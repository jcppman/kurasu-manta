import * as schema from '@/db/schema'
import { DB_FILE_NAME } from '@/lib/server/constants'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

let db: ReturnType<typeof drizzle> | null = null

export function getDatabase() {
  if (!db) {
    const client = createClient({
      url: DB_FILE_NAME,
    })

    db = drizzle(client, {
      schema,
      casing: 'snake_case',
    })
  }

  return db
}

export default getDatabase
