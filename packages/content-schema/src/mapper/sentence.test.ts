import type { Annotation } from '@/zod/annotation'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { describe, expect, test } from 'vitest'
import { mapCreateSentenceToDrizzle, mapDrizzleToSentence, mapSentenceToDrizzle } from './sentence'

describe('sentence mappers', () => {
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
    minLessonNumber: 1,
  }

  const sentence: Sentence = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    annotations: mockAnnotations,
    audio: 'test-audio.mp3',
    minLessonNumber: 1,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  }

  const drizzleRow = {
    id: 1,
    content: 'これはテストの文です',
    explanation: mockExplanation,
    annotations: mockAnnotations,
    audio: 'test-audio.mp3' as string | null,
    minLessonNumber: 1,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  }

  test('mapCreateSentenceToDrizzle', () => {
    const result = mapCreateSentenceToDrizzle(createSentence)

    expect(result).toEqual({
      content: 'これはテストの文です',
      explanation: mockExplanation,
      annotations: mockAnnotations,
      audio: 'test-audio.mp3',
      minLessonNumber: 1,
    })
  })

  test('mapCreateSentenceToDrizzle with minimal data', () => {
    const minimalSentence: CreateSentence = {
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
      annotations: [],
      minLessonNumber: 2,
    }

    const result = mapCreateSentenceToDrizzle(minimalSentence)

    expect(result).toEqual({
      content: 'シンプルな文',
      explanation: { en: 'Simple sentence', cn: '简单句子' },
      annotations: [],
      audio: undefined,
      minLessonNumber: 2,
    })
  })

  test('mapSentenceToDrizzle', () => {
    const result = mapSentenceToDrizzle(sentence)

    expect(result).toEqual({
      id: 1,
      content: 'これはテストの文です',
      explanation: mockExplanation,
      annotations: mockAnnotations,
      audio: 'test-audio.mp3',
      minLessonNumber: 1,
    })
  })

  test('mapDrizzleToSentence', () => {
    const result = mapDrizzleToSentence(drizzleRow)

    expect(result).toEqual(sentence)
  })

  test('mapDrizzleToSentence with different explanation', () => {
    const differentExplanation: LocalizedText = {
      en: 'Different explanation',
      cn: '不同的解释',
    }
    const drizzleRowWithDifferentExplanation = {
      ...drizzleRow,
      explanation: differentExplanation,
    }

    const result = mapDrizzleToSentence(drizzleRowWithDifferentExplanation)

    expect(result).toEqual({
      ...sentence,
      explanation: differentExplanation,
    })
  })

  test('round trip mapping preserves data', () => {
    // Create → Drizzle → Sentence
    const drizzleInsert = mapCreateSentenceToDrizzle(createSentence)
    const drizzleRowFromInsert = {
      id: 1,
      ...drizzleInsert,
      audio: drizzleInsert.audio ?? null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    }
    const sentenceFromDrizzle = mapDrizzleToSentence(drizzleRowFromInsert)

    expect(sentenceFromDrizzle.content).toBe(createSentence.content)
    expect(sentenceFromDrizzle.explanation).toEqual(createSentence.explanation)
    expect(sentenceFromDrizzle.annotations).toEqual(createSentence.annotations)
    expect(sentenceFromDrizzle.audio).toBe(createSentence.audio)
    expect(sentenceFromDrizzle.minLessonNumber).toBe(createSentence.minLessonNumber)
    expect(sentenceFromDrizzle.id).toBe(1)
  })
})
