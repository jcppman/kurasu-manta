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
