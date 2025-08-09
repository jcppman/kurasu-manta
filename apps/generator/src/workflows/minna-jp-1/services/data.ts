import db from '@/db'
import { knowledgePointsTable, sentenceKnowledgePointsTable, sentencesTable } from '@/db/schema'
import { withRetry } from '@/lib/async'
import { logger } from '@/lib/utils'
import {
  generateSentencesForLessonNumber,
  getTargetSentenceCount,
} from '@/workflows/minna-jp-1/services/sentence'
import { findPosOfVocabulary } from '@/workflows/minna-jp-1/services/vocabulary'
import { CourseContentService } from '@kurasu-manta/content-schema/service'
import { eq } from 'drizzle-orm'
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

  // Note: Knowledge points are directly deleted via foreign key constraint

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

  // Note: Knowledge points are directly deleted via foreign key constraint

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

  // 1. Get or create lesson by number
  let lesson = await courseContentService.getLessonByNumber(lessonNumber)
  if (!lesson) {
    lesson = await courseContentService.createLesson({
      number: lessonNumber,
      title: `Lesson ${lessonNumber}`,
    })
  }

  // 2. Process vocabularies (POS lookup)
  const noPos = vocabularies.filter((v) => !v.pos)
  for (const voc of noPos) {
    voc.pos = await findPosOfVocabulary(voc)
  }

  // 3. Create knowledge points with proper lesson ID
  await courseContentService.createKnowledgePoints(
    vocabularies.map((v) => ({
      lessonId: lesson.id, // Real database ID
      type: 'vocabulary',
      content: v.content,
      annotations: v.annotations,
      pos: v.pos,
      explanation: {
        zhCN: v.translation,
      },
      accent: v.accent,
    }))
  )
}

async function createGrammarLesson(lessonNumber: number, grammarItems: MinaGrammar[]) {
  const courseContentService = new CourseContentService(db)

  // 1. Get or create lesson by number
  let lesson = await courseContentService.getLessonByNumber(lessonNumber)
  if (!lesson) {
    lesson = await courseContentService.createLesson({
      number: lessonNumber,
      title: `Lesson ${lessonNumber}`,
    })
  }

  // 2. Create grammar knowledge points with proper lesson ID
  return courseContentService.createKnowledgePoints(
    grammarItems.map((g) => ({
      lessonId: lesson.id, // Real database ID
      type: 'grammar',
      content: g.content,
      annotations: [],
      explanation: {
        zhCN: g.explanation,
      },
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

  const generatedSentences = await withRetry(() => generateSentencesForLessonNumber(lessonNumber))
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
    .filter((lesson) => lesson.number < untilLessonNumber + 1)
    .sort((a, b) => a.number - b.number)

  let currentProgress = 0
  while (currentProgress < lessonsToProcess.length) {
    const currentLesson = lessonsToProcess[currentProgress]

    // Get sentence stats with pos info for all knowledge points in this lesson
    const stats = await courseContentService.getLessonKnowledgePointSentenceStats(currentLesson.id)

    // Check which knowledge points need more sentences using the efficient approach
    const knowledgePointsNeedingSentences = stats.filter((stat) => {
      const targetCount = getTargetSentenceCount(stat.type, stat.pos)
      return stat.sentenceCount < targetCount
    })

    logger.info(
      `Remaining knowledge points needing sentences in lesson ${currentLesson.number}: ${knowledgePointsNeedingSentences.length}/${stats.length}`
    )
    if (knowledgePointsNeedingSentences.length > 0) {
      logger.info(`Creating sentences for lesson ${lessonsToProcess[currentProgress].number}...`)
      await createSentencesForLesson(lessonsToProcess[currentProgress].number)
    } else {
      logger.info(
        `All knowledge points in ${lessonsToProcess[currentProgress].number} has sufficient sentences`
      )
      currentProgress++
    }
  }

  logger.info('All sentences created successfully for lessons up to', untilLessonNumber)
}
