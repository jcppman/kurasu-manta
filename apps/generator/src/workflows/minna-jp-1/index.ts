import { logger } from '@/lib/utils'
import { generateSentenceAudioClips, generateVocabularyAudioClips } from './services/audio'
import {
  cleanGrammar,
  cleanSentences,
  cleanVocabularies,
  createGrammarLessons,
  createSentencesForLessons,
  createVocabularies,
  updateExplanationsFromDataSource,
} from './services/data'

export async function execute({
  untilLessonNumber,
  clean = false,
}: { untilLessonNumber: number; clean: boolean }) {
  if (clean) {
    await cleanGrammar()
    await cleanVocabularies()
    await cleanSentences()
  }

  await createGrammarLessons(untilLessonNumber)
  await createVocabularies(untilLessonNumber)
  await createSentencesForLessons(untilLessonNumber)

  await generateVocabularyAudioClips()
  await generateSentenceAudioClips()
  // await updateExplanationsFromDataSource()
}

execute({
  untilLessonNumber: 5,
  clean: false,
})
  .then(() => {
    logger.info('Workflow completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Workflow failed')
    logger.error(error)
    process.exit(1)
  })
