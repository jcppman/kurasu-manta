import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import db from '@/db'
import { knowledgePointsTable, lessonKnowledgePointsTable } from '@/db/schema'
import { AUDIO_DIR } from '@/lib/server/constants'
import { logger } from '@/lib/server/utils'
import { CourseContentService } from '@repo/kurasu-manta-schema/service/course-content'
import { eq, inArray } from 'drizzle-orm'
import sh from 'shelljs'
import { type MinaVocabulary, getData } from './data'
import { findPosOfVocabulary, generateAudio } from './service/language'

async function cleanVocabularies() {
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

async function createLessons() {
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

async function generateVocabularyAudioClips() {
  const courseContentService = new CourseContentService(db)

  // get vocabularies that has no audio clips
  const { items } = await courseContentService.getVocabulariesByConditions(
    {
      hasAudio: false,
    },
    {
      page: 1,
      limit: 100,
    }
  )

  let processedCount = 0

  for (const voc of items) {
    const { sha1, content } = await generateAudio({
      content: voc.content,
      annotations: voc.annotations,
    })

    const dir = join(AUDIO_DIR, sha1.slice(0, 2))
    const filename = `${sha1}.mp3`

    // save audio to file system
    sh.mkdir('-p', dir)
    writeFileSync(join(dir, filename), content)

    // update database
    await courseContentService.partialUpdateKnowledgePoint(voc.id, {
      audio: sha1,
    })

    processedCount++
  }
}

export async function execute() {
  await cleanVocabularies()
  await createLessons()
  // await generateVocabularyAudioClips()
}

if (require.main === module) {
  execute()
    .then(() => {
      logger.info('Workflow completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Workflow failed:', error)
      process.exit(1)
    })
}
