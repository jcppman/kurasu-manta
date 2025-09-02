import db from '@/db'
import { withRetry } from '@/lib/async'
import { logger } from '@/lib/utils'
import {
  MAX_LLM_RETRY_TIMES,
  MAX_LOW_PRIORITY_GRAMMAR,
  MAX_LOW_PRIORITY_VOCABULARIES,
  SENTENCE_COUNT_GRAMMAR,
  SENTENCE_COUNT_OTHER_VOCABULARY,
  SENTENCE_COUNT_PHRASE_PATTERN,
  SENTENCE_GENERATION_BATCH_SIZE,
} from '@/workflows/minna-jp-1/constants'
import { sanitizeVocabularyContent } from '@/workflows/minna-jp-1/utils'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { CourseContentService } from '@kurasu-manta/content-schema/service'
import type { Annotation } from '@kurasu-manta/content-schema/zod'
import {
  type Grammar,
  type KnowledgePoint,
  type Vocabulary,
  isGrammar,
  isVocabulary,
} from '@kurasu-manta/content-schema/zod'
import { generateObject } from 'ai'
import random from 'random'
import { isKanji } from 'wanakana'
import { z } from 'zod'

export function knowledgeDetails(input: KnowledgePoint, parentTagName = 'knowledge'): string {
  let result = `<content>${sanitizeVocabularyContent(input.content)}</content>`
  if (input.explanation) {
    // Use Simplified Chinese as primary language for AI generation context
    const explanation =
      typeof input.explanation === 'string'
        ? input.explanation
        : input.explanation.zhCN || input.explanation.zhTW || input.explanation.enUS
    result += `<explain>${explanation}</explain>`
  }
  if (isVocabulary(input) && input.pos) {
    result += `<pos>${input.pos}</pos>`
  }
  return `<${parentTagName} id="${input.id}">${result}</${parentTagName}>`
}

async function repairAnnotatedSentence(
  annotatedSentence: string,
  originalSentence: string
): Promise<string> {
  logger.debug(`correcting furigana annotations for ${annotatedSentence}`)
  logger.debug(`original sentence: ${originalSentence}`)
  const prompt = `
You are a Japanese annotation expert tasked with fixing malformed furigana annotations in sentences. Your job is to produce a perfectly annotated version following these strict rules:

- Only annotate kanji with their proper reading in [brackets] (furigana).
- For compound words (kanji compounds), annotate as a single unit with the complete reading (e.g., 今日[きょう], 学校[がっこう]).
- For words containing kanji followed by okurigana or kana (e.g. ごはん or 晩ごはん), annotate only the kanji portion, giving the reading for just the kanji, not the entire word. (e.g., 晩[ばん]ごはん—not 晩ごはん[ばんごはん]).
- Annotate kanji individually if not part of a compound (e.g., 古[ふる]い).
- Do not add annotations to non-kanji characters (hiragana, katakana, punctuation, etc.).
- Do not change hiragana words to kanji or correct spelling—preserve the sentence structure entirely.
- Do not add spaces or extra punctuation in or around furigana brackets.
- Annotate each eligible kanji in the sentence exactly once, in accordance with natural Japanese reading standards.

Fix the malformed annotation in the given sentence and return ONLY the correctly annotated sentence.

---

# Steps

1. Check each annotated word for adherence to the rules above, especially:
    - For words with kanji followed by hiragana or multiple kanji in a compound, confirm only the kanji portion is annotated, not the whole word or compound unless specifying a full compound reading.
2. Remove or adjust any over-annotations (e.g., annotating non-kanji or the full word including okurigana).
3. Ensure all formatting standards (no spaces or extra punctuation) are maintained.
4. Preserve all other sentence elements and formatting—only change the annotation.

# Output Format

- Output the corrected annotated sentence as one line, no extra comments or formatting.

# Examples

**Original:**
音楽を聞いています。
**Malformed Annotated:**
音[おん]楽[がく]を聞[き]いています。
**Corrected:**
音楽[おんがく]を聞[き]いています。

**Original:**
「お願いします」と言いました。
**Malformed Annotated:**
「お願い[おねがい]します」と言[い]いました。
**Corrected:**
「お願い[ねが]します」と言[い]いました。

(For brevity, real examples may include longer sentences with multiple compound and okurigana cases. Use the above pattern and guidelines.)

# Notes

- Pay special attention to compound words with attached hiragana (e.g., 面白い: only 面白 gets annotation, not the whole word).
- Do not introduce errors by omitting required annotations for eligible kanji or by annotating hiragana/katakana.

**Reminder:** Fix malformed annotation by precisely applying the kanji annotation guidelines, especially for compounds and words with okurigana. Return only the properly annotated sentence.

ORIGINAL SENTENCE: "${originalSentence}"
MALFORMED ANNOTATED SENTENCE: "${annotatedSentence}"

Fix the malformed annotation and return ONLY the corrected annotated sentence.
  `

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt,
    schema: z.object({
      repairedSentence: z.string(),
    }),
  })

  return object.repairedSentence.trim()
}

