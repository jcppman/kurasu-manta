import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import db from '@/db'
import { knowledgePointsTable, lessonKnowledgePointsTable } from '@/db/schema'
import { AUDIO_DIR } from '@/lib/server/constants'
import { defineWorkflow } from '@/lib/workflow-api'
import type { StepContext } from '@/lib/workflow-engine'
import { CourseContentService } from '@repo/kurasu-manta-schema/service/course-content'
import { eq, inArray } from 'drizzle-orm'
import sh from 'shelljs'
import { type MinaVocabulary, getData } from './data'
import { findPosOfVocabulary, generateAudio } from './service/language'

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
        cn: v.translation,
      },
      examples: [],
    }))
  )
}

async function generateVocabularyAudioClips(context: StepContext) {
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
  const totalItems = items.length

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
    const progress = Math.round((processedCount / totalItems) * 100)
    await context.updateProgress(
      progress,
      `Generated audio for "${voc.content}" (${processedCount}/${totalItems})`
    )
  }
}

// New workflow definition using defineWorkflow API
export const workflowDefinition = defineWorkflow(
  'minna-jp-1',
  ({ defineStep }) => {
    defineStep('Clean vocabularies', {
      description: 'Drop vocabulary knowledge points',
      dependencies: [],
      handler: async (context) => {
        context.logger.info('Resetting database - dropping vocabulary knowledge points...')

        // First, get all vocabulary knowledge point IDs
        const vocabularyKnowledgePoints = await db
          .select({ id: knowledgePointsTable.id })
          .from(knowledgePointsTable)
          .where(eq(knowledgePointsTable.type, 'vocabulary'))

        const vocabularyIds = vocabularyKnowledgePoints.map((kp) => kp.id)

        if (vocabularyIds.length === 0) {
          context.logger.info('No vocabulary knowledge points found to delete')
          await context.updateProgress(100, 'No vocabulary points to delete')
          return
        }

        context.logger.info(`Found ${vocabularyIds.length} vocabulary knowledge points to delete`)

        // Delete lesson-knowledge point associations for vocabulary points only
        await db
          .delete(lessonKnowledgePointsTable)
          .where(inArray(lessonKnowledgePointsTable.knowledgePointId, vocabularyIds))

        context.logger.info('Deleted vocabulary lesson associations')
        await context.updateProgress(50, 'Vocabulary lesson associations cleared')

        // Delete vocabulary knowledge points
        await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'vocabulary'))

        context.logger.info(`Deleted ${vocabularyIds.length} vocabulary knowledge points`)

        context.logger.info('Database reset completed - vocabulary knowledge points dropped')
        await context.updateProgress(100, 'Vocabulary knowledge points deleted')
      },
    })
    defineStep('createLesson', {
      description: 'Process vocabulary data and create lessons',
      dependencies: [],
      handler: async (context) => {
        context.logger.info('Creating lessons...')
        const data = getData()

        // Group by lesson
        const groupedData = data.reduce((acc, item) => {
          const lesson = item.lesson
          acc.set(lesson, acc.get(lesson) ?? [])
          acc.get(lesson)?.push(item)
          return acc
        }, new Map<number, MinaVocabulary[]>())

        const totalLessons = Array.from(groupedData.keys()).filter((lesson) => lesson <= 25).length
        let completedLessons = 0

        for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
          if (lessonNumber > 25) {
            continue // skip lesson 26 and above
          }

          context.logger.info(`Processing lesson ${lessonNumber}...`)
          await createLesson(lessonNumber, lessonVocabularies)

          completedLessons++
          const progress = Math.round((completedLessons / totalLessons) * 100)
          await context.updateProgress(progress, `Processed lesson ${lessonNumber}`)
        }

        context.logger.info('All lessons created successfully')
      },
    })

    defineStep('generateAudio', {
      description: 'Generate TTS audio files for vocabulary',
      dependencies: ['createLesson'],
      timeout: 300000, // 5 minutes timeout for audio generation
      handler: async (context) => {
        context.logger.info('Generating audio clips...')
        await generateVocabularyAudioClips(context)
        context.logger.info('Audio generation completed')
      },
    })
  },
  {
    description: 'Minna no Nihongo 1 vocabulary processing workflow',
    tags: ['minna', 'japanese', 'vocabulary'],
    version: '1.0.0',
    author: 'Kurasu Manta',
  }
)
