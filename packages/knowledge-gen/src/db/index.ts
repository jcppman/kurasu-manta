import { DB_FILE_NAME } from '@env'
import { createClient } from '@libsql/client'
import { LibSQLDatabase, drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Create a libSQL client
const client = createClient({
  url: DB_FILE_NAME,
})

// Create a database instance with the schema
export const db = drizzle(client, { schema })
