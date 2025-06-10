import { resolve } from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  DB_DIR: z.string(),
  DB_FILE_NAME: z.string(),
  OPENAI_API_KEY: z.string(),
  LOG_LEVEL: z.string().optional(),
})

const constants = envSchema.parse(process.env)

export const AUDIO_DIR = resolve(constants.DB_DIR, 'audio')

export default constants
export const { DB_DIR, DB_FILE_NAME, OPENAI_API_KEY, LOG_LEVEL } = constants
