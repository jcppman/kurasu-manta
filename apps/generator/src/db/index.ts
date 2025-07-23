import { DB_FILE_PATH } from '@/lib/constants'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const getDbClient = () => {
  return drizzle({
    connection: `file:${DB_FILE_PATH}`,
    schema,
    casing: 'snake_case',
  })
}

export { getDbClient }

export default getDbClient()
