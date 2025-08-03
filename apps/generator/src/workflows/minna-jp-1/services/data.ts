import db from '@/db'
import {
  knowledgePointsTable,
  lessonKnowledgePointsTable,
  sentenceKnowledgePointsTable,
  sentencesTable,
} from '@/db/schema'
import { withRetry } from '@/lib/async'
import { logger } from '@/lib/utils'
import {
  DESIRED_SENTENCE_COUNT_PER_BATCH,
  MAX_LLM_RETRY_TIMES,
} from '@/workflows/minna-jp-1/constants'
import { generateSentencesForLessonNumber } from '@/workflows/minna-jp-1/services/sentence'
import { findPosOfVocabulary } from '@/workflows/minna-jp-1/services/vocabulary'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { eq, inArray } from 'drizzle-orm'
import {
  type MinaGrammar,
  type MinaVocabulary,
  getGrammarData,
  getVocData,
} from 'src/workflows/minna-jp-1/content'

export async function cleanVocabularies() {
  logger.info('Resetting database - dropping vocabulary knowledge points...')

  // First, get all vocabulary knowledge point IDs
  const vocabularyKnowledgePoints = await db
    .select({ id: knowledgePointsTable.id })
    .from(knowledgePointsTable)
    .where(eq(knowledgePointsTable.type, 'vocabulary'))

  const vocabularyIds = vocabularyKnowledgePoints.map((kp) => kp.id)

  if (vocabularyIds.length === 0) {
    logger.info('No vocabulary knowledge points found to delete')
    return
  }

  logger.info(`Found ${vocabularyIds.length} vocabulary knowledge points to delete`)

  // Delete lesson-knowledge point associations for vocabulary points only
  await db
    .delete(lessonKnowledgePointsTable)
    .where(inArray(lessonKnowledgePointsTable.knowledgePointId, vocabularyIds))

  logger.info('Deleted vocabulary lesson associations')

  // Delete vocabulary knowledge points
  await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'vocabulary'))

  logger.info(`Deleted ${vocabularyIds.length} vocabulary knowledge points`)

  logger.info('Database reset completed - vocabulary knowledge points dropped')
}

export async function cleanGrammar() {
  logger.info('Resetting database - dropping grammar knowledge points...')

  // First, get all grammar knowledge point IDs
  const grammarKnowledgePoints = await db
    .select({ id: knowledgePointsTable.id })
    .from(knowledgePointsTable)
    .where(eq(knowledgePointsTable.type, 'grammar'))

  const grammarIds = grammarKnowledgePoints.map((kp) => kp.id)

  if (grammarIds.length === 0) {
    logger.info('No grammar knowledge points found to delete')
    return
  }

  logger.info(`Found ${grammarIds.length} grammar knowledge points to delete`)

  // Delete lesson-knowledge point associations for grammar points only
  await db
    .delete(lessonKnowledgePointsTable)
    .where(inArray(lessonKnowledgePointsTable.knowledgePointId, grammarIds))

  logger.info('Deleted grammar lesson associations')

  // Delete grammar knowledge points
  await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'grammar'))

  logger.info(`Deleted ${grammarIds.length} grammar knowledge points`)

  logger.info('Database reset completed - grammar knowledge points dropped')
}

export async function cleanSentences() {
  logger.info('Resetting database - dropping all sentences...')

  // Delete all sentence-knowledge point associations first
  await db.delete(sentenceKnowledgePointsTable)
  logger.info('Deleted all sentence-knowledge point associations')

  // Delete all sentences
  await db.delete(sentencesTable)
  logger.info('Deleted all sentences')

  logger.info('Database reset completed - all sentences dropped')
}

