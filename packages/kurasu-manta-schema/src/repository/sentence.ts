import type { PaginatedResult, PaginationParams } from '@/common/types'
import {
  knowledgePointsTable,
  sentenceKnowledgePointsTable,
  sentencesTable,
} from '@/drizzle/schema'
import type * as schema from '@/drizzle/schema'
import { optionalResult, requireResult } from '@/drizzle/utils'
import { mapDrizzleToKnowledgePoint } from '@/mapper/knowledge'
import { mapCreateSentenceToDrizzle, mapDrizzleToSentence } from '@/mapper/sentence'
import type { KnowledgePoint } from '@/zod/knowledge'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { and, count, eq, or, sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

/**
 * Repository for sentences
 * Provides a clean API for accessing sentences from the database
 */
export class SentenceRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  /**
   * Get all sentences
   */
  async getAll(): Promise<Sentence[]> {
    const rows = await this.db.select().from(sentencesTable)
    return rows.map(mapDrizzleToSentence)
  }

  /**
   * Get a sentence by ID
   */
  async getById(id: number): Promise<Sentence | null> {
    const rows = await this.db.select().from(sentencesTable).where(eq(sentencesTable.id, id))

    return optionalResult(rows, mapDrizzleToSentence)
  }

  /**
   * Get sentences with pagination
   */
  async getWithPagination(
    params: PaginationParams = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<Sentence>> {
    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    // Get total count
    const result = await this.db.select({ count: count() }).from(sentencesTable)
    const total = result[0]?.count || 0

    // Get paginated sentences
    const rows = await this.db.select().from(sentencesTable).limit(limit).offset(offset)

    const items = rows.map(mapDrizzleToSentence)
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
   * Get sentences associated with a knowledge point
   */
  async getByKnowledgePointId(knowledgePointId: number): Promise<Sentence[]> {
    const rows = await this.db
      .select({
        sentence: sentencesTable,
      })
      .from(sentenceKnowledgePointsTable)
      .innerJoin(sentencesTable, eq(sentenceKnowledgePointsTable.sentenceId, sentencesTable.id))
      .where(eq(sentenceKnowledgePointsTable.knowledgePointId, knowledgePointId))

    return rows.map((row) => mapDrizzleToSentence(row.sentence))
  }

  /**
   * Get knowledge points associated with a sentence
   */
  async getKnowledgePointsBySentenceId(sentenceId: number): Promise<KnowledgePoint[]> {
    const rows = await this.db
      .select({
        knowledgePoint: knowledgePointsTable,
      })
      .from(sentenceKnowledgePointsTable)
      .innerJoin(
        knowledgePointsTable,
        eq(sentenceKnowledgePointsTable.knowledgePointId, knowledgePointsTable.id)
      )
      .where(eq(sentenceKnowledgePointsTable.sentenceId, sentenceId))

    return rows.map((row) => mapDrizzleToKnowledgePoint(row.knowledgePoint))
  }

  /**
   * Create a new sentence
   */
  async create(sentence: CreateSentence): Promise<Sentence> {
    const created = await this.db
      .insert(sentencesTable)
      .values(mapCreateSentenceToDrizzle(sentence))
      .returning()

    return requireResult(created, mapDrizzleToSentence, 'Failed to create sentence')
  }

  /**
   * Update a sentence
   */
  async update(sentence: Sentence): Promise<Sentence> {
    // Add a small delay to ensure timestamp changes
    await new Promise<void>((resolve) => setTimeout(resolve, 1))

    const updated = await this.db
      .update(sentencesTable)
      .set({
        content: sentence.content,
        explanation: sentence.explanation,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sentencesTable.id, sentence.id))
      .returning()

    return requireResult(updated, mapDrizzleToSentence, 'Failed to update sentence')
  }

  /**
   * Delete a sentence by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(sentencesTable)
      .where(eq(sentencesTable.id, id))
      .returning({ id: sentencesTable.id })

    return result.length > 0
  }

  /**
   * Associate a sentence with a knowledge point
   */
  async associateWithKnowledgePoint(sentenceId: number, knowledgePointId: number): Promise<void> {
    await this.db
      .insert(sentenceKnowledgePointsTable)
      .values({
        sentenceId,
        knowledgePointId,
      })
      .onConflictDoNothing()
  }

  /**
   * Dissociate a sentence from a knowledge point
   */
  async dissociateFromKnowledgePoint(sentenceId: number, knowledgePointId: number): Promise<void> {
    await this.db
      .delete(sentenceKnowledgePointsTable)
      .where(
        and(
          eq(sentenceKnowledgePointsTable.sentenceId, sentenceId),
          eq(sentenceKnowledgePointsTable.knowledgePointId, knowledgePointId)
        )
      )
  }

  /**
   * Get all knowledge points associated with multiple sentences
   */
  async getKnowledgePointsForSentences(
    sentenceIds: number[]
  ): Promise<Map<number, KnowledgePoint[]>> {
    if (sentenceIds.length === 0) {
      return new Map()
    }

    // Use OR conditions for each sentence ID
    const sentenceConditions = sentenceIds.map((id) =>
      eq(sentenceKnowledgePointsTable.sentenceId, id)
    )

    // Ensure we have at least one condition before using or()
    if (sentenceConditions.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        sentenceId: sentenceKnowledgePointsTable.sentenceId,
        knowledgePoint: knowledgePointsTable,
      })
      .from(sentenceKnowledgePointsTable)
      .innerJoin(
        knowledgePointsTable,
        eq(sentenceKnowledgePointsTable.knowledgePointId, knowledgePointsTable.id)
      )
      .where(sentenceConditions.length === 1 ? sentenceConditions[0] : or(...sentenceConditions))

    const result = new Map<number, KnowledgePoint[]>()

    for (const row of rows) {
      const sentenceId = row.sentenceId
      const knowledgePoint = mapDrizzleToKnowledgePoint(row.knowledgePoint)

      if (!result.has(sentenceId)) {
        result.set(sentenceId, [])
      }
      result.get(sentenceId)?.push(knowledgePoint)
    }

    return result
  }

  /**
   * Get sentence counts for multiple knowledge points
   */
  async getCountByKnowledgePointIds(knowledgePointIds: number[]): Promise<Map<number, number>> {
    if (knowledgePointIds.length === 0) {
      return new Map()
    }

    // Use OR conditions for each knowledge point ID
    const knowledgePointConditions = knowledgePointIds.map((id) =>
      eq(sentenceKnowledgePointsTable.knowledgePointId, id)
    )

    const rows = await this.db
      .select({
        knowledgePointId: sentenceKnowledgePointsTable.knowledgePointId,
        count: count(),
      })
      .from(sentenceKnowledgePointsTable)
      .where(
        knowledgePointConditions.length === 1
          ? knowledgePointConditions[0]
          : or(...knowledgePointConditions)
      )
      .groupBy(sentenceKnowledgePointsTable.knowledgePointId)

    const result = new Map<number, number>()

    // Initialize all knowledge point IDs with count 0
    for (const id of knowledgePointIds) {
      result.set(id, 0)
    }

    // Update with actual counts
    for (const row of rows) {
      result.set(row.knowledgePointId, row.count)
    }

    return result
  }
}
