import assert from 'node:assert'
import test from 'node:test'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import { CourseContentService } from '@/service/course-content'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence } from '@/zod/sentence'
import { isNumber } from 'lodash-es'
import { createInMemoryDb } from '../utils/db'

test('CourseContentService', async (t) => {
  let courseContentService: CourseContentService
  let knowledgeRepo: KnowledgeRepository
  let lessonRepo: LessonRepository
  let sentenceRepo: SentenceRepository

  // Test fixtures
  const createVocabularyPoint = (lessonNumber: number, content: string) => ({
    lesson: lessonNumber,
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

  const createGrammarPoint = (lessonNumber: number, content: string) => ({
    lesson: lessonNumber,
    content,
    type: KNOWLEDGE_POINT_TYPES.GRAMMAR,
    explanation: {
      en: `English explanation for ${content}`,
      cn: `Chinese explanation for ${content}`,
    },
    examples: [`Example using ${content}`],
  })

  const createLesson = (number: number) => ({
    number,
    title: `Lesson ${number}`,
    description: `Description for Lesson ${number}`,
  })

  // Test fixtures for sentence integration tests
  const mockExplanation: LocalizedText = {
    en: 'This sentence demonstrates vocabulary usage',
    cn: '这个句子展示词汇用法',
  }

  const createTestSentence = (content: string): CreateSentence => ({
    content,
    explanation: mockExplanation,
  })

  // Setup before each test
  t.beforeEach(async () => {
    const db = await createInMemoryDb()
    courseContentService = new CourseContentService(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)
    sentenceRepo = new SentenceRepository(db)
  })

  // Tests for getLessonWithContent
  await t.test('getLessonWithContent', async (t) => {
    await t.test('should retrieve a lesson with its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(1, '単語'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(1, '文法'))

      // Associate knowledge points with the lesson
      await knowledgeRepo.associateWithLesson(vocPoint.id, lesson.id)
      await knowledgeRepo.associateWithLesson(grammarPoint.id, lesson.id)

      // Get the lesson with content
      const lessonWithContent = await courseContentService.getLessonWithContent(lesson.id)

      // Assertions
      assert.ok(lessonWithContent, 'Lesson with content should exist')
      assert.strictEqual(lessonWithContent?.id, lesson.id, 'Lesson ID should match')
      assert.strictEqual(
        lessonWithContent?.knowledgePoints.length,
        2,
        'Should have 2 knowledge points'
      )

      // Verify knowledge points are included
      const knowledgePointContents = lessonWithContent?.knowledgePoints.map((kp) => kp.content)
      assert.ok(knowledgePointContents.includes('単語'), 'Should include vocabulary point')
      assert.ok(knowledgePointContents.includes('文法'), 'Should include grammar point')
    })

    await t.test('should handle a lesson with no knowledge points', async () => {
      // Create a lesson without knowledge points
      const lesson = await lessonRepo.create(createLesson(2))

      // Get the lesson with content
      const lessonWithContent = await courseContentService.getLessonWithContent(lesson.id)

      // Assertions
      assert.ok(lessonWithContent, 'Lesson with content should exist')
      assert.strictEqual(lessonWithContent?.id, lesson.id, 'Lesson ID should match')
      assert.strictEqual(
        lessonWithContent?.knowledgePoints.length,
        0,
        'Should have 0 knowledge points'
      )
    })

    await t.test('should return null for a non-existent lesson', async () => {
      // Get a non-existent lesson
      const lessonWithContent = await courseContentService.getLessonWithContent(999)

      // Assertions
      assert.strictEqual(lessonWithContent, null, 'Should return null for non-existent lesson')
    })
  })

  // Tests for createKnowledgePointsWithLesson
  await t.test('createKnowledgePointsWithLesson', async (t) => {
    await t.test(
      'should create knowledge points and associate them with an existing lesson',
      async () => {
        // Create a lesson first
        await lessonRepo.create(createLesson(3))

        // Create knowledge points with the same lesson number
        const knowledgePoints = [
          createVocabularyPoint(3, '既存'),
          createGrammarPoint(3, '既存の文法'),
          createGrammarPoint(5, '既存の文法2'),
        ]

        // Create knowledge points with lesson
        const resultMap =
          await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)

        // Assertions
        assert.ok(resultMap.size > 0, 'Result map should not be empty')

        const allKnowledgePoints = await knowledgeRepo.getAll()
        assert.equal(allKnowledgePoints.length, 3, 'should have 3 kp inserted')
      }
    )

    await t.test(
      "should create knowledge points and create a new lesson if it doesn't exist",
      async () => {
        // Create knowledge points with a new lesson number
        const knowledgePoints = [
          createVocabularyPoint(4, '新しい'),
          createGrammarPoint(4, '新しい文法'),
        ]

        // Create knowledge points with lesson
        const resultMap =
          await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)

        // Assertions
        assert.ok(resultMap.size > 0, 'Result map should not be empty')
        // Get the lesson with content from the map (there should be only one)
        const lessonIds = Array.from(resultMap.keys())
        assert.ok(lessonIds.length > 0, 'Should have at least one lesson ID')
        const lessonId = lessonIds[0]
        // Ensure lessonId is a number before using it as a key
        if (isNumber(lessonId)) {
          const lessonWithContent = resultMap.get(lessonId)

          assert.ok(lessonWithContent, 'Lesson with content should exist in the map')
          assert.strictEqual(lessonWithContent?.number, 4, 'Lesson number should match')
          assert.strictEqual(lessonWithContent?.title, 'Lesson 4', 'Lesson title should be default')
          assert.strictEqual(
            lessonWithContent?.knowledgePoints.length,
            2,
            'Should have 2 knowledge points'
          )

          // Verify the lesson was created
          const lesson = await lessonRepo.getByNumber(4)
          assert.ok(lesson, 'Lesson should exist')

          if (!lesson.id) {
            assert.fail('Lesson ID should not be null')
          }
          // Verify the knowledge points were created and associated
          const lessonKnowledgePoints = await knowledgeRepo.getByLessonId(lesson.id)
          assert.strictEqual(
            lessonKnowledgePoints.length,
            2,
            'Lesson should have 2 knowledge points'
          )
        } else {
          assert.fail('Lesson ID should be a number')
        }
      }
    )

    await t.test('should handle multiple knowledge points for the same lesson', async () => {
      // Create many knowledge points with the same lesson number
      const knowledgePoints = [
        createVocabularyPoint(5, '多い1'),
        createVocabularyPoint(5, '多い2'),
        createGrammarPoint(5, '多い文法1'),
        createGrammarPoint(5, '多い文法2'),
      ]

      // Create knowledge points with lesson
      const resultMap = await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)

      // Assertions
      assert.ok(resultMap.size > 0, 'Result map should not be empty')
      // Get the lesson with content from the map (there should be only one)
      const lessonIds = Array.from(resultMap.keys())
      assert.ok(lessonIds.length > 0, 'Should have at least one lesson ID')
      const lessonId = lessonIds[0]
      if (typeof lessonId === 'number') {
        const lessonWithContent = resultMap.get(lessonId)

        assert.ok(lessonWithContent, 'Lesson with content should exist in the map')
        assert.strictEqual(lessonWithContent?.number, 5, 'Lesson number should match')
        assert.strictEqual(
          lessonWithContent?.knowledgePoints.length,
          4,
          'Should have 4 knowledge points'
        )
      } else {
        assert.fail('Lesson ID should be a number')
      }
    })

    await t.test(
      'should throw an error when given an empty array of knowledge points',
      async () => {
        // Try to create with empty array
        await assert.rejects(
          async () => {
            await courseContentService.createKnowledgePointsWithLesson([])
          },
          {
            message: 'At least one knowledge point is required',
          },
          'Should throw error for empty array'
        )
      }
    )
  })

  // Tests for deleteLessonWithContent
  await t.test('deleteLessonWithContent', async (t) => {
    await t.test('should delete a lesson and all its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(8))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(8, '削除'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(8, '削除文法'))

      // Associate knowledge points with the lesson
      await knowledgeRepo.associateWithLesson(vocPoint.id, lesson.id)
      await knowledgeRepo.associateWithLesson(grammarPoint.id, lesson.id)

      // Delete the lesson with content
      const result = await courseContentService.deleteLessonWithContent(lesson.id)

      // Assertions
      assert.strictEqual(result, true, 'Deletion should be successful')

      // Verify the lesson was deleted
      const deletedLesson = await lessonRepo.getById(lesson.id)
      assert.strictEqual(deletedLesson, null, 'Lesson should be deleted')

      // Verify the knowledge points were deleted
      const vocPointAfter = await knowledgeRepo.getById(vocPoint.id)
      const grammarPointAfter = await knowledgeRepo.getById(grammarPoint.id)
      assert.strictEqual(vocPointAfter, null, 'Vocabulary point should be deleted')
      assert.strictEqual(grammarPointAfter, null, 'Grammar point should be deleted')
    })

    await t.test("should return false when the lesson doesn't exist", async () => {
      // Delete a non-existent lesson
      const result = await courseContentService.deleteLessonWithContent(999)

      // Assertions
      assert.strictEqual(result, false, 'Deletion should fail for non-existent lesson')
    })
  })

  // Tests for removeKnowledgePointsFromLesson
  await t.test('removeKnowledgePointsFromLesson', async (t) => {
    await t.test('should remove knowledge points from a lesson without deleting them', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(9))

      // Create knowledge points
      const vocPoint1 = await knowledgeRepo.create(createVocabularyPoint(9, '削除対象1'))
      const vocPoint2 = await knowledgeRepo.create(createVocabularyPoint(9, '削除対象2'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(9, '残す文法'))

      // Associate knowledge points with the lesson
      await knowledgeRepo.associateWithLesson(vocPoint1.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocPoint2.id, lesson.id)
      await knowledgeRepo.associateWithLesson(grammarPoint.id, lesson.id)

      // Remove specific knowledge points
      const result = await courseContentService.removeKnowledgePointsFromLesson(lesson.id, [
        vocPoint1.id,
        vocPoint2.id,
      ])

      // Assertions
      assert.strictEqual(result, true, 'Removal should be successful')

      // Verify the knowledge points were disassociated but not deleted
      const lessonKnowledgePoints = await knowledgeRepo.getByLessonId(lesson.id)
      assert.strictEqual(
        lessonKnowledgePoints.length,
        1,
        'Lesson should have 1 knowledge point left'
      )
      assert.strictEqual(
        lessonKnowledgePoints[0]?.content,
        '残す文法',
        'Grammar point should remain'
      )

      // Verify the knowledge points still exist
      const vocPoint1After = await knowledgeRepo.getById(vocPoint1.id)
      const vocPoint2After = await knowledgeRepo.getById(vocPoint2.id)
      assert.ok(vocPoint1After, 'Vocabulary point 1 should still exist')
      assert.ok(vocPoint2After, 'Vocabulary point 2 should still exist')
    })

    await t.test('should handle removing a subset of knowledge points from a lesson', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(10))

      // Create knowledge points
      const vocPoint1 = await knowledgeRepo.create(createVocabularyPoint(10, '部分1'))
      const vocPoint2 = await knowledgeRepo.create(createVocabularyPoint(10, '部分2'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(10, '部分文法'))

      // Associate knowledge points with the lesson
      await knowledgeRepo.associateWithLesson(vocPoint1.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocPoint2.id, lesson.id)
      await knowledgeRepo.associateWithLesson(grammarPoint.id, lesson.id)

      // Remove only one knowledge point
      const result = await courseContentService.removeKnowledgePointsFromLesson(lesson.id, [
        vocPoint1.id,
      ])

      // Assertions
      assert.strictEqual(result, true, 'Removal should be successful')

      // Verify only the specified knowledge point was disassociated
      const lessonKnowledgePoints = await knowledgeRepo.getByLessonId(lesson.id)
      assert.strictEqual(
        lessonKnowledgePoints.length,
        2,
        'Lesson should have 2 knowledge points left'
      )

      const remainingContents = lessonKnowledgePoints.map((kp) => kp.content)
      assert.ok(remainingContents.includes('部分2'), 'Vocabulary point 2 should remain')
      assert.ok(remainingContents.includes('部分文法'), 'Grammar point should remain')
      assert.ok(!remainingContents.includes('部分1'), 'Vocabulary point 1 should be removed')
    })

    await t.test('should return true when no knowledge points are provided', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(11))

      // Remove with empty array
      const result = await courseContentService.removeKnowledgePointsFromLesson(lesson.id, [])

      // Assertions
      assert.strictEqual(result, true, 'Should return true when nothing to remove')
    })
  })

  // Tests for getVocabulariesByConditions
  await t.test('getVocabulariesByConditions', async (t) => {
    await t.test('should retrieve vocabularies by lesson ID with pagination', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(12))

      // Create vocabulary points
      const vocPoint1 = await knowledgeRepo.create(createVocabularyPoint(12, '語彙1'))
      const vocPoint2 = await knowledgeRepo.create(createVocabularyPoint(12, '語彙2'))
      const vocPoint3 = await knowledgeRepo.create(createVocabularyPoint(12, '語彙3'))

      // Create a grammar point (should not be returned)
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(12, '文法'))

      // Associate all points with the lesson
      await knowledgeRepo.associateWithLesson(vocPoint1.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocPoint2.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocPoint3.id, lesson.id)
      await knowledgeRepo.associateWithLesson(grammarPoint.id, lesson.id)

      // Get vocabularies with pagination (limit 2, page 1)
      const result1 = await courseContentService.getVocabulariesByConditions(
        { lessonId: lesson.id },
        { page: 1, limit: 2 }
      )

      // Assertions for first page
      assert.strictEqual(result1.items.length, 2, 'Should return 2 items on first page')
      assert.strictEqual(result1.total, 3, 'Total count should be 3')
      assert.strictEqual(result1.page, 1, 'Current page should be 1')
      assert.strictEqual(result1.limit, 2, 'Limit should be 2')
      assert.strictEqual(result1.totalPages, 2, 'Total pages should be 2')
      assert.strictEqual(result1.hasNextPage, true, 'Should have next page')
      assert.strictEqual(result1.hasPrevPage, false, 'Should not have previous page')

      // Verify all returned items are vocabularies
      for (const item of result1.items) {
        assert.strictEqual(item.type, KNOWLEDGE_POINT_TYPES.VOCABULARY, 'Item should be vocabulary')
      }

      // Get vocabularies with pagination (limit 2, page 2)
      const result2 = await courseContentService.getVocabulariesByConditions(
        { lessonId: lesson.id },
        { page: 2, limit: 2 }
      )

      // Assertions for second page
      assert.strictEqual(result2.items.length, 1, 'Should return 1 item on second page')
      assert.strictEqual(result2.page, 2, 'Current page should be 2')
      assert.strictEqual(result2.hasNextPage, false, 'Should not have next page')
      assert.strictEqual(result2.hasPrevPage, true, 'Should have previous page')
    })

    await t.test('should retrieve vocabularies with audio', async () => {
      // Create vocabulary points with and without audio
      const vocWithAudio1 = await knowledgeRepo.create({
        ...createVocabularyPoint(13, '音声あり1'),
        audio: 'audio1.mp3',
      })
      const vocWithAudio2 = await knowledgeRepo.create({
        ...createVocabularyPoint(13, '音声あり2'),
        audio: 'audio2.mp3',
      })
      const vocWithoutAudio = await knowledgeRepo.create(createVocabularyPoint(13, '音声なし'))

      // Create a lesson and associate all points
      const lesson = await lessonRepo.create(createLesson(13))
      await knowledgeRepo.associateWithLesson(vocWithAudio1.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocWithAudio2.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocWithoutAudio.id, lesson.id)

      // Get vocabularies with audio
      const result = await courseContentService.getVocabulariesByConditions({ hasAudio: true })

      // Assertions
      assert.strictEqual(result.items.length, 2, 'Should return 2 items with audio')
      assert.strictEqual(result.total, 2, 'Total count should be 2')

      // Verify all returned items have audio
      for (const item of result.items) {
        assert.ok(item.audio, 'Item should have audio')
      }

      // Get vocabularies without audio
      const resultWithoutAudio = await courseContentService.getVocabulariesByConditions({
        hasAudio: false,
      })

      // Assertions
      assert.strictEqual(resultWithoutAudio.items.length, 1, 'Should return 1 item without audio')
      assert.strictEqual(resultWithoutAudio.total, 1, 'Total count should be 1')

      // Verify returned item has no audio
      for (const item of resultWithoutAudio.items) {
        assert.strictEqual(item.audio, undefined, 'Item should not have audio')
      }
    })

    await t.test('should combine multiple conditions', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(14))

      // Create vocabulary points with and without audio in this lesson
      const vocWithAudio = await knowledgeRepo.create({
        ...createVocabularyPoint(14, '条件テスト1'),
        audio: 'test-audio.mp3',
      })
      const vocWithoutAudio = await knowledgeRepo.create(createVocabularyPoint(14, '条件テスト2'))

      // Create vocabulary in another lesson with audio
      const otherLesson = await lessonRepo.create(createLesson(15))
      const otherVocWithAudio = await knowledgeRepo.create({
        ...createVocabularyPoint(15, '別レッスン'),
        audio: 'other-audio.mp3',
      })

      // Associate points with their lessons
      await knowledgeRepo.associateWithLesson(vocWithAudio.id, lesson.id)
      await knowledgeRepo.associateWithLesson(vocWithoutAudio.id, lesson.id)
      await knowledgeRepo.associateWithLesson(otherVocWithAudio.id, otherLesson.id)

      // Get vocabularies with combined conditions: from lesson 14 with audio
      const result = await courseContentService.getVocabulariesByConditions({
        lessonId: lesson.id,
        hasAudio: true,
      })

      // Assertions
      assert.strictEqual(result.items.length, 1, 'Should return 1 item matching both conditions')
      assert.strictEqual(result.total, 1, 'Total count should be 1')
      // Check if we have items before accessing them
      assert.strictEqual(
        result.items[0]?.content,
        '条件テスト1',
        'Should return the correct vocabulary'
      )
      assert.ok(result.items[0].audio, 'Item should have audio')
    })

    await t.test('should return empty result when no vocabularies match conditions', async () => {
      // Get vocabularies with non-existent lesson ID
      const result = await courseContentService.getVocabulariesByConditions({
        lessonId: 999,
      })

      // Assertions
      assert.strictEqual(result.items.length, 0, 'Should return empty array')
      assert.strictEqual(result.total, 0, 'Total count should be 0')
      assert.strictEqual(result.totalPages, 0, 'Total pages should be 0')
      assert.strictEqual(result.hasNextPage, false, 'Should not have next page')
      assert.strictEqual(result.hasPrevPage, false, 'Should not have previous page')
    })
  })

  // Cross-repository Integration Tests
  await t.test('Cross-repository Integration', async (t) => {
    await t.test('Cascade deletion behavior', async (t) => {
      await t.test('should delete sentence associations when sentence is deleted', async () => {
        // Create entities
        const sentence = await sentenceRepo.create(createTestSentence('これは削除テストです'))
        const knowledgePoint = await knowledgeRepo.create(createVocabularyPoint(1, '削除'))

        // Associate them
        await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

        // Verify association exists
        const beforeDelete = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
        assert.strictEqual(beforeDelete.length, 1)

        // Delete sentence
        await sentenceRepo.delete(sentence.id)

        // Verify knowledge point still exists but association is gone
        const knowledgePointStillExists = await knowledgeRepo.getById(knowledgePoint.id)
        assert.ok(knowledgePointStillExists, 'Knowledge point should still exist')

        const sentencesForKnowledgePoint = await sentenceRepo.getByKnowledgePointId(
          knowledgePoint.id
        )
        assert.strictEqual(sentencesForKnowledgePoint.length, 0, 'Association should be deleted')
      })

      await t.test(
        'should delete sentence associations when knowledge point is deleted',
        async () => {
          // Create entities
          const sentence = await sentenceRepo.create(createTestSentence('これは削除テストです'))
          const knowledgePoint = await knowledgeRepo.create(createVocabularyPoint(1, '削除'))

          // Associate them
          await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)

          // Delete knowledge point
          await knowledgeRepo.delete(knowledgePoint.id)

          // Verify sentence still exists but association is gone
          const sentenceStillExists = await sentenceRepo.getById(sentence.id)
          assert.ok(sentenceStillExists, 'Sentence should still exist')

          const knowledgePointsForSentence = await sentenceRepo.getKnowledgePointsBySentenceId(
            sentence.id
          )
          assert.strictEqual(knowledgePointsForSentence.length, 0, 'Association should be deleted')
        }
      )
    })

    await t.test('Complex relationship scenarios', async (t) => {
      await t.test(
        'should handle sentences with multiple knowledge points from different lessons',
        async () => {
          // Create lessons
          const lesson1 = await lessonRepo.create(createLesson(1))
          const lesson2 = await lessonRepo.create(createLesson(2))

          // Create knowledge points in different lessons
          const vocab1 = await knowledgeRepo.create(createVocabularyPoint(1, '学校'))
          const vocab2 = await knowledgeRepo.create(createVocabularyPoint(2, '図書館'))
          const grammar1 = await knowledgeRepo.create(createGrammarPoint(1, 'に行く'))

          // Associate knowledge points with lessons
          await knowledgeRepo.associateWithLesson(vocab1.id, lesson1.id)
          await knowledgeRepo.associateWithLesson(vocab2.id, lesson2.id)
          await knowledgeRepo.associateWithLesson(grammar1.id, lesson1.id)

          // Create sentence that uses knowledge points from both lessons
          const sentence = await sentenceRepo.create(createTestSentence('私は学校と図書館に行く'))

          // Associate sentence with knowledge points
          await sentenceRepo.associateWithKnowledgePoint(sentence.id, vocab1.id)
          await sentenceRepo.associateWithKnowledgePoint(sentence.id, vocab2.id)
          await sentenceRepo.associateWithKnowledgePoint(sentence.id, grammar1.id)

          // Verify associations
          const knowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
          assert.strictEqual(knowledgePoints.length, 3)

          const knowledgePointContents = knowledgePoints.map((kp) => kp.content)
          assert.ok(knowledgePointContents.includes('学校'))
          assert.ok(knowledgePointContents.includes('図書館'))
          assert.ok(knowledgePointContents.includes('に行く'))
        }
      )

      await t.test('should handle knowledge points with multiple example sentences', async () => {
        // Create a knowledge point
        const knowledgePoint = await knowledgeRepo.create(createVocabularyPoint(1, '食べる'))

        // Create multiple sentences using this knowledge point
        const sentences = await Promise.all([
          sentenceRepo.create(createTestSentence('私は朝ご飯を食べる')),
          sentenceRepo.create(createTestSentence('彼は魚を食べる')),
          sentenceRepo.create(createTestSentence('猫は魚を食べる')),
        ])

        // Associate all sentences with the knowledge point
        for (const sentence of sentences) {
          await sentenceRepo.associateWithKnowledgePoint(sentence.id, knowledgePoint.id)
        }

        // Verify all sentences are associated
        const associatedSentences = await sentenceRepo.getByKnowledgePointId(knowledgePoint.id)
        assert.strictEqual(associatedSentences.length, 3)

        const sentenceContents = associatedSentences.map((s) => s.content)
        assert.ok(sentenceContents.includes('私は朝ご飯を食べる'))
        assert.ok(sentenceContents.includes('彼は魚を食べる'))
        assert.ok(sentenceContents.includes('猫は魚を食べる'))
      })
    })

    await t.test('Integration with CourseContentService', async (t) => {
      await t.test(
        'should maintain data integrity when deleting lessons with associated sentences',
        async () => {
          // Create lesson with knowledge points
          const lesson = await lessonRepo.create(createLesson(1))
          const knowledgePoints = await Promise.all([
            knowledgeRepo.create(createVocabularyPoint(1, '本')),
            knowledgeRepo.create(createGrammarPoint(1, 'を読む')),
          ])

          // Associate knowledge points with lesson
          for (const kp of knowledgePoints) {
            await knowledgeRepo.associateWithLesson(kp.id, lesson.id)
          }

          // Create sentences associated with these knowledge points
          const sentences = await Promise.all([
            sentenceRepo.create(createTestSentence('私は本を読む')),
            sentenceRepo.create(createTestSentence('彼女は本を読む')),
          ])

          // Associate sentences with knowledge points
          for (const sentence of sentences) {
            for (const kp of knowledgePoints) {
              await sentenceRepo.associateWithKnowledgePoint(sentence.id, kp.id)
            }
          }

          // Delete lesson with content using CourseContentService
          const deleteResult = await courseContentService.deleteLessonWithContent(lesson.id)
          assert.strictEqual(deleteResult, true)

          // Verify knowledge points are deleted
          for (const kp of knowledgePoints) {
            const deletedKp = await knowledgeRepo.getById(kp.id)
            assert.strictEqual(deletedKp, null, 'Knowledge point should be deleted')
          }

          // Verify sentences still exist (they should not be cascade deleted)
          for (const sentence of sentences) {
            const existingSentence = await sentenceRepo.getById(sentence.id)
            assert.ok(existingSentence, 'Sentence should still exist')

            // But associations should be gone
            const associatedKps = await sentenceRepo.getKnowledgePointsBySentenceId(sentence.id)
            assert.strictEqual(
              associatedKps.length,
              0,
              'Sentence should have no associated knowledge points'
            )
          }
        }
      )
    })

    await t.test('Bulk operations with getKnowledgePointsForSentences', async () => {
      // Create multiple sentences and knowledge points
      const sentences = await Promise.all([
        sentenceRepo.create(createTestSentence('文1')),
        sentenceRepo.create(createTestSentence('文2')),
        sentenceRepo.create(createTestSentence('文3')),
      ])

      const knowledgePoints = await Promise.all([
        knowledgeRepo.create(createVocabularyPoint(1, '単語1')),
        knowledgeRepo.create(createVocabularyPoint(1, '単語2')),
        knowledgeRepo.create(createGrammarPoint(1, '文法1')),
      ])

      // Create complex associations
      // Sentence 1: associated with all knowledge points
      // Sentence 2: associated with first two knowledge points
      // Sentence 3: associated with last knowledge point only
      await sentenceRepo.associateWithKnowledgePoint(sentences[0].id, knowledgePoints[0].id)
      await sentenceRepo.associateWithKnowledgePoint(sentences[0].id, knowledgePoints[1].id)
      await sentenceRepo.associateWithKnowledgePoint(sentences[0].id, knowledgePoints[2].id)

      await sentenceRepo.associateWithKnowledgePoint(sentences[1].id, knowledgePoints[0].id)
      await sentenceRepo.associateWithKnowledgePoint(sentences[1].id, knowledgePoints[1].id)

      await sentenceRepo.associateWithKnowledgePoint(sentences[2].id, knowledgePoints[2].id)

      // Test bulk retrieval
      const bulkResult = await sentenceRepo.getKnowledgePointsForSentences(
        sentences.map((s) => s.id)
      )

      // Verify results
      assert.strictEqual(bulkResult.size, 3)
      assert.strictEqual(bulkResult.get(sentences[0].id)?.length, 3)
      assert.strictEqual(bulkResult.get(sentences[1].id)?.length, 2)
      assert.strictEqual(bulkResult.get(sentences[2].id)?.length, 1)

      // Verify specific associations
      const sentence1Kps = bulkResult.get(sentences[0].id) || []
      const sentence1Contents = sentence1Kps.map((kp) => kp.content)
      assert.ok(sentence1Contents.includes('単語1'))
      assert.ok(sentence1Contents.includes('単語2'))
      assert.ok(sentence1Contents.includes('文法1'))
    })

    await t.test('Validation and error handling', async (t) => {
      await t.test('should handle non-existent associations gracefully', async () => {
        // Try to dissociate non-existent association
        await sentenceRepo.dissociateFromKnowledgePoint(999, 999)
        // Should not throw error

        // Try to get knowledge points for non-existent sentence
        const result = await sentenceRepo.getKnowledgePointsBySentenceId(999)
        assert.strictEqual(result.length, 0)

        // Try to get sentences for non-existent knowledge point
        const sentences = await sentenceRepo.getByKnowledgePointId(999)
        assert.strictEqual(sentences.length, 0)
      })

      await t.test('should handle empty arrays in bulk operations', async () => {
        const result = await sentenceRepo.getKnowledgePointsForSentences([])
        assert.strictEqual(result.size, 0)
      })
    })
  })

  // Tests for getSentenceCountsByKnowledgePointIds
  await t.test('getSentenceCountsByKnowledgePointIds', async (t) => {
    await t.test('should return empty map for empty knowledge point IDs', async () => {
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([])
      assert.strictEqual(result.size, 0)
    })

    await t.test('should return sentence counts for knowledge points', async () => {
      // Create knowledge points
      const kp1 = await knowledgeRepo.create(createVocabularyPoint(1, '単語1'))
      const kp2 = await knowledgeRepo.create(createVocabularyPoint(1, '単語2'))
      const kp3 = await knowledgeRepo.create(createGrammarPoint(1, '文法1'))

      // Create sentences
      const sentence1 = await sentenceRepo.create(createTestSentence('文1'))
      const sentence2 = await sentenceRepo.create(createTestSentence('文2'))
      const sentence3 = await sentenceRepo.create(createTestSentence('文3'))

      // Associate sentences with knowledge points
      // kp1: 3 sentences, kp2: 1 sentence, kp3: 0 sentences
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence2.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence3.id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentence1.id, kp2.id)

      // Test the service method
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([
        kp1.id,
        kp2.id,
        kp3.id,
      ])

      // Assertions
      assert.strictEqual(result.size, 3)
      assert.strictEqual(result.get(kp1.id), 3)
      assert.strictEqual(result.get(kp2.id), 1)
      assert.strictEqual(result.get(kp3.id), 0)
    })

    await t.test('should handle non-existent knowledge point IDs', async () => {
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([999, 1000])

      assert.strictEqual(result.size, 2)
      assert.strictEqual(result.get(999), 0)
      assert.strictEqual(result.get(1000), 0)
    })

    await t.test('should integrate with lesson and knowledge point creation', async () => {
      // Create lesson with knowledge points using the service
      const knowledgePoints = [
        createVocabularyPoint(1, '統合テスト1'),
        createVocabularyPoint(1, '統合テスト2'),
        createGrammarPoint(1, '統合文法'),
      ]

      const lessonsWithContent =
        await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)
      const lesson = Array.from(lessonsWithContent.values())[0]

      assert.ok(lesson, 'Lesson should be created')
      assert.strictEqual(lesson.knowledgePoints.length, 3)

      // Create sentences and associate with knowledge points
      const sentences = await Promise.all([
        sentenceRepo.create(createTestSentence('統合テスト文1')),
        sentenceRepo.create(createTestSentence('統合テスト文2')),
      ])

      const kp1 = lesson.knowledgePoints[0]
      const kp2 = lesson.knowledgePoints[1]
      const kp3 = lesson.knowledgePoints[2]

      assert.ok(kp1, 'Knowledge point 1 should exist')
      assert.ok(kp2, 'Knowledge point 2 should exist')
      assert.ok(kp3, 'Knowledge point 3 should exist')
      assert.ok(sentences[0], 'Sentence 1 should exist')
      assert.ok(sentences[1], 'Sentence 2 should exist')

      await sentenceRepo.associateWithKnowledgePoint(sentences[0].id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentences[1].id, kp1.id)
      await sentenceRepo.associateWithKnowledgePoint(sentences[0].id, kp2.id)

      // Test sentence counts
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([
        kp1.id,
        kp2.id,
        kp3.id,
      ])

      assert.strictEqual(result.size, 3)
      assert.strictEqual(result.get(kp1.id), 2)
      assert.strictEqual(result.get(kp2.id), 1)
      assert.strictEqual(result.get(kp3.id), 0)
    })
  })
})
