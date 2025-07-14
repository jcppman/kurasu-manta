import { logger } from '@/lib/server/utils'
import { generateVocabularyAudioClips } from './services/audio'
import { cleanVocabularies, createLessons } from './services/data'

export async function execute() {
  // biome-ignore lint/correctness/noConstantCondition: <explanation>
  if (false) {
    await cleanVocabularies()
    await createLessons()
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
