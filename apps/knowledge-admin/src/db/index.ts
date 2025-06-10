import { DB_FILE_NAME } from '@/lib/server/constants'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const getDbClient = () => {
  const db = drizzle(DB_FILE_NAME, {
    schema,
    casing: 'snake_case',
  })

  return db
}

export { getDbClient }

export default getDbClient()