export async function generateFuriganaAnnotations(
  sentence: string,
  vocabularies: Vocabulary[]
): Promise<Annotation[]> {
  // Build vocabulary pronunciation context from provided vocabularies
  const vocabularyContext = vocabularies
    .filter((vocab) => vocab.annotations.some((ann) => ann.type === 'furigana'))
    .map((vocab) => {
      const furiganaAnnotations = vocab.annotations
        .filter((ann) => ann.type === 'furigana')
        .sort((a, b) => b.loc - a.loc)
      let content = vocab.content
      for (const ann of furiganaAnnotations) {
        content = `${content.slice(0, ann.loc + ann.len)}[${ann.content}]${content.slice(ann.loc + ann.len)}`
      }
      return content
    })
    .join('\n')

  const prompt = `
# Japanese Furigana Annotation Prompt

You are a Japanese language annotation expert.
Your task is to **add furigana ONLY to existing kanji characters** in a Japanese sentence.

**CRITICAL CONSTRAINTS**:
- **NEVER change, replace, or rewrite any part of the sentence.**
- **Hiragana, katakana, punctuation, and words already written in kana MUST remain untouched.**
- If the input contains no kanji, the output must be identical to the input.
- Do NOT convert kana into kanji (e.g., "あなた" must never become "貴方").

---

## ANNOTATION RULES
1. **Format**: Use \`kanji[hiragana]\` for each kanji or compound word.
   - Example: \`学校[がっこう]\`, \`食[た]べます\`.
   - Kana outside of the brackets must remain exactly where it is.
2. **Compound Words**: Annotate as a single unit when it is a standard compound (学校, 病院, 図書館, 日本, etc.).
   - Example: \`晩ごはん → 晩[ばん]ごはん\`.
3. **Okurigana**: Annotate only the kanji stem.
   - Correct: \`買[か]いました\`
   - Incorrect: \`買い[かい]ました\`
4. **Kana Preservation**:
   - NEVER wrap kana inside brackets.
   - NEVER replace kana with kanji or kanji with kana.
5. **Vocabulary Priority**: Always use readings from the vocabulary list when available.
6. **Katakana**: Do not annotate katakana words.

---

## VOCABULARY PRONUNCIATIONS
- 晩[ばん]ごはん
- 食[た]べます

---

## CONTEXT READING RULES
- 何ですか → 何[なん]ですか
- 三人 → 三[さん]人[にん]
- 人が → 人[ひと]が
- 一つ → 一[ひと]つ
- 一番 → 一[いち]番[ばん]

---

## OUTPUT FORMAT
- Return ONLY the fully annotated Japanese sentence.
- Do NOT provide explanations, JSON, or lists.
- If no kanji are present, return the sentence unchanged.

---

## Examples

**Input:** 古い傘を買いました
**Output:** 古[ふる]い傘[かさ]を買[か]いました

**Input:** 私は学校に行きます
**Output:** 私[わたし]は学校[がっこう]に行[い]きます

**Input:** 今日は何時ですか
**Output:** 今日[きょう]は何[なん]時[じ]ですか

**Input:** あなたは学生ですか。
**Output:** あなたは学生[がくせい]ですか。 (no rewriting of あなた)

**Input:** コンピュータを使います
**Output:** コンピュータを使[つか]います

---

## Negative Examples (Do NOT produce these)

- Input: あなたは学生ですか。
  Wrong Output: 貴方[あなた]は学生[がくせい]ですか。
  (**Never replace hiragana-only words with kanji**)

- Input: 晩ごはんを食べます。
  Wrong Output: 晩ごはん[ばんごはん]を食[た]べます。
  (**Do not extend brackets over kana—晩[ばん]ごはん is correct**)

- Input: 買いました
  Wrong Output: 買い[かい]ました
  (**Never bracket okurigana; only annotate the kanji stem**)

---

VOCABULARY PRONUNCIATIONS:
${vocabularyContext || 'None provided'}

IMPORTANT: If any words in the sentence appear in the vocabulary list above, use EXACTLY those pronunciations as compound words. For example, if the vocabulary shows "今日[きょう]", then annotate 今日 as a single compound: 今日[きょう].

SENTENCE TO ANNOTATE:
"${sentence}"
  `

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt,
    schema: z.object({
      annotatedSentence: z.string(),
    }),
  })

  // Parse the annotated sentence to generate position-based annotations
  const maxRepairAttempts = 3
  let annotatedSentence = object.annotatedSentence

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    try {
      return parseAnnotatedSentenceToAnnotations(annotatedSentence, sentence)
    } catch (error) {
      if (attempt === maxRepairAttempts) {
        // Final attempt failed, throw the original error
        logger.error(
          `Annotation parsing failed after ${maxRepairAttempts} repair attempts for sentence: "${sentence}"`
        )
        throw error
      }

      // Try to repair the annotation
      logger.warn(`Annotation parsing failed (attempt ${attempt + 1}), trying to repair: ${error}`)
      try {
        annotatedSentence = await repairAnnotatedSentence(annotatedSentence, sentence)
        logger.info(`Repaired annotation: "${annotatedSentence}"`)
      } catch (repairError) {
        logger.error(`Annotation repair failed: ${repairError}`)
        throw error // Throw original parsing error if repair fails
      }
    }
  }

  throw new Error('Unexpected end of repair loop')
}

