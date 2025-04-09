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
