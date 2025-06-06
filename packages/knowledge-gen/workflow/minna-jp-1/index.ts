import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AUDIO_DIR, DB_DIR } from '@/constants'
import initDb from '@/db'
import { type StepContext, WorkflowEngine, type WorkflowStep } from '@/src/workflow-engine'
import { logger } from '@/utils'
import type { WorkflowRunConfig } from '@/workflow/types'
import { CourseContentService } from '@repo/kurasu-manta-schema/service/course-content'
import sh from 'shelljs'
import { type MinaVocabulary, getData } from './data'
import { findPosOfVocabulary, generateAudio } from './service/language'

export default async function run(
  config?: WorkflowRunConfig<'init' | 'createLesson' | 'generateAudio'>
) {
  const { steps } = config ?? {
    steps: {
      init: true,
      createLesson: true,
      generateAudio: true,
    },
  }

  const engine = new WorkflowEngine()

  // Define workflow steps
  const workflowSteps: WorkflowStep[] = []

  if (steps.init) {
    workflowSteps.push({
      name: 'init',
      handler: async (context) => {
        context.logger.info('Initializing database...')
        await resetDatabase()
        context.logger.info('Database initialization completed')
      },
    })
  }

  if (steps.createLesson) {
    workflowSteps.push({
      name: 'createLesson',
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
  }

  if (steps.generateAudio) {
    workflowSteps.push({
      name: 'generateAudio',
      handler: async (context) => {
        context.logger.info('Generating audio clips...')
        await generateVocabularyAudioClips(context)
        context.logger.info('Audio generation completed')
      },
    })
  }

  // Start workflow
  const runId = await engine.start('minna-jp-1', workflowSteps, { steps })

  // Execute steps
  for (const step of workflowSteps) {
    await engine.executeStep(step.name, step.handler)
  }

  await engine.complete()
  logger.info(`Workflow minna-jp-1 completed with run ID: ${runId}`)

  async function resetDatabase() {
    const projectDir = resolve(__dirname, '..', '..')
    const pwd = sh.pwd()
    const dbDir = join(projectDir, DB_DIR)

    sh.rm('-rf', dbDir)
    sh.mkdir('-p', dbDir)
    sh.cd(projectDir)

    sh.exec('drizzle-kit push')
    sh.cd(pwd)
  }

  async function createLesson(lessonNumber: number, vocabularies: MinaVocabulary[]) {
    const db = initDb()
    const courseContentService = new CourseContentService(db)

    const noPos = vocabularies.filter((v) => !v.pos)
    for (const voc of noPos) {
      const pos = await findPosOfVocabulary(voc)
      voc.pos = pos
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
    const db = initDb()
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
}
