import { KNOWLEDGE_POINT_TYPES, type KnowledgePointType } from '@/common/types'
import type { PaginatedResult, PaginationParams } from '@/common/types'
import {
  knowledgePointsTable,
  sentenceKnowledgePointsTable,
  type sentencesTable,
} from '@/drizzle/schema'
import type * as schema from '@/drizzle/schema'
import type { Db } from '@/drizzle/types'
import { optionalResult, requireResult } from '@/drizzle/utils'
import {
  mapCreateKnowledgePointToDrizzle,
  mapDrizzleToKnowledgePoint,
  mapKnowledgePointToDrizzle,
} from '@/mapper/knowledge'
import { mapDrizzleToSentence } from '@/mapper/sentence'
import type { CreateKnowledgePoint, KnowledgePoint } from '@/zod/knowledge'
import { and, eq, sql } from 'drizzle-orm'

/**
 * Repository for knowledge points
 * This provides a clean API for accessing knowledge points from the database
 */
export class KnowledgeRepository {
  constructor(private db: Db) {}

  /**
   * Helper method to map knowledge point with sentences from relational query result
   */
  private mapKnowledgePointWithSentences(
    result: {
      sentenceKnowledgePoints: Array<{ sentence: typeof sentencesTable.$inferSelect }>
    } & typeof knowledgePointsTable.$inferSelect
  ): KnowledgePoint {
    const knowledgePoint = mapDrizzleToKnowledgePoint(result)
    knowledgePoint.sentences = result.sentenceKnowledgePoints.map((skp) =>
      mapDrizzleToSentence(skp.sentence)
    )
    return knowledgePoint
  }

  /**
   * Get all knowledge points
   * @deprecated Use getMany() instead
   */
  async getAll(): Promise<KnowledgePoint[]> {
    const result = await this.getMany()
    return result.items
  }

  /**
   * Get a knowledge point by ID
   */
  async getById(id: number, options?: { withSentences?: boolean }): Promise<KnowledgePoint | null> {
    if (options?.withSentences) {
      const result = await this.db.query.knowledgePointsTable.findFirst({
        where: eq(knowledgePointsTable.id, id),
        with: {
          sentenceKnowledgePoints: {
            with: {
              sentence: true,
            },
          },
        },
      })

      if (!result) return null

      return this.mapKnowledgePointWithSentences(result)
    }

    const rows = await this.db
      .select()
      .from(knowledgePointsTable)
      .where(eq(knowledgePointsTable.id, id))

    return optionalResult(rows, mapDrizzleToKnowledgePoint)
  }

  /**
   * Get knowledge points by lesson ID
   */
  async getByLessonId(
    lessonId: number,
    options?: { withSentences?: boolean }
  ): Promise<KnowledgePoint[]> {
    if (options?.withSentences) {
      // Use relational query to get knowledge points with sentences
      const results = await this.db.query.knowledgePointsTable.findMany({
        where: eq(knowledgePointsTable.lessonId, lessonId),
        with: {
          sentenceKnowledgePoints: {
            with: {
              sentence: true,
            },
          },
        },
      })

      return results.map((result) => this.mapKnowledgePointWithSentences(result))
    }

    const rows = await this.db
      .select()
      .from(knowledgePointsTable)
      .where(eq(knowledgePointsTable.lessonId, lessonId))

    return rows.map((row) => mapDrizzleToKnowledgePoint(row))
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
   * Get knowledge points with optional filtering and pagination
   * @param conditions Filtering conditions
   * @param pagination Pagination parameters
   * @param options Additional options
   * @returns Paginated result of knowledge points
   */
  async getMany(
    conditions: {
      lessonId?: number
      type?: KnowledgePointType
      hasAudio?: boolean
    } = {},
    pagination?: PaginationParams,
    options?: { withSentences?: boolean }
  ): Promise<PaginatedResult<KnowledgePoint>> {
    const whereClause = this.buildWhereClause(conditions)

    // If no pagination provided, return all results
    if (!pagination) {
      const rows = await this.db
        .select()
        .from(knowledgePointsTable)
        .where(whereClause)
        .orderBy(knowledgePointsTable.id)

      const items = rows.map(mapDrizzleToKnowledgePoint)

      // Fetch sentences if requested
      if (options?.withSentences && items.length > 0) {
        const knowledgePointsWithSentences = await this.db.query.knowledgePointsTable.findMany({
          where: sql`${knowledgePointsTable.id} IN (${items.map((item) => item.id).join(',')})`,
          with: {
            sentenceKnowledgePoints: {
              with: {
                sentence: true,
              },
            },
          },
        })

        const sentenceMap = new Map()
        for (const kp of knowledgePointsWithSentences) {
          sentenceMap.set(
            kp.id,
            kp.sentenceKnowledgePoints.map((skp) => mapDrizzleToSentence(skp.sentence))
          )
        }

        for (const item of items) {
          item.sentences = sentenceMap.get(item.id) || []
        }
      }

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

    // Fetch sentences if requested
    if (options?.withSentences && items.length > 0) {
      // Get knowledge points with sentences using relational query
      const knowledgePointsWithSentences = await this.db.query.knowledgePointsTable.findMany({
        where: sql`${knowledgePointsTable.id} IN (${items.map((item) => item.id).join(',')})`,
        with: {
          sentenceKnowledgePoints: {
            with: {
              sentence: true,
            },
          },
        },
      })

      // Map sentences to existing items
      const sentenceMap = new Map()
      for (const kp of knowledgePointsWithSentences) {
        sentenceMap.set(
          kp.id,
          kp.sentenceKnowledgePoints.map((skp) => mapDrizzleToSentence(skp.sentence))
        )
      }

      for (const item of items) {
        item.sentences = sentenceMap.get(item.id) || []
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

  /**
   * Helper method to build where clause for filtering conditions
   */
  private buildWhereClause(conditions: {
    lessonId?: number
    type?: KnowledgePointType
    hasAudio?: boolean
  }) {
    const whereConditions = []

    // Filter by lesson ID if provided
    if (conditions.lessonId !== undefined) {
      whereConditions.push(eq(knowledgePointsTable.lessonId, conditions.lessonId))
    }

    // Filter by type if provided
    if (conditions.type !== undefined) {
      whereConditions.push(eq(knowledgePointsTable.type, conditions.type))
    }

    // Filter by hasAudio if provided (only applicable for vocabularies)
    if (conditions.hasAudio !== undefined) {
      const audioCondition = conditions.hasAudio
        ? sql`${knowledgePointsTable.type} = ${KNOWLEDGE_POINT_TYPES.VOCABULARY} AND json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') IS NOT NULL`
        : sql`${knowledgePointsTable.type} = ${KNOWLEDGE_POINT_TYPES.VOCABULARY} AND (json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') IS NULL OR json_extract(${knowledgePointsTable.typeSpecificData}, '$.audio') = '')`

      whereConditions.push(audioCondition)
    }

    return whereConditions.length > 0 ? and(...whereConditions) : undefined
  }
}
