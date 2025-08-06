/**
 * Common type definitions shared across the application
 */

/**
 * Knowledge point types as const object
 * Single source of truth for knowledge point types
 */
export const KNOWLEDGE_POINT_TYPES = {
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
} as const

/**
 * Knowledge point type as a union type
 */
export type KnowledgePointType = (typeof KNOWLEDGE_POINT_TYPES)[keyof typeof KNOWLEDGE_POINT_TYPES]

/**
 * Pagination parameters for database queries
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page?: number
  /** Number of items per page */
  limit?: number
}

/**
 * Pagination result with metadata
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  items: T[]
  /** Total number of items across all pages */
  total: number
  /** Current page number (1-based) */
  page: number
  /** Number of items per page */
  limit: number
  /** Total number of pages */
  totalPages: number
  /** Whether there is a next page */
  hasNextPage: boolean
  /** Whether there is a previous page */
  hasPrevPage: boolean
}
