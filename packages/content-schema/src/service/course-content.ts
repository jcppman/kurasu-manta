import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import type { KnowledgePointType, PaginatedResult, PaginationParams } from '@/common/types'
import { mergeWithPartialFiltered } from '@/common/utils'
import type { Db } from '@/drizzle/types'
import { KnowledgeRepository } from '@/repository/knowledge'
import { LessonRepository } from '@/repository/lesson'
import { SentenceRepository } from '@/repository/sentence'
import type { CreateKnowledgePoint, KnowledgePoint, Vocabulary } from '@/zod/knowledge'
import type { Lesson } from '@/zod/lesson'
import type { CreateSentence, Sentence } from '@/zod/sentence'
import { groupBy, isEmpty, isNumber, map, toPairs } from 'lodash-es'

/**
 * Interface for a lesson with its associated knowledge points
 */
export interface LessonWithContent extends Lesson {
  knowledgePoints: KnowledgePoint[]
}

/**
 * Service for managing course content
 * This provides higher-level operations for working with lessons and knowledge points
 */
export class CourseContentService {
  private lessonRepository: LessonRepository
  private knowledgeRepository: KnowledgeRepository
  private sentenceRepository: SentenceRepository

  constructor(db: Db) {
    this.lessonRepository = new LessonRepository(db)
    this.knowledgeRepository = new KnowledgeRepository(db)
    this.sentenceRepository = new SentenceRepository(db)
  }

  /**
   * Get a lesson by ID, optionally with its knowledge points
   */
  async getLessonById(
    lessonId: number,
    options: { withContent: true }
  ): Promise<LessonWithContent | null>
  async getLessonById(lessonId: number, options?: { withContent?: false }): Promise<Lesson | null>
  async getLessonById(
    lessonId: number,
    options: { withContent?: boolean } = {}
  ): Promise<Lesson | LessonWithContent | null> {
    // Get the lesson by ID
    const lesson = await this.lessonRepository.getById(lessonId)
    if (!lesson) {
      return null
    }

    // If content is not requested, return just the lesson
    if (!options.withContent) {
      return lesson
    }

    // Get the knowledge points for this lesson
    const knowledgePoints = await this.knowledgeRepository.getByLessonId(lessonId)

    // Return the lesson with its knowledge points
    return {
      ...lesson,
      knowledgePoints,
    }
  }

  /**
   * Delete a lesson and its knowledge points
   */
  async deleteLessonWithContent(lessonId: number): Promise<boolean> {
    // Get the knowledge point IDs associated with this lesson
    const knowledgePointIds = await this.lessonRepository.getKnowledgePointIds(lessonId)

    // Delete each knowledge point
    for (const knowledgePointId of knowledgePointIds) {
      await this.knowledgeRepository.delete(knowledgePointId)
    }

    // Delete the lesson
    return this.lessonRepository.delete(lessonId)
  }

  /**
   * Remove knowledge points from a lesson (delete them entirely since they belong to one lesson)
   */
  async removeKnowledgePointsFromLesson(
    lessonId: number,
    knowledgePointIds: number[]
  ): Promise<boolean> {
    if (!knowledgePointIds.length) {
      return true // Nothing to remove
    }

    try {
      // Delete each knowledge point (since they belong to one lesson only)
      for (const knowledgePointId of knowledgePointIds) {
        await this.knowledgeRepository.delete(knowledgePointId)
      }
      return true
    } catch (error) {
      console.error('Error removing knowledge points from lesson:', error)
      return false
    }
  }

