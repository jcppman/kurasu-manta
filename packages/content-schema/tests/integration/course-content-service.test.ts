import { beforeEach, describe, expect, test } from 'vitest'

import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import { CourseContentService } from '@/service/course-content'
import { isVocabulary } from '@/zod/knowledge'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence } from '@/zod/sentence'
import { createInMemoryDb } from '../utils/db'

describe('CourseContentService - New Methods', () => {
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

  beforeEach(async () => {
    const db = await createInMemoryDb()
    courseContentService = new CourseContentService(db)
    knowledgeRepo = new KnowledgeRepository(db)
    lessonRepo = new LessonRepository(db)
    sentenceRepo = new SentenceRepository(db)
  })

  // Tests for new methods
  describe('getLessonByNumber', () => {
    test('should return lesson when it exists', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(1))

      // Get lesson by number
      const result = await courseContentService.getLessonByNumber(1)

      expect(result).toBeTruthy()
      expect(result?.number).toBe(1)
      expect(result?.title).toBe('Test Lesson 1')
    })

    test('should return null when lesson does not exist', async () => {
      const result = await courseContentService.getLessonByNumber(999)
      expect(result).toBe(null)
    })
  })

  describe('createLesson', () => {
    test('should create a new lesson', async () => {
      const result = await courseContentService.createLesson({
        number: 5,
        title: 'New Lesson',
      })

      expect(result).toBeTruthy()
      expect(result.number).toBe(5)
      expect(result.title).toBe('New Lesson')
      expect(result.id).toBeTruthy()
    })
  })

  describe('createKnowledgePoints', () => {
    test('should create knowledge points with valid lesson IDs', async () => {
      // Create a lesson first
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const knowledgePoints = [
        createVocabularyPoint(lesson.id, '私'),
        createGrammarPoint(lesson.id, 'です'),
      ]

      const result = await courseContentService.createKnowledgePoints(knowledgePoints)

      expect(result.length).toBe(2)
      expect(result[0]?.content).toBe('私')
      expect(result[1]?.content).toBe('です')
      expect(result[0]?.lessonId).toBe(lesson.id)
      expect(result[1]?.lessonId).toBe(lesson.id)
    })

    test('should create empty array when given empty input', async () => {
      const result = await courseContentService.createKnowledgePoints([])
      expect(result.length).toBe(0)
    })
  })

  // Integration test combining the new methods
  describe('Integration: Complete lesson creation workflow', () => {
    test('should create lesson and knowledge points separately', async () => {
      const lessonNumber = 10

      // 1. Check if lesson exists
      let lesson = await courseContentService.getLessonByNumber(lessonNumber)
      expect(lesson).toBe(null)

      // 2. Create lesson
      lesson = await courseContentService.createLesson({
        number: lessonNumber,
        title: `Lesson ${lessonNumber}`,
      })
      expect(lesson).toBeTruthy()
      expect(lesson.number).toBe(lessonNumber)

      // 3. Create knowledge points with proper lesson ID
      const knowledgePoints = [
        createVocabularyPoint(lesson.id, '学校'),
        createVocabularyPoint(lesson.id, '行く'),
        createGrammarPoint(lesson.id, 'に'),
      ]

      const createdKnowledgePoints =
        await courseContentService.createKnowledgePoints(knowledgePoints)
      expect(createdKnowledgePoints.length).toBe(3)

      // 4. Verify all knowledge points have correct lesson ID
      for (const kp of createdKnowledgePoints) {
        expect(kp.lessonId).toBe(lesson.id)
      }

      // 5. Verify lesson can be retrieved by number
      const retrievedLesson = await courseContentService.getLessonByNumber(lessonNumber)
      expect(retrievedLesson).toBeTruthy()
      expect(retrievedLesson?.id).toBe(lesson.id)
    })
  })

  // Test some existing methods that should still work
  describe('Existing methods still work', () => {
    test('getLessonById should work', async () => {
      const lesson = await lessonRepo.create(createLesson(2))
      const result = await courseContentService.getLessonById(lesson.id)

      expect(result).toBeTruthy()
      expect(result?.id).toBe(lesson.id)
    })

    test('getLessons should work', async () => {
      await lessonRepo.create(createLesson(3))
      await lessonRepo.create(createLesson(4))

      const result = await courseContentService.getLessons()
      expect(result.items.length).toBeGreaterThanOrEqual(2)
    })
  })

  // Tests for getLessonWithContent
  describe('getLessonWithContent', () => {
    test('should retrieve a lesson with its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(1))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '単語'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '文法'))

      // Get the lesson with content
      const lessonWithContent = await courseContentService.getLessonById(lesson.id, {
        withContent: true,
      })

      expect(lessonWithContent).toBeTruthy()

      // Assertions
      expect(lessonWithContent).toBeTruthy()
      expect(lessonWithContent?.id).toBe(lesson.id)
      expect(lessonWithContent?.knowledgePoints.length).toBe(2)

      // Verify knowledge points are included
      const knowledgePointContents = lessonWithContent?.knowledgePoints.map((kp) => kp.content)
      expect(knowledgePointContents?.includes('単語')).toBe(true)
      expect(knowledgePointContents?.includes('文法')).toBe(true)
    })

    test('should handle a lesson with no knowledge points', async () => {
      // Create a lesson without knowledge points
      const lesson = await lessonRepo.create(createLesson(2))

      // Get the lesson with content
      const lessonWithContent = await courseContentService.getLessonById(lesson.id, {
        withContent: true,
      })

      // Assertions
      expect(lessonWithContent).toBeTruthy()
      expect(lessonWithContent).toBeTruthy()
      expect(lessonWithContent?.id).toBe(lesson.id)
      expect(lessonWithContent?.knowledgePoints.length).toBe(0)
    })

    test('should return null for a non-existent lesson', async () => {
      // Get a non-existent lesson
      const lessonWithContent = await courseContentService.getLessonById(999, { withContent: true })

      // Assertions
      expect(lessonWithContent).toBe(null)
    })
  })

  // Tests for deleteLessonWithContent
  describe('deleteLessonWithContent', () => {
    test('should delete a lesson and all its associated knowledge points', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(8))

      // Create knowledge points
      const vocPoint = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '削除'))
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '削除文法'))

      // Delete the lesson with content
      const result = await courseContentService.deleteLessonWithContent(lesson.id)

      // Assertions
      expect(result).toBe(true)

      // Verify the lesson was deleted
      const deletedLesson = await lessonRepo.getById(lesson.id)
      expect(deletedLesson).toBe(null)

      // Verify the knowledge points were deleted
      const vocPointAfter = await knowledgeRepo.getById(vocPoint.id)
      const grammarPointAfter = await knowledgeRepo.getById(grammarPoint.id)
      expect(vocPointAfter).toBe(null)
      expect(grammarPointAfter).toBe(null)
    })

    test("should return false when the lesson doesn't exist", async () => {
      // Delete a non-existent lesson
      const result = await courseContentService.deleteLessonWithContent(999)

      // Assertions
      expect(result).toBe(false)
    })
  })

  // Tests for getVocabulariesByConditions
  describe('getVocabulariesByConditions', () => {
    test('should retrieve vocabularies by lesson ID with pagination', async () => {
      // Create a lesson
      const lesson = await lessonRepo.create(createLesson(12))

      // Create vocabulary points
      const vocPoint1 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙1'))
      const vocPoint2 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙2'))
      const vocPoint3 = await knowledgeRepo.create(createVocabularyPoint(lesson.id, '語彙3'))

      // Create a grammar point (should not be returned)
      const grammarPoint = await knowledgeRepo.create(createGrammarPoint(lesson.id, '文法'))

      // Get vocabularies with pagination (limit 2, page 1)
      const result1 = await courseContentService.getKnowledgePointsByConditions(
        { lessonId: lesson.id, type: 'vocabulary' },
        { page: 1, limit: 2 }
      )

      // Assertions for first page
      expect(result1.items.length).toBe(2)
      expect(result1.total).toBe(3)
      expect(result1.page).toBe(1)
      expect(result1.limit).toBe(2)
      expect(result1.totalPages).toBe(2)
      expect(result1.hasNextPage).toBe(true)
      expect(result1.hasPrevPage).toBe(false)

      // Verify all returned items are vocabularies
      for (const item of result1.items) {
        expect(item.type).toBe(KNOWLEDGE_POINT_TYPES.VOCABULARY)
      }

      // Get vocabularies with pagination (limit 2, page 2)
      const result2 = await courseContentService.getKnowledgePointsByConditions(
        { lessonId: lesson.id, type: 'vocabulary' },
        { page: 2, limit: 2 }
      )

      // Assertions for second page
      expect(result2.items.length).toBe(1)
      expect(result2.page).toBe(2)
      expect(result2.hasNextPage).toBe(false)
      expect(result2.hasPrevPage).toBe(true)
    })

    test('should retrieve vocabularies with audio', async () => {
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
      const result = await courseContentService.getKnowledgePointsByConditions({
        hasAudio: true,
        type: 'vocabulary',
      })

      // Assertions
      expect(result.items.length).toBe(2)
      expect(result.total).toBe(2)

      // Verify all returned items have audio
      for (const item of result.items) {
        expect(isVocabulary(item)).toBe(true)
        if (isVocabulary(item)) {
          expect(item.audio).toBeTruthy()
        }
      }

      // Get vocabularies without audio
      const resultWithoutAudio = await courseContentService.getKnowledgePointsByConditions({
        hasAudio: false,
        type: 'vocabulary',
      })

      // Assertions
      expect(resultWithoutAudio.items.length).toBe(1)
      expect(resultWithoutAudio.total).toBe(1)

      // Verify returned item has no audio
      for (const item of resultWithoutAudio.items) {
        expect(isVocabulary(item)).toBe(true)
        if (isVocabulary(item)) {
          expect(item.audio).toBe(undefined)
        }
      }
    })

    test('should combine multiple conditions', async () => {
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
      const result = await courseContentService.getKnowledgePointsByConditions({
        lessonId: lesson.id,
        hasAudio: true,
        type: 'vocabulary',
      })

      // Assertions
      expect(result.items.length).toBe(1)
      expect(result.total).toBe(1)
      // Check if we have items before accessing them
      expect(result.items[0]?.content).toBe('条件テスト1')
      expect(result.items[0] && isVocabulary(result.items[0])).toBe(true)
      if (result.items[0] && isVocabulary(result.items[0])) {
        expect(result.items[0].audio).toBeTruthy()
      }
    })

    test('should return empty result when no vocabularies match conditions', async () => {
      // Get vocabularies with non-existent lesson ID
      const result = await courseContentService.getKnowledgePointsByConditions({
        lessonId: 999,
        type: 'vocabulary',
      })

      // Assertions
      expect(result.items.length).toBe(0)
      expect(result.total).toBe(0)
      expect(result.totalPages).toBe(0)
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(false)
    })
  })

  // Tests for getSentenceCountsByKnowledgePointIds
  describe('getSentenceCountsByKnowledgePointIds', () => {
    test('should return empty map for empty knowledge point IDs', async () => {
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([])
      expect(result.size).toBe(0)
    })

    test('should return sentence counts for knowledge points', async () => {
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
      expect(result.size).toBe(3)
      expect(result.get(kp1.id)).toBe(3)
      expect(result.get(kp2.id)).toBe(1)
      expect(result.get(kp3.id)).toBe(0)
    })

    test('should handle non-existent knowledge point IDs', async () => {
      const result = await courseContentService.getSentenceCountsByKnowledgePointIds([999, 1000])

      expect(result.size).toBe(2)
      expect(result.get(999)).toBe(0)
      expect(result.get(1000)).toBe(0)
    })
  })

  // Tests for createSentenceWithKnowledgePoints
  describe('createSentenceWithKnowledgePoints', () => {
    test('should create a sentence and associate it with knowledge points', async () => {
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
      expect(createdSentence).toBeTruthy()
      expect(createdSentence.content).toBe('私は学校に行く')
      expect(createdSentence.explanation).toEqual(mockExplanation)
      expect(createdSentence.annotations.length).toBe(0)

      // Verify associations were created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      expect(associatedKnowledgePoints.length).toBe(2)

      const knowledgePointContents = associatedKnowledgePoints.map((kp) => kp.content)
      expect(knowledgePointContents.includes('学校')).toBe(true)
      expect(knowledgePointContents.includes('に行く')).toBe(true)
    })

    test('should handle sentence creation with no knowledge points', async () => {
      // Create sentence without knowledge point associations
      const sentenceData = createTestSentence('これは単純な文です')
      const createdSentence = await courseContentService.createSentenceWithKnowledgePoints(
        sentenceData,
        []
      )

      // Assertions
      expect(createdSentence).toBeTruthy()
      expect(createdSentence.content).toBe('これは単純な文です')

      // Verify no associations were created
      const associatedKnowledgePoints = await sentenceRepo.getKnowledgePointsBySentenceId(
        createdSentence.id
      )
      expect(associatedKnowledgePoints.length).toBe(0)
    })
  })

  // Tests for getLessonsInScope
  describe('getLessonsInScope', () => {
    test('should return empty array when no lessons exist', async () => {
      const result = await courseContentService.getLessonsInScope(5)

      expect(result.length).toBe(0)
    })

    test('should return lessons with number less than or equal to given number', async () => {
      // Create test lessons
      const lesson1 = await lessonRepo.create(createLesson(1))
      const lesson3 = await lessonRepo.create(createLesson(3))
      const lesson5 = await lessonRepo.create(createLesson(5))
      const lesson7 = await lessonRepo.create(createLesson(7))

      // Test with scope = 5
      const result = await courseContentService.getLessonsInScope(5)

      expect(result.length).toBe(3)

      const lessonNumbers = result.map((lesson) => lesson.number).sort()
      expect(lessonNumbers).toEqual([1, 3, 5])
    })

    test('should handle boundary conditions correctly', async () => {
      // Create lessons at boundaries
      await lessonRepo.create(createLesson(1))
      await lessonRepo.create(createLesson(5))
      await lessonRepo.create(createLesson(10))

      // Test exact match boundary
      const resultExact = await courseContentService.getLessonsInScope(5)
      expect(resultExact.length).toBe(2)

      const exactNumbers = resultExact.map((lesson) => lesson.number).sort()
      expect(exactNumbers).toEqual([1, 5])

      // Test lower boundary
      const resultLower = await courseContentService.getLessonsInScope(1)
      expect(resultLower.length).toBe(1)
      expect(resultLower[0]?.number).toBe(1)

      // Test no match
      const resultNone = await courseContentService.getLessonsInScope(0)
      expect(resultNone.length).toBe(0)
    })
  })
})
