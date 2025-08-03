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
    lessonId: lessonNumber,
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
    lessonId: lessonNumber,
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

  const createTestSentence = (content: string, minLessonNumber = 1): CreateSentence => ({
    content,
    explanation: mockExplanation,
    annotations: [],
    minLessonNumber,
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

      // Get the lesson with content
      const lessonWithContent = await courseContentService.getLessonById(lesson.id, {
        withContent: true,
      })

      assert.ok(lessonWithContent)

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
      const lessonWithContent = await courseContentService.getLessonById(lesson.id, {
        withContent: true,
      })

      // Assertions
      assert.ok(lessonWithContent)
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
      const lessonWithContent = await courseContentService.getLessonById(999, { withContent: true })

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

        const allKnowledgePointsResult = await knowledgeRepo.getMany()
        const allKnowledgePoints = allKnowledgePointsResult.items
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
      // Create a lesson first
      const lesson = await lessonRepo.create(createLesson(13))

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

  // Tests for createSentenceWithKnowledgePoints
  await t.test('createSentenceWithKnowledgePoints', async (t) => {
    await t.test('should create a sentence and associate it with knowledge points', async () => {
      // Create knowledge points
      const vocab = await knowledgeRepo.create(createVocabularyPoint(1, '学校'))
      const grammar = await knowledgeRepo.create(createGrammarPoint(1, 'に行く'))

      // Create sentence with knowledge point associations
      const sentenceData = createTestSentence('私は学校に行く')
      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceData,
        [vocab.id, grammar.id]
      )

      // Assertions
      assert.ok(createdSentence, 'Sentence should be created')
      assert.strictEqual(createdSentence.content, '私は学校に行く', 'Content should match')
      assert.deepStrictEqual(
        createdSentence.explanation,
        mockExplanation,
        'Explanation should match'
      )
      assert.strictEqual(createdSentence.annotations.length, 0, 'Should have no annotations')

      // Verify associations were created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      assert.strictEqual(
        associatedKnowledgePoints.length,
        2,
        'Should have 2 associated knowledge points'
      )

      const knowledgePointContents = associatedKnowledgePoints.map((kp) => kp.content)
      assert.ok(knowledgePointContents.includes('学校'), 'Should include vocabulary')
      assert.ok(knowledgePointContents.includes('に行く'), 'Should include grammar')
    })

    await t.test('should handle sentence creation with no knowledge points', async () => {
      // Create sentence without knowledge point associations
      const sentenceData = createTestSentence('これは単純な文です')
      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceData,
        []
      )

      // Assertions
      assert.ok(createdSentence, 'Sentence should be created')
      assert.strictEqual(createdSentence.content, 'これは単純な文です', 'Content should match')

      // Verify no associations were created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      assert.strictEqual(
        associatedKnowledgePoints.length,
        0,
        'Should have no associated knowledge points'
      )
    })

    await t.test('should handle sentence creation with many knowledge points', async () => {
      // Create multiple knowledge points
      const knowledgePoints = await Promise.all([
        knowledgeRepo.create(createVocabularyPoint(1, '私')),
        knowledgeRepo.create(createVocabularyPoint(1, '学校')),
        knowledgeRepo.create(createVocabularyPoint(1, '図書館')),
        knowledgeRepo.create(createGrammarPoint(1, 'と')),
        knowledgeRepo.create(createGrammarPoint(1, 'に行く')),
      ])

      // Create sentence with all knowledge points
      const sentenceData = createTestSentence('私は学校と図書館に行く')
      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceData,
        knowledgePoints.map((kp) => kp.id)
      )

      // Assertions
      assert.ok(createdSentence, 'Sentence should be created')
      assert.strictEqual(createdSentence.content, '私は学校と図書館に行く', 'Content should match')

      // Verify all associations were created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      assert.strictEqual(
        associatedKnowledgePoints.length,
        5,
        'Should have 5 associated knowledge points'
      )

      const knowledgePointContents = associatedKnowledgePoints.map((kp) => kp.content)
      assert.ok(knowledgePointContents.includes('私'), 'Should include 私')
      assert.ok(knowledgePointContents.includes('学校'), 'Should include 学校')
      assert.ok(knowledgePointContents.includes('図書館'), 'Should include 図書館')
      assert.ok(knowledgePointContents.includes('と'), 'Should include と')
      assert.ok(knowledgePointContents.includes('に行く'), 'Should include に行く')
    })

    await t.test('should handle sentence with annotations', async () => {
      // Create knowledge point
      const vocab = await knowledgeRepo.create(createVocabularyPoint(1, '本'))

      // Create sentence with annotations
      const sentenceDataWithAnnotations: CreateSentence = {
        content: '私は本を読む',
        explanation: mockExplanation,
        minLessonNumber: 1,
        annotations: [
          {
            loc: 2,
            len: 1,
            type: 'vocabulary',
            content: '本',
            id: vocab.id,
          },
        ],
      }

      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceDataWithAnnotations,
        [vocab.id]
      )

      // Assertions
      assert.ok(createdSentence, 'Sentence should be created')
      assert.strictEqual(createdSentence.content, '私は本を読む', 'Content should match')
      assert.strictEqual(createdSentence.annotations.length, 1, 'Should have 1 annotation')
      assert.strictEqual(
        createdSentence.annotations[0]?.type,
        'vocabulary',
        'Annotation type should match'
      )
      assert.strictEqual(
        createdSentence.annotations[0]?.content,
        '本',
        'Annotation content should match'
      )

      // Verify association was created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      assert.strictEqual(
        associatedKnowledgePoints.length,
        1,
        'Should have 1 associated knowledge point'
      )
      assert.strictEqual(
        associatedKnowledgePoints[0]?.content,
        '本',
        'Should be associated with 本'
      )
    })

    await t.test('should handle duplicate knowledge point IDs gracefully', async () => {
      // Create knowledge point
      const vocab = await knowledgeRepo.create(createVocabularyPoint(1, '猫'))

      // Create sentence with duplicate knowledge point IDs
      const sentenceData = createTestSentence('猫が好きです')
      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceData,
        [vocab.id, vocab.id, vocab.id] // Duplicates
      )

      // Assertions
      assert.ok(createdSentence, 'Sentence should be created')
      assert.strictEqual(createdSentence.content, '猫が好きです', 'Content should match')

      // Verify only one association was created (due to unique constraint)
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      assert.strictEqual(
        associatedKnowledgePoints.length,
        1,
        'Should have 1 associated knowledge point'
      )
      assert.strictEqual(
        associatedKnowledgePoints[0]?.content,
        '猫',
        'Should be associated with 猫'
      )
    })

    await t.test('should integrate with sentence counting functionality', async () => {
      // Create knowledge points
      const kp1 = await knowledgeRepo.create(createVocabularyPoint(1, '犬'))
      const kp2 = await knowledgeRepo.create(createVocabularyPoint(1, '鳥'))

      // Verify initial counts are zero
      let counts = await courseContentService.getSentenceCountsByKnowledgePointIds([kp1.id, kp2.id])
      assert.strictEqual(counts.get(kp1.id), 0, 'Initial count should be 0')
      assert.strictEqual(counts.get(kp2.id), 0, 'Initial count should be 0')

      // Create first sentence with both knowledge points
      await courseContentService.createSentenceWithKnowledgePoints(
        createTestSentence('犬と鳥がいます'),
        [kp1.id, kp2.id]
      )

      // Verify counts increased
      counts = await courseContentService.getSentenceCountsByKnowledgePointIds([kp1.id, kp2.id])
      assert.strictEqual(counts.get(kp1.id), 1, 'Count for kp1 should be 1')
      assert.strictEqual(counts.get(kp2.id), 1, 'Count for kp2 should be 1')

      // Create second sentence with only first knowledge point
      await courseContentService.createSentenceWithKnowledgePoints(createTestSentence('犬が走る'), [
        kp1.id,
      ])

      // Verify counts updated correctly
      counts = await courseContentService.getSentenceCountsByKnowledgePointIds([kp1.id, kp2.id])
      assert.strictEqual(counts.get(kp1.id), 2, 'Count for kp1 should be 2')
      assert.strictEqual(counts.get(kp2.id), 1, 'Count for kp2 should remain 1')
    })
  })

  // Tests for getLessonsInScope
  await t.test('getLessonsInScope', async (t) => {
    await t.test('should return empty array when no lessons exist', async () => {
      const result = await courseContentService.getLessonsInScope(5)

      assert.strictEqual(result.length, 0, 'Should return empty array when no lessons exist')
    })

    await t.test(
      'should return lessons with number less than or equal to given number',
      async () => {
        // Create test lessons
        const lesson1 = await lessonRepo.create(createLesson(1))
        const lesson3 = await lessonRepo.create(createLesson(3))
        const lesson5 = await lessonRepo.create(createLesson(5))
        const lesson7 = await lessonRepo.create(createLesson(7))

        // Test with scope = 5
        const result = await courseContentService.getLessonsInScope(5)

        assert.strictEqual(result.length, 3, 'Should return 3 lessons')

        const lessonNumbers = result.map((lesson) => lesson.number).sort()
        assert.deepStrictEqual(lessonNumbers, [1, 3, 5], 'Should return lessons 1, 3, and 5')
      }
    )

    await t.test('should handle boundary conditions correctly', async () => {
      // Create lessons at boundaries
      await lessonRepo.create(createLesson(1))
      await lessonRepo.create(createLesson(5))
      await lessonRepo.create(createLesson(10))

      // Test exact match boundary
      const resultExact = await courseContentService.getLessonsInScope(5)
      assert.strictEqual(resultExact.length, 2, 'Should include lesson with exact number match')

      const exactNumbers = resultExact.map((lesson) => lesson.number).sort()
      assert.deepStrictEqual(exactNumbers, [1, 5], 'Should include lessons 1 and 5')

      // Test lower boundary
      const resultLower = await courseContentService.getLessonsInScope(1)
      assert.strictEqual(resultLower.length, 1, 'Should include only lesson 1')
      assert.strictEqual(resultLower[0]?.number, 1, 'Should be lesson 1')

      // Test no match
      const resultNone = await courseContentService.getLessonsInScope(0)
      assert.strictEqual(resultNone.length, 0, 'Should return no lessons when number is too low')
    })

    await t.test('should integrate with lesson creation workflow', async () => {
      // Create lessons using the course content service
      const knowledgePoints = [
        createVocabularyPoint(1, 'スコープテスト1'),
        createVocabularyPoint(3, 'スコープテスト3'),
        createVocabularyPoint(5, 'スコープテスト5'),
      ]

      const lessonsWithContent =
        await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)

      // Verify lessons were created
      assert.strictEqual(lessonsWithContent.size, 3, 'Should create 3 lessons')

      // Test scope filtering
      const lessonsInScope = await courseContentService.getLessonsInScope(3)
      assert.strictEqual(lessonsInScope.length, 2, 'Should return 2 lessons in scope')

      const scopeNumbers = lessonsInScope.map((lesson) => lesson.number).sort()
      assert.deepStrictEqual(scopeNumbers, [1, 3], 'Should include lessons 1 and 3')
    })

    await t.test('should preserve lesson properties correctly', async () => {
      const originalLesson = await lessonRepo.create({
        number: 3,
        title: 'Scope Test Lesson',
        description: 'A test lesson for scope functionality',
      })

      const result = await courseContentService.getLessonsInScope(5)

      assert.strictEqual(result.length, 1, 'Should return one lesson')

      const returnedLesson = result[0]
      assert.ok(returnedLesson, 'Lesson should exist')
      assert.strictEqual(returnedLesson.id, originalLesson.id, 'ID should match')
      assert.strictEqual(returnedLesson.number, originalLesson.number, 'Number should match')
      assert.strictEqual(returnedLesson.title, originalLesson.title, 'Title should match')
      assert.strictEqual(
        returnedLesson.description,
        originalLesson.description,
        'Description should match'
      )
    })

    await t.test('should work with large datasets', async () => {
      // Create multiple lessons using both direct repository and service methods
      for (let i = 1; i <= 10; i++) {
        await lessonRepo.create(createLesson(i))
      }

      // Also create some lessons through the service with knowledge points
      const knowledgePoints = [
        createVocabularyPoint(15, 'サービステスト'),
        createVocabularyPoint(20, 'サービステスト2'),
      ]
      await courseContentService.createKnowledgePointsWithLesson(knowledgePoints)

      // Test filtering with different scopes
      const scope10 = await courseContentService.getLessonsInScope(10)
      assert.strictEqual(scope10.length, 10, 'Should return 10 lessons for scope 10')

      const scope15 = await courseContentService.getLessonsInScope(15)
      assert.strictEqual(scope15.length, 11, 'Should return 11 lessons for scope 15')

      const scope25 = await courseContentService.getLessonsInScope(25)
      assert.strictEqual(scope25.length, 12, 'Should return all 12 lessons for scope 25')
    })

    await t.test('should integrate with other service methods', async () => {
      // Create lesson with knowledge points
      const lesson = await lessonRepo.create(createLesson(2))
      const vocab = await knowledgeRepo.create(createVocabularyPoint(2, '統合テスト'))

      // Verify lesson can be retrieved through different methods
      const lessonById = await courseContentService.getLessonById(lesson.id)
      assert.ok(lessonById, 'Should find lesson by ID')

      const lessonsInScope = await courseContentService.getLessonsInScope(5)
      assert.strictEqual(lessonsInScope.length, 1, 'Should find lesson in scope')
      assert.strictEqual(lessonsInScope[0]?.id, lesson.id, 'Should be the same lesson')
    })
  })

  // Tests for new methods added for dashboard support
  await t.test('getKnowledgePointsByConditions', async (t) => {
    await t.test('should retrieve all knowledge points when no type specified', async () => {
      // Create lessons
      const lesson1 = await lessonRepo.create(createLesson(20))
      const lesson2 = await lessonRepo.create(createLesson(21))

      // Create mixed knowledge points
      const vocab1 = await knowledgeRepo.create(createVocabularyPoint(20, '語彙1'))
      const vocab2 = await knowledgeRepo.create(createVocabularyPoint(21, '語彙2'))
      const grammar1 = await knowledgeRepo.create(createGrammarPoint(20, '文法1'))
      const grammar2 = await knowledgeRepo.create(createGrammarPoint(21, '文法2'))

      // Associate with lessons

      // Get all knowledge points (no type filter)
      const result = await courseContentService.getKnowledgePointsByConditions({})

      // Should return both vocabulary and grammar points
      assert.ok(result.items.length >= 4, 'Should return at least 4 knowledge points')

      const vocabularies = result.items.filter((item) => item.type === 'vocabulary')
      const grammars = result.items.filter((item) => item.type === 'grammar')

      assert.ok(vocabularies.length >= 2, 'Should include vocabulary points')
      assert.ok(grammars.length >= 2, 'Should include grammar points')
    })

    await t.test('should filter by type when specified', async () => {
      // Create lesson first
      const lesson = await lessonRepo.create(createLesson(22))

      // Create mixed knowledge points
      const vocab = await knowledgeRepo.create(createVocabularyPoint(22, 'フィルタテスト'))
      const grammar = await knowledgeRepo.create(createGrammarPoint(22, 'フィルタ文法'))

      // Get only vocabulary points
      const vocabResult = await courseContentService.getKnowledgePointsByConditions({
        type: 'vocabulary',
      })

      // Get only grammar points
      const grammarResult = await courseContentService.getKnowledgePointsByConditions({
        type: 'grammar',
      })

      // Verify filtering works
      const allVocabs = vocabResult.items.every((item) => item.type === 'vocabulary')
      const allGrammars = grammarResult.items.every((item) => item.type === 'grammar')

      assert.ok(allVocabs, 'Should only return vocabulary points when type is vocabulary')
      assert.ok(allGrammars, 'Should only return grammar points when type is grammar')
    })

    await t.test('should support pagination', async () => {
      // Create lesson first
      const lesson = await lessonRepo.create(createLesson(23))

      // Create multiple knowledge points
      const points = []

      for (let i = 1; i <= 5; i++) {
        const point = await knowledgeRepo.create(createVocabularyPoint(23, `ページング${i}`))
        points.push(point)
      }

      // Get first page (limit 2)
      const page1 = await courseContentService.getKnowledgePointsByConditions(
        { lessonId: lesson.id },
        { limit: 2, offset: 0 }
      )

      // Get second page (limit 2, offset 2)
      const page2 = await courseContentService.getKnowledgePointsByConditions(
        { lessonId: lesson.id },
        { limit: 2, offset: 2 }
      )

      assert.strictEqual(page1.items.length, 2, 'First page should have 2 items')
      assert.strictEqual(page2.items.length, 2, 'Second page should have 2 items')
      assert.ok(page1.hasNextPage, 'First page should indicate more items available')
      assert.strictEqual(page1.total, 5, 'Total should be 5')
    })
  })

  await t.test('getLessons', async (t) => {
    await t.test('should retrieve all lessons without pagination', async () => {
      // Create test lessons
      const lesson1 = await lessonRepo.create(createLesson(30))
      const lesson2 = await lessonRepo.create(createLesson(31))
      const lesson3 = await lessonRepo.create(createLesson(32))

      // Get all lessons
      const result = await courseContentService.getLessons()

      assert.ok(result.items.length >= 3, 'Should return at least 3 lessons')
      assert.strictEqual(result.hasNextPage, false, 'Should not have more items when no pagination')
      assert.ok(result.total >= 3, 'Total should be at least 3')

      // Verify lesson data structure
      const firstLesson = result.items[0]
      assert.ok(firstLesson?.id, 'Lesson should have an ID')
      assert.ok(typeof firstLesson?.number === 'number', 'Lesson should have a number')
    })

    await t.test('should support pagination', async () => {
      // Create multiple lessons
      for (let i = 40; i <= 44; i++) {
        await lessonRepo.create(createLesson(i))
      }

      // Get first page
      const page1 = await courseContentService.getLessons({ limit: 2, offset: 0 })

      // Get second page
      const page2 = await courseContentService.getLessons({ limit: 2, offset: 2 })

      assert.strictEqual(page1.items.length, 2, 'First page should have 2 items')
      assert.strictEqual(page2.items.length, 2, 'Second page should have 2 items')

      // Verify pagination metadata
      assert.ok(page1.total >= 5, 'Total should be at least 5')
      assert.ok(page1.hasNextPage, 'Should indicate more items available')
    })
  })

  await t.test('getSentences', async (t) => {
    await t.test('should retrieve all sentences without filtering', async () => {
      // Create test sentences
      const sentence1 = await sentenceRepo.create(createTestSentence('テスト文章1', 10))
      const sentence2 = await sentenceRepo.create(createTestSentence('テスト文章2', 15))
      const sentence3 = await sentenceRepo.create(createTestSentence('テスト文章3', 20))

      // Get all sentences
      const result = await courseContentService.getSentences()

      assert.ok(result.items.length >= 3, 'Should return at least 3 sentences')
      assert.strictEqual(result.hasNextPage, false, 'Should not have more items when no pagination')
      assert.ok(result.total >= 3, 'Total should be at least 3')

      // Verify sentence data structure
      const firstSentence = result.items[0]
      assert.ok(firstSentence?.id, 'Sentence should have an ID')
      assert.ok(typeof firstSentence?.content === 'string', 'Sentence should have content')
      assert.ok(
        typeof firstSentence?.minLessonNumber === 'number',
        'Sentence should have minLessonNumber'
      )
    })

    await t.test('should filter by minLessonNumber', async () => {
      // Create sentences with different lesson numbers
      await sentenceRepo.create(createTestSentence('早い文章', 5))
      await sentenceRepo.create(createTestSentence('遅い文章', 25))

      // Filter sentences with minLessonNumber >= 20
      const result = await courseContentService.getSentences({ minLessonNumber: 20 })

      // All returned sentences should have minLessonNumber >= 20
      const allAboveThreshold = result.items.every((sentence) => sentence.minLessonNumber >= 20)
      assert.ok(allAboveThreshold, 'All sentences should have minLessonNumber >= 20')
    })

    await t.test('should support pagination', async () => {
      // Create multiple sentences
      for (let i = 50; i <= 54; i++) {
        await sentenceRepo.create(createTestSentence(`ページング文章${i}`, i))
      }

      // Get first page
      const page1 = await courseContentService.getSentences({}, { limit: 2, offset: 0 })

      // Get second page
      const page2 = await courseContentService.getSentences({}, { limit: 2, offset: 2 })

      assert.strictEqual(page1.items.length, 2, 'First page should have 2 items')
      assert.strictEqual(page2.items.length, 2, 'Second page should have 2 items')

      // Verify pagination metadata
      assert.ok(page1.total >= 5, 'Total should be at least 5')
      assert.ok(page1.hasNextPage, 'Should indicate more items available')
    })

    await t.test('should combine filtering and pagination', async () => {
      // Create sentences with mixed lesson numbers
      for (let i = 60; i <= 64; i++) {
        await sentenceRepo.create(createTestSentence(`組み合わせ${i}`, i))
      }

      // Filter and paginate: minLessonNumber >= 62, limit 2
      const result = await courseContentService.getSentences(
        { minLessonNumber: 62 },
        { limit: 2, offset: 0 }
      )

      assert.ok(result.items.length <= 2, 'Should respect limit')
      const allAboveThreshold = result.items.every((sentence) => sentence.minLessonNumber >= 62)
      assert.ok(allAboveThreshold, 'All sentences should meet filter criteria')
    })
  })

  // Test backward compatibility with deprecated method
  await t.test('getVocabulariesByConditions backward compatibility', async (t) => {
    await t.test('should still work as before', async () => {
      // Create lesson first
      const lesson = await lessonRepo.create(createLesson(70))

      // Create mixed knowledge points
      const vocab = await knowledgeRepo.create(createVocabularyPoint(70, '互換性テスト'))
      const grammar = await knowledgeRepo.create(createGrammarPoint(70, '文法テスト'))

      // Old method should still return only vocabularies
      const result = await courseContentService.getVocabulariesByConditions({})

      // Should only return vocabulary points
      const allVocabs = result.items.every((item) => item.type === 'vocabulary')
      assert.ok(allVocabs, 'Should only return vocabulary points for backward compatibility')
    })
  })
})
