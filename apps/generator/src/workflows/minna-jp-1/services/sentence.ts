import db from '@/db'
import { processInParallel } from '@/lib/async'
import { logger } from '@/lib/utils'
import {
  DESIRED_SENTENCE_COUNT_PER_KNOWLEDGE_POINT,
  MAX_LLM_RETRY_TIMES,
  MAX_LOW_PRIORITY_GRAMMAR,
  MAX_LOW_PRIORITY_VOCABULARIES,
} from '@/workflows/minna-jp-1/constants'
import { sanitizeVocabularyContent } from '@/workflows/minna-jp-1/utils'
import { openai } from '@ai-sdk/openai'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { type Annotation, annotationSchema } from '@kurasu-manta/knowledge-schema/zod/annotation'
import {
  type Grammar,
  type KnowledgePoint,
  type Vocabulary,
  isGrammar,
  isVocabulary,
} from '@kurasu-manta/knowledge-schema/zod/knowledge'
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

export async function generateSentenceAnnotations(
  sentence: string,
  vocabularies: Vocabulary[]
): Promise<Annotation[]> {
  const prompt = `
You are a Japanese language annotation expert. Your task is to annotate a Japanese sentence based on a provided vocabulary list.

ANNOTATION RULES:
1. **Vocabulary Annotations** (type: 'vocabulary')
   - Mark all occurrences of words from the provided vocabulary list
   - Each annotation must match the vocabulary item exactly (e.g., annotate "私" not "私は")
   - Include the vocabulary ID in the annotation

2. **Furigana Annotations** (type: 'furigana')
   - Mark ONLY kanji characters that are NOT part of the provided vocabulary
   - Provide pronunciation in hiragana
   - Do NOT include trailing hiragana in the annotation length
   - Group consecutive kanji that form a single word (e.g., 家族 as one annotation, not 家 and 族 separately)

SENTENCE TO ANNOTATE:
"${sentence}"

VOCABULARY LIST:
${vocabularies.map((v) => knowledgeDetails(v, 'vocabulary')).join('\n')}

OUTPUT FORMAT:
Return a JSON array where each annotation contains:
- loc: Starting position (0-based character index)
- len: Number of characters to annotate
- type: 'vocabulary' or 'furigana'
- content: The annotation content (vocabulary word or furigana reading)
- id: Vocabulary ID (required for 'vocabulary' type, keep it absent for 'furigana')

EXAMPLE:
For sentence "古い傘", the output would be:
[
  {"loc": 0, "len": 1, "type": "furigana", "content": "ふる"},
  {"loc": 2, "len": 1, "type": "furigana", "content": "かさ"}
]

CONSTRAINTS:
- Annotations must not overlap
- Annotate all occurrences of vocabulary words
- Ensure exact character positions and lengths
- Return only the JSON array with no additional text
  `

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    prompt,
    schema: z.object({
      annotations: z.array(annotationSchema),
    }),
  })

  const trimmedAnnotations = object.annotations.map((a) => ({
    ...a,
    content: a.content.trim(),
  }))

  // sometimes the AI may return furigana annotations that are already part of the vocabulary, filter them out

  // range is [loc, loc + len - 1] both inclusive
  const vocRanges = trimmedAnnotations
    .filter((a) => a.type === 'vocabulary')
    .map((a) => [a.loc, a.loc + a.len - 1])
  return trimmedAnnotations.filter((a) => {
    if (a.type === 'vocabulary') {
      return true
    }

    return !vocRanges.some((range) => {
      const [vocStart, vocEnd] = range
      const [furiganaStart, furiganaEnd] = [a.loc, a.loc + a.len - 1]
      return furiganaStart <= vocEnd && furiganaEnd >= vocStart
    })
  })
}