  /**
   * Get knowledge points by conditions with pagination
   * @param conditions Filtering conditions
   * @param pagination Pagination parameters (supports both page-based and offset-based)
   * @returns Paginated result of knowledge points
   */
  async getKnowledgePointsByConditions(
    conditions: {
      lessonId?: number
      hasAudio?: boolean
      type?: KnowledgePointType // Optional type filter - if not provided, returns all types
    },
    pagination?: PaginationParams | { limit?: number; offset?: number }
  ): Promise<PaginatedResult<KnowledgePoint>> {
    // Convert offset-based pagination to page-based if needed
    let normalizedPagination: PaginationParams | undefined
    if (pagination) {
      if ('offset' in pagination) {
        // Convert offset-based to page-based
        const limit = pagination.limit || 20
        const offset = pagination.offset || 0
        const page = Math.floor(offset / limit) + 1
        normalizedPagination = { page, limit }
      } else {
        normalizedPagination = pagination
      }
    }

    // Use the repository method with optional type filtering
    const result = await this.knowledgeRepository.getMany(
      conditions, // Pass conditions as-is, including optional type
      normalizedPagination
    )

    // Return all knowledge points (no filtering needed since repository handles it)
    return result
  }

  async getVocabularyById(
    id: number,
    options: { withSentences?: boolean } = {}
  ): Promise<Vocabulary | null> {
    const vocabulary = await this.knowledgeRepository.getById(id, {
      withSentences: options.withSentences,
    })
    if (!vocabulary || vocabulary.type !== KNOWLEDGE_POINT_TYPES.VOCABULARY) {
      return null
    }
    return vocabulary
  }

  /**
   * update knowledge point
   */
  async partialUpdateKnowledgePoint(
    id: number,
    knowledgePoint: Partial<KnowledgePoint>
  ): Promise<KnowledgePoint | null> {
    // get the knowledge point by ID
    const existingKnowledgePoint = await this.knowledgeRepository.getById(id)
    if (!existingKnowledgePoint) {
      return null
    }

    const updatedKnowledgePoint = await this.knowledgeRepository.update(
      id,
      mergeWithPartialFiltered(existingKnowledgePoint, knowledgePoint)
    )

    // Check if the update was successful
    if (!updatedKnowledgePoint) {
      throw new Error(`Failed to update vocabulary with ID ${id}`)
    }

    // Return the updated vocabulary
    return updatedKnowledgePoint
  }

  /**
   * Get sentence counts for multiple knowledge points
   */
  async getSentenceCountsByKnowledgePointIds(
    knowledgePointIds: number[]
  ): Promise<Map<number, number>> {
    return this.sentenceRepository.getCountByKnowledgePointIds(knowledgePointIds)
  }

  /**
   * Get sentences associated with any of the provided knowledge point IDs
   */
  async getSentencesByKnowledgePointIds(knowledgePointIds: number[]): Promise<Sentence[]> {
    return this.sentenceRepository.getSentencesByKnowledgePointIds(knowledgePointIds)
  }

  /**
   * Create a sentence and associate it with knowledge points
   */
  async createSentenceWithKnowledgePoints(
    sentence: CreateSentence,
    knowledgePointIds: number[]
  ): Promise<Sentence> {
    // Create the sentence
    const createdSentence = await this.sentenceRepository.create(sentence)

    // Associate with all knowledge points
    for (const knowledgePointId of knowledgePointIds) {
      await this.sentenceRepository.associateWithKnowledgePoint(
        createdSentence.id,
        knowledgePointId
      )
    }

    return createdSentence
  }

  /**
   * Get lessons that are in scope (lesson number less than or equal to given lesson number)
   */
  async getLessonsInScope(lessonNumber: number): Promise<Lesson[]> {
    return this.lessonRepository.getLessonsByConditions({
      lessonNumberLessThan: lessonNumber,
    })
  }

  /**
   * Get all lessons with optional pagination
   * @param pagination Pagination parameters (supports both page-based and offset-based)
   * @returns Paginated result of lessons
   */
  async getLessons(
    pagination?: PaginationParams | { limit?: number; offset?: number }
  ): Promise<PaginatedResult<Lesson>> {
    // Convert offset-based pagination to page-based if needed
    let normalizedPagination: PaginationParams | undefined
    if (pagination) {
      if ('offset' in pagination) {
        // Convert offset-based to page-based
        const limit = pagination.limit || 10
        const offset = pagination.offset || 0
        const page = Math.floor(offset / limit) + 1
        normalizedPagination = { page, limit }
      } else {
        normalizedPagination = pagination
      }
    }

    // Use the repository method
    return this.lessonRepository.getMany({}, normalizedPagination)
  }

