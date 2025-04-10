import { knowledgePointsTable, lessonKnowledgePointsTable } from '@/drizzle/schema'
import type * as schema from '@/drizzle/schema'
import { optionalResult, requireResult } from '@/drizzle/utils'
import {
  mapCreateKnowledgePointToDrizzle,
  mapDrizzleToKnowledgePoint,
  mapKnowledgePointToDrizzle,
} from '@/mappers/knowledge'
import type { CreateKnowledgePoint, KnowledgePoint } from '@/zod/knowledge'
import { and, eq } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

/**
 * Repository for knowledge points
 * This provides a clean API for accessing knowledge points from the database
 */
export class KnowledgeRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  /**
   * Get all knowledge points
   */
  async getAll(): Promise<KnowledgePoint[]> {
    const rows = await this.db.select().from(knowledgePointsTable)
    return rows.map(mapDrizzleToKnowledgePoint)
  }

  /**
   * Get a knowledge point by ID
   */
  async getById(id: number): Promise<KnowledgePoint | null> {
    const rows = await this.db
      .select()
      .from(knowledgePointsTable)
      .where(eq(knowledgePointsTable.id, id))

    return optionalResult(rows, mapDrizzleToKnowledgePoint)
  }

  /**
   * Get knowledge points by lesson ID
   */
  async getByLessonId(lessonId: number): Promise<KnowledgePoint[]> {
    const rows = await this.db
      .select({
        knowledgePoint: knowledgePointsTable,
      })
      .from(lessonKnowledgePointsTable)
      .innerJoin(
        knowledgePointsTable,
        eq(lessonKnowledgePointsTable.knowledgePointId, knowledgePointsTable.id)
      )
      .where(eq(lessonKnowledgePointsTable.lessonId, lessonId))

    return rows.map((row: { knowledgePoint: typeof knowledgePointsTable.$inferSelect }) =>
      mapDrizzleToKnowledgePoint(row.knowledgePoint)
    )
  }

  /**
   * Create a new knowledge point
   */
  async create(knowledgePoint: CreateKnowledgePoint): Promise<KnowledgePoint> {
    const data = mapCreateKnowledgePointToDrizzle(knowledgePoint)
    const result = await this.db.insert(knowledgePointsTable).values(data).returning()
    return requireResult(result, mapDrizzleToKnowledgePoint)
  }

  /**
   * Update a knowledge point
   */
  async update(id: number, knowledgePoint: KnowledgePoint): Promise<KnowledgePoint | null> {
    const data = mapKnowledgePointToDrizzle(knowledgePoint)
    const result = await this.db
      .update(knowledgePointsTable)
      .set(data)
      .where(eq(knowledgePointsTable.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    return optionalResult(result, mapDrizzleToKnowledgePoint)
  }

  /**
   * Delete a knowledge point
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(knowledgePointsTable)
      .where(eq(knowledgePointsTable.id, id))
      .returning({ id: knowledgePointsTable.id })

    return result.length > 0
  }

  /**
   * Associate a knowledge point with a lesson
   */
  async associateWithLesson(knowledgePointId?: number, lessonId?: number): Promise<void> {
    if (typeof knowledgePointId !== 'number' || typeof lessonId !== 'number') {
      throw new Error('knowledgePointId and lessonId must be numbers')
    }
    await this.db
      .insert(lessonKnowledgePointsTable)
      .values({
        knowledgePointId,
        lessonId,
      })
      .onConflictDoNothing()
  }

  /**
   * Disassociate a knowledge point from a lesson
   */
  async disassociateFromLesson(knowledgePointId: number, lessonId: number): Promise<void> {
    await this.db
      .delete(lessonKnowledgePointsTable)
      .where(
        and(
          eq(lessonKnowledgePointsTable.knowledgePointId, knowledgePointId),
          eq(lessonKnowledgePointsTable.lessonId, lessonId)
        )
      )
  }
}
