import { logger } from './utils'
import run from './workflow/minna-jp-1'

run({
  steps: {
    init: false,
    createLesson: false,
    generateAudio: true,
  },
}).then(async () => {
  logger.info('Workflow completed successfully.')
})
