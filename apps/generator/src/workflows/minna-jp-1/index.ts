import { logger } from '@/lib/utils'
import { generateVocabularyAudioClips } from './services/audio'
import {
  cleanGrammar,
  cleanSentences,
  cleanVocabularies,
  createGrammarLessons,
  createSentencesForLesson,
  createSentencesForLessons,
  createVocabularies,
} from './services/data'

export async function execute() {
  // await cleanGrammar()
  // await createGrammarLessons()
  // await cleanVocabularies()
  // await createVocabularies()
  await generateVocabularyAudioClips()
  // await cleanSentences()
  // await createSentencesForLessons(3)
}

execute()
  .then(() => {
    logger.info('Workflow completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Workflow failed')
    logger.error(error)
    process.exit(1)
  })
