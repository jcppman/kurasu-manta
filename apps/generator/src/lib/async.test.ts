import assert from 'node:assert'
import { describe, it, test } from 'node:test'
import { processInParallel } from './async'

describe('processInParallel', () => {
  test('should process empty array and return empty results', async () => {
    const result = await processInParallel([], async (x) => x * 2, 2)
    assert.deepStrictEqual(result, [])
  })

  test('should process all items successfully with concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = async (x: number): Promise<number> => {
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay to test concurrency
      return x * 2
    }

    const results = await processInParallel(items, processor, 2)

    assert.strictEqual(results.length, 5)

    // All should be successful
    results.forEach((result, index) => {
      assert.strictEqual(result.success, true)
      if (result.success) {
        assert.strictEqual(result.result, items[index] * 2)
        assert.strictEqual(result.item, items[index])
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

    assert.strictEqual(results.length, 5)

    // Check successful results
    const successfulResults = results.filter((r) => r.success)
    assert.strictEqual(successfulResults.length, 4)

    // Check failed result
    const failedResults = results.filter((r) => !r.success)
    assert.strictEqual(failedResults.length, 1)

    const failedResult = failedResults[0]
    if (!failedResult.success) {
      assert.strictEqual(failedResult.item, 3)
      assert.ok(failedResult.error instanceof Error)
      assert.strictEqual(failedResult.error.message, 'Failed for 3')
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
    assert.ok(maxActiveCount <= 2)
    assert.ok(maxActiveCount > 0)
  })

  test('should throw error for invalid concurrency', async () => {
    await assert.rejects(
      async () => {
        await processInParallel([1, 2, 3], async (x) => x, 0)
      },
      { message: 'Concurrency must be greater than 0' }
    )

    await assert.rejects(
      async () => {
        await processInParallel([1, 2, 3], async (x) => x, -1)
      },
      { message: 'Concurrency must be greater than 0' }
    )
  })

  test('should handle processor that always throws', async () => {
    const items = [1, 2, 3]
    const processor = async (x: number): Promise<number> => {
      throw new Error(`Always fails for ${x}`)
    }

    const results = await processInParallel(items, processor, 2)

    assert.strictEqual(results.length, 3)

    results.forEach((result, index) => {
      assert.strictEqual(result.success, false)
      if (!result.success) {
        assert.strictEqual(result.item, items[index])
        assert.ok(result.error instanceof Error)
        assert.strictEqual(result.error.message, `Always fails for ${items[index]}`)
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

    assert.strictEqual(results.length, 5)

    results.forEach((result, index) => {
      assert.strictEqual(result.item, items[index])
      if (result.success) {
        assert.strictEqual(result.result, items[index].toUpperCase())
      }
    })
  })

  test('should handle single item with concurrency 1', async () => {
    const items = [42]
    const processor = async (x: number): Promise<string> => `result-${x}`

    const results = await processInParallel(items, processor, 1)

    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].success, true)
    if (results[0].success) {
      assert.strictEqual(results[0].result, 'result-42')
      assert.strictEqual(results[0].item, 42)
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
      assert.ok(typeof result.result === 'string')
    }

    for (const result of failedResults) {
      // result.error should be available, result.result should not exist
      assert.ok(result.error !== undefined)
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
    assert.strictEqual(results.length, 5)
    results.forEach((result, index) => {
      assert.strictEqual(result.success, true)
      if (result.success) {
        assert.strictEqual(result.result, items[index] * 2)
      }
    })

    // Should use default concurrency (5), so all items should run concurrently
    assert.strictEqual(maxActiveCount, 5)
  })
})
