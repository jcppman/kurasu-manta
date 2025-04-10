import assert from 'node:assert'
import test from 'node:test'
import { optionalResult, requireResult } from './utils'

test('requireResult', async (t) => {
  await t.test('maps valid result correctly', () => {
    const result = [{ id: 1, name: 'Test' }]
    const mapper = (item: { id: number; name: string }) => ({
      id: item.id,
      name: item.name.toUpperCase(),
    })

    const mapped = requireResult(result, mapper)
    assert.deepStrictEqual(mapped, { id: 1, name: 'TEST' })
  })

  await t.test('throws error on undefined result', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item

    assert.throws(() => {
      requireResult(result, mapper)
    }, /No result returned from database/)
  })

  await t.test('throws error on empty result array', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const result: any[] = []
    const mapper = (item: { id: number }) => item

    assert.throws(() => {
      requireResult(result, mapper)
    }, /No result returned from database/)
  })

  await t.test('throws error with custom message', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item
    const errorMessage = 'Custom error message'

    assert.throws(() => {
      requireResult(result, mapper, errorMessage)
    }, /Custom error message/)
  })
})

test('optionalResult', async (t) => {
  await t.test('maps valid result correctly', () => {
    const result = [{ id: 1, name: 'Test' }]
    const mapper = (item: { id: number; name: string }) => ({
      id: item.id,
      name: item.name.toUpperCase(),
    })

    const mapped = optionalResult(result, mapper)
    assert.deepStrictEqual(mapped, { id: 1, name: 'TEST' })
  })

  await t.test('returns null on undefined result', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item

    const mapped = optionalResult(result, mapper)
    assert.strictEqual(mapped, null)
  })

  await t.test('returns null on empty result array', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const result: any[] = []
    const mapper = (item: { id: number }) => item

    const mapped = optionalResult(result, mapper)
    assert.strictEqual(mapped, null)
  })
})
