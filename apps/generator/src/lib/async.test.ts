import { describe, expect, test } from 'vitest'
import { processInParallel, withRetry } from './async'

describe('processInParallel', () => {
  test('should process empty array and return empty results', async () => {
    const result = await processInParallel([], async (x) => x * 2, 2)
    expect(result).toEqual([])
  })

  test('should process all items successfully with concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = async (x: number): Promise<number> => {
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay to test concurrency
      return x * 2
    }

    const results = await processInParallel(items, processor, 2)

    expect(results.length).toBe(5)

    // All should be successful
    results.forEach((result, index) => {
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.result).toBe(items[index] * 2)
        expect(result.item).toBe(items[index])
      }
    })
  })

  test('should handle mixed success and failure cases', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = async (x: number): Promise<number> => {
      if (x === 3) {
        throw new Error(`Failed for ${x}`)
      }
      return x * 2
    }

    const results = await processInParallel(items, processor, 3)

    expect(results.length).toBe(5)

    // Check successful results
    const successfulResults = results.filter((r) => r.success)
    expect(successfulResults.length).toBe(4)

    // Check failed result
    const failedResults = results.filter((r) => !r.success)
    expect(failedResults.length).toBe(1)

    const failedResult = failedResults[0]
    if (!failedResult.success) {
      expect(failedResult.item).toBe(3)
      expect(failedResult.error instanceof Error).toBe(true)
      if (failedResult.error instanceof Error) {
        expect(failedResult.error.message).toBe('Failed for 3')
      }
    }
  })

  test('should respect concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5, 6]
    let activeCount = 0
    let maxActiveCount = 0

    const processor = async (x: number): Promise<number> => {
      activeCount++
      maxActiveCount = Math.max(maxActiveCount, activeCount)

      await new Promise((resolve) => setTimeout(resolve, 50))

      activeCount--
      return x * 2
    }

    await processInParallel(items, processor, 2)

    // Should never exceed concurrency limit of 2
    expect(maxActiveCount <= 2).toBe(true)
    expect(maxActiveCount > 0).toBe(true)
  })

  test('should throw error for invalid concurrency', async () => {
    await expect(async () => {
      await processInParallel([1, 2, 3], async (x) => x, 0)
    }).rejects.toThrow('Concurrency must be greater than 0')

    await expect(async () => {
      await processInParallel([1, 2, 3], async (x) => x, -1)
    }).rejects.toThrow('Concurrency must be greater than 0')
  })

  test('should handle processor that always throws', async () => {
    const items = [1, 2, 3]
    const processor = async (x: number): Promise<number> => {
      throw new Error(`Always fails for ${x}`)
    }

    const results = await processInParallel(items, processor, 2)

    expect(results.length).toBe(3)

    results.forEach((result, index) => {
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.item).toBe(items[index])
        expect(result.error instanceof Error).toBe(true)
        if (result.error instanceof Error) {
          expect(result.error.message).toBe(`Always fails for ${items[index]}`)
        }
      }
    })
  })

  test('should maintain item order in results', async () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const processor = async (x: string): Promise<string> => {
      // Add random delay to test order preservation
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20))
      return x.toUpperCase()
    }

    const results = await processInParallel(items, processor, 3)

    expect(results.length).toBe(5)

    results.forEach((result, index) => {
      expect(result.item).toBe(items[index])
      if (result.success) {
        expect(result.result).toBe(items[index].toUpperCase())
      }
    })
  })

  test('should handle single item with concurrency 1', async () => {
    const items = [42]
    const processor = async (x: number): Promise<string> => `result-${x}`

    const results = await processInParallel(items, processor, 1)

    expect(results.length).toBe(1)
    expect(results[0].success).toBe(true)
    if (results[0].success) {
      expect(results[0].result).toBe('result-42')
      expect(results[0].item).toBe(42)
    }
  })

  test('should provide proper type narrowing', async () => {
    const items = [1, 2, 3]
    const processor = async (x: number): Promise<string> => x.toString()

    const results = await processInParallel(items, processor, 2)

    const successfulResults = results.filter((r) => r.success)
    const failedResults = results.filter((r) => !r.success)

    // TypeScript should properly narrow types after filtering
    for (const result of successfulResults) {
      // result.result should be string, not string | undefined
      const _resultLength: number = result.result.length
      expect(typeof result.result === 'string').toBe(true)
    }

    for (const result of failedResults) {
      // result.error should be available, result.result should not exist
      expect(result.error !== undefined).toBe(true)
      // @ts-expect-error - result should not have 'result' property when success is false
      const _shouldNotExist = result.result
    }
  })

  test('should use default concurrency when not specified', async () => {
    const items = [1, 2, 3, 4, 5]
    let activeCount = 0
    let maxActiveCount = 0

    const processor = async (x: number): Promise<number> => {
      activeCount++
      maxActiveCount = Math.max(maxActiveCount, activeCount)

      await new Promise((resolve) => setTimeout(resolve, 50))

      activeCount--
      return x * 2
    }

    // Call without specifying concurrency - should use default (5)
    const results = await processInParallel(items, processor)

    // All should be successful
    expect(results.length).toBe(5)
    results.forEach((result, index) => {
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.result).toBe(items[index] * 2)
      }
    })

    // Should use default concurrency (5), so all items should run concurrently
    expect(maxActiveCount).toBe(5)
  })
})

