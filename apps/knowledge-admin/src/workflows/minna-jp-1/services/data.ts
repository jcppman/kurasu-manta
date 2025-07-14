import db from '@/db'
import { knowledgePointsTable, lessonKnowledgePointsTable } from '@/db/schema'
import { logger } from '@/lib/server/utils'
import { type MinaVocabulary, getData } from '@/workflows/minna-jp-1/data'
import { findPosOfVocabulary } from '@/workflows/minna-jp-1/services/vocabulary'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { eq, inArray } from 'drizzle-orm'

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

export async function createLessons() {
  logger.info('Creating lessons...')
  const data = getData()

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
