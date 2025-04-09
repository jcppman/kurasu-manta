import { customType } from 'drizzle-orm/sqlite-core'

/**
 * Creates a custom SQLite JSON field type that automatically
 * serializes/deserializes JSON data and guarantees a non-null value
 */
export function jsonField<T>(name: string) {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text'
    },
    toDriver(value: T): string {
      return JSON.stringify(value)
    },
    fromDriver(value: string): T {
      if (!value) {
        throw new Error('JSON field expected non-null value but received empty string')
      }

      try {
        return JSON.parse(value)
      } catch (e) {
        console.error('Failed to parse JSON from database:', e)
        throw new Error('Failed to parse JSON value from database')
      }
    },
  })(name)
}

/**
 * Creates a custom SQLite JSON field type that automatically
 * serializes/deserializes JSON data and handles null/undefined values
 */
export function jsonFieldOptional<T>(name: string) {
  return customType<{ data: T | null; driverData: string }>({
    dataType() {
      return 'text'
    },
    toDriver(value: T | null): string {
      return JSON.stringify(value)
    },
    fromDriver(value: string): T | null {
      if (!value) return null

      try {
        return JSON.parse(value)
      } catch (e) {
        console.error('Failed to parse JSON from database:', e)
        return null
      }
    },
  })(name)
}

/**
 * Helper function to handle required results from database operations
 * Throws an error if no result is returned
 *
 * @param result - The result array from a database operation
 * @param mapper - A function to map the database result to a domain object
 * @param errorMessage - Custom error message (optional)
 * @returns The mapped result
 * @throws Error if no result is found
 */
export function requireResult<T, R>(
  result: T[] | undefined,
  mapper: (item: T) => R,
  errorMessage = 'No result returned from database'
): R {
  if (!result || result.length === 0 || !result[0]) {
    throw new Error(errorMessage)
  }
  return mapper(result[0])
}

/**
 * Helper function to handle optional results from database operations
 * Returns null if no result is returned
 *
 * @param result - The result array from a database operation
 * @param mapper - A function to map the database result to a domain object
 * @returns The mapped result or null if no result is found
 */
export function optionalResult<T, R>(result: T[] | undefined, mapper: (item: T) => R): R | null {
  if (!result || result.length === 0 || !result[0]) {
    return null
  }
  return mapper(result[0])
}