export async function generateSentenceExplanations(
  sentences: string[]
): Promise<{ zhCN: string; enUS: string }[]> {
  if (sentences.length === 0) {
    return []
  }

  let remainingSentences = [...sentences]
  const results: ({ zhCN: string; enUS: string } | null)[] = new Array(sentences.length).fill(null)
  let retryCount = 0

  while (remainingSentences.length > 0 && retryCount < MAX_LLM_RETRY_TIMES) {
    const prompt = `
You are a professional translator providing accurate translations of Japanese sentences.

Your task is to translate each Japanese sentence into Chinese (Simplified) and English.

SENTENCES TO TRANSLATE:
${remainingSentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n')}

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

    try {
      const { object } = await generateObject({
        model: openai('gpt-4o'),
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

      // Process translations and identify failed ones
      const failedIndices: number[] = []
      const newRemainingSentences: string[] = []

      remainingSentences.forEach((sentence, currentIndex) => {
        const originalIndex = sentences.indexOf(sentence)
        const translation = object.translations[currentIndex]

        // Validate translation
        if (!translation?.zhCN?.trim() || !translation?.enUS?.trim()) {
          logger.warn(
            `Empty translation generated for sentence: ${sentence} (attempt ${retryCount + 1})`
          )
          failedIndices.push(originalIndex)
          newRemainingSentences.push(sentence)
        } else {
          // Translation is valid, store it
          results[originalIndex] = {
            zhCN: translation.zhCN.trim(),
            enUS: translation.enUS.trim(),
          }
        }
      })

      remainingSentences = newRemainingSentences
      retryCount++

      if (failedIndices.length > 0) {
        logger.info(
          `Retrying ${failedIndices.length} failed translations (attempt ${retryCount}/${MAX_LLM_RETRY_TIMES})`
        )
      }
    } catch (error) {
      logger.error(`Translation generation failed on attempt ${retryCount + 1}:`, error)
      retryCount++
    }
  }

  // Handle any remaining failed translations
  return results.map((result, index) => {
    if (result === null) {
      const sentence = sentences[index]
      logger.error(
        `Failed to generate translation for sentence after ${MAX_LLM_RETRY_TIMES} attempts: ${sentence}`
      )
      throw new Error(`Translation failed for sentence: ${sentence}`)
    }
    return result
  })
}

interface ParsedToken {
  text: string
  furigana?: string
}

function parseToken(token: string): ParsedToken {
  const furiganaMatch = token.match(/^(.+?)\[(.+?)\]$/)
  if (furiganaMatch) {
    return {
      text: furiganaMatch[1],
      furigana: furiganaMatch[2],
    }
  }
  return {
    text: token,
  }
}

function calculateAnnotationsFromTokens(
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
    const parsed = parseToken(token)
    const tokenLength = parsed.text.length

    // Check if this token is a vocabulary item
    const vocabId = vocabMap.get(parsed.text)
    if (vocabId) {
      annotations.push({
        loc: currentPosition,
        len: tokenLength,
        type: 'vocabulary',
        content: parsed.text,
        id: vocabId,
      })
    } else if (parsed.furigana) {
      // This is a kanji with furigana annotation
      annotations.push({
        loc: currentPosition,
        len: tokenLength,
        type: 'furigana',
        content: parsed.furigana,
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
  sentence: Omit<GeneratedSentence, 'annotations' | 'explanation'>
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
  const isDuplicate = existingSentences.some((s) => s.content.trim() === sentence.content.trim())
  if (isDuplicate) {
    logger.warn(`Duplicate sentence found: ${sentence.content}`)
    return false
  }

  // check if the sentence is correct
  const prompt = `
You are a Japanese language expert evaluating sentences for a Japanese textbook.

SENTENCE TO EVALUATE:
${sentence.content}

EVALUATION CRITERIA:
Focus on detecting serious errors that would mislead students. Accept sentences that are:
- Grammatically correct (even if formal or textbook-style)
- Logically consistent
- Appropriate for educational contexts

REJECT ONLY IF:
1. **Fundamental Grammar Violations**: Incorrect particles, verb conjugations, or structural patterns that break Japanese grammar rules
2. **Honorific Misuse**: Using respectful language incorrectly about oneself or in impossible contexts
3. **Logical Contradictions**: Tense-time mismatches or internally contradictory information
4. **Semantic Impossibilities**: Nonsensical word combinations or impossible situations
5. **Cultural Rudeness**: Sentences that would be considered rude, too direct, or inappropriate in Japanese culture (even in educational contexts)

ACCEPT:
- Formal vocabulary choices appropriate for textbooks
- Polite direct questions common in educational dialogues
- Standard textbook expressions even if less common in casual speech

EVALUATION:
Output true if grammatically correct and logically sound for educational use.
Output false only for clear errors that would confuse or mislead students.
`
  const {
    object: { valid, reason },
  } = await generateObject({
    model: openai('gpt-4o'),
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
- You MUST only use vocabulary words that are explicitly listed in the sections below
- Do NOT use any vocabulary words that are not in the provided lists
- If you need additional words for particles, basic grammar, or function words (は、が、を、に、で、と、の、も、から、まで、です、ます、etc.), those are acceptable
- But avoid using content vocabulary (nouns, verbs, adjectives, adverbs) that are not in the provided lists

VOCABULARY AND GRAMMAR BY PRIORITY:

=== URGENT (need more examples) ===
Must appear in at least ${Math.ceil(amount * 0.6)} sentences
<vocabulary>
${urgent.vocabularies.map((v) => knowledgeDetails(v)).join('\n')}
</vocabulary>
<grammar>
${urgent.grammar.map((g) => knowledgeDetails(g)).join('\n')}
</grammar>

=== HIGH (need some examples) ===
Should appear in at least ${Math.ceil(amount * 0.3)} sentences
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
7. Focus on practical, daily-life situations that students would actually encounter

TOKENIZATION OUTPUT REQUIREMENT:
For each sentence, also provide a tokenized version with furigana annotations:
- Split the sentence into meaningful tokens
- For kanji that are NOT in the provided vocabulary list, add furigana in brackets: kanji[hiragana]
- For vocabulary items from the provided list, keep them as-is (no furigana needed)
- Particles and hiragana-only words should be separate tokens

EXAMPLE:
- Sentence: "私は日本人です"
- Tokens: ["私", "は", "日本人[にほんじん]", "です"]

Create sentences that are clear, useful, and appropriate for students at this level.
  `
  const allVocabularies = [...urgent.vocabularies, ...high.vocabularies, ...low.vocabularies]
  const {
    object: { sentences },
  } = await generateObject({
    model: openai('gpt-4o'),
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

  // Validate sentences in parallel with controlled concurrency
  logger.info(`Validating ${sentences.length} sentences with default concurrency`)
  const validationResults = await processInParallel(sentences, async (sentence) => {
    logger.info(`Validating sentence: ${sentence.content}`)
    const isValid = await validateSentence(sentence)
    if (!isValid) {
      throw new Error('Validation failed')
    }
    return sentence
  })

  // Process only successfully validated sentences
  const validatedSentences = validationResults
    .filter(
      (
        result
      ): result is {
        success: true
        result: Omit<GeneratedSentence, 'annotations'>
        item: Omit<GeneratedSentence, 'annotations'>
      } => result.success
    )
    .map((result) => result.result)

  logger.info(`${validatedSentences.length} out of ${sentences.length} sentences passed validation`)

  // Generate translations for validated sentences
  logger.info(`Generating translations for ${validatedSentences.length} sentences`)
  const translations = await generateSentenceExplanations(validatedSentences.map((s) => s.content))

  // Combine sentences with translations
  const sentencesWithExplanations = validatedSentences.map((sentence, index) => ({
    ...sentence,
    explanation: translations[index],
  }))

  // Generate annotations from tokens deterministically
  logger.info(
    `Generating annotations from tokens for ${sentencesWithExplanations.length} sentences`
  )
  const generated = sentencesWithExplanations.map((sentence) => {
    logger.debug(`Generating annotations for sentence: ${JSON.stringify(sentence)}`)
    const annotations = calculateAnnotationsFromTokens(
      sentence.tokens,
      allVocabularies.filter((v) => sentence.vocabularyIds.includes(v.id))
    )
    return {
      ...sentence,
      annotations,
    }
  })

  logger.info(`${generated.length} sentences successfully generated with annotations`)

  return generated
}

async function getPrioritizedKnowledgePointsByLessonNumber(
  lessonNumber: number,
  maxDesiredCount: number
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
    const ratio = (maxDesiredCount - count) / maxDesiredCount
    if (ratio >= 0.6) {
      if (isVocabulary(curr)) {
        buckets.urgent.vocabularies.push(curr)
      } else if (isGrammar(curr)) {
        buckets.urgent.grammar.push(curr)
      }
    } else if (ratio >= 0.3) {
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
  const buckets = await getPrioritizedKnowledgePointsByLessonNumber(
    lessonNumber,
    DESIRED_SENTENCE_COUNT_PER_KNOWLEDGE_POINT
  )

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
