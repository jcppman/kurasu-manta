import { resolve } from 'node:path'
import * as schema from '@/db/schema'
import { drizzle } from 'drizzle-orm/libsql'

// Database path - same as generator but from web app perspective
const DB_DIR = process.env.DB_DIR || './db'
const DB_FILE_NAME = process.env.DB_FILE_NAME || 'local.db'
const DB_FILE_PATH = resolve(DB_DIR, DB_FILE_NAME)

export const db = drizzle({
  connection: `file:${DB_FILE_PATH}`,
  schema,
  casing: 'snake_case',
})
