import assert from 'node:assert'
import test from 'node:test'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { CourseContentService } from '@/service/course-content'
import { isNumber } from 'lodash-es'
import { createInMemoryDb } from '../utils/db'

test('CourseContentService', async (t) => {
  let courseContentService: CourseContentService
  let knowledgeRepo: KnowledgeRepository
  let lessonRepo: LessonRepository

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

  // Setup before each test
  t.beforeEach(async () => {
    const db = await createInMemoryDb()
    courseContentService = new CourseContentService(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)
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
})