async function createLesson(lessonNumber: number, vocabularies: MinaVocabulary[]) {
  const courseContentService = new CourseContentService(db)

  const noPos = vocabularies.filter((v) => !v.pos)
  for (const voc of noPos) {
    voc.pos = await findPosOfVocabulary(voc)
  }

  // insert
  courseContentService.createKnowledgePointsWithLesson(
    vocabularies.map((v) => ({
      lesson: lessonNumber,
      type: 'vocabulary',
      content: v.content,
      annotations: v.annotations,
      pos: v.pos,
      explanation: {
        zhCN: v.translation,
      },
      examples: [],
    }))
  )
}

async function createGrammarLesson(lessonNumber: number, grammarItems: MinaGrammar[]) {
  const courseContentService = new CourseContentService(db)

  // insert
  return courseContentService.createKnowledgePointsWithLesson(
    grammarItems.map((g) => ({
      lesson: lessonNumber,
      type: 'grammar',
      content: g.content,
      annotations: [],
      explanation: {
        zhCN: g.explanation,
      },
      examples: [],
    }))
  )
}

export async function createVocabularies() {
  logger.info('Creating lessons...')
  const data = getVocData()

  // Group by lesson
  const groupedData = data.reduce((acc, item) => {
    const lesson = item.lesson
    acc.set(lesson, acc.get(lesson) ?? [])
    acc.get(lesson)?.push(item)
    return acc
  }, new Map<number, MinaVocabulary[]>())

  let completedLessons = 0

  for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
    if (lessonNumber > 25) {
      continue // skip lesson 26 and above
    }

    logger.info(`Processing lesson ${lessonNumber}...`)
    await createLesson(lessonNumber, lessonVocabularies)

    completedLessons++
  }

  logger.info('All lessons created successfully')
}

export async function createGrammarLessons() {
  logger.info('Creating grammar lessons...')
  const data = getGrammarData()

  // Group by lesson
  const groupedData = data.reduce((acc, item) => {
    const lesson = item.lesson
    acc.set(lesson, acc.get(lesson) ?? [])
    acc.get(lesson)?.push(item)
    return acc
  }, new Map<number, MinaGrammar[]>())

  let completedLessons = 0

  for (const [lessonNumber, lessonGrammarItems] of groupedData.entries()) {
    logger.info(`Processing grammar for lesson ${lessonNumber}...`)
    await createGrammarLesson(lessonNumber, lessonGrammarItems)

    completedLessons++
  }

  logger.info('All grammar lessons created successfully')
}

export async function createSentencesForLesson(lessonNumber: number) {
  const courseContentService = new CourseContentService(db)

  const generatedSentences = await withRetry(() =>
    generateSentencesForLessonNumber(lessonNumber, DESIRED_SENTENCE_COUNT_PER_BATCH)
  )
  if (generatedSentences.length === 0) {
    logger.info(`No sentences generated for lesson number ${lessonNumber}`)
    return
  }
  logger.info(`Generated ${generatedSentences.length} sentences for lesson ${lessonNumber}`)
  for (const sentence of generatedSentences) {
    const { content, vocabularyIds, grammarIds, annotations, explanation } = sentence

    // Combine vocabulary and grammar IDs
    const allKnowledgePointIds = [...vocabularyIds, ...grammarIds]

    // Create sentence and associate with knowledge points in one call
    await courseContentService.createSentenceWithKnowledgePoints(
      {
        content,
        explanation,
        annotations,
        minLessonNumber: lessonNumber,
      },
      allKnowledgePointIds
    )

    logger.info(`Created sentence for lesson number ${lessonNumber}: "${content}"`)
  }
}

export async function createSentencesForLessons(
  untilLessonNumber: number = Number.POSITIVE_INFINITY
) {
  const courseContentService = new CourseContentService(db)

  // Get all lessons
  const { items: lessons } = await courseContentService.getLessons()

  const lessonsToProcess = lessons
    .filter((lesson) => lesson.number <= untilLessonNumber)
    .sort((a, b) => a.number - b.number)

  // get stats: each lesson's sentence count by knowledge point id
}
