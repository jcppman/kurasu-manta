import { logger } from '@/lib/server/utils'
import {
  cleanVocabularies,
  createLessons,
  generateVocabularyAudioClips,
} from './services/data-generation'

export async function execute() {
  // await cleanVocabularies()
  // await createLessons()
  await generateVocabularyAudioClips()
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