describe('withRetry', () => {
  test('should succeed on first attempt', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      return 'success'
    }

    const result = await withRetry(fn)

    expect(result).toBe('success')
    expect(callCount).toBe(1)
  })

  test('should retry and eventually succeed', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      if (callCount < 3) {
        throw new Error(`Attempt ${callCount} failed`)
      }
      return 'success'
    }

    const result = await withRetry(fn, { maxAttempts: 3 })

    expect(result).toBe('success')
    expect(callCount).toBe(3)
  })

  test('should fail after max attempts exceeded', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      throw new Error(`Attempt ${callCount} failed`)
    }

    await expect(async () => {
      await withRetry(fn, { maxAttempts: 3 })
    }).rejects.toThrow('Attempt 3 failed')

    expect(callCount).toBe(3)
  })

  test('should respect custom retry options', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      throw new Error(`Attempt ${callCount} failed`)
    }

    const startTime = Date.now()

    await expect(async () => {
      await withRetry(fn, {
        maxAttempts: 2,
        initialDelay: 100,
        backoffFactor: 1, // No backoff for predictable timing
      })
    }).rejects.toThrow()

    const endTime = Date.now()
    const elapsed = endTime - startTime

    expect(callCount).toBe(2)
    // Should have at least the initial delay
    expect(elapsed >= 100).toBe(true)
  })

  test('should apply exponential backoff', async () => {
    let callCount = 0
    const delays: number[] = []
    const fn = async () => {
      callCount++
      throw new Error(`Attempt ${callCount} failed`)
    }

    const startTime = Date.now()
    let lastTime = startTime

    const originalSetTimeout = global.setTimeout
    // @ts-ignore
    global.setTimeout = (
      callback: (...args: unknown[]) => void,
      delay?: number | undefined,
      ...args: unknown[]
    ) => {
      if (typeof delay === 'number') {
        delays.push(delay)
        const now = Date.now()
        lastTime = now
      }
      return originalSetTimeout(callback, delay, ...args)
    }

    try {
      await expect(async () => {
        await withRetry(fn, {
          maxAttempts: 3,
          initialDelay: 100,
          backoffFactor: 2,
        })
      }).rejects.toThrow()
    } finally {
      global.setTimeout = originalSetTimeout
    }

    expect(callCount).toBe(3)
    expect(delays.length).toBe(2) // 2 retries means 2 delays
    expect(delays[0]).toBe(100) // First delay
    expect(delays[1]).toBe(200) // Second delay (100 * 2)
  })

  test('should respect max delay', async () => {
    let callCount = 0
    const delays: number[] = []
    const fn = async () => {
      callCount++
      throw new Error(`Attempt ${callCount} failed`)
    }

    const originalSetTimeout = global.setTimeout
    // @ts-ignore
    global.setTimeout = (
      callback: (...args: unknown[]) => void,
      delay?: number | undefined,
      ...args: unknown[]
    ) => {
      if (typeof delay === 'number') {
        delays.push(delay)
      }
      return originalSetTimeout(callback, delay, ...args)
    }

    try {
      await expect(async () => {
        await withRetry(fn, {
          maxAttempts: 4,
          initialDelay: 100,
          backoffFactor: 3,
          maxDelay: 250,
        })
      }).rejects.toThrow()
    } finally {
      global.setTimeout = originalSetTimeout
    }

    expect(callCount).toBe(4)
    expect(delays.length).toBe(3) // 3 retries means 3 delays
    expect(delays[0]).toBe(100) // First delay
    expect(delays[1]).toBe(250) // Second delay capped at maxDelay (would be 300)
    expect(delays[2]).toBe(250) // Third delay also capped
  })

  test('should use default options when not specified', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      throw new Error(`Attempt ${callCount} failed`)
    }

    await expect(async () => {
      await withRetry(fn) // Using defaults
    }).rejects.toThrow()

    // Default maxAttempts is 3
    expect(callCount).toBe(3)
  })

  test('should preserve return type', async () => {
    const numberFn = async (): Promise<number> => 42
    const stringFn = async (): Promise<string> => 'hello'
    const objectFn = async (): Promise<{ value: string }> => ({ value: 'test' })

    const numberResult = await withRetry(numberFn)
    const stringResult = await withRetry(stringFn)
    const objectResult = await withRetry(objectFn)

    // TypeScript should infer correct types
    expect(typeof numberResult).toBe('number')
    expect(typeof stringResult).toBe('string')
    expect(typeof objectResult).toBe('object')

    expect(numberResult).toBe(42)
    expect(stringResult).toBe('hello')
    expect(objectResult).toEqual({ value: 'test' })
  })
})
