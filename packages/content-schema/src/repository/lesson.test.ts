import { createInMemoryDb } from '@tests/utils/db'
import { beforeEach, describe, expect, test } from 'vitest'
import { LessonRepository } from './lesson'

describe('LessonRepository', () => {
  let lessonRepo: LessonRepository

  // Setup before each test
  beforeEach(async () => {
    const db = await createInMemoryDb()
    lessonRepo = new LessonRepository(db)
  })

  describe('getLessonsByConditions', () => {
    test('should return empty array when no lessons exist', async () => {
      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })

      expect(result.length).toBe(0)
    })

    test('should return lessons with number less than or equal to given number', async () => {
      // Create test lessons
      const lesson1 = await lessonRepo.create({
        number: 1,
        title: 'Lesson 1',
        description: 'First lesson',
      })
      const lesson2 = await lessonRepo.create({
        number: 3,
        title: 'Lesson 3',
        description: 'Third lesson',
      })
      const lesson3 = await lessonRepo.create({
        number: 5,
        title: 'Lesson 5',
        description: 'Fifth lesson',
      })
      const lesson4 = await lessonRepo.create({
        number: 7,
        title: 'Lesson 7',
        description: 'Seventh lesson',
      })

      // Test filtering with lessonNumberLessThan = 5
      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })

      expect(result.length).toBe(3)

      const lessonNumbers = result.map((lesson) => lesson.number).sort()
      expect(lessonNumbers).toEqual([1, 3, 5])
    })

    test('should return all lessons when condition is not specified', async () => {
      // Create test lessons
      await lessonRepo.create({
        number: 1,
        title: 'Lesson 1',
        description: 'First lesson',
      })
      await lessonRepo.create({
        number: 3,
        title: 'Lesson 3',
        description: 'Third lesson',
      })

      // Test without any conditions
      const result = await lessonRepo.getLessonsByConditions({})

      expect(result.length).toBe(2)
    })

    test('should handle boundary conditions correctly', async () => {
      // Create lessons at boundaries
      const lesson1 = await lessonRepo.create({
        number: 1,
        title: 'Lesson 1',
        description: 'First lesson',
      })
      const lesson5 = await lessonRepo.create({
        number: 5,
        title: 'Lesson 5',
        description: 'Fifth lesson',
      })
      const lesson10 = await lessonRepo.create({
        number: 10,
        title: 'Lesson 10',
        description: 'Tenth lesson',
      })

      // Test exact match boundary
      const resultExact = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })
      expect(resultExact.length).toBe(2)

      const exactNumbers = resultExact.map((lesson) => lesson.number).sort()
      expect(exactNumbers).toEqual([1, 5])

      // Test lower boundary
      const resultLower = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 1,
      })
      expect(resultLower.length).toBe(1)
      expect(resultLower[0]?.number).toBe(1)

      // Test no match
      const resultNone = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 0,
      })
      expect(resultNone.length).toBe(0)
    })

    test('should preserve lesson properties correctly', async () => {
      const originalLesson = await lessonRepo.create({
        number: 3,
        title: 'Test Lesson',
        description: 'A test lesson with description',
      })

      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })

      expect(result.length).toBe(1)

      const returnedLesson = result[0]
      expect(returnedLesson).toBeTruthy()
      expect(returnedLesson?.id).toBe(originalLesson.id)
      expect(returnedLesson?.number).toBe(originalLesson.number)
      expect(returnedLesson?.title).toBe(originalLesson.title)
      expect(returnedLesson?.description).toBe(originalLesson.description)
    })

    test('should handle large datasets efficiently', async () => {
      // Create multiple lessons
      const lessonCount = 20
      for (let i = 1; i <= lessonCount; i++) {
        await lessonRepo.create({
          number: i,
          title: `Lesson ${i}`,
          description: `Description for lesson ${i}`,
        })
      }

      // Test filtering
      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 10,
      })

      expect(result.length).toBe(10)

      const numbers = result.map((lesson) => lesson.number).sort((a, b) => a - b)
      const expectedNumbers = Array.from({ length: 10 }, (_, i) => i + 1)
      expect(numbers).toEqual(expectedNumbers)
    })
  })

  describe('Integration with existing methods', () => {
    test('should work together with other repository methods', async () => {
      // Create lesson using create method
      const createdLesson = await lessonRepo.create({
        number: 2,
        title: 'Integration Test Lesson',
        description: 'Testing integration',
      })

      // Verify it exists using getByNumber
      const foundByNumber = await lessonRepo.getByNumber(2)
      expect(foundByNumber).toBeTruthy()

      // Verify it's included in getLessonsByConditions
      const foundByConditions = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })
      expect(foundByConditions.length).toBe(1)
      expect(foundByConditions[0]?.id).toBe(createdLesson.id)

      // Verify existsByNumber works
      const exists = await lessonRepo.existsByNumber(2)
      expect(exists).toBe(true)
    })
  })
})
