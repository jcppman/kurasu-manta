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
