import assert from 'node:assert'
import test from 'node:test'
import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { createInMemoryDb } from '@tests/utils/db'
import { KnowledgeRepository } from './knowledge'
import { LessonRepository } from './lesson'
import { SentenceRepository } from './sentence'

test('KnowledgeRepository - includeSentences option', async (t) => {
  await t.test('getById with includeSentences option', async (t) => {
    await t.test('should return knowledge point without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const sentenceRepo = new SentenceRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create a knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lesson: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
        examples: ['こんにちは、田中さん。'],
      })

      // Create a sentence and associate it
      const sentence = await sentenceRepo.create({
        content: 'こんにちは、田中さん。',
        explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
      })
      await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

      const result = await knowledgeRepo.getById(kp.id)

      assert.ok(result)
      assert.strictEqual(result.id, kp.id)
      assert.ok(!('sentences' in result))
    })

    await t.test(
      'should return knowledge point with sentences when includeSentences is true',
      async () => {
        const db = await createInMemoryDb()
        const knowledgeRepo = new KnowledgeRepository(db)
        const sentenceRepo = new SentenceRepository(db)
        const lessonRepo = new LessonRepository(db)

        // Create lesson first
        await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

        // Create a knowledge point
        const kp = await knowledgeRepo.create({
          type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
          lesson: 1,
          content: 'こんにちは',
          explanation: { en: 'Hello', ja: 'こんにちは' },
          pos: 'interjection',
          annotations: [],
          examples: ['こんにちは、田中さん。'],
        })

        // Create sentences and associate them
        const sentence1 = await sentenceRepo.create({
          content: 'こんにちは、田中さん。',
          explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        })
        const sentence2 = await sentenceRepo.create({
          content: 'こんにちは、皆さん。',
          explanation: { en: 'Hello, everyone.', ja: 'こんにちは、皆さん。' },
        })

        await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp.id)
        await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp.id)

        const result = await knowledgeRepo.getById(kp.id, { includeSentences: true })

        assert.ok(result)
        assert.strictEqual(result.id, kp.id)
        assert.ok('sentences' in result)
        assert.strictEqual(result.sentences?.length, 2)
        assert.ok(result.sentences?.some((s) => s.content === 'こんにちは、田中さん。'))
        assert.ok(result.sentences?.some((s) => s.content === 'こんにちは、皆さん。'))
      }
    )

    await t.test(
      'should return knowledge point with empty sentences array when no sentences are associated',
      async () => {
        const db = await createInMemoryDb()
        const knowledgeRepo = new KnowledgeRepository(db)
        const lessonRepo = new LessonRepository(db)

        // Create lesson first
        await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

        // Create a knowledge point without sentences
        const kp = await knowledgeRepo.create({
          type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
          lesson: 1,
          content: 'こんにちは',
          explanation: { en: 'Hello', ja: 'こんにちは' },
          pos: 'interjection',
          annotations: [],
          examples: ['こんにちは、田中さん。'],
        })

        const result = await knowledgeRepo.getById(kp.id, { includeSentences: true })

        assert.ok(result)
        assert.strictEqual(result.id, kp.id)
        assert.ok('sentences' in result)
        assert.strictEqual(result.sentences?.length, 0)
      }
    )
  })

  await t.test('getByLessonId with includeSentences option', async (t) => {
    await t.test('should return knowledge points without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create lesson and knowledge points
      const kp1 = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lesson: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
        examples: [],
      })

      await knowledgeRepo.associateWithLesson(kp1.id, 1)

      const results = await knowledgeRepo.getByLessonId(1)

      assert.strictEqual(results.length, 1)
      assert.ok(!('sentences' in results[0]))
    })

    await t.test(
      'should return knowledge points with sentences when includeSentences is true',
      async () => {
        const db = await createInMemoryDb()
        const knowledgeRepo = new KnowledgeRepository(db)
        const sentenceRepo = new SentenceRepository(db)
        const lessonRepo = new LessonRepository(db)

        // Create lesson first
        await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

        // Create lesson and knowledge points
        const kp1 = await knowledgeRepo.create({
          type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
          lesson: 1,
          content: 'こんにちは',
          explanation: { en: 'Hello', ja: 'こんにちは' },
          pos: 'interjection',
          annotations: [],
          examples: [],
        })

        await knowledgeRepo.associateWithLesson(kp1.id, 1)

        // Create and associate sentence
        const sentence = await sentenceRepo.create({
          content: 'こんにちは、田中さん。',
          explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        })
        await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp1.id)

        const results = await knowledgeRepo.getByLessonId(1, { includeSentences: true })

        assert.strictEqual(results.length, 1)
        assert.ok('sentences' in results[0])
        assert.strictEqual(results[0].sentences?.length, 1)
        assert.strictEqual(results[0].sentences?.[0].content, 'こんにちは、田中さん。')
      }
    )
  })

  await t.test('getByConditions with includeSentences option', async (t) => {
    await t.test('should return knowledge points without sentences by default', async () => {
      const db = await createInMemoryDb()
      const knowledgeRepo = new KnowledgeRepository(db)
      const lessonRepo = new LessonRepository(db)

      // Create lesson first
      await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

      // Create knowledge point
      const kp = await knowledgeRepo.create({
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
        lesson: 1,
        content: 'こんにちは',
        explanation: { en: 'Hello', ja: 'こんにちは' },
        pos: 'interjection',
        annotations: [],
        examples: [],
      })

      await knowledgeRepo.associateWithLesson(kp.id, 1)

      const results = await knowledgeRepo.getByConditions({ lessonId: 1 })

      assert.strictEqual(results.items.length, 1)
      assert.ok(!('sentences' in results.items[0]))
    })

    await t.test(
      'should return knowledge points with sentences when includeSentences is true',
      async () => {
        const db = await createInMemoryDb()
        const knowledgeRepo = new KnowledgeRepository(db)
        const sentenceRepo = new SentenceRepository(db)
        const lessonRepo = new LessonRepository(db)

        // Create lesson first
        await lessonRepo.create({ number: 1, title: 'Test Lesson', description: 'Test' })

        // Create knowledge point
        const kp = await knowledgeRepo.create({
          type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
          lesson: 1,
          content: 'こんにちは',
          explanation: { en: 'Hello', ja: 'こんにちは' },
          pos: 'interjection',
          annotations: [],
          examples: [],
        })

        await knowledgeRepo.associateWithLesson(kp.id, 1)

        // Create and associate sentence
        const sentence = await sentenceRepo.create({
          content: 'こんにちは、田中さん。',
          explanation: { en: 'Hello, Mr. Tanaka.', ja: 'こんにちは、田中さん。' },
        })
        await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)

        const results = await knowledgeRepo.getByConditions(
          { lessonId: 1 },
          { page: 1, limit: 20 },
          { includeSentences: true }
        )

        assert.strictEqual(results.items.length, 1)
        assert.ok('sentences' in results.items[0])
        assert.strictEqual(results.items[0].sentences?.length, 1)
        assert.strictEqual(results.items[0].sentences?.[0].content, 'こんにちは、田中さん。')
      }
    )
  })
})