export function parseAnnotatedSentenceToAnnotations(
  annotatedSentence: string,
  originalSentence: string
): Annotation[] {
  const annotations: Annotation[] = []
  let originalPos = 0
  let annotatedPos = 0
  let lastKanjiStart = -1 // Track the start of the current kanji sequence

  while (annotatedPos < annotatedSentence.length) {
    const char = annotatedSentence[annotatedPos]

    if (char === '[') {
      // Find the closing bracket
      const closingBracket = annotatedSentence.indexOf(']', annotatedPos)
      if (closingBracket === -1) {
        throw new Error(
          `Malformed annotation: missing closing bracket after position ${annotatedPos}`
        )
      }

      // Extract furigana content
      const furigana = annotatedSentence.slice(annotatedPos + 1, closingBracket)

      if (originalPos === 0) {
        throw new Error(
          'Furigana annotation found at beginning of sentence with no preceding kanji'
        )
      }

      // Find the start and end of the kanji sequence that this furigana applies to
      const kanjiStart = lastKanjiStart >= 0 ? lastKanjiStart : originalPos - 1
      const kanjiEnd = originalPos - 1

      // Ensure we have a valid kanji sequence
      if (kanjiStart > kanjiEnd) {
        throw new Error(`Invalid kanji sequence: start ${kanjiStart} > end ${kanjiEnd}`)
      }

      // Verify that the sequence contains at least one kanji
      let allKanji = true
      for (let i = kanjiStart; i <= kanjiEnd; i++) {
        if (!isKanji(originalSentence[i])) {
          allKanji = false
          break
        }
      }

      let drop = false
      if (!allKanji) {
        if (originalSentence.slice(kanjiEnd + 1 - furigana.length, kanjiEnd + 1) === furigana) {
          drop = true
          logger.info(
            `Dropping unnecessary furigana annotation "${furigana}" after non-kanji sequence "${originalSentence.slice(kanjiStart, kanjiEnd + 1)}" at position ${kanjiStart}`
          )
        } else {
          throw new Error(
            `Furigana annotation "${furigana}" found after sequence containing non-kanji "${originalSentence.slice(kanjiStart, kanjiEnd + 1)}" at position ${kanjiStart}`
          )
        }
      }

      const kanjiLength = kanjiEnd - kanjiStart + 1
      if (!drop) {
        annotations.push({
          loc: kanjiStart,
          len: kanjiLength,
          type: 'furigana',
          content: furigana.trim(),
        })
      }

      // Reset kanji tracking
      lastKanjiStart = -1

      // Move past the furigana annotation
      annotatedPos = closingBracket + 1
    } else {
      // Regular character - should match the original
      if (originalPos >= originalSentence.length) {
        throw new Error('Annotated sentence is longer than original sentence')
      }

      if (char !== originalSentence[originalPos]) {
        throw new Error(
          `Character mismatch at position ${originalPos}: expected '${originalSentence[originalPos]}', got '${char}'`
        )
      }

      // Track kanji sequences for compound word detection
      if (isKanji(char)) {
        if (lastKanjiStart === -1) {
          lastKanjiStart = originalPos
        }
        // Continue the current kanji sequence
      } else {
        // Non-kanji character breaks the sequence
        lastKanjiStart = -1
      }

      annotatedPos++
      originalPos++
    }
  }

  // Check that we've consumed the entire original sentence
  if (originalPos !== originalSentence.length) {
    throw new Error('Original sentence is longer than annotated sentence')
  }

  return annotations
}

