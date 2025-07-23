import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// Database path - same as generator but from web app perspective
const DB_DIR = resolve(__dirname, '../../data')
const DB_FILE_NAME = 'local.db'
const DB_FILE_PATH = resolve(DB_DIR, DB_FILE_NAME)

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  casing: 'snake_case',
  dialect: 'sqlite',
  dbCredentials: {
    url: DB_FILE_PATH,
  },
})
