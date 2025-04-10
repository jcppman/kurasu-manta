import type { Annotation } from '@/types/knowledge-point'
import { relations } from 'drizzle-orm'
import { int, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { jsonField, jsonFieldOptional } from './utils'

/**
 * Knowledge point types as const object
 */
export const KNOWLEDGE_POINT_TYPES = {
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
  CONJUGATION: 'conjugation',
} as const

/**
 * Knowledge point type as a union type
 */
export type KnowledgePointType = (typeof KNOWLEDGE_POINT_TYPES)[keyof typeof KNOWLEDGE_POINT_TYPES]

/**
 * Lessons table - represents a lesson from the textbook
 */
export const lessonsTable = sqliteTable('lessons', {
  id: int().primaryKey({ autoIncrement: true }),
  // Lesson number in the textbook (e.g., Lesson 1, Lesson 2)
  sequenceNumber: int().notNull().unique(),
  // Title of the lesson
  title: text().notNull(),
  // Description or summary of the lesson
  description: text(),
  // Creation timestamp
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  // Last update timestamp
  updatedAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/**
 * Knowledge points table - core content of the system
 */
export const knowledgePointsTable = sqliteTable('knowledge_points', {
  id: int().primaryKey({ autoIncrement: true }),
  // Type of knowledge point
  type: text().notNull().$type<KnowledgePointType>(),
  // Content in Japanese
  content: text().notNull(),
  // Translation in target language (e.g., English, Chinese)
  translation: text().notNull(),
  // Explanation of the knowledge point
  explanation: text(),
  // Examples of usage
  examples: jsonFieldOptional<string[]>('json'), // Using JSON transformer
  // Annotations for content (e.g., furigana, word type, conjugation type)
  annotations: jsonField<Annotation[]>('json'), // Using JSON transformer
  // Creation timestamp
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  // Last update timestamp
  updatedAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/**
 * Lesson to Knowledge Point relationship (many-to-many)
 * This allows knowledge points to be associated with multiple lessons
 * and lessons to contain multiple knowledge points
 */
export const lessonKnowledgePointsTable = sqliteTable(
  'lesson_knowledge_points',
  {
    lessonId: int()
      .notNull()
      .references(() => lessonsTable.id, { onDelete: 'cascade' }),
    knowledgePointId: int()
      .notNull()
      .references(() => knowledgePointsTable.id, { onDelete: 'cascade' }),
    // Creation timestamp
    createdAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.lessonId, table.knowledgePointId] }),
    }
  }
)

/**
 * Relations for the lessons table
 */
export const lessonsRelations = relations(lessonsTable, ({ many }) => ({
  lessonKnowledgePoints: many(lessonKnowledgePointsTable),
}))

/**
 * Relations for the knowledge points table
 */
export const knowledgePointsRelations = relations(knowledgePointsTable, ({ many }) => ({
  lessonKnowledgePoints: many(lessonKnowledgePointsTable),
}))

/**
 * Relations for the lesson knowledge points table
 */
export const lessonKnowledgePointsRelations = relations(lessonKnowledgePointsTable, ({ one }) => ({
  lesson: one(lessonsTable, {
    fields: [lessonKnowledgePointsTable.lessonId],
    references: [lessonsTable.id],
  }),
  knowledgePoint: one(knowledgePointsTable, {
    fields: [lessonKnowledgePointsTable.knowledgePointId],
    references: [knowledgePointsTable.id],
  }),
}))
