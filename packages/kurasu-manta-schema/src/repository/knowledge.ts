import { KNOWLEDGE_POINT_TYPES, type KnowledgePointType } from '@/common/types'
import type { PaginatedResult, PaginationParams } from '@/common/types'
import { knowledgePointsTable, lessonKnowledgePointsTable } from '@/drizzle/schema'
import type * as schema from '@/drizzle/schema'
import { optionalResult, requireResult } from '@/drizzle/utils'
import {
  mapCreateKnowledgePointToDrizzle,
  mapDrizzleToKnowledgePoint,
  mapKnowledgePointToDrizzle,
} from '@/mapper/knowledge'
import type { CreateKnowledgePoint, KnowledgePoint } from '@/zod/knowledge'
import { and, eq, sql } from 'drizzle-orm'
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

  /**
   * Get knowledge points by conditions with pagination
   * @param conditions Filtering conditions
   * @param pagination Pagination parameters
   * @returns Paginated result of knowledge points
   */
  async getByConditions(
    conditions: {
      lessonId?: number
      type?: KnowledgePointType
      hasAudio?: boolean
    },
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<KnowledgePoint>> {
    // Set default pagination values
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit

    // Build the where conditions
    const whereConditions = []

    // Filter by lesson ID if provided
    if (conditions.lessonId !== undefined) {
      // We need to use a subquery to filter by lesson ID
      const subquery = this.db
        .select({ knowledgePointId: lessonKnowledgePointsTable.knowledgePointId })
        .from(lessonKnowledgePointsTable)
        .where(eq(lessonKnowledgePointsTable.lessonId, conditions.lessonId))
        .as('lesson_knowledge_points_subquery')

      whereConditions.push(
        sql`${knowledgePointsTable.id} IN (SELECT ${subquery.knowledgePointId} FROM ${subquery})`
      )
    }

    // Filter by type if provided
    if (conditions.type !== undefined) {
      whereConditions.push(eq(knowledgePointsTable.type, conditions.type))
    }

    // Filter by hasAudio if provided (only applicable for vocabularies)
    if (conditions.hasAudio !== undefined) {
      if (conditions.hasAudio) {
        // For hasAudio=true, we need to check if the audio field exists in typeSpecificData
        whereConditions.push(
          sql`${knowledgePointsTable.type} = ${KNOWLEDGE_POINT_TYPES.VOCABULARY} AND json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') IS NOT NULL`
        )
      } else {
        // For hasAudio=false, we need to check if the audio field doesn't exist or is null
        whereConditions.push(
          sql`${knowledgePointsTable.type} = ${KNOWLEDGE_POINT_TYPES.VOCABULARY} AND (json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') IS NULL OR json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') = '')`
        )
      }
    }

    // Combine all conditions with AND
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Get total count for pagination
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgePointsTable)
      .where(whereClause)

    const total = countResult[0]?.count || 0

    // Get the paginated results
    const rows = await this.db
      .select()
      .from(knowledgePointsTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(knowledgePointsTable.id)

    // Map the results
    const items = rows.map(mapDrizzleToKnowledgePoint)

    // If we filtered by lessonId, set the lesson property for each knowledge point
    if (conditions.lessonId !== undefined) {
      for (const item of items) {
        item.lesson = conditions.lessonId
      }
    }

    // Calculate pagination metadata
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
}
