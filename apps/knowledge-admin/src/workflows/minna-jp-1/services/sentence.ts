import db from '@/db'
import { logger } from '@/lib/server/utils'
import {
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

  const generated: GeneratedSentence[] = []

  for (const sentence of sentences) {
    logger.info(`Generated sentence: ${sentence.content}`)
    if (!(await validateSentence(sentence))) {
      continue
    }
    generated.push({
      ...sentence,
      annotations: await generateSentenceAnnotations(
        sentence.content,
        allVocabularies.filter((v) => sentence.vocabularyIds.includes(v.id))
      ),
    })
  }

  return generated
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
  amount: number
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