async function generateTranslationsForSentences(
  sentences: string[]
): Promise<{ zhCN: string; zhTW: string; enUS: string }[]> {
  const prompt = `
You are a professional translator providing accurate translations of Japanese sentences.

Your task is to translate each Japanese sentence into Simplified Chinese (zhCN), Traditional Chinese (zhTW), and English (enUS).

TRANSLATION GUIDELINES:
- Provide natural, accurate translations that convey the original meaning
- Simplified Chinese (zhCN) should use Simplified Chinese characters
- Traditional Chinese (zhTW) should use Traditional Chinese characters with Taiwan conventions
- English translations should be clear and natural
- Maintain the tone and style of the original sentence
- For formal Japanese sentences, use appropriate formal language in translations
- For casual Japanese sentences, use appropriate casual language in translations

OUTPUT FORMAT:
Return translations in the same order as the input sentences.

SENTENCES TO TRANSLATE:
${sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n')}
  `

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt,
    schema: z.object({
      translations: z.array(
        z.object({
          zhCN: z.string(),
          zhTW: z.string(),
          enUS: z.string(),
        })
      ),
    }),
  })

  // Validate all translations
  return object.translations.map((translation, index) => {
    if (!translation?.zhCN?.trim() || !translation?.zhTW?.trim() || !translation?.enUS?.trim()) {
      throw new Error(`Empty translation generated for sentence: ${sentences[index]}`)
    }
    return {
      zhCN: translation.zhCN.trim(),
      zhTW: translation.zhTW.trim(),
      enUS: translation.enUS.trim(),
    }
  })
}

export async function generateSentenceExplanations(
  sentences: string[]
): Promise<{ zhCN: string; zhTW: string; enUS: string }[]> {
  if (sentences.length === 0) {
    return []
  }

  return withRetry(() => generateTranslationsForSentences(sentences), {
    maxAttempts: MAX_LLM_RETRY_TIMES,
  })
}

export function calculateVocabularyAnnotationsFromTokens(
  tokens: string[],
  vocabularyItems: Vocabulary[]
): Annotation[] {
  const annotations: Annotation[] = []
  let currentPosition = 0

  // Create a map of vocabulary content to ID for quick lookup
  const vocabMap = new Map<string, number>()
  for (const vocab of vocabularyItems) {
    vocabMap.set(vocab.content, vocab.id)
  }

  for (const token of tokens) {
    const tokenLength = token.length

    // Check if this token is a vocabulary item
    const vocabId = vocabMap.get(token)
    if (vocabId) {
      annotations.push({
        loc: currentPosition,
        len: tokenLength,
        type: 'vocabulary',
        content: token,
        id: vocabId,
      })
    }

    currentPosition += tokenLength
  }

  return annotations
}

export function getTargetSentenceCount(type: 'vocabulary' | 'grammar', pos?: string): number {
  if (type === 'vocabulary') {
    // Check if it's 句型 (phrase pattern)
    if (pos === '句型') {
      return SENTENCE_COUNT_PHRASE_PATTERN
    }
    return SENTENCE_COUNT_OTHER_VOCABULARY
  }
  if (type === 'grammar') {
    return SENTENCE_COUNT_GRAMMAR
  }
  return SENTENCE_COUNT_OTHER_VOCABULARY
}

// Keep the old function for backward compatibility in other parts of the code
export function getTargetSentenceCountForKnowledgePoint(knowledgePoint: KnowledgePoint): number {
  if (isVocabulary(knowledgePoint)) {
    return getTargetSentenceCount('vocabulary', knowledgePoint.pos)
  }
  if (isGrammar(knowledgePoint)) {
    return getTargetSentenceCount('grammar')
  }
  return SENTENCE_COUNT_OTHER_VOCABULARY
}

interface SentenceRating {
  content: string
  score: number
  reasoning: string
}

