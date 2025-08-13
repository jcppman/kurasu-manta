import { beforeEach, describe, expect, test } from 'vitest'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { createInMemoryDb } from '@tests/utils/db'

describe('SentenceRepository', () => {
  let sentenceRepo: SentenceRepository
  let knowledgeRepo: KnowledgeRepository
  let lessonRepo: LessonRepository

  // Test fixtures
  const mockExplanation: LocalizedText = {
    en: 'This is a test sentence',
    cn: '这是一个测试句子',
  }

  const createSentenceData: CreateSentence = {
    content: 'これはテストの文です',
    explanation: mockExplanation,
    minLessonNumber: 1,
    annotations: [],
  }

  const createMinimalSentence: CreateSentence = {
    content: 'シンプルな文',
    explanation: { en: 'Simple sentence', cn: '简单句子' },
    minLessonNumber: 1,
    annotations: [],
  }

  const createKnowledgePoint = (content: string) => ({
    lessonId: 1,
    content,
    type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
    explanation: {
      en: `English explanation for ${content}`,
      cn: `Chinese explanation for ${content}`,
    },
    pos: '名',
    annotations: [
      {
        loc: 0,
        len: content.length,
        type: 'kanji',
        content,
      },
    ],
    examples: [`Example using ${content}`],
  })

  // Setup before each test
  beforeEach(async () => {
    const db = await createInMemoryDb()
    sentenceRepo = new SentenceRepository(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)

    // Create lesson 1 for all knowledge points in tests
    await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })
  })

  describe('create', () => {
    test('should create a sentence with all fields', async () => {
      const created = await sentenceRepo.create(createSentenceData)

      expect(created.id).toBeTruthy()
      expect(created.content).toBe(createSentenceData.content)
      expect(created.explanation).toEqual(createSentenceData.explanation)
      expect(created.createdAt).toBeTruthy()
      expect(created.updatedAt).toBeTruthy()
    })
  })

  describe('getById', () => {
    test('should retrieve a sentence by ID', async () => {
      const created = await sentenceRepo.create(createSentenceData)
      const retrieved = await sentenceRepo.getById(created.id)

      expect(retrieved).toBeTruthy()
      if (retrieved) {
        expect(retrieved.id).toBe(created.id)
        expect(retrieved.content).toBe(created.content)
        expect(retrieved.explanation).toEqual(created.explanation)
      }
    })

    test('should return null for non-existent ID', async () => {
      const retrieved = await sentenceRepo.getById(999)
      expect(retrieved).toBe(null)
    })
  })

  describe('getMany', () => {
    test('getAll', async () => {
      // Create multiple sentences
      const sentence1 = await sentenceRepo.create(createSentenceData)
      const sentence2 = await sentenceRepo.create(createMinimalSentence)
      // create relationship with knowledge points
      const knowledgePoint1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const knowledgePoint2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, knowledgePoint1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, knowledgePoint2.id)

      const result = await sentenceRepo.getMany()
      const allSentences = result.items

      expect(allSentences.length).toBe(2)
      expect(allSentences.some((s) => s.id === sentence1.id)).toBeTruthy()
      expect(allSentences.some((s) => s.id === sentence2.id)).toBeTruthy()
    })

    test('getByIds', async () => {
      const sentence1 = await sentenceRepo.create(createSentenceData)
      const sentence2 = await sentenceRepo.create(createMinimalSentence)
      // create relationship with knowledge points
      const knowledgePoint1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const knowledgePoint2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))

      // associate knowledge points
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, knowledgePoint1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, knowledgePoint1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, knowledgePoint2.id)

      const result = await sentenceRepo.getMany({
        knowledgePointId: knowledgePoint1.id,
      })
      const sentences = result.items

      expect(sentences.length).toBe(2)
      expect(sentences.some((s) => s.id === sentence1.id)).toBeTruthy()
      expect(sentences.some((s) => s.id === sentence2.id)).toBeTruthy()
    })

    test('with pagination', () => {
      // TODO
      expect(true).toBe(true)
    })
  })

  describe('getMany - Duplicate Fix Tests', () => {
    test('should return unique sentences when no knowledgePointId filter is applied', async () => {
      // Create sentences and knowledge points
      const sentence1 = await sentenceRepo.create({
        content: '重複テスト文1',
        explanation: { en: 'Duplicate test sentence 1', cn: '重复测试句子1' },
        minLessonNumber: 1,
        annotations: [],
      })
      const sentence2 = await sentenceRepo.create({
        content: '重複テスト文2',
        explanation: { en: 'Duplicate test sentence 2', cn: '重复测试句子2' },
        minLessonNumber: 1,
        annotations: [],
      })

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('単語A'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('単語B'))
      const kp3 = await knowledgeRepo.create(createKnowledgePoint('単語C'))

      // Associate each sentence with multiple knowledge points
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp3.id)

      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp2.id)

      // Query without knowledgePointId filter - should return unique sentences
      const result = await sentenceRepo.getMany()
      const sentenceIds = result.items.map((s) => s.id)

      expect(result.items.length).toBe(2)
      expect(sentenceIds).toContain(sentence1.id)
      expect(sentenceIds).toContain(sentence2.id)
      // Ensure no duplicates
      expect(new Set(sentenceIds).size).toBe(sentenceIds.length)
    })

    test('should return unique sentences when filtering by knowledgePointId', async () => {
      // Create sentences
      const sentence1 = await sentenceRepo.create({
        content: 'フィルターテスト文1',
        explanation: { en: 'Filter test sentence 1', cn: '过滤测试句子1' },
        minLessonNumber: 1,
        annotations: [],
      })
      const sentence2 = await sentenceRepo.create({
        content: 'フィルターテスト文2',
        explanation: { en: 'Filter test sentence 2', cn: '过滤测试句子2' },
        minLessonNumber: 1,
        annotations: [],
      })
      const sentence3 = await sentenceRepo.create({
        content: 'フィルターテスト文3',
        explanation: { en: 'Filter test sentence 3', cn: '过滤测试句子3' },
        minLessonNumber: 1,
        annotations: [],
      })

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('共通単語'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('別の単語'))

      // Associate sentences with knowledge points
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id) // Multiple associations for sentence1

      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp2.id) // Multiple associations for sentence2

      // sentence3 only associated with kp2
      await sentenceRepo.associateWithKnowledgePoint(sentence3.id, kp2.id)

      // Filter by kp1 - should return sentences 1 and 2, each appearing only once
      const result = await sentenceRepo.getMany({ knowledgePointId: kp1.id })
      const sentenceIds = result.items.map((s) => s.id)

      expect(result.items.length).toBe(2)
      expect(sentenceIds).toContain(sentence1.id)
      expect(sentenceIds).toContain(sentence2.id)
      expect(sentenceIds).not.toContain(sentence3.id)
      // Ensure no duplicates
      expect(new Set(sentenceIds).size).toBe(sentenceIds.length)
    })

    test('should return unique sentences with minLessonNumber filter (no knowledgePointId)', async () => {
      // Create sentences with different lesson numbers
      const sentence1 = await sentenceRepo.create({
        content: 'レッスン1の文',
        explanation: { en: 'Lesson 1 sentence', cn: '第1课句子' },
        minLessonNumber: 1,
        annotations: [],
      })
      const sentence2 = await sentenceRepo.create({
        content: 'レッスン2の文',
        explanation: { en: 'Lesson 2 sentence', cn: '第2课句子' },
        minLessonNumber: 2,
        annotations: [],
      })
      const sentence3 = await sentenceRepo.create({
        content: 'レッスン3の文',
        explanation: { en: 'Lesson 3 sentence', cn: '第3课句子' },
        minLessonNumber: 3,
        annotations: [],
      })

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('レッスン単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('レッスン単語2'))

      // Associate sentences with multiple knowledge points
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)

      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp2.id)

      await sentenceRepo.associateWithKnowledgePoint(sentence3.id, kp1.id)

      // Filter by minLessonNumber = 2 (should include lessons 1 and 2)
      const result = await sentenceRepo.getMany({ maxLessonNumber: 2 })
      const sentenceIds = result.items.map((s) => s.id)

      expect(result.items.length).toBe(2)
      expect(sentenceIds).toContain(sentence1.id)
      expect(sentenceIds).toContain(sentence2.id)
      expect(sentenceIds).not.toContain(sentence3.id)
      // Ensure no duplicates
      expect(new Set(sentenceIds).size).toBe(sentenceIds.length)
    })

    test('should return unique sentences with combined knowledgePointId and minLessonNumber filters', async () => {
      // Create sentences with different lesson numbers
      const sentence1 = await sentenceRepo.create({
        content: '組み合わせテスト文1',
        explanation: { en: 'Combined test sentence 1', cn: '组合测试句子1' },
        minLessonNumber: 1,
        annotations: [],
      })
      const sentence2 = await sentenceRepo.create({
        content: '組み合わせテスト文2',
        explanation: { en: 'Combined test sentence 2', cn: '组合测试句子2' },
        minLessonNumber: 2,
        annotations: [],
      })
      const sentence3 = await sentenceRepo.create({
        content: '組み合わせテスト文3',
        explanation: { en: 'Combined test sentence 3', cn: '组合测试句子3' },
        minLessonNumber: 3,
        annotations: [],
      })

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('組み合わせ単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('組み合わせ単語2'))

      // Associate sentences with knowledge points
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)

      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp2.id)

      // sentence3 associated with kp1 but has minLessonNumber=3
      await sentenceRepo.associateWithKnowledgePoint(sentence3.id, kp1.id)

      // Filter by both knowledgePointId=kp1 and minLessonNumber=2
      // Should return sentences 1 and 2 (both associated with kp1 and have minLessonNumber <= 2)
      const result = await sentenceRepo.getMany({
        knowledgePointId: kp1.id,
        maxLessonNumber: 2,
      })
      const sentenceIds = result.items.map((s) => s.id)

      expect(result.items.length).toBe(2)
      expect(sentenceIds).toContain(sentence1.id)
      expect(sentenceIds).toContain(sentence2.id)
      expect(sentenceIds).not.toContain(sentence3.id) // Excluded by minLessonNumber filter
      // Ensure no duplicates
      expect(new Set(sentenceIds).size).toBe(sentenceIds.length)
    })

    test('should return unique sentences with pagination when no knowledgePointId filter', async () => {
      // Create multiple sentences
      const sentences = []
      for (let i = 1; i <= 5; i++) {
        const sentence = await sentenceRepo.create({
          content: `ページネーション文${i}`,
          explanation: { en: `Pagination sentence ${i}`, cn: `分页句子${i}` },
          minLessonNumber: 1,
          annotations: [],
        })
        sentences.push(sentence)
      }

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('ページ単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('ページ単語2'))

      // Associate each sentence with multiple knowledge points to test for duplicates
      for (const sentence of sentences) {
        await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp1.id)
        await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp2.id)
      }

      // Test pagination without knowledgePointId filter
      const page1 = await sentenceRepo.getMany({}, { page: 1, limit: 2 })
      const page2 = await sentenceRepo.getMany({}, { page: 2, limit: 2 })
      const page3 = await sentenceRepo.getMany({}, { page: 3, limit: 2 })

      // Page 1: 2 items
      expect(page1.items.length).toBe(2)
      expect(page1.total).toBe(5)
      expect(page1.totalPages).toBe(3)

      // Page 2: 2 items
      expect(page2.items.length).toBe(2)
      expect(page2.total).toBe(5)

      // Page 3: 1 item
      expect(page3.items.length).toBe(1)
      expect(page3.total).toBe(5)

      // Collect all sentence IDs across pages
      const allIds = [
        ...page1.items.map((s) => s.id),
        ...page2.items.map((s) => s.id),
        ...page3.items.map((s) => s.id),
      ]

      // Ensure no duplicates across pages
      expect(new Set(allIds).size).toBe(allIds.length)
      expect(allIds.length).toBe(5)
    })

    test('should return unique sentences with pagination when filtering by knowledgePointId', async () => {
      // Create sentences
      const sentences = []
      for (let i = 1; i <= 4; i++) {
        const sentence = await sentenceRepo.create({
          content: `フィルターページ文${i}`,
          explanation: { en: `Filter page sentence ${i}`, cn: `过滤分页句子${i}` },
          minLessonNumber: 1,
          annotations: [],
        })
        sentences.push(sentence)
      }

      const kp1 = await knowledgeRepo.create(createKnowledgePoint('フィルターページ単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('フィルターページ単語2'))

      // Associate first 3 sentences with kp1 (and also with kp2 to test duplicates)
      for (let i = 0; i < 3; i++) {
        await sentenceRepo.associateWithKnowledgePoint(sentences[i]?.id ?? 0, kp1.id)
        await sentenceRepo.associateWithKnowledgePoint(sentences[i]?.id ?? 0, kp2.id)
      }
      // Last sentence only with kp2
      await sentenceRepo.associateWithKnowledgePoint(sentences[3]?.id ?? 0, kp2.id)

      // Test pagination with knowledgePointId filter
      const page1 = await sentenceRepo.getMany({ knowledgePointId: kp1.id }, { page: 1, limit: 2 })
      const page2 = await sentenceRepo.getMany({ knowledgePointId: kp1.id }, { page: 2, limit: 2 })

      // Should return 3 sentences total (first 3 associated with kp1)
      expect(page1.items.length).toBe(2)
      expect(page1.total).toBe(3)
      expect(page1.totalPages).toBe(2)

      expect(page2.items.length).toBe(1)
      expect(page2.total).toBe(3)

      // Collect all sentence IDs
      const allIds = [...page1.items.map((s) => s.id), ...page2.items.map((s) => s.id)]

      // Ensure no duplicates and correct filtering
      expect(new Set(allIds).size).toBe(allIds.length)
      expect(allIds.length).toBe(3)
      expect(allIds).not.toContain(sentences[3]?.id) // Last sentence should be excluded
    })
  })

  describe('getWithPagination', () => {
    test('should paginate sentences correctly', async () => {
      // Create 5 sentences
      for (let i = 0; i < 5; i++) {
        await sentenceRepo.create({
          content: `テスト文 ${i + 1}`,
          explanation: { en: `Test sentence ${i + 1}` },
          minLessonNumber: 1,
          annotations: [],
        })
      }

      // Test first page
      const page1 = await sentenceRepo.getWithPagination({ page: 1, limit: 2 })
      expect(page1.items.length).toBe(2)
      expect(page1.total).toBe(5)
      expect(page1.page).toBe(1)
      expect(page1.limit).toBe(2)
      expect(page1.totalPages).toBe(3)
      expect(page1.hasNextPage).toBe(true)
      expect(page1.hasPrevPage).toBe(false)

      // Test last page
      const page3 = await sentenceRepo.getWithPagination({ page: 3, limit: 2 })
      expect(page3.items.length).toBe(1)
      expect(page3.hasNextPage).toBe(false)
      expect(page3.hasPrevPage).toBe(true)
    })

    test('should use default pagination when not provided', async () => {
      await sentenceRepo.create(createSentenceData)

      const result = await sentenceRepo.getWithPagination()
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })
  })

  test('update', async () => {
    const created = await sentenceRepo.create(createSentenceData)

    const updatedData: Sentence = {
      ...created,
      content: '更新された文',
      explanation: { en: 'Updated sentence', cn: '更新的句子' },
    }

    const updated = await sentenceRepo.update(updatedData)

    expect(updated.id).toBe(created.id)
    expect(updated.content).toBe('更新された文')
    expect(updated.explanation).toEqual({ en: 'Updated sentence', cn: '更新的句子' })
    expect(updated.updatedAt).not.toBe(created.updatedAt)
  })

  describe('delete', () => {
    test('should delete an existing sentence', async () => {
      const created = await sentenceRepo.create(createSentenceData)

      const deleted = await sentenceRepo.delete(created.id)
      expect(deleted).toBe(true)

      const retrieved = await sentenceRepo.getById(created.id)
      expect(retrieved).toBe(null)
    })

    test('should return false for non-existent sentence', async () => {
      const deleted = await sentenceRepo.delete(999)
      expect(deleted).toBe(false)
    })
  })

  describe('knowledge point associations', () => {
    test('should associate sentence with knowledge point', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      expect(knowledgePoints.length).toBe(1)
      expect(knowledgePoints[0]?.id).toBe(knowledgePoint.id)

      const sentences = await sentenceRepo.getByKnowledgePointId(knowledgePoint.id)
      expect(sentences.length).toBe(1)
      expect(sentences[0]?.id).toBe(sentence.id)
    })

    test('should handle multiple associations', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const kp1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp2.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      expect(knowledgePoints.length).toBe(2)
    })

    test('should dissociate sentence from knowledge point', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)
      await sentenceRepo.dissociateFromKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      expect(knowledgePoints.length).toBe(0)
    })

    test('should handle onConflictDoNothing for duplicate associations', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      // Associate twice - should not throw error
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      expect(knowledgePoints.length).toBe(1)
    })
  })

  describe('getKnowledgePointsForSentences', () => {
    test('should return empty map for empty sentence IDs', async () => {
      const result = await sentenceRepo.getKnowledgePointsForSentences([])
      expect(result.size).toBe(0)
    })

    test('should return knowledge points for multiple sentences', async () => {
      const sentence1 = await sentenceRepo.create({
        content: '文1',
        explanation: { en: 'Sentence 1', cn: '句子1' },
        annotations: [],
        minLessonNumber: 1,
      })
      const sentence2 = await sentenceRepo.create({
        content: '文2',
        explanation: { en: 'Sentence 2', cn: '句子2' },
        annotations: [],
        minLessonNumber: 1,
      })
      const kp1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))

      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)

      const result = await sentenceRepo.getKnowledgePointsForSentences([sentence1.id, sentence2.id])

      expect(result.size).toBe(2)
      expect(result.get(sentence1.id)?.length).toBe(2)
      expect(result.get(sentence2.id)?.length).toBe(1)
    })
  })

  describe('getCountByKnowledgePointIds', () => {
    test('should return empty map for empty knowledge point IDs', async () => {
      const result = await sentenceRepo.getCountByKnowledgePointIds([])
      expect(result.size).toBe(0)
    })

    test('should return counts for single knowledge point', async () => {
      const kp = await knowledgeRepo.create(createKnowledgePoint('単語'))
      const sentence1 = await sentenceRepo.create({
        content: '文1',
        explanation: { en: 'Sentence 1', cn: '句子1' },
        annotations: [],
        minLessonNumber: 1,
      })
      const sentence2 = await sentenceRepo.create({
        content: '文2',
        explanation: { en: 'Sentence 2', cn: '句子2' },
        annotations: [],
        minLessonNumber: 1,
      })

      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp.id)

      const result = await sentenceRepo.getCountByKnowledgePointIds([kp.id])

      expect(result.size).toBe(1)
      expect(result.get(kp.id)).toBe(2)
    })

    test('should return counts for multiple knowledge points', async () => {
      const kp1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))
      const kp3 = await knowledgeRepo.create(createKnowledgePoint('単語3'))

      const sentence1 = await sentenceRepo.create({
        content: '文1',
        explanation: { en: 'Sentence 1', cn: '句子1' },
        annotations: [],
        minLessonNumber: 1,
      })
      const sentence2 = await sentenceRepo.create({
        content: '文2',
        explanation: { en: 'Sentence 2', cn: '句子2' },
        annotations: [],
        minLessonNumber: 1,
      })
      const sentence3 = await sentenceRepo.create({
        content: '文3',
        explanation: { en: 'Sentence 3', cn: '句子3' },
        annotations: [],
        minLessonNumber: 1,
      })

      // kp1: 3 sentences, kp2: 1 sentence, kp3: 0 sentences
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence3.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)

      const result = await sentenceRepo.getCountByKnowledgePointIds([kp1.id, kp2.id, kp3.id])

      expect(result.size).toBe(3)
      expect(result.get(kp1.id)).toBe(3)
      expect(result.get(kp2.id)).toBe(1)
      expect(result.get(kp3.id)).toBe(0)
    })

    test('should handle non-existent knowledge point IDs', async () => {
      const result = await sentenceRepo.getCountByKnowledgePointIds([999, 1000])

      expect(result.size).toBe(2)
      expect(result.get(999)).toBe(0)
      expect(result.get(1000)).toBe(0)
    })

    test('should handle mixed existing and non-existent knowledge point IDs', async () => {
      const kp = await knowledgeRepo.create(createKnowledgePoint('単語'))
      const sentence = await sentenceRepo.create({
        content: '文',
        explanation: { en: 'Sentence', cn: '句子' },
        annotations: [],
        minLessonNumber: 1,
      })

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

      const result = await sentenceRepo.getCountByKnowledgePointIds([kp.id, 999])

      expect(result.size).toBe(2)
      expect(result.get(kp.id)).toBe(1)
      expect(result.get(999)).toBe(0)
    })
  })
})
