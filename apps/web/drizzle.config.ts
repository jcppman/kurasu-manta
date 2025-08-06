import { defineConfig } from 'drizzle-kit'
import { config } from './src/lib/env'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  casing: 'snake_case',
  dialect: 'postgresql',
  dbCredentials: config.database,
})
