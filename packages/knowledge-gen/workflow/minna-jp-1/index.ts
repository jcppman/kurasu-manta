import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AUDIO_DIR, DB_DIR } from '@/constants'
import initDb from '@/db'
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

  // remove db and create table
  if (steps.init) {
    await resetDatabase()
  }

  const db = initDb()
  const courseContentService = new CourseContentService(db)

  // create lesson and text context
  if (steps.createLesson) {
    const data = getData()
    // group by lesson
    const groupedData = data.reduce((acc, item) => {
      const lesson = item.lesson
      acc.set(lesson, acc.get(lesson) ?? [])

      acc.get(lesson)?.push(item)
      return acc
    }, new Map<number, MinaVocabulary[]>())

    const lesson1 = groupedData.get(1)
    if (!lesson1) {
      throw new Error('Lesson 1 not found')
    }
    for (const lessonVocabularies of groupedData.values()) {
      const lesson = lessonVocabularies[0]?.lesson ?? Number.POSITIVE_INFINITY
      if (lesson > 25) {
        // skip lesson 26 and above
        continue
      }
      await createLesson(lessonVocabularies[0]?.lesson ?? 0, lessonVocabularies)
    }
  }

  // generate audio
  if (steps.generateAudio) {
    await generateVocabularyAudioClips()
  }

  async function resetDatabase() {
    logger.info('Initializing database...')

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
    logger.info(
      `Creating content for lesson ${lessonNumber}, ${vocabularies.length} vocabularies...`
    )

    const noPos = vocabularies.filter((v) => !v.pos)
    for (const voc of noPos) {
      const pos = await findPosOfVocabulary(voc)
      logger.info(`Found pos for ${voc.content}: ${pos}`)
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

  async function generateVocabularyAudioClips() {
    logger.info('Creating audio...')

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

    for (const voc of items) {
      const { sha1, content } = await generateAudio({
        content: voc.content,
        annotations: voc.annotations,
      })
      logger.info(`Created audio for ${voc.content}`)

      const dir = join(AUDIO_DIR, sha1.slice(0, 2))
      const filename = `${sha1}.mp3`

      logger.info(`Saving it to ${dir} as ${filename}`)

      // save audio to file system
      sh.mkdir('-p', dir)

      writeFileSync(join(dir, filename), content)

      // update database
      await courseContentService.partialUpdateKnowledgePoint(voc.id, {
        audio: sha1,
      })
      logger.info(`Updated audio for ${voc.content} in database`)
    }
  }
}
