import { logger } from '@/lib/server/utils'
import { generateVocabularyAudioClips } from './services/audio'
import {
  cleanGrammar,
  cleanVocabularies,
  createGrammarLessons,
  createVocabularies,
} from './services/data'

export async function execute() {
  await cleanGrammar()
  await createGrammarLessons()
  // biome-ignore lint/correctness/noConstantCondition: <explanation>
  if (false) {
    await cleanVocabularies()
    await createVocabularies()
    await generateVocabularyAudioClips()
  }
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
