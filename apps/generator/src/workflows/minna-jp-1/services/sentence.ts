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
    result += `<explain>${input.explanation.zhCN}</explain>`
  }
  return `<${parentTagName} id="${input.id}">${result}</${parentTagName}>`
}

async function repairAnnotatedSentence(
  annotatedSentence: string,
  originalSentence: string,
  error: string
): Promise<string> {
  const prompt = `
You are a Japanese annotation expert fixing malformed furigana annotations.

CORRECT ANNOTATION FORMAT:
1. Each kanji gets individual furigana: kanji[hiragana]
2. For compound words with okurigana, only annotate the kanji reading portion:
   - CORRECT: お願[ねが]い (only the kanji 願 gets [ねが])
   - WRONG: お願[おねが]い (includes okurigana in annotation)
3. No spaces, no extra punctuation in brackets
4. Keep all other characters exactly as they are

EXAMPLES OF CORRECT REPAIRS:
- "お名[な]前[まえ]は何[なん]ですか" ✓
- "中[ちゅう]国[こく]人[じん]です" ✓
- "お願[ねが]いします" ✓
- "学[がく]校[こう]に行[い]きます" ✓

PROBLEM: The annotation parsing failed with this error: "${error}"

ORIGINAL SENTENCE: "${originalSentence}"
MALFORMED ANNOTATION: "${annotatedSentence}"

Fix the malformed annotation and return ONLY the corrected annotated sentence.
  `

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt,
    schema: z.object({
      repairedSentence: z.string(),
    }),
  })

  return object.repairedSentence.trim()
}

export async function generateFuriganaAnnotations(sentence: string): Promise<Annotation[]> {
  const prompt = `
You are a Japanese language annotation expert. Your task is to add furigana annotations for ALL kanji characters in a Japanese sentence.

ANNOTATION RULES:
1. Add furigana for ALL kanji characters using the format: kanji[hiragana]
2. IMPORTANT: Annotate EACH kanji individually, even in compound words (e.g., 家[か]族[ぞく], NOT 家族[かぞく])
3. CRITICAL: For compound words with okurigana (trailing hiragana), only annotate the kanji reading portion:
   - CORRECT: お願[ねが]い (kanji 願 gets [ねが], okurigana い stays separate)
   - WRONG: お願[おねが]い (includes okurigana お and い in the reading)
   - CORRECT: 買[か]い (kanji 買 gets [か], okurigana い stays separate)
   - WRONG: 買い[かい] (includes okurigana い in the reading)
4. Do NOT add furigana to hiragana, katakana, or punctuation
5. Keep all other characters exactly as they are
6. CRITICAL: Use context-appropriate readings - consider the grammatical position and meaning in the sentence

CONTEXT-DEPENDENT READING EXAMPLES:
- 何 as "what" in questions: なん (何ですか → 何[なん]ですか)
- 何 as "how many" with counters: なん (何人 → 何[なん]人[にん])
- 何 as indefinite "something": なに (何か → 何[なに]か)
- 一 as number "one": いち (一つ → 一[ひと]つ)
- 一 in compound words: いっ (一番 → 一[いち]番[ばん])
- 人 after numbers: にん (三人 → 三[さん]人[にん])
- 人 as "person": ひと (人が → 人[ひと]が)

OUTPUT FORMAT:
Return the sentence with furigana annotations in brackets. Do NOT provide JSON or any other format.

EXAMPLES:
Input: "古い傘を買いました"
Output: "古[ふる]い傘[かさ]を買[か]いました"

Input: "私は学校に行きます"
Output: "私[わたし]は学[がく]校[こう]に行[い]きます"

Input: "お名前は何ですか"
Output: "お名[な]前[まえ]は何[なん]ですか"

Input: "何人いますか"
Output: "何[なん]人[にん]いますか"

Input: "中国人です"
Output: "中[ちゅう]国[こく]人[じん]です"

Input: どうぞよろしくお願いします。
Output: どうぞよろしくお願[ねが]いします。

Return only the annotated sentence with no additional text.

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
        annotatedSentence = await repairAnnotatedSentence(
          annotatedSentence,
          sentence,
          error instanceof Error ? error.message : String(error)
        )
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

      // Since we now generate individual kanji annotations, the furigana applies to the previous character
      if (originalPos === 0) {
        throw new Error(
          'Furigana annotation found at beginning of sentence with no preceding kanji'
        )
      }

      const kanjiPos = originalPos - 1
      const kanjiChar = originalSentence[kanjiPos]

      // Verify the previous character is actually a kanji
      if (!isKanji(kanjiChar)) {
        throw new Error(
          `Furigana annotation "${furigana}" found after non-kanji character "${kanjiChar}" at position ${kanjiPos}`
        )
      }

      annotations.push({
        loc: kanjiPos,
        len: 1, // Always 1 for individual kanji
        type: 'furigana',
        content: furigana.trim(),
      })

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
): Promise<{ zhCN: string; enUS: string }[]> {
  const prompt = `
You are a professional translator providing accurate translations of Japanese sentences.

TRANSLATION GUIDELINES:
- Provide natural, accurate translations that convey the original meaning
- Chinese translations should use Simplified Chinese characters
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
          enUS: z.string(),
        })
      ),
    }),
  })

  // Validate all translations
  return object.translations.map((translation, index) => {
    if (!translation?.zhCN?.trim() || !translation?.enUS?.trim()) {
      throw new Error(`Empty translation generated for sentence: ${sentences[index]}`)
    }
    return {
      zhCN: translation.zhCN.trim(),
      enUS: translation.enUS.trim(),
    }
  })
}

export async function generateSentenceExplanations(
  sentences: string[]
): Promise<{ zhCN: string; enUS: string }[]> {
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

  // Get existing sentences from ALL related knowledge points to check for duplicates
  const allKnowledgePointIds = [
    ...new Set(sentences.flatMap((s) => [...s.vocabularyIds, ...s.grammarIds])),
  ]

  let existingSentences: { content: string }[] = []
  if (allKnowledgePointIds.length > 0) {
    const courseContentService = new CourseContentService(db)
    existingSentences =
      await courseContentService.getSentencesByKnowledgePointIds(allKnowledgePointIds)
  }

  // Build vocabulary context for pronunciation validation
  const allTargetVocabularyIds = [...new Set(sentences.flatMap((s) => s.vocabularyIds))]
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
${sentences
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
  }))

  // Generate annotations
  logger.info(`Generating annotations for ${sentencesWithExplanations.length} sentences`)
  const results = await Promise.allSettled(
    sentencesWithExplanations.map(async (sentence) => {
      const furiganaAnnotations = await generateFuriganaAnnotations(sentence.content)
      const vocabularyAnnotations = calculateVocabularyAnnotationsFromTokens(
        sentence.tokens,
        allVocabularies.filter((v) => sentence.vocabularyIds.includes(v.id))
      )

      return {
        ...sentence,
        annotations: furiganaAnnotations.concat(vocabularyAnnotations),
      }
    })
  )

  const generated = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)

  const failedCount = results.length - generated.length
  if (failedCount > 0) {
    logger.warn(`${failedCount} sentences failed to generate annotations`)
  }

  // Early exit if no sentences were successfully generated
  if (generated.length === 0) {
    throw new Error(
      `No sentences were successfully generated for target knowledge point: ${target.content}. All sentences failed annotation parsing. This prevents infinite loops.`
    )
  }

  return generated
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
