import db from '@/db'
import { processInParallel, withRetry } from '@/lib/async'
import { logger } from '@/lib/utils'
import {
  MAX_LLM_RETRY_TIMES,
  MAX_LOW_PRIORITY_GRAMMAR,
  MAX_LOW_PRIORITY_VOCABULARIES,
  SENTENCE_HIGH_AMOUNT_THRESHOLD,
  SENTENCE_URGENT_AMOUNT_THRESHOLD,
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
import { z } from 'zod'

function knowledgeDetails(input: KnowledgePoint, parentTagName = 'knowledge'): string {
  let result = `<content>${sanitizeVocabularyContent(input.content)}</content>`
  if (input.explanation) {
    result += `<explain>${input.explanation.zhCN}</explain>`
  }
  return `<${parentTagName} id="${input.id}">${result}</${parentTagName}>`
}

export async function generateFuriganaAnnotations(sentence: string): Promise<Annotation[]> {
  const prompt = `
You are a Japanese language annotation expert. Your task is to add furigana annotations for ALL kanji characters in a Japanese sentence.

ANNOTATION RULES:
1. Add furigana for ALL kanji characters using the format: kanji[hiragana]
2. Group consecutive kanji that form a single word (e.g., 家族[かぞく], not 家[か]族[ぞく])
3. Do NOT add furigana to hiragana, katakana, or punctuation
4. Keep all other characters exactly as they are
5. CRITICAL: Use context-appropriate readings - consider the grammatical position and meaning in the sentence

CONTEXT-DEPENDENT READING EXAMPLES:
- 何 as "what" in questions: なん (何ですか → 何[なん]ですか)
- 何 as "how many" with counters: なん (何人 → 何[なん]人[にん])
- 何 as indefinite "something": なに (何か → 何[なに]か)
- 一 as number "one": いち (一つ → 一[ひと]つ)
- 一 in compound words: いっ (一番 → 一[いち]番[ばん])
- 人 after numbers: にん (三人 → 三[さん]人[にん])
- 人 as "person": ひと (人が → 人[ひと]が)

SENTENCE TO ANNOTATE:
"${sentence}"

OUTPUT FORMAT:
Return the sentence with furigana annotations in brackets. Do NOT provide JSON or any other format.

EXAMPLES:
Input: "古い傘を買いました"
Output: "古[ふる]い傘[かさ]を買[か]いました"

Input: "私は学校に行きます"
Output: "私[わたし]は学校[がっこう]に行[い]きます"

Input: "お名前は何ですか"
Output: "お名前[なまえ]は何[なん]ですか"

Input: "何人いますか"
Output: "何[なん]人[にん]いますか"

Return only the annotated sentence with no additional text.
  `

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    prompt,
    schema: z.object({
      annotatedSentence: z.string(),
    }),
  })

  // Parse the annotated sentence to generate position-based annotations
  return parseAnnotatedSentenceToAnnotations(object.annotatedSentence, sentence)
}

