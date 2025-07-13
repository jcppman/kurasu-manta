import assert from 'node:assert'
import test from 'node:test'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { mapCreateSentenceToDrizzle, mapDrizzleToSentence, mapSentenceToDrizzle } from './sentence'

test('sentence mappers', async (t) => {
  const mockExplanation: LocalizedText = {
    en: 'This is a test sentence',
    cn: '这是一个测试句子',
  }

  const createSentence: CreateSentence = {
    content: 'これはテストの文です',
    explanation: mockExplanation,
  }

  const sentence: Sentence = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  const drizzleRow = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  await t.test('mapCreateSentenceToDrizzle', () => {
    const result = mapCreateSentenceToDrizzle(createSentence)

    assert.deepStrictEqual(result, {
      content: 'これはテストの文です',
      explanation: mockExplanation,
    })
  })

  await t.test('mapCreateSentenceToDrizzle with minimal data', () => {
    const minimalSentence: CreateSentence = {
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
    }

    const result = mapCreateSentenceToDrizzle(minimalSentence)

    assert.deepStrictEqual(result, {
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
    })
  })

  await t.test('mapSentenceToDrizzle', () => {
    const result = mapSentenceToDrizzle(sentence)

    assert.deepStrictEqual(result, {
      id: 1,
      content: 'これはテストの文です',
      explanation: mockExplanation,
    })
  })

  await t.test('mapDrizzleToSentence', () => {
    const result = mapDrizzleToSentence(drizzleRow)

    assert.deepStrictEqual(result, sentence)
  })

  await t.test('mapDrizzleToSentence with different explanation', () => {
    const differentExplanation: LocalizedText = {
      en: 'Different explanation',
      cn: '不同的解释',
    }
    const drizzleRowWithDifferentExplanation = {
      ...drizzleRow,
      explanation: differentExplanation,
    }

    const result = mapDrizzleToSentence(drizzleRowWithDifferentExplanation)

    assert.deepStrictEqual(result, {
      ...sentence,
      explanation: differentExplanation,
    })
  })

  await t.test('round trip mapping preserves data', () => {
    // Create → Drizzle → Sentence
    const drizzleInsert = mapCreateSentenceToDrizzle(createSentence)
    const drizzleRowFromInsert = {
      id: 1,
      ...drizzleInsert,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
    const sentenceFromDrizzle = mapDrizzleToSentence(drizzleRowFromInsert)

    assert.strictEqual(sentenceFromDrizzle.content, createSentence.content)
    assert.deepStrictEqual(sentenceFromDrizzle.explanation, createSentence.explanation)
    assert.strictEqual(sentenceFromDrizzle.id, 1)
  })
})
