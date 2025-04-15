import { lessonKnowledgePointsTable, lessonsTable } from '@/drizzle/schema'
import type { Db } from '@/drizzle/types'
import { optionalResult, requireResult } from '@/drizzle/utils'
import { mapCreateLessonToDrizzle, mapDrizzleToLesson, mapLessonToDrizzle } from '@/mapper/lesson'
import type { CreateLesson, Lesson } from '@/zod/lesson'
import { eq } from 'drizzle-orm'

/**
 * Repository for lessons
 * This provides a clean API for accessing lessons from the database
 */
export class LessonRepository {
  constructor(private db: Db) {}

  /**
   * Get all lessons
   */
  async getAll(): Promise<Lesson[]> {
    const rows = await this.db.select().from(lessonsTable)
    return rows.map(mapDrizzleToLesson)
  }

  /**
   * Get a lesson by ID
   */
  async getById(id: number): Promise<Lesson | null> {
    const rows = await this.db.select().from(lessonsTable).where(eq(lessonsTable.id, id))
    return optionalResult(rows, mapDrizzleToLesson)
  }

  /**
   * Get a lesson by number
   */
  async getByNumber(number: number): Promise<Lesson | null> {
    const rows = await this.db.select().from(lessonsTable).where(eq(lessonsTable.number, number))
    return optionalResult(rows, mapDrizzleToLesson)
  }

  /**
   * Check if a lesson exists by number
   * This is more efficient than getByNumber when you only need to check existence
   */
  async existsByNumber(number: number): Promise<boolean> {
    const result = await this.db
      .select({ id: lessonsTable.id })
      .from(lessonsTable)
      .where(eq(lessonsTable.number, number))
      .limit(1)

    return result.length > 0
  }

  /**
   * Create a new lesson
   */
  async create(lesson: CreateLesson): Promise<Lesson> {
    const data = mapCreateLessonToDrizzle(lesson)
    const result = await this.db.insert(lessonsTable).values(data).returning()
    return requireResult(
      result,
      mapDrizzleToLesson,
      'Failed to create lesson: No result returned from database'
    )
  }

  /**
   * Update a lesson
   */
  async update(id: number, lesson: Lesson): Promise<Lesson | null> {
    const data = mapLessonToDrizzle(lesson)
    const result = await this.db
      .update(lessonsTable)
      .set(data)
      .where(eq(lessonsTable.id, id))
      .returning()

    return optionalResult(result, mapDrizzleToLesson)
  }

  /**
   * Delete a lesson
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(lessonsTable)
      .where(eq(lessonsTable.id, id))
      .returning({ id: lessonsTable.id })

    return result.length > 0
  }

  /**
   * Get knowledge point IDs associated with a lesson
   */
  async getKnowledgePointIds(lessonId: number): Promise<number[]> {
    const rows = await this.db
      .select({ knowledgePointId: lessonKnowledgePointsTable.knowledgePointId })
      .from(lessonKnowledgePointsTable)
      .where(eq(lessonKnowledgePointsTable.lessonId, lessonId))

    return rows.map((row: { knowledgePointId: number }) => row.knowledgePointId)
  }
}
