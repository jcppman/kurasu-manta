import type { PaginatedResult, PaginationParams } from '@/common/types'
import { knowledgePointsTable, lessonsTable } from '@/drizzle/schema'
import type { Db } from '@/drizzle/types'
import { optionalResult, requireResult } from '@/drizzle/utils'
import { mapCreateLessonToDrizzle, mapDrizzleToLesson, mapLessonToDrizzle } from '@/mapper/lesson'
import type { CreateLesson, Lesson } from '@/zod/lesson'
import { count, eq, lte } from 'drizzle-orm'

/**
 * Repository for lessons
 * This provides a clean API for accessing lessons from the database
 */
export class LessonRepository {
  constructor(private db: Db) {}

  /**
   * Get lessons with optional filtering and pagination
   */
  async getMany(
    conditions: {
      numberLessThanOrEqual?: number
    } = {},
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Lesson>> {
    // If no pagination provided, return all results
    if (!pagination) {
      const rows =
        conditions.numberLessThanOrEqual !== undefined
          ? await this.db
              .select()
              .from(lessonsTable)
              .where(lte(lessonsTable.number, conditions.numberLessThanOrEqual))
          : await this.db.select().from(lessonsTable)

      const items = rows.map(mapDrizzleToLesson)
      return {
        items,
        total: items.length,
        page: 1,
        limit: items.length,
        totalPages: items.length === 0 ? 0 : 1,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit

    // Get total count
    const countResult =
      conditions.numberLessThanOrEqual !== undefined
        ? await this.db
            .select({ count: count() })
            .from(lessonsTable)
            .where(lte(lessonsTable.number, conditions.numberLessThanOrEqual))
        : await this.db.select({ count: count() }).from(lessonsTable)

    const total = countResult[0]?.count || 0

    // Get paginated results
    const rows =
      conditions.numberLessThanOrEqual !== undefined
        ? await this.db
            .select()
            .from(lessonsTable)
            .where(lte(lessonsTable.number, conditions.numberLessThanOrEqual))
            .limit(limit)
            .offset(offset)
        : await this.db.select().from(lessonsTable).limit(limit).offset(offset)

    const items = rows.map(mapDrizzleToLesson)
    const totalPages = Math.ceil(total / limit)

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
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
      .select({ id: knowledgePointsTable.id })
      .from(knowledgePointsTable)
      .where(eq(knowledgePointsTable.lessonId, lessonId))

    return rows.map((row: { id: number }) => row.id)
  }

  /**
   * Get lessons by conditions
   * @deprecated Use getMany() instead
   */
  async getLessonsByConditions(conditions: {
    lessonNumberLessThan?: number
  }): Promise<Lesson[]> {
    const result = await this.getMany({
      numberLessThanOrEqual: conditions.lessonNumberLessThan,
    })
    return result.items
  }
}
