import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from './schema'
export type Schema = typeof schema
export type Db = LibSQLDatabase<Schema>
