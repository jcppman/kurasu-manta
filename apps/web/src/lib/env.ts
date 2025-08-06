import { resolve } from 'node:path'
import { z } from 'zod'

// Environment variable schema with validation
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database configuration
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  POSTGRES_DB: z.string().default('kurasu_manta'),

  // Audio storage configuration
  AUDIO_DIR: z.string().optional(),
})

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`)
      throw new Error(`Invalid environment configuration:\n${errorMessages.join('\n')}`)
    }
    throw error
  }
}

// Parsed and validated environment configuration
export const env = parseEnv()

// Derived/computed values
export const config = {
  ...env,

  // Database connection configuration
  database: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
  },

  // Audio storage configuration
  audio: {
    // Use absolute path to data directory at monorepo root
    localStorageDir: env.AUDIO_DIR ? resolve(env.AUDIO_DIR) : resolve('./data/audio'),
    useS3InProduction: env.NODE_ENV === 'production',
  },

  // Runtime flags
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const

// Type for the configuration object
export type Config = typeof config
export type Env = typeof env
