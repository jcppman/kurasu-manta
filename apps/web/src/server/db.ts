import * as schema from '@/db/schema'
import { config } from '@/lib/env'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool(config.database)

export const db = drizzle(pool, { schema, casing: 'snake_case' })

export { schema }
