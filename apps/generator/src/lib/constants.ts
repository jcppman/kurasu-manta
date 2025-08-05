import { resolve } from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  AUDIO_DIR: z.string().optional(),
  OPENAI_API_KEY: z.string(),
  LOG_LEVEL: z.string().optional(),
})

const constants = envSchema.parse(process.env)

export const AUDIO_DIR = resolve(constants.AUDIO_DIR || './data', 'audio')

export default constants
export const { OPENAI_API_KEY, LOG_LEVEL } = constants
