import { DB_FILE_NAME } from '@/lib/server/constants'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  casing: 'snake_case',
  dialect: 'sqlite',
  dbCredentials: {
    url: DB_FILE_NAME,
  },
})
