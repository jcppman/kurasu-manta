import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './schema'
export type Schema = typeof schema
export type Db = NodePgDatabase<Schema>
