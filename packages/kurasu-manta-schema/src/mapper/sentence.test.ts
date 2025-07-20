import assert from 'node:assert'
import test from 'node:test'
import type { Annotation } from '@/zod/annotation'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { mapCreateSentenceToDrizzle, mapDrizzleToSentence, mapSentenceToDrizzle } from './sentence'

test('sentence mappers', async (t) => {
  const mockExplanation: LocalizedText = {
    en: 'This is a test sentence',
    cn: '这是一个测试句子',
  }

  const mockAnnotations: Annotation[] = [
    { loc: 0, len: 3, type: 'pronoun', content: 'これ' },
    { loc: 4, len: 6, type: 'verb', content: 'テスト' },
  ]

  const createSentence: CreateSentence = {
    content: 'これはテストの文です',
    explanation: mockExplanation,
    annotations: mockAnnotations,
    audio: 'test-audio.mp3',
  }

  const sentence: Sentence = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    annotations: mockAnnotations,
    audio: 'test-audio.mp3',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  const drizzleRow = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    annotations: mockAnnotations,
    audio: 'test-audio.mp3' as string | null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  await t.test('mapCreateSentenceToDrizzle', () => {
    const result = mapCreateSentenceToDrizzle(createSentence)

    assert.deepStrictEqual(result, {
      content: 'これはテストの文です',
      explanation: mockExplanation,
      annotations: mockAnnotations,
      audio: 'test-audio.mp3',
    })
  })

  await t.test('mapCreateSentenceToDrizzle with minimal data', () => {
    const minimalSentence: CreateSentence = {
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
      annotations: [],
    }

    const result = mapCreateSentenceToDrizzle(minimalSentence)

    assert.deepStrictEqual(result, {
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
      annotations: [],
      audio: undefined,
    })
  })

  await t.test('mapSentenceToDrizzle', () => {
    const result = mapSentenceToDrizzle(sentence)

    assert.deepStrictEqual(result, {
      id: 1,
      content: 'これはテストの文です',
      explanation: mockExplanation,
      annotations: mockAnnotations,
      audio: 'test-audio.mp3',
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
      audio: drizzleInsert.audio ?? null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
    const sentenceFromDrizzle = mapDrizzleToSentence(drizzleRowFromInsert)

    assert.strictEqual(sentenceFromDrizzle.content, createSentence.content)
    assert.deepStrictEqual(sentenceFromDrizzle.explanation, createSentence.explanation)
    assert.deepStrictEqual(sentenceFromDrizzle.annotations, createSentence.annotations)
    assert.strictEqual(sentenceFromDrizzle.audio, createSentence.audio)
    assert.strictEqual(sentenceFromDrizzle.id, 1)
  })
})
