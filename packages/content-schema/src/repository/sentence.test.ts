import assert from 'node:assert'
import test from 'node:test'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { createInMemoryDb } from '@tests/utils/db'

test('SentenceRepository', async (t) => {
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
  t.beforeEach(async () => {
    const db = await createInMemoryDb()
    sentenceRepo = new SentenceRepository(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)

    // Create lesson 1 for all knowledge points in tests
    await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })
  })

  await t.test('create', async (t) => {
    await t.test('should create a sentence with all fields', async () => {
      const created = await sentenceRepo.create(createSentenceData)

      assert.ok(created.id, 'Should have an ID')
      assert.strictEqual(created.content, createSentenceData.content)
      assert.deepStrictEqual(created.explanation, createSentenceData.explanation)
      assert.ok(created.createdAt, 'Should have createdAt timestamp')
      assert.ok(created.updatedAt, 'Should have updatedAt timestamp')
    })
  })

  await t.test('getById', async (t) => {
    await t.test('should retrieve a sentence by ID', async () => {
      const created = await sentenceRepo.create(createSentenceData)
      const retrieved = await sentenceRepo.getById(created.id)

      assert.ok(retrieved, 'Should retrieve the sentence')
      assert.strictEqual(retrieved.id, created.id)
      assert.strictEqual(retrieved.content, created.content)
      assert.deepStrictEqual(retrieved.explanation, created.explanation)
    })

    await t.test('should return null for non-existent ID', async () => {
      const retrieved = await sentenceRepo.getById(999)
      assert.strictEqual(retrieved, null)
    })
  })

  await t.test('getAll', async () => {
    // Create multiple sentences
    const sentence1 = await sentenceRepo.create(createSentenceData)
    const sentence2 = await sentenceRepo.create(createMinimalSentence)

    const result = await sentenceRepo.getMany()
    const allSentences = result.items

    assert.strictEqual(allSentences.length, 2)
    assert.ok(allSentences.some((s) => s.id === sentence1.id))
    assert.ok(allSentences.some((s) => s.id === sentence2.id))
  })

  await t.test('getWithPagination', async (t) => {
    await t.test('should paginate sentences correctly', async () => {
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
      assert.strictEqual(page1.items.length, 2)
      assert.strictEqual(page1.total, 5)
      assert.strictEqual(page1.page, 1)
      assert.strictEqual(page1.limit, 2)
      assert.strictEqual(page1.totalPages, 3)
      assert.strictEqual(page1.hasNextPage, true)
      assert.strictEqual(page1.hasPrevPage, false)

      // Test last page
      const page3 = await sentenceRepo.getWithPagination({ page: 3, limit: 2 })
      assert.strictEqual(page3.items.length, 1)
      assert.strictEqual(page3.hasNextPage, false)
      assert.strictEqual(page3.hasPrevPage, true)
    })

    await t.test('should use default pagination when not provided', async () => {
      await sentenceRepo.create(createSentenceData)

      const result = await sentenceRepo.getWithPagination()
      assert.strictEqual(result.page, 1)
      assert.strictEqual(result.limit, 20)
    })
  })

  await t.test('update', async () => {
    const created = await sentenceRepo.create(createSentenceData)

    const updatedData: Sentence = {
      ...created,
      content: '更新された文',
      explanation: { en: 'Updated sentence', cn: '更新的句子' },
    }

    const updated = await sentenceRepo.update(updatedData)

    assert.strictEqual(updated.id, created.id)
    assert.strictEqual(updated.content, '更新された文')
    assert.deepStrictEqual(updated.explanation, { en: 'Updated sentence', cn: '更新的句子' })
    assert.notStrictEqual(updated.updatedAt, created.updatedAt)
  })

  await t.test('delete', async (t) => {
    await t.test('should delete an existing sentence', async () => {
      const created = await sentenceRepo.create(createSentenceData)

      const deleted = await sentenceRepo.delete(created.id)
      assert.strictEqual(deleted, true)

      const retrieved = await sentenceRepo.getById(created.id)
      assert.strictEqual(retrieved, null)
    })

    await t.test('should return false for non-existent sentence', async () => {
      const deleted = await sentenceRepo.delete(999)
      assert.strictEqual(deleted, false)
    })
  })

  await t.test('knowledge point associations', async (t) => {
    await t.test('should associate sentence with knowledge point', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      assert.strictEqual(knowledgePoints.length, 1)
      assert.strictEqual(knowledgePoints[0]?.id, knowledgePoint.id)

      const sentences = await sentenceRepo.getByKnowledgePointId(knowledgePoint.id)
      assert.strictEqual(sentences.length, 1)
      assert.strictEqual(sentences[0]?.id, sentence.id)
    })

    await t.test('should handle multiple associations', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const kp1 = await knowledgeRepo.create(createKnowledgePoint('単語1'))
      const kp2 = await knowledgeRepo.create(createKnowledgePoint('単語2'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp2.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      assert.strictEqual(knowledgePoints.length, 2)
    })

    await t.test('should dissociate sentence from knowledge point', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)
      await sentenceRepo.dissociateFromKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      assert.strictEqual(knowledgePoints.length, 0)
    })

    await t.test('should handle onConflictDoNothing for duplicate associations', async () => {
      const sentence = await sentenceRepo.create(createSentenceData)
      const knowledgePoint = await knowledgeRepo.create(createKnowledgePoint('単語'))

      // Associate twice - should not throw error
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

      const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
      assert.strictEqual(knowledgePoints.length, 1)
    })
  })

  await t.test('getKnowledgePointsForSentences', async (t) => {
    await t.test('should return empty map for empty sentence IDs', async () => {
      const result = await sentenceRepo.getKnowledgePointsForSentences([])
      assert.strictEqual(result.size, 0)
    })

    await t.test('should return knowledge points for multiple sentences', async () => {
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

      assert.strictEqual(result.size, 2)
      assert.strictEqual(result.get(sentence1.id)?.length, 2)
      assert.strictEqual(result.get(sentence2.id)?.length, 1)
    })
  })

  await t.test('getCountByKnowledgePointIds', async (t) => {
    await t.test('should return empty map for empty knowledge point IDs', async () => {
      const result = await sentenceRepo.getCountByKnowledgePointIds([])
      assert.strictEqual(result.size, 0)
    })

    await t.test('should return counts for single knowledge point', async () => {
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

      assert.strictEqual(result.size, 1)
      assert.strictEqual(result.get(kp.id), 2)
    })

    await t.test('should return counts for multiple knowledge points', async () => {
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

      assert.strictEqual(result.size, 3)
      assert.strictEqual(result.get(kp1.id), 3)
      assert.strictEqual(result.get(kp2.id), 1)
      assert.strictEqual(result.get(kp3.id), 0)
    })

    await t.test('should handle non-existent knowledge point IDs', async () => {
      const result = await sentenceRepo.getCountByKnowledgePointIds([999, 1000])

      assert.strictEqual(result.size, 2)
      assert.strictEqual(result.get(999), 0)
      assert.strictEqual(result.get(1000), 0)
    })

    await t.test('should handle mixed existing and non-existent knowledge point IDs', async () => {
      const kp = await knowledgeRepo.create(createKnowledgePoint('単語'))
      const sentence = await sentenceRepo.create({
        content: '文',
        explanation: { en: 'Sentence', cn: '句子' },
        annotations: [],
        minLessonNumber: 1,
      })

      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

      const result = await sentenceRepo.getCountByKnowledgePointIds([kp.id, 999])

      assert.strictEqual(result.size, 2)
      assert.strictEqual(result.get(kp.id), 1)
      assert.strictEqual(result.get(999), 0)
    })
  })
})
