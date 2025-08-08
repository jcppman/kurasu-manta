import { describe, expect, test } from 'vitest'
import { optionalResult, requireResult } from './utils'

describe('requireResult', () => {
  test('maps valid result correctly', () => {
    const result = [{ id: 1, name: 'Test' }]
    const mapper = (item: { id: number; name: string }) => ({
      id: item.id,
      name: item.name.toUpperCase(),
    })

    const mapped = requireResult(result, mapper)
    expect(mapped).toEqual({ id: 1, name: 'TEST' })
  })

  test('throws error on undefined result', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item

    expect(() => {
      requireResult(result, mapper)
    }).toThrow(/No result returned from database/)
  })

  test('throws error on empty result array', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const result: any[] = []
    const mapper = (item: { id: number }) => item

    expect(() => {
      requireResult(result, mapper)
    }).toThrow(/No result returned from database/)
  })

  test('throws error with custom message', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item
    const errorMessage = 'Custom error message'

    expect(() => {
      requireResult(result, mapper, errorMessage)
    }).toThrow(/Custom error message/)
  })
})

describe('optionalResult', () => {
  test('maps valid result correctly', () => {
    const result = [{ id: 1, name: 'Test' }]
    const mapper = (item: { id: number; name: string }) => ({
      id: item.id,
      name: item.name.toUpperCase(),
    })

    const mapped = optionalResult(result, mapper)
    expect(mapped).toEqual({ id: 1, name: 'TEST' })
  })

  test('returns null on undefined result', () => {
    const result = undefined
    const mapper = (item: { id: number }) => item

    const mapped = optionalResult(result, mapper)
    expect(mapped).toBe(null)
  })

  test('returns null on empty result array', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const result: any[] = []
    const mapper = (item: { id: number }) => item

    const mapped = optionalResult(result, mapper)
    expect(mapped).toBe(null)
  })
})