async function rateSentences(
  sentences: string[],
  targetKnowledge: KnowledgePoint
): Promise<SentenceRating[]> {
  const prompt = `
You are a Japanese language expert rating sentences for educational use. You must be critical and selective - most sentences should receive scores below 8.

RATING CRITERIA (1-10 scale, be strict):

**HIGH SCORES (8-10)**: Reserve for exceptional sentences that are:
- Simple and natural (something you'd actually hear/say)
- Perfect demonstration of target knowledge in realistic context
- Appropriate vocabulary combinations that make sense

**MEDIUM SCORES (5-7)**: For sentences that are:
- Grammatically correct but awkward or contrived
- Unnatural combinations (like random facts: "神戸は中国じゃありません")
- Overly complex for the target knowledge level

**LOW SCORES (1-4)**: For sentences that are:
- Grammatically incorrect
- Very unnatural or nonsensical
- Poor demonstration of target knowledge
- Confusing for learners

EXAMPLES OF WHAT TO PREFER:
- For "銀行員": "あの方は銀行員じゃありません" (natural context)
- NOT: "神戸は中国じゃありません" (weird factual statement)

Be critical - only give high scores to truly excellent, natural sentences that students would benefit from learning.

Rate each sentence with a score (1-10) and brief reasoning.

TARGET KNOWLEDGE POINT TO DEMONSTRATE:
${knowledgeDetails(targetKnowledge)}

SENTENCES TO RATE:
${sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n')}
  `

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    temperature: 0.3, // Lower temperature for more consistent, critical ratings
    prompt,
    schema: z.object({
      ratings: z.array(
        z.object({
          sentenceIndex: z.number(),
          score: z.number().min(1).max(10),
          reasoning: z.string(),
        })
      ),
    }),
  })

  return object.ratings.map((rating, index) => ({
    content: sentences[rating.sentenceIndex - 1] || sentences[index],
    score: rating.score,
    reasoning: rating.reasoning,
  }))
}

interface GeneratedSentence {
  content: string
  tokens: string[]
  explanation: {
    zhCN: string
    enUS: string
  }
  vocabularyIds: number[]
  grammarIds: number[]
  annotations: Annotation[]
}

interface KnowledgeBucket {
  vocabularies: Vocabulary[]
  grammar: Grammar[]
}

interface ValidationResult {
  results: Array<{
    sentenceIndex: number
    grammaticallyValid: boolean
    pronunciationValid: boolean
    overallValid: boolean
    reason?: string
  }>
}

export async function validateSentences(
  sentences: Omit<GeneratedSentence, 'annotations' | 'explanation'>[],
  availableVocabularies: Vocabulary[]
): Promise<ValidationResult> {
  if (sentences.length === 0) {
    return { results: [] }
  }

  // First, remove duplicates within the input batch
  const seenContent = new Set<string>()
  const deduplicatedSentences = sentences.filter((sentence, index) => {
    const normalizedContent = sentence.content.trim()
    if (seenContent.has(normalizedContent)) {
      logger.warn(`Duplicate sentence found in batch at index ${index}: "${sentence.content}"`)
      return false
    }
    seenContent.add(normalizedContent)
    return true
  })

  if (deduplicatedSentences.length < sentences.length) {
    logger.info(
      `Removed ${sentences.length - deduplicatedSentences.length} duplicate sentences from batch`
    )
  }

  // If all sentences were duplicates, return empty results
  if (deduplicatedSentences.length === 0) {
    return { results: [] }
  }

  // Get existing sentences from ALL related knowledge points to check for duplicates
  const allKnowledgePointIds = [
    ...new Set(deduplicatedSentences.flatMap((s) => [...s.vocabularyIds, ...s.grammarIds])),
  ]

  let existingSentences: { content: string }[] = []
  if (allKnowledgePointIds.length > 0) {
    const courseContentService = new CourseContentService(db)
    existingSentences =
      await courseContentService.getSentencesByKnowledgePointIds(allKnowledgePointIds)
  }

  // Build vocabulary context for pronunciation validation
  const allTargetVocabularyIds = [...new Set(deduplicatedSentences.flatMap((s) => s.vocabularyIds))]
  const targetVocabularies = availableVocabularies.filter((v) =>
    allTargetVocabularyIds.includes(v.id)
  )

  const vocabularyContext = targetVocabularies
    .filter((vocab) => vocab.annotations.some((ann) => ann.type === 'furigana'))
    .map((vocab) => {
      const furiganaAnnotation = vocab.annotations.find((ann) => ann.type === 'furigana')
      return `${vocab.content}[${furiganaAnnotation?.content}] (ID: ${vocab.id})`
    })
    .join('\n')

  // Build existing sentences context for duplicate detection
  const existingSentencesContext =
    existingSentences.length > 0
      ? existingSentences.map((s, i) => `${i + 1}. ${s.content}`).join('\n')
      : 'None'

  const prompt = `
You are a Japanese language expert evaluating multiple sentences for a Japanese textbook.

EVALUATION CRITERIA:
Each sentence must pass ALL these checks to be valid:

1. **DUPLICATE CHECK**: Not substantially similar to existing sentences (ignoring punctuation/whitespace)
2. **GRAMMAR CHECK**: Grammatically correct with proper particles, verb conjugations, structure
3. **PRONUNCIATION CHECK**: Target vocabulary maintains expected pronunciations in context
4. **NATURALNESS CHECK**: Sounds like something a native speaker would actually say
5. **EDUCATIONAL SUITABILITY**: Appropriate for language learners

REJECT SENTENCES IF:
- Grammar violations (incorrect particles, verb forms, structure)
- Honorific misuse (using respectful language incorrectly)
- Logical inconsistencies (tense-time mismatches)
- Unnatural constructions native speakers wouldn't use
- Too similar to existing sentences
- Target vocabulary changes pronunciation from expected reading

PRONUNCIATION VALIDATION RULES:
- Check if vocabulary appears in contexts where pronunciation would change
- Common changes: numbers with counters (九 from 'きゅう' to 'ここの' in 九つ)
- Only mark pronunciation invalid if it definitively changes from stored reading

For each sentence, provide:
- grammaticallyValid: true/false
- pronunciationValid: true/false
- overallValid: true only if BOTH grammar and pronunciation are valid AND not duplicate
- reason: Brief explanation if invalid

SENTENCES TO EVALUATE:
${deduplicatedSentences
  .map((s, i) => `${i + 1}. "${s.content}" (Uses vocabulary IDs: ${s.vocabularyIds.join(', ')})`)
  .join('\n')}

TARGET VOCABULARY WITH EXPECTED PRONUNCIATIONS:
${vocabularyContext || 'None with furigana'}

EXISTING SENTENCES (avoid duplicates):
${existingSentencesContext}
`

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt,
    schema: z.object({
      results: z.array(
        z.object({
          sentenceIndex: z.number(),
          grammaticallyValid: z.boolean(),
          pronunciationValid: z.boolean(),
          overallValid: z.boolean(),
          reason: z.string().optional(),
        })
      ),
    }),
  })

  // Validate results match input sentences
  const results = object.results.map((result, index) => {
    const expectedIndex = index + 1
    if (result.sentenceIndex !== expectedIndex) {
      logger.warn(
        `Validation result index mismatch: expected ${expectedIndex}, got ${result.sentenceIndex}`
      )
    }
    return {
      ...result,
      sentenceIndex: index, // Use array index for consistency
    }
  })

  // Log validation results
  results.forEach((result, index) => {
    if (!result.overallValid) {
      logger.warn(`Sentence validation failed: "${sentences[index].content}" - ${result.reason}`)
    }
  })

  return { results }
}

