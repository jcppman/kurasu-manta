import db from '@/db'
import { logger } from '@/lib/server/utils'
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
  return existingSentences.some((s) => s.content.trim() === sentence.content.trim())
}

export interface GenerateSentencesForScopeParameters {
  amount: number
  buckets: {
    urgent: KnowledgeBucket
    high: KnowledgeBucket
    low: KnowledgeBucket
  }
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

const SENTENCE_COUNT_PER_LESSON = 10
const SENTENCE_COUNT_PER_KNOWLEDGE_POINT = 5
export async function generateSentencesForLesson(
  lessonId: number,
  amount = SENTENCE_COUNT_PER_LESSON
): Promise<GeneratedSentence[]> {
  // TEMP: only get vocabularies and grammar for the target lesson
  const courseContentService = new CourseContentService(db)
  // get all vocabularies and grammar for lessons that number <= targetLesson
  const targetLesson = await courseContentService.getLessonWithContent(lessonId)
  if (!targetLesson) {
    throw new Error(`Lesson with ID ${lessonId} not found`)
  }

  // calculate weights
  const countMap = await courseContentService.getSentenceCountsByKnowledgePointIds(
    targetLesson.knowledgePoints.map((k) => k.id)
  )
  const params = targetLesson.knowledgePoints.reduce(
    (accum, curr) => {
      const count = countMap.get(curr.id) ?? 0
      const ratio =
        (SENTENCE_COUNT_PER_KNOWLEDGE_POINT - count) / SENTENCE_COUNT_PER_KNOWLEDGE_POINT
      if (ratio >= 0.6) {
        if (isVocabulary(curr)) {
          accum.buckets.urgent.vocabularies.push(curr)
        } else if (isGrammar(curr)) {
          accum.buckets.urgent.grammar.push(curr)
        }
      } else if (ratio >= 0.3) {
        if (isVocabulary(curr)) {
          accum.buckets.high.vocabularies.push(curr)
        } else if (isGrammar(curr)) {
          accum.buckets.high.grammar.push(curr)
        }
      } else {
        if (isVocabulary(curr)) {
          accum.buckets.low.vocabularies.push(curr)
        } else if (isGrammar(curr)) {
          accum.buckets.low.grammar.push(curr)
        }
      }
      return accum
    },
    {
      amount,
      buckets: {
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
      },
    } as GenerateSentencesForScopeParameters
  )

  // report the number of vocabularies and grammar in each bucket
  logger.info(
    `Generating sentences for lesson: ${JSON.stringify(
      {
        lessonId,
        urgentVocabularies: params.buckets.urgent.vocabularies.length,
        urgentGrammar: params.buckets.urgent.grammar.length,
        highVocabularies: params.buckets.high.vocabularies.length,
        highGrammar: params.buckets.high.grammar.length,
        lowVocabularies: params.buckets.low.vocabularies.length,
        lowGrammar: params.buckets.low.grammar.length,
      },
      null,
      2
    )}`
  )

  return generateSentencesFromPrioritizedBuckets(params)
}
