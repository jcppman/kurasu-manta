import { DB_FILE_NAME } from '@/env'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export default function init() {
  const db = drizzle(DB_FILE_NAME, {
    schema,
    casing: 'snake_case',
  })

  return db
}
