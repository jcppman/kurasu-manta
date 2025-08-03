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
   * Create knowledge points and associate them with their respective lessons
   * Knowledge points can belong to different lessons
   * @param knowledgePoints Array of knowledge points to create
   * @returns Map of lesson number to LessonWithContent objects
   */
  async createKnowledgePointsWithLesson(
    knowledgePoints: CreateKnowledgePoint[]
  ): Promise<Map<number, LessonWithContent>> {
    if (isEmpty(knowledgePoints)) {
      throw new Error('At least one knowledge point is required')
    }

    // Group knowledge points by lesson number
    const knowledgePointsByLesson = groupBy(knowledgePoints, 'lessonId')

    // Map to store lessons with their created knowledge points
    const lessonsWithContent = new Map<number, LessonWithContent>()

    // Process each lesson group
    for (const [lessonNumberStr, lessonKnowledgePoints] of toPairs(knowledgePointsByLesson)) {
      const lessonNumber = Number(lessonNumberStr)

      // Check if the lesson exists (using the more efficient method)
      const lessonExists = await this.lessonRepository.existsByNumber(lessonNumber)

      // Get or create the lesson
      let lesson: Lesson
      if (lessonExists) {
        // Only fetch the full lesson if it exists
        const existingLesson = await this.lessonRepository.getByNumber(lessonNumber)
        if (!existingLesson) {
          throw new Error(`Lesson ${lessonNumber} exists but could not be retrieved`)
        }
        lesson = existingLesson
      } else {
        // Create a new lesson with a default title
        lesson = await this.lessonRepository.create({
          number: lessonNumber,
          title: `Lesson ${lessonNumber}`,
        })
      }

      // Create knowledge points (they already have lessonId set)
      const createdKnowledgePoints = await Promise.all(
        map(lessonKnowledgePoints, async (knowledgePoint) => {
          return this.knowledgeRepository.create(knowledgePoint)
        })
      )

      // Ensure lesson ID is defined
      if (!isNumber(lesson.id)) {
        throw new Error(`Lesson ${lessonNumber} has no ID`)
      }

      // Add the lesson with its knowledge points to the result map
      lessonsWithContent.set(lesson.number, {
        ...lesson,
        knowledgePoints: createdKnowledgePoints,
      })
    }

    return lessonsWithContent
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

  /**
   * Get vocabularies by conditions with pagination
   * @deprecated Use getKnowledgePointsByConditions with type: 'vocabulary' instead
   * @param conditions Filtering conditions
   * @param pagination Pagination parameters
   * @returns Paginated result of vocabularies
   */
  async getVocabulariesByConditions(
    conditions: {
      lessonId?: number
      hasAudio?: boolean
    },
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Vocabulary>> {
    // Delegate to the new method with vocabulary type filter
    const result = await this.getKnowledgePointsByConditions(
      {
        ...conditions,
        type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
      },
      pagination
    )

    // Filter the results to only include vocabularies for type safety
    const vocabularies = result.items.filter(
      (item): item is Vocabulary => item.type === KNOWLEDGE_POINT_TYPES.VOCABULARY
    )

    return {
      ...result,
      items: vocabularies,
    }
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
   * Get all sentences with optional filtering and pagination
   * @param filters Filtering conditions
   * @param pagination Pagination parameters (supports both page-based and offset-based)
   * @returns Paginated result of sentences
   */
  async getSentences(
    filters?: { minLessonNumber?: number },
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
    return this.sentenceRepository.getMany(filters || {}, normalizedPagination)
  }

  /**
   * Get statistics for knowledge points in a lesson
   * @param lessonId The lesson ID to get stats for
   * @returns Array of statistics with knowledge point ID and sentence count
   */
  async getLessonKnowledgePointSentenceStats(
    lessonId: number
  ): Promise<Array<{ knowledgePointId: number; sentenceCount: number }>> {
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
    }))
  }
}
