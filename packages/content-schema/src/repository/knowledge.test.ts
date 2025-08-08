import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { createInMemoryDb } from '@tests/utils/db'
import { describe, expect, test } from 'vitest'
import { KnowledgeRepository } from './knowledge'
import { LessonRepository } from './lesson'
import { SentenceRepository } from './sentence'

describe('KnowledgeRepository - withSentences option', () => {
  describe('getById with withSentences option', () => {
    test('should return knowledge point without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const sentenceRepo = new SentenceRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create a knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      // Create a sentence and associate it
      const sentence = await sentenceRepo.create({
        content: 'こんにちは、田中さん。',
        explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        annotations: [],
        minLessonNumber: 1,
      })
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

      const result = await knowledgeRepo.getById(kp.id)

      expect(result).toBeTruthy()
      expect(result?.id).toBe(kp.id)
      expect(result && 'sentences' in result).toBe(false)
    })

    test('should return knowledge point with sentences when withSentences is true', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const sentenceRepo = new SentenceRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create a knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      // Create sentences and associate them
      const sentence1 = await sentenceRepo.create({
        content: 'こんにちは、田中さん。',
        explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        annotations: [],
        minLessonNumber: 1,
      })
      const sentence2 = await sentenceRepo.create({
        content: 'こんにちは、皆さん。',
        explanation: { en: 'Hello, everyone.', ja: 'こんにちは、皆さん。' },
        annotations: [],
        minLessonNumber: 1,
      })

      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp.id)

      const result = await knowledgeRepo.getById(kp.id, { withSentences: true })

      expect(result).toBeTruthy()
      expect(result?.id).toBe(kp.id)
      expect(result && 'sentences' in result).toBe(true)
      expect(result?.sentences?.length).toBe(2)
      expect(result?.sentences?.some((s) => s.content === 'こんにちは、田中さん。')).toBeTruthy()
      expect(result?.sentences?.some((s) => s.content === 'こんにちは、皆さん。')).toBeTruthy()
    })

    test('should return knowledge point with empty sentences array when no sentences are associated', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create a knowledge point without sentences
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      const result = await knowledgeRepo.getById(kp.id, { withSentences: true })

      expect(result).toBeTruthy()
      expect(result?.id).toBe(kp.id)
      expect(result && 'sentences' in result).toBe(true)
      expect(result?.sentences?.length).toBe(0)
    })
  })

  describe('getByLessonId with withSentences option', () => {
    test('should return knowledge points without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create lesson and knowledge points
      const kp1 = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      const results = await knowledgeRepo.getByLessonId(1)

      expect(results.length).toBe(1)
      expect(results[0]).toBeTruthy()
      expect(results[0] && 'sentences' in results[0]).toBe(false)
    })

    test('should return knowledge points with sentences when withSentences is true', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const sentenceRepo = new SentenceRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create lesson and knowledge points
      const kp1 = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      // Create and associate sentence
      const sentence = await sentenceRepo.create({
        content: 'こんにちは、田中さん。',
        explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        annotations: [],
        minLessonNumber: 1,
      })
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp1.id)

      const results = await knowledgeRepo.getByLessonId(1, { withSentences: true })

      expect(results.length).toBe(1)
      expect(results[0]).toBeTruthy()
      expect(results[0] && 'sentences' in results[0]).toBe(true)
      expect(results[0]?.sentences?.length).toBe(1)
      expect(results[0]?.sentences?.[0]).toBeTruthy()
      expect(results[0]?.sentences?.[0]?.content).toBe('こんにちは、田中さん。')
    })
  })

  describe('getMany with withSentences option', () => {
    test('should return knowledge points without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      const results = await knowledgeRepo.getMany({ lessonId: 1 })

      expect(results.items.length).toBe(1)
      expect(results.items[0]).toBeTruthy()
      expect(results.items[0] && 'sentences' in results.items[0]).toBe(false)
    })

    test('should return knowledge points with sentences when withSentences is true', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const sentenceRepo = new SentenceRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lessonId: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
      })

      // Create and associate sentence
      const sentence = await sentenceRepo.create({
        content: 'こんにちは、田中さん。',
        explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        annotations: [],
        minLessonNumber: 1,
      })
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

      const results = await knowledgeRepo.getMany(
        { lessonId: 1 },
        { page: 1, limit: 20 },
        { withSentences: true }
      )

      expect(results.items.length).toBe(1)
      expect(results.items[0]).toBeTruthy()
      expect(results.items[0] && 'sentences' in results.items[0]).toBe(true)
      expect(results.items[0]?.sentences?.length).toBe(1)
      expect(results.items[0]?.sentences?.[0]).toBeTruthy()
      expect(results.items[0]?.sentences?.[0]?.content).toBe('こんにちは、田中さん。')
    })
  })
})
