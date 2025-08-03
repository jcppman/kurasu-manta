import { DEFAULT_MAX_CONCURRENCY, MAX_LLM_RETRY_TIMES } from '@/workflows/minna-jp-1/constants'
import { logger } from './utils'

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

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  backoffFactor?: number
  maxDelay?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: MAX_LLM_RETRY_TIMES,
  initialDelay: 1000,
  backoffFactor: 2,
  maxDelay: 10000,
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown
  let delay = opts.initialDelay

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxAttempts) {
        logger.error(`Operation failed after ${opts.maxAttempts} attempts:`, error)
        throw error
      }

      logger.warn(`Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms:`, error)

      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay)
    }
  }

  throw lastError
}
