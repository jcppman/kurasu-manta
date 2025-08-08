import { createRequire } from 'node:module'
import type { Db } from '@/drizzle'
import * as schema from '@/drizzle/schema'
import type * as DrizzleKit from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/pglite'

// workaround for https://github.com/drizzle-team/drizzle-orm/issues/2853
const require = createRequire(import.meta.url)
const { generateDrizzleJson, generateMigration } = require('drizzle-kit/api') as typeof DrizzleKit
// end of workaround

export const createInMemoryDb = async () => {
  const prevJson = generateDrizzleJson({})
  const curJson = generateDrizzleJson(schema, prevJson.id, undefined, 'snake_case')
  const statements = await generateMigration(prevJson, curJson)

  // Create Drizzle instance with logger disabled for tests
  const db = drizzle({ schema, casing: 'snake_case' })

  for (const statement of statements) {
    await db.execute(statement)
  }

  return db as unknown as Db
}