  /**
   * Get a lesson by its lesson number
   * @param lessonNumber The lesson number to search for
   * @returns The lesson if found, null otherwise
   */
  async getLessonByNumber(lessonNumber: number): Promise<Lesson | null> {
    return this.lessonRepository.getByNumber(lessonNumber)
  }

  /**
   * Create a new lesson
   * @param lesson The lesson data to create
   * @returns The created lesson with database ID
   */
  async createLesson(lesson: { number: number; title: string }): Promise<Lesson> {
    return this.lessonRepository.create(lesson)
  }

  /**
   * Create multiple knowledge points
   * Each knowledge point must have a valid lessonId (database ID, not lesson number)
   * @param knowledgePoints Array of knowledge points to create
   * @returns Array of created knowledge points
   */
  async createKnowledgePoints(knowledgePoints: CreateKnowledgePoint[]): Promise<KnowledgePoint[]> {
    return Promise.all(knowledgePoints.map((kp) => this.knowledgeRepository.create(kp)))
  }

  /**
   * Update a knowledge point
   * @param id The knowledge point ID to update
   * @param knowledgePoint The updated knowledge point data
   * @returns The updated knowledge point, or null if not found
   */
  async updateKnowledgePoint(
    id: number,
    knowledgePoint: KnowledgePoint
  ): Promise<KnowledgePoint | null> {
    return this.knowledgeRepository.update(id, knowledgePoint)
  }

  /**
   * Get all sentences with optional filtering and pagination
   * @param filters Filtering conditions
   * @param pagination Pagination parameters (supports both page-based and offset-based)
   * @returns Paginated result of sentences
   */
  async getSentences(
    filters?: { minLessonNumber?: number; knowledgePointId?: number },
    pagination?: PaginationParams | { limit?: number; offset?: number }
  ): Promise<PaginatedResult<Sentence>> {
    // Convert offset-based pagination to page-based if needed
    let normalizedPagination: PaginationParams | undefined
    if (pagination) {
      if ('offset' in pagination) {
        // Convert offset-based to page-based
        const limit = pagination.limit || 10
        const offset = pagination.offset || 0
        const page = Math.floor(offset / limit) + 1
        normalizedPagination = { page, limit }
      } else {
        normalizedPagination = pagination
      }
    }

    // Use the repository method with filters
    return this.sentenceRepository.getMany(filters, normalizedPagination)
  }

  /**
   * Get statistics for knowledge points in a lesson
   * @param lessonId The lesson ID to get stats for
   * @returns Array of statistics with knowledge point ID and sentence count
   */
  async getLessonKnowledgePointSentenceStats(lessonId: number): Promise<
    Array<{
      knowledgePointId: number
      sentenceCount: number
      type: 'vocabulary' | 'grammar'
      pos?: string
    }>
  > {
    // Get all knowledge points for this lesson
    const knowledgePoints = await this.knowledgeRepository.getByLessonId(lessonId)

    if (knowledgePoints.length === 0) {
      return []
    }

    // Get sentence counts for all knowledge points
    const knowledgePointIds = knowledgePoints.map((kp) => kp.id)
    const sentenceCountsMap = await this.getSentenceCountsByKnowledgePointIds(knowledgePointIds)

    // Build the result array
    return knowledgePoints.map((kp) => ({
      knowledgePointId: kp.id,
      sentenceCount: sentenceCountsMap.get(kp.id) || 0,
      type: kp.type,
      pos: kp.type === 'vocabulary' ? kp.pos : undefined,
    }))
  }
}
