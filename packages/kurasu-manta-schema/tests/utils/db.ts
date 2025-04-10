import * as schema from '@/drizzle/schema'
import { createClient } from '@libsql/client'
import { pushSQLiteSchema } from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/libsql'

export const createInMemoryDb = async () => {
  const client = createClient({
    url: ':memory:',
  })
  const { apply } = await pushSQLiteSchema(schema, drizzle(client))
  await apply()

  return drizzle(client, { schema })
}