function parseAnnotatedSentenceToAnnotations(
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

      // Find the kanji that this furigana belongs to by looking backwards
      // from the current originalPos to find the start of the kanji sequence
      let kanjiStart = originalPos

      // Look backwards to find the start of the kanji sequence
      while (kanjiStart > 0) {
        const prevChar = originalSentence[kanjiStart - 1]
        if (!/[\u4e00-\u9faf]/.test(prevChar)) {
          break
        }
        kanjiStart--
      }

      // The kanji sequence ends at the current originalPos
      const kanjiEnd = originalPos

      if (kanjiStart < kanjiEnd) {
        annotations.push({
          loc: kanjiStart,
          len: kanjiEnd - kanjiStart,
          type: 'furigana',
          content: furigana.trim(),
        })
      }

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

Your task is to translate each Japanese sentence into Chinese (Simplified) and English.

SENTENCES TO TRANSLATE:
${sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n')}

TRANSLATION GUIDELINES:
- Provide natural, accurate translations that convey the original meaning
- Chinese translations should use Simplified Chinese characters
- English translations should be clear and natural
- Maintain the tone and style of the original sentence
- For formal Japanese sentences, use appropriate formal language in translations
- For casual Japanese sentences, use appropriate casual language in translations

OUTPUT FORMAT:
Return translations in the same order as the input sentences.
  `

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
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
  const validatedTranslations = object.translations.map((translation, index) => {
    if (!translation?.zhCN?.trim() || !translation?.enUS?.trim()) {
      throw new Error(`Empty translation generated for sentence: ${sentences[index]}`)
    }
    return {
      zhCN: translation.zhCN.trim(),
      enUS: translation.enUS.trim(),
    }
  })

  return validatedTranslations
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

async function generateCombinedAnnotations(
  sentence: string,
  tokens: string[],
  vocabularyItems: Vocabulary[]
): Promise<Annotation[]> {
  // Generate vocabulary annotations from tokens
  const vocabularyAnnotations = calculateVocabularyAnnotationsFromTokens(tokens, vocabularyItems)

  // Generate furigana annotations for all kanji in the sentence
  const furiganaAnnotations = await generateFuriganaAnnotations(sentence)

  // Combine and remove overlapping furigana
  const vocabularyRanges = vocabularyAnnotations.map((a) => [a.loc, a.loc + a.len - 1])

  const filteredFuriganaAnnotations = furiganaAnnotations.filter((annotation) => {
    const furiganaStart = annotation.loc
    const furiganaEnd = annotation.loc + annotation.len - 1

    const overlapsWithVocabulary = vocabularyRanges.some(([vocabStart, vocabEnd]) => {
      return furiganaStart <= vocabEnd && furiganaEnd >= vocabStart
    })

    return !overlapsWithVocabulary
  })

  // Combine all annotations and sort by position
  const allAnnotations = [...vocabularyAnnotations, ...filteredFuriganaAnnotations]
  return allAnnotations.sort((a, b) => a.loc - b.loc)
}

function calculateVocabularyAnnotationsFromTokens(
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

export async function validateSentence(
  sentence: Omit<GeneratedSentence, 'annotations' | 'explanation'>,
  availableVocabularies: Vocabulary[]
): Promise<boolean> {
  // evaluate if the sentence is valid and is not too similar to existing sentences
  // get existing sentences from the database
  const courseContentService = new CourseContentService(db)
  const existingSentences = (
    await Promise.all(
      sentence.vocabularyIds.map((vId) =>
        courseContentService.getVocabularyById(vId, { withSentences: true })
      )
    )
  ).flatMap((v) => v?.sentences ?? [])
  // if equal, unqualify the sentence
  const isDuplicate = existingSentences.some(
    (s) =>
      s.content.replace(/[、。！？]/g, '').trim() ===
      sentence.content.replace(/[、。！？]/g, '').trim()
  )
  if (isDuplicate) {
    logger.warn(`Duplicate sentence found: ${sentence.content}`)
    return false
  }

  // Get vocabulary details for context from provided vocabularies
  const targetVocabularies = availableVocabularies.filter((v) =>
    sentence.vocabularyIds.includes(v.id)
  )

  const targetWords = targetVocabularies.map((v) => v.content).join(', ')

  // check if the sentence is correct
  const prompt = `
You are a Japanese language expert evaluating sentences for a Japanese textbook.

SENTENCE TO EVALUATE:
${sentence.content}

TARGET VOCABULARY BEING DEMONSTRATED:
${targetWords}

EVALUATION CRITERIA:
This sentence demonstrates target vocabulary for language learners. Balance educational goals with natural language patterns.

ACCEPT sentences that are:
- Grammatically correct and naturally flowing
- Logically consistent and realistic
- Appropriate for educational contexts
- Using target vocabulary in natural, believable situations

REJECT IF:
1. **Grammar Violations**: Incorrect particles, verb conjugations, or structural patterns
2. **Honorific Misuse**: Using respectful language incorrectly about oneself or impossible contexts
3. **Logical Issues**: Tense-time mismatches or contradictory information
4. **Unnatural Constructions**: Awkward stacking of modifiers, overly complex descriptions, or artificial-sounding combinations that native speakers wouldn't use
5. **Unrealistic Scenarios**: Situations that feel contrived or wouldn't occur in real life

EDUCATIONAL BALANCE:
- Target vocabulary should be used in natural, believable contexts
- Prefer simple, clear sentences over complex constructions
- Formal vocabulary (like '貴方') is acceptable when used appropriately, but avoid artificially forcing multiple target words into unnatural combinations
- Sentences should sound like something a native speaker might actually say or encounter

EVALUATION:
Output true if grammatically correct, natural-sounding, and suitable for educational use.
Output false for sentences that would confuse students due to grammar errors, unnatural constructions, or overly artificial combinations.
`
  const {
    object: { valid, reason },
  } = await generateObject({
    model: openai('gpt-4.1'),
    prompt,
    schema: z.object({
      valid: z.boolean(),
      reason: z.string().optional(),
    }),
  })

  if (!valid) {
    logger.warn(`Invalid sentence found: ${sentence.content}, reason: ${reason}`)
  }

  return valid
}

interface PrioritizedBuckets {
  urgent: KnowledgeBucket
  high: KnowledgeBucket
  low: KnowledgeBucket
}
export interface GenerateSentencesForScopeParameters {
  amount: number
  buckets: PrioritizedBuckets
}

export async function generateSentencesFromPrioritizedBuckets({
  amount,
  buckets,
}: GenerateSentencesForScopeParameters): Promise<GeneratedSentence[]> {
  const { urgent, high, low } = buckets

  const prompt = `
You are a Japanese language teacher creating example sentences for students learning Japanese.

Generate ${amount} Japanese sentences using ONLY the vocabulary and grammar provided below.

CRITICAL VOCABULARY CONSTRAINT:
- TRY YOUR BEST to only use vocabulary words that are explicitly listed in the sections below
- AVOID using content vocabulary (nouns, verbs, adjectives, adverbs) that are not in the provided lists
- If you need additional words for particles, basic grammar, or function words (は、が、を、に、で、と、の、も、から、まで、です、ます、etc.), those are acceptable

VOCABULARY AND GRAMMAR BY PRIORITY:

=== URGENT (need more sentences) ===
<vocabulary>
${urgent.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${urgent.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>

=== HIGH (need some sentences) ===
<vocabulary>
${high.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${high.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>

=== LOW (use naturally) ===
Already have sufficient examples - use only when it improves the sentence
<vocabulary>
${low.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${low.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>

GENERATION GUIDELINES:
1. Create exactly ${amount} sentences
2. Prioritize URGENT items - try to use each urgent item at least once
3. Include HIGH priority items regularly throughout your sentences
4. Use LOW priority items only when they make sentences more natural
5. Combine items from different priorities when it creates better sentences
6. Vary sentence types: statements, questions, negative forms, past/present tense

TOKENIZATION OUTPUT REQUIREMENT:
For each sentence, also provide a tokenized version:
- Split the sentence into meaningful tokens, including ALL characters
- NEVER split vocabulary items from the provided list - keep them as complete tokens
- Include punctuation marks (、。！？etc.) as separate tokens
- Particles and hiragana-only words should be separate tokens

EXAMPLES:
- Sentence content: "私は日本人です"
- Tokens: ["私", "は", "日本人", "です"]

- Sentence content: "失礼ですが、お名前は何ですか。"
- If "お名前は" is a vocabulary item: ["失礼", "ですが", "、", "お名前は", "何", "ですか", "。"]
- If "お名前は" is NOT a vocabulary item: ["失礼", "ですが", "、", "お名前", "は", "何", "ですか", "。"]

Create sentences that are clear, useful, and appropriate for students.
  `
  const allVocabularies = [...urgent.vocabularies, ...high.vocabularies, ...low.vocabularies]
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

  const allKnowledgePointIds = new Set([
    ...urgent.vocabularies.map((v) => `v:${v.id}`),
    ...urgent.grammar.map((g) => `g:${g.id}`),
    ...high.vocabularies.map((v) => `v:${v.id}`),
    ...high.grammar.map((g) => `g:${g.id}`),
    ...low.vocabularies.map((v) => `v:${v.id}`),
    ...low.grammar.map((g) => `g:${g.id}`),
  ])

  // Validate sentences in parallel with controlled concurrency
  logger.info(`Validating ${sentences.length} sentences with default concurrency`)
  const validationResults = await processInParallel(sentences, async (sentence) => {
    // validate if ids are valid or something faked by LLM
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

    logger.info(`Validating sentence: ${sentence.content}`)
    const isValid = await validateSentence(sentence, allVocabularies)
    if (!isValid) {
      throw new Error('Validation failed')
    }
    return sentence
  })

  // Process only successfully validated sentences
  const cleanedUpSentences = validationResults
    .filter(
      (
        result
      ): result is {
        success: true
        result: Omit<GeneratedSentence, 'annotations'>
        item: Omit<GeneratedSentence, 'annotations'>
      } => result.success
    )
    .map((result) => ({
      ...result.result,
      content: result.result.content.replace(/ /g, '').trim(), // Clean up whitespace
    }))

  logger.info(`${cleanedUpSentences.length} out of ${sentences.length} sentences passed validation`)

  // Generate translations for validated sentences
  logger.info(`Generating translations for ${cleanedUpSentences.length} sentences`)
  const translations = await generateSentenceExplanations(cleanedUpSentences.map((s) => s.content))

  // Combine sentences with translations
  const sentencesWithExplanations = cleanedUpSentences.map((sentence, index) => ({
    ...sentence,
    explanation: translations[index],
  }))

  // Generate annotations using two-stage approach
  logger.info(
    `Generating annotations for ${sentencesWithExplanations.length} sentences using two-stage approach`
  )
  const generated = await Promise.all(
    sentencesWithExplanations.map(async (sentence) => {
      logger.debug(`Generating annotations for sentence: ${sentence.content}`)
      const annotations = await generateCombinedAnnotations(
        sentence.content,
        sentence.tokens,
        allVocabularies.filter((v) => sentence.vocabularyIds.includes(v.id))
      )
      return {
        ...sentence,
        annotations,
      }
    })
  )

  logger.info(`${generated.length} sentences successfully generated with annotations`)

  return generated
}

async function getPrioritizedKnowledgePointsByLessonNumber(
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

  const buckets: PrioritizedBuckets = {
    urgent: {
      vocabularies: [],
      grammar: [],
    },
    high: {
      vocabularies: [],
      grammar: [],
    },
    low: {
      vocabularies: [],
      grammar: [],
    },
  }

  // calculate weights
  const countMap = await courseContentService.getSentenceCountsByKnowledgePointIds(
    targetKnowledgePoints.map((k) => k.id)
  )
  for (const curr of targetKnowledgePoints) {
    const count = countMap.get(curr.id) ?? 0
    if (count <= SENTENCE_URGENT_AMOUNT_THRESHOLD) {
      if (isVocabulary(curr)) {
        buckets.urgent.vocabularies.push(curr)
      } else if (isGrammar(curr)) {
        buckets.urgent.grammar.push(curr)
      }
    } else if (count <= SENTENCE_HIGH_AMOUNT_THRESHOLD) {
      if (isVocabulary(curr)) {
        buckets.high.vocabularies.push(curr)
      } else if (isGrammar(curr)) {
        buckets.high.grammar.push(curr)
      }
    } else {
      if (isVocabulary(curr)) {
        buckets.low.vocabularies.push(curr)
      } else if (isGrammar(curr)) {
        buckets.low.grammar.push(curr)
      }
    }
  }

  buckets.urgent.vocabularies = random.shuffle(buckets.urgent.vocabularies)
  buckets.urgent.grammar = random.shuffle(buckets.urgent.grammar)
  buckets.high.vocabularies = random.shuffle(buckets.high.vocabularies)
  buckets.high.grammar = random.shuffle(buckets.high.grammar)

  // limit low priority items
  buckets.low.vocabularies = random
    .shuffle(buckets.low.vocabularies)
    .slice(0, MAX_LOW_PRIORITY_VOCABULARIES)
  buckets.low.grammar = random.shuffle(buckets.low.grammar).slice(0, MAX_LOW_PRIORITY_GRAMMAR)

  return buckets
}

export async function generateSentencesForLessonNumber(
  lessonNumber: number,
  amount: number
): Promise<GeneratedSentence[]> {
  const buckets = await getPrioritizedKnowledgePointsByLessonNumber(lessonNumber)

  // report the number of vocabularies and grammar in each bucket
  logger.info(
    `Generating sentences for lesson: ${JSON.stringify(
      {
        lessonNumber,
        urgentVocabularies: buckets.urgent.vocabularies.length,
        urgentGrammar: buckets.urgent.grammar.length,
        highVocabularies: buckets.high.vocabularies.length,
        highGrammar: buckets.high.grammar.length,
        lowVocabularies: buckets.low.vocabularies.length,
        lowGrammar: buckets.low.grammar.length,
      },
      null,
      2
    )}`
  )

  return generateSentencesFromPrioritizedBuckets({
    amount,
    buckets,
  })
}
