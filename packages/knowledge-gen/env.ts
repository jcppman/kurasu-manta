import { z } from 'zod'

const envSchema = z.object({
  DB_DIR: z.string(),
  DB_FILE_NAME: z.string(),
  OPENAI_API_KEY: z.string(),
})

const env = envSchema.parse(process.env)

export default env
export const { DB_DIR, DB_FILE_NAME, OPENAI_API_KEY } = env
