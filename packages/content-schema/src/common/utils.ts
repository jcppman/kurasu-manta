export function mergeWithPartialFiltered<T>(full: T, partial: Partial<T>): T {
  const result = { ...full }

  for (const key in partial) {
    if (partial[key] !== undefined) {
      result[key] = partial[key]
    }
  }

  return result
}
