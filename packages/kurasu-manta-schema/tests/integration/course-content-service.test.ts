import assert from 'node:assert'
import test from 'node:test'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import { CourseContentService } from '@/service/course-content'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence } from '@/zod/sentence'
import { createInMemoryDb } from '../utils/db'

test('CourseContentService - New Methods', async (t) => {
  let courseContentService: CourseContentService
  let knowledgeRepo: KnowledgeRepository
  let lessonRepo: LessonRepository
  let sentenceRepo: SentenceRepository

  // Test fixtures
  const createVocabularyPoint = (lessonId: number, content: string) => ({
    lessonId,
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
  })

  const createGrammarPoint = (lessonId: number, content: string) => ({
    lessonId,
    content,
    type: KNOWLEDGE_POINT_TYPES.GRAMMAR,
    explanation: {
      en: `English explanation for ${content}`,
      cn: `Chinese explanation for ${content}`,
    },
  })

  const createLesson = (number: number) => ({
    number,
    title: `Test Lesson ${number}`,
  })

  const mockExplanation: LocalizedText = {
    en: 'English explanation',
    cn: 'Chinese explanation',
  }

  const createTestSentence = (content: string): CreateSentence => ({
    content,
    explanation: mockExplanation,
    annotations: [],
    minLessonNumber: 1,
  })

  t.beforeEach(async () => {
    const db = await createInMemoryDb()
    courseContentService = new CourseContentService(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)
    sentenceRepo = new SentenceRepository(db)
  })

  // Tests for new methods
  await t.test('getLessonByNumber', async (t) => {
    await t.test('should return lesson when it exists', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(1))

      // Get lesson by number
      const result = await courseContentService.getLessonByNumber(1)

      assert.ok(result, 'Should return a lesson')
      assert.strictEqual(result.number, 1)
      assert.strictEqual(result.title, 'Test Lesson 1')
    })

    await t.test('should return null when lesson does not exist', async () => {
      const result = await courseContentService.getLessonByNumber(999)
      assert.strictEqual(result, null, 'Should return null for non-existent lesson')
    })
  })

  await t.test('createLesson', async (t) => {
    await t.test('should create a new lesson', async () => {
      const result = await courseContentService.createLesson({
        number: 5,
        title: 'New Lesson',
      })

      assert.ok(result, 'Should return created lesson')
      assert.strictEqual(result.number, 5)
      assert.strictEqual(result.title, 'New Lesson')
      assert.ok(result.id, 'Should have database ID')
    })
  })

  await t.test('createKnowledgePoints', async (t) => {
    await t.test('should create knowledge points with valid lesson IDs', async () => {
      // Create a lesson first
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const knowledgePoints = [
        createVocabularyPoint(lesson.id, '私'),
        createGrammarPoint(lesson.id, 'です'),
      ]

      const result = await courseContentService.createKnowledgePoints(knowledgePoints)

      assert.strictEqual(result.length, 2, 'Should create 2 knowledge points')
      assert.strictEqual(result[0]?.content, '私')
      assert.strictEqual(result[1]?.content, 'です')
      assert.strictEqual(result[0]?.lessonId, lesson.id)
      assert.strictEqual(result[1]?.lessonId, lesson.id)
    })

    await t.test('should create empty array when given empty input', async () => {
      const result = await courseContentService.createKnowledgePoints([])
      assert.strictEqual(result.length, 0, 'Should return empty array')
    })
  })

  // Integration test combining the new methods
  await t.test('Integration: Complete lesson creation workflow', async (t) => {
    await t.test('should create lesson and knowledge points separately', async () => {
      const lessonNumber = 10

      // 1. Check if lesson exists
      let lesson = await courseContentService.getLessonByNumber(lessonNumber)
      assert.strictEqual(lesson, null, 'Lesson should not exist initially')

      // 2. Create lesson
      lesson = await courseContentService.createLesson({
        number: lessonNumber,
        title: `Lesson ${lessonNumber}`,
      })
      assert.ok(lesson, 'Lesson should be created')
      assert.strictEqual(lesson.number, lessonNumber)

      // 3. Create knowledge points with proper lesson ID
      const knowledgePoints = [
        createVocabularyPoint(lesson.id, '学校'),
        createVocabularyPoint(lesson.id, '行く'),
        createGrammarPoint(lesson.id, 'に'),
      ]

      const createdKnowledgePoints =
        await courseContentService.createKnowledgePoints(knowledgePoints)
      assert.strictEqual(createdKnowledgePoints.length, 3, 'Should create 3 knowledge points')

      // 4. Verify all knowledge points have correct lesson ID
      for (const kp of createdKnowledgePoints) {
        assert.strictEqual(kp.lessonId, lesson.id, 'Knowledge point should have correct lesson ID')
      }

      // 5. Verify lesson can be retrieved by number
      const retrievedLesson = await courseContentService.getLessonByNumber(lessonNumber)
      assert.ok(retrievedLesson, 'Should be able to retrieve lesson by number')
      assert.strictEqual(retrievedLesson.id, lesson.id)
    })
  })

  // Test some existing methods that should still work
  await t.test('Existing methods still work', async (t) => {
    await t.test('getLessonById should work', async () => {
      const lesson = await lessonRepo.create(createLesson(2))
      const result = await courseContentService.getLessonById(lesson.id)

      assert.ok(result, 'Should return lesson')
      assert.strictEqual(result.id, lesson.id)
    })

    await t.test('getLessons should work', async () => {
      await lessonRepo.create(createLesson(3))
      await lessonRepo.create(createLesson(4))

      const result = await courseContentService.getLessons()
      assert.ok(result.items.length >= 2, 'Should return at least 2 lessons')
    })
  })

  // Tests for getLessonWithContent
  await t.test('getLessonWithContent', async (t) => {
    await t.test('should retrieve a lesson with its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '単語'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '文法'))

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

  // Tests for deleteLessonWithContent
  await t.test('deleteLessonWithContent', async (t) => {
    await t.test('should delete a lesson and all its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(8))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '削除'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '削除文法'))

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

  // Tests for getVocabulariesByConditions
  await t.test('getVocabulariesByConditions', async (t) => {
    await t.test('should retrieve vocabularies by lesson ID with pagination', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(12))

      // Create vocabulary points
      const vocPoint1 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙1'))
      const vocPoint2 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙2'))
      const vocPoint3 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙3'))

      // Create a grammar point (should not be returned)
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '文法'))

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
        ...createVocabularyPoint(lesson.id, '音声あり1'),
        audio: 'audio1.mp3',
      })
      const vocWithAudio2 = await knowledgeRepo.create({
        ...createVocabularyPoint(lesson.id, '音声あり2'),
        audio: 'audio2.mp3',
      })
      const vocWithoutAudio = await knowledgeRepo.create(
        createVocabularyPoint(lesson.id, '音声なし')
      )

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
        ...createVocabularyPoint(lesson.id, '条件テスト1'),
        audio: 'test-audio.mp3',
      })
      const vocWithoutAudio = await knowledgeRepo.create(
        createVocabularyPoint(lesson.id, '条件テスト2')
      )

      // Create vocabulary in another lesson with audio
      const otherLesson = await lessonRepo.create(createLesson(15))
      const otherVocWithAudio = await knowledgeRepo.create({
        ...createVocabularyPoint(otherLesson.id, '別レッスン'),
        audio: 'other-audio.mp3',
      })

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

  // Tests for getSentenceCountsByKnowledgePointIds
  await t.test('getSentenceCountsByKnowledgePointIds', async (t) => {
    await t.test('should return empty map for empty knowledge point IDs', async () => {
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([])
      assert.strictEqual(result.size, 0)
    })

    await t.test('should return sentence counts for knowledge points', async () => {
      // Create lesson first
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const kp1 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '単語1'))
      const kp2 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '単語2'))
      const kp3 = await knowledgeRepo.create(createGrammarPoint(lesson.id, '文法1'))

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
  })

  // Tests for createSentenceWithKnowledgePoints
  await t.test('createSentenceWithKnowledgePoints', async (t) => {
    await t.test('should create a sentence and associate it with knowledge points', async () => {
      // Create lesson first
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const vocab = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '学校'))
      const grammar = await knowledgeRepo.create(createGrammarPoint(lesson.id, 'に行く'))

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
  })
})
