import assert from 'node:assert'
import test from 'node:test'
import { createInMemoryDb } from '@tests/utils/db'
import { LessonRepository } from './lesson'

test('LessonRepository', async (t) => {
  let lessonRepo: LessonRepository

  // Setup before each test
  t.beforeEach(async () => {
    const db = await createInMemoryDb()
    lessonRepo = new LessonRepository(db)
  })

  await t.test('getLessonsByConditions', async (t) => {
    await t.test('should return empty array when no lessons exist', async () => {
      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })

      assert.strictEqual(result.length, 0, 'Should return empty array')
    })

    await t.test(
      'should return lessons with number less than or equal to given number',
      async () => {
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

        assert.strictEqual(result.length, 3, 'Should return 3 lessons')

        const lessonNumbers = result.map((lesson) => lesson.number).sort()
        assert.deepStrictEqual(lessonNumbers, [1, 3, 5], 'Should return lessons 1, 3, and 5')
      }
    )

    await t.test('should return all lessons when condition is not specified', async () => {
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

      assert.strictEqual(result.length, 2, 'Should return all lessons')
    })

    await t.test('should handle boundary conditions correctly', async () => {
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
      assert.strictEqual(resultExact.length, 2, 'Should include lesson with exact number match')

      const exactNumbers = resultExact.map((lesson) => lesson.number).sort()
      assert.deepStrictEqual(exactNumbers, [1, 5], 'Should include lessons 1 and 5')

      // Test lower boundary
      const resultLower = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 1,
      })
      assert.strictEqual(resultLower.length, 1, 'Should include lesson 1')
      assert.strictEqual(resultLower[0]?.number, 1, 'Should be lesson 1')

      // Test no match
      const resultNone = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 0,
      })
      assert.strictEqual(resultNone.length, 0, 'Should return no lessons when number is too low')
    })

    await t.test('should preserve lesson properties correctly', async () => {
      const originalLesson = await lessonRepo.create({
        number: 3,
        title: 'Test Lesson',
        description: 'A test lesson with description',
      })

      const result = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })

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

    await t.test('should handle large datasets efficiently', async () => {
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

      assert.strictEqual(result.length, 10, 'Should return 10 lessons')

      const numbers = result.map((lesson) => lesson.number).sort((a, b) => a - b)
      const expectedNumbers = Array.from({ length: 10 }, (_, i) => i + 1)
      assert.deepStrictEqual(numbers, expectedNumbers, 'Should return lessons 1-10')
    })
  })

  await t.test('Integration with existing methods', async (t) => {
    await t.test('should work together with other repository methods', async () => {
      // Create lesson using create method
      const createdLesson = await lessonRepo.create({
        number: 2,
        title: 'Integration Test Lesson',
        description: 'Testing integration',
      })

      // Verify it exists using getByNumber
      const foundByNumber = await lessonRepo.getByNumber(2)
      assert.ok(foundByNumber, 'Lesson should be found by number')

      // Verify it's included in getLessonsByConditions
      const foundByConditions = await lessonRepo.getLessonsByConditions({
        lessonNumberLessThan: 5,
      })
      assert.strictEqual(foundByConditions.length, 1, 'Should find lesson through conditions')
      assert.strictEqual(foundByConditions[0]?.id, createdLesson.id, 'Should be the same lesson')

      // Verify existsByNumber works
      const exists = await lessonRepo.existsByNumber(2)
      assert.strictEqual(exists, true, 'Lesson should exist')
    })
  })
})
