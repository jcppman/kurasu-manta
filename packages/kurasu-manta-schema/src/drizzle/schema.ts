import type { KnowledgePointType } from '@/common/types'
import type { LocalizedText } from '@/zod/localized-text'
import { relations } from 'drizzle-orm'
import { int, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { jsonField } from './utils'

/**
 * Re-export knowledge point types for backward compatibility
 */
export { KNOWLEDGE_POINT_TYPES, type KnowledgePointType } from '@/common/types'

/**
 * Lessons table - represents a lesson
 */
export const lessonsTable = sqliteTable('lessons', {
  id: int().primaryKey({ autoIncrement: true }),
  // Lesson number
  number: int().notNull().unique(),
  // Title of the lesson
  title: text(),
  // Description of the lesson
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
 * Knowledge points table - core content
 * Following the heterogeneous data approach with JSON fields for type-specific data
 */
export const knowledgePointsTable = sqliteTable('knowledge_points', {
  id: int().primaryKey({ autoIncrement: true }),
  // Type of knowledge point (vocabulary or grammar)
  type: text().notNull().$type<KnowledgePointType>(),
  // Content in Japanese
  content: text().notNull(),
  // Explanation of the knowledge point (localized)
  explanation: jsonField<LocalizedText>('explanation'),
  // Type-specific data stored in JSON fields
  // For vocabulary: pos, annotations, examples
  // For grammar: examples
  typeSpecificData: jsonField<Record<string, unknown>>('type_specific_data'),
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
  (table) => [primaryKey({ columns: [table.lessonId, table.knowledgePointId] })]
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
