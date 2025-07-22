import db from '@/db'
import { logger } from '@/lib/server/utils'
import {
  GENERATED_SENTENCE_COUNT_PER_BATCH,
  GENERATED_SENTENCE_COUNT_PER_KNOWLEDGE_POINT,
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
You are a Japanese language annotation expert. A list of already annotated vocabularies is provided. Your tasks are:

- mark vocabulary locations for vocabulary in list, with annotation type 'vocabulary'
- mark kanji pronunciations for kanji words in the sentence but NOT in the provided vocabulary list, with annotation type 'furigana'

SENTENCE TO ANNOTATE:
"${sentence}"

VOCABULARY USED IN THIS SENTENCE:
${vocabularies.map((v) => knowledgeDetails(v, 'vocabulary')).join('\n')}

OUTPUT FORMAT:
For each annotation, provide:
1. loc: The character position where the annotation starts (0-based index)
2. len: The length of the text segment being annotated
3. type: 'furigana' | 'vocabulary' (use 'vocabulary' for words that are in the provided vocabulary list)
4. content: The furigana or vocabulary content being annotated
5. id: If type is 'vocabulary', you MUST set it to the id of the vocabulary. if type is 'furigana', ignore this field.

REQUIREMENTS:
- Annotations must not overlap
- Position and length must be accurate for the actual characters in the sentence
- Ensure the annotated text matches exactly what appears in the sentence, for example if the vocabulary is "私", don't annotate "私は", just "私"
- If a word appears multiple times, annotate all occurrences
- Combine multiple kanji in a single annotation if they are part of the same word, for example: mark 家族 in one annotation rather than 家 and 族 separately.

Return only the annotations array with no additional text.
  `

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    prompt,
    schema: z.object({
      annotations: z.array(annotationSchema),
    }),
  })

  return object.annotations.map((a) => ({
    ...a,
    content: a.content.trim(),
  }))
}

interface GeneratedSentence {
  content: string
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
  sentence: Omit<GeneratedSentence, 'annotations'>
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
You are a Japanese language expert evaluating whether a sentence is grammatically and culturally appropriate for teaching.

SENTENCE TO EVALUATE:
${sentence.content}
EXPLAIN:
${sentence.explanation.zhCN}
${sentence.explanation.enUS}

CHECK FOR THESE TYPES OF ERRORS:

1. **Cultural/Pragmatic Errors**
   - Using honorifics incorrectly (e.g., さん/様/先生 about oneself)
   - Inappropriate politeness levels for the context
   - Culturally impossible or strange situations
   - Using humble/respectful forms incorrectly

2. **Grammatical Errors**
   - Incorrect particle usage
   - Wrong verb conjugations
   - Incompatible grammar patterns
   - Word order violations

3. **Semantic/Logic Errors**
   - Contradictory information within the sentence
   - Nonsensical combinations
   - Incorrect word usage (using 行く when 来る is needed)
   - Counter/classifier mismatches

COMMON MISTAKES TO CATCH:
- 私は山田さんです (wrong - can't use さん for oneself)
- 先生は来週来ています (wrong - tense doesn't match time expression)
- きのう行きます (wrong - past time with non-past verb)
- 私は私の本を読みます (awkward - unnecessary 私の)
- お水をお飲みください (wrong - double honorific)

EVALUATION:
output true if the sentence is grammatically and culturally appropriate, otherwise output false.
if false, provide a reason for the invalidity.
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
You are a Japanese language teacher creating example sentences for みんなの日本語 students.

Generate ${amount} Japanese sentences using the vocabulary and grammar provided below.

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
8. provide 'zhCN' and 'enUS' explanations for each sentence

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
          explanation: z.object({
            zhCN: z.string(),
            enUS: z.string(),
          }),
          vocabularyIds: z.array(z.number()),
          grammarIds: z.array(z.number()),
        })
      ),
    }),
  })

  return Promise.all(
    sentences
      .filter((sentence) => validateSentence(sentence))
      .map(async (sentence) => {
        return {
          ...sentence,
          annotations: await generateSentenceAnnotations(
            sentence.content,
            allVocabularies.filter((v) => sentence.vocabularyIds.includes(v.id))
          ),
        }
      })
  )
}

async function getKnowledgePointsByLessonNumber(lessonNumber: number): Promise<PrioritizedBuckets> {
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
    const ratio =
      (GENERATED_SENTENCE_COUNT_PER_KNOWLEDGE_POINT - count) /
      GENERATED_SENTENCE_COUNT_PER_KNOWLEDGE_POINT
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

  // limit low priority items
  buckets.low.vocabularies = random
    .shuffle(buckets.low.vocabularies)
    .slice(0, MAX_LOW_PRIORITY_VOCABULARIES)
  buckets.low.grammar = random.shuffle(buckets.low.grammar).slice(0, MAX_LOW_PRIORITY_GRAMMAR)

  return buckets
}

export async function generateSentencesForLessonNumber(
  lessonNumber: number,
  amount = GENERATED_SENTENCE_COUNT_PER_BATCH
): Promise<GeneratedSentence[]> {
  const buckets = await getKnowledgePointsByLessonNumber(lessonNumber)

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