interface PrioritizedBuckets {
  target: KnowledgePoint
  high: KnowledgeBucket
  low: KnowledgeBucket
}
export interface GenerateSentencesForScopeParameters {
  buckets: PrioritizedBuckets
  amount: number
}

export async function generateSentencesFromPrioritizedBuckets({
  buckets,
  amount,
}: GenerateSentencesForScopeParameters): Promise<GeneratedSentence[]> {
  const { target, high, low } = buckets

  // Get existing sentences for the target knowledge point to avoid generating similar ones
  const courseContentService = new CourseContentService(db)
  const existingSentences = await courseContentService.getSentencesByKnowledgePointIds([target.id])

  const existingSentencesList = existingSentences.map((s) => s.content)
  const existingSentencesSection =
    existingSentencesList.length > 0
      ? `${existingSentencesList.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : ''

  const batchSize = Math.max(SENTENCE_GENERATION_BATCH_SIZE, amount * 3)
  const prompt = `
You are a Japanese language teacher creating example sentences for students learning Japanese.

CRITICAL REQUIREMENTS:
1. PRIMARY FOCUS: Each sentence MUST clearly demonstrate the target knowledge point
2. PRONUNCIATION CONSISTENCY: Use target vocabulary ONLY in contexts where it maintains its stored pronunciation
3. SIMPLICITY: Keep sentences short and use basic grammar patterns
4. NATURALNESS: Sound like real Japanese that natives would actually say
5. VOCABULARY CONSTRAINT: Only use vocabulary from the provided lists above

GENERATION GUIDELINES:
- Create exactly ${batchSize} sentences
- Each sentence should clearly show how to use the TARGET knowledge point
- PRONUNCIATION RULE: Ensure vocabulary maintains its expected pronunciation in all contexts
  * Avoid contexts that change vocabulary pronunciation (e.g., numbers with counters if pronunciation differs)
  * Use vocabulary in forms that match their stored furigana readings
- Use HIGH priority knowledge naturally when it improves the sentence
- Use LOW priority knowledge only if it makes sentences more natural
- Prefer simple, direct sentences over complex constructions
- Vary sentence types: statements, questions, negative forms
- Include natural punctuation and/or particles (e.g., "今、三時五分です" instead of "今三時五分です")

TOKENIZATION OUTPUT REQUIREMENT:
For each sentence, provide a tokenized version:
- Split into meaningful tokens including ALL characters
- Keep vocabulary items from the provided list as complete tokens
- Include punctuation marks as separate tokens
- Particles and function words should be separate tokens

EXAMPLES:
- Sentence: "私は日本人です" → Tokens: ["私", "は", "日本人", "です"]
- Sentence: "失礼ですが、お名前は何ですか。" → Tokens: ["失礼", "ですが", "、", "お名前", "は", "何", "ですか", "。"]
- Sentence: "今、三時五分です" → Tokens: ["今", "、", "三時五分", "です"]

Create clear, simple sentences that help students understand the target knowledge point.

Generate exactly ${batchSize} simple, natural Japanese sentences.

PRIMARY TARGET (MUST demonstrate clearly):
${knowledgeDetails(target, isVocabulary(target) ? 'vocabulary' : 'grammar')}

EXISTING SENTENCES FOR TARGET KNOWLEDGE (avoid generating similar ones):
${existingSentencesSection}

SUPPORTING KNOWLEDGE (use naturally when appropriate):
=== HIGH PRIORITY ===
<vocabulary>
${high.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${high.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>

=== LOW PRIORITY (background knowledge) ===
<vocabulary>
${low.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${low.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>
  `

  const allVocabularies = [
    ...(isVocabulary(target) ? [target] : []),
    ...high.vocabularies,
    ...low.vocabularies,
  ]

  const {
    object: { sentences },
  } = await generateObject({
    model: openai('gpt-4.1'),
    temperature: 1,
    prompt,
    schema: z.object({
      sentences: z.array(
        z.object({
          content: z.string(),
          tokens: z.array(z.string()),
          vocabularyIds: z.array(z.number()),
          grammarIds: z.array(z.number()),
        })
      ),
    }),
  })

  logger.debug(
    `Generated ${sentences.length} sentences: \n${sentences.map((s) => s.content).join('\n')}`
  )

  const allKnowledgePointIds = new Set([
    isVocabulary(target) ? `v:${target.id}` : `g:${target.id}`,
    ...high.vocabularies.map((v) => `v:${v.id}`),
    ...high.grammar.map((g) => `g:${g.id}`),
    ...low.vocabularies.map((v) => `v:${v.id}`),
    ...low.grammar.map((g) => `g:${g.id}`),
  ])

  // Validate IDs first (quick check)
  for (const sentence of sentences) {
    for (const id of sentence.vocabularyIds) {
      if (!allKnowledgePointIds.has(`v:${id}`)) {
        throw new Error(`Invalid vocabulary ID found: ${id} in sentence: ${sentence.content}`)
      }
    }
    for (const id of sentence.grammarIds) {
      if (!allKnowledgePointIds.has(`g:${id}`)) {
        throw new Error(`Invalid grammar ID found: ${id} in sentence: ${sentence.content}`)
      }
    }
  }

  // Batch validate sentences
  logger.info(`Validating ${sentences.length} sentences`)
  const validationResult = await validateSentences(sentences, allVocabularies)

  // Get valid sentences
  const validSentences = sentences
    .filter((_, index) => validationResult.results[index]?.overallValid)
    .map((sentence) => ({
      ...sentence,
      content: sentence.content.replace(/ /g, '').trim(),
    }))

  if (validSentences.length === 0) {
    logger.warn('No valid sentences generated')
    return []
  }

  // Rate sentences and select the best one
  logger.info(`Rating ${validSentences.length} sentences`)
  const ratings = await rateSentences(
    validSentences.map((s) => s.content),
    target
  )

  // Sort by score and select top sentences
  const topRatedSentences = ratings
    .filter((r) => r.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, amount)

  logger.debug(`Sentence ratings: ${JSON.stringify(topRatedSentences, null, 2)}`)
  logger.info(`Selected ${topRatedSentences.length} top-rated sentences`)
  topRatedSentences.forEach((rating, index) => {
    logger.info(`#${index + 1}: ${rating.content} (score: ${rating.score}/10)`)
  })

  // Get the selected sentences with their data
  const selectedSentences = topRatedSentences
    .map((rating) => validSentences.find((s) => s.content === rating.content))
    .filter(Boolean) as typeof validSentences

  // Generate translations
  logger.info(`Generating translations for ${selectedSentences.length} sentences`)
  const translations = await generateSentenceExplanations(selectedSentences.map((s) => s.content))

  // Add explanations
  const sentencesWithExplanations = selectedSentences.map((sentence, index) => ({
    ...sentence,
    explanation: translations[index],
    annotations: calculateVocabularyAnnotationsFromTokens(sentence.tokens, allVocabularies),
  }))

  // Return sentences without annotations (annotations will be generated in a separate step)
  logger.info(
    `Generated ${sentencesWithExplanations.length} sentences (annotations will be generated separately)`
  )

  return sentencesWithExplanations.map((sentence) => ({
    ...sentence,
  }))
}

export async function getPrioritizedKnowledgePointsByLessonNumber(
  lessonNumber: number
): Promise<PrioritizedBuckets> {
  const courseContentService = new CourseContentService(db)

  // get all lessons directly as there won't be too much
  const lessons = await courseContentService.getLessonsInScope(lessonNumber)
  const mustUseLessons = lessons.filter((l) => l.number === lessonNumber)

  // collect must use lessons knowledge points first
  const targetKnowledgePoints = (
    await Promise.all(
      mustUseLessons.flatMap((l) => courseContentService.getLessonById(l.id, { withContent: true }))
    )
  ).flatMap((l) => l?.knowledgePoints ?? [])

  const nearbyLessons = lessons.filter((l) => l.number === lessonNumber - 1)
  const nearbyKnowledgePoints = (
    await Promise.all(
      nearbyLessons.flatMap((l) => courseContentService.getLessonById(l.id, { withContent: true }))
    )
  ).flatMap((l) => l?.knowledgePoints ?? [])

  targetKnowledgePoints.push(...nearbyKnowledgePoints)

  // Calculate sentence deficits for prioritization
  const countMap = await courseContentService.getSentenceCountsByKnowledgePointIds(
    targetKnowledgePoints.map((k) => k.id)
  )

  // Sort knowledge points by deficit (target - current), highest deficit first
  const sortedByDeficit = targetKnowledgePoints
    .map((kp) => {
      const currentCount = countMap.get(kp.id) ?? 0
      const targetCount = getTargetSentenceCountForKnowledgePoint(kp)
      const deficit = Math.max(0, targetCount - currentCount)
      return { knowledgePoint: kp, deficit, currentCount, targetCount }
    })
    .sort((a, b) => {
      const diff = b.deficit - a.deficit
      if (diff !== 0) return diff // sort by deficit first

      // grammar has higher priority than vocabulary
      if (isGrammar(a.knowledgePoint) && isVocabulary(b.knowledgePoint)) return -1
      if (isVocabulary(a.knowledgePoint) && isGrammar(b.knowledgePoint)) return 1
      return 0
    })

  // Select the knowledge point with highest deficit as target
  const target = sortedByDeficit[0]?.knowledgePoint
  if (!target) {
    throw new Error('No knowledge points available for sentence generation')
  }

  // Create high and low priority buckets from remaining knowledge points
  const remainingKnowledgePoints = sortedByDeficit.slice(1).map((item) => item.knowledgePoint)

  const high: KnowledgeBucket = { vocabularies: [], grammar: [] }
  const low: KnowledgeBucket = { vocabularies: [], grammar: [] }

  // Split remaining points - high priority gets first half, low gets second half
  const midpoint = Math.floor(remainingKnowledgePoints.length / 2)
  const highPriorityPoints = remainingKnowledgePoints.slice(0, midpoint)
  const lowPriorityPoints = remainingKnowledgePoints.slice(midpoint)

  // Categorize by type
  for (const kp of highPriorityPoints) {
    if (isVocabulary(kp)) high.vocabularies.push(kp)
    else if (isGrammar(kp)) high.grammar.push(kp)
  }

  for (const kp of lowPriorityPoints) {
    if (isVocabulary(kp)) low.vocabularies.push(kp)
    else if (isGrammar(kp)) low.grammar.push(kp)
  }

  // Shuffle and limit items
  high.vocabularies = random.shuffle(high.vocabularies)
  high.grammar = random.shuffle(high.grammar)
  low.vocabularies = random.shuffle(low.vocabularies).slice(0, MAX_LOW_PRIORITY_VOCABULARIES)
  low.grammar = random.shuffle(low.grammar).slice(0, MAX_LOW_PRIORITY_GRAMMAR)

  return {
    target,
    high: {
      vocabularies: high.vocabularies,
      grammar: high.grammar,
    },
    low: {
      vocabularies: low.vocabularies,
      grammar: low.grammar,
    },
  }
}

export async function generateSentencesForLessonNumber(
  lessonNumber: number
): Promise<GeneratedSentence[]> {
  const buckets = await getPrioritizedKnowledgePointsByLessonNumber(lessonNumber)
  // report the target and supporting knowledge
  logger.info(
    `Generating sentences for lesson: ${JSON.stringify(
      {
        lessonNumber,
        target: `${buckets.target.content} (${isVocabulary(buckets.target) ? 'vocab' : 'grammar'})`,
      },
      null,
      2
    )}`
  )

  return generateSentencesFromPrioritizedBuckets({
    buckets,
    amount: getTargetSentenceCountForKnowledgePoint(buckets.target),
  })
}
