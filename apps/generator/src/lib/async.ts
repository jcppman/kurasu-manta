import { DEFAULT_MAX_CONCURRENCY } from '@/workflows/minna-jp-1/constants'

export type ProcessResult<T, R> =
  | {
      success: true
      result: R
      item: T
    }
  | {
      success: false
      error: unknown
      item: T
    }

// Default concurrency for external API calls
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = DEFAULT_MAX_CONCURRENCY
): Promise<ProcessResult<T, R>[]> {
  if (concurrency <= 0) {
    throw new Error('Concurrency must be greater than 0')
  }

  if (items.length === 0) {
    return []
  }

  const results: ProcessResult<T, R>[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)

    const batchPromises = batch.map(async (item): Promise<ProcessResult<T, R>> => {
      try {
        const result = await processor(item)
        return { success: true, result, item } as const
      } catch (error) {
        return { success: false, error, item } as const
      }
    })

    const batchResults = await Promise.allSettled(batchPromises)

    for (const settledResult of batchResults) {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value)
      } else {
        results.push({
          success: false,
          error: settledResult.reason,
          item: batch[results.length % batch.length],
        } as const)
      }
    }
  }

  return results
}
