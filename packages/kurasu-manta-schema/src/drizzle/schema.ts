import type { KnowledgePointType } from '@/common/types'
import type { Annotation } from '@/zod/annotation'
import type { LocalizedText } from '@/zod/localized-text'
import { relations } from 'drizzle-orm'
import { int, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { jsonField } from './utils'

const createdAndUpdatedAt = {
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}

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
  ...createdAndUpdatedAt,
})

/**
 * Knowledge points table - core content
 * Following the heterogeneous data approach with JSON fields for type-specific data
 */
export const knowledgePointsTable = sqliteTable('knowledge_points', {
  id: int().primaryKey({ autoIncrement: true }),
  // Foreign key to lessons table (one-to-many relationship)
  lessonId: int()
    .notNull()
    .references(() => lessonsTable.id, { onDelete: 'cascade' }),
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
  ...createdAndUpdatedAt,
})

/**
 * Sentence table
 */
export const sentencesTable = sqliteTable('sentences', {
  id: int().primaryKey({ autoIncrement: true }),
  // Content in Japanese
  content: text().notNull(),
  // Explanation of the knowledge point (localized)
  explanation: jsonField<LocalizedText>('explanation').notNull(),
  // Annotations for the sentence
  annotations: jsonField<Annotation[]>('annotations'),
  // Audio file path/URL for the sentence
  audio: text('audio'),
  // The lesson number this sentence is generated for
  minLessonNumber: int().notNull(),
  ...createdAndUpdatedAt,
})

/**
 * Sentence to Knowledge Point relationship (many-to-many)
 */
export const sentenceKnowledgePointsTable = sqliteTable(
  'sentence_knowledge_points',
  {
    sentenceId: int()
      .notNull()
      .references(() => sentencesTable.id, { onDelete: 'cascade' }),
    knowledgePointId: int()
      .notNull()
      .references(() => knowledgePointsTable.id, { onDelete: 'cascade' }),
    // Creation timestamp
    createdAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [primaryKey({ columns: [table.sentenceId, table.knowledgePointId] })]
)

/**
 * Relations for the lessons table
 */
export const lessonsRelations = relations(lessonsTable, ({ many }) => ({
  knowledgePoints: many(knowledgePointsTable),
}))

/**
 * Relations for the knowledge points table
 */
export const knowledgePointsRelations = relations(knowledgePointsTable, ({ one, many }) => ({
  lesson: one(lessonsTable, {
    fields: [knowledgePointsTable.lessonId],
    references: [lessonsTable.id],
  }),
  sentenceKnowledgePoints: many(sentenceKnowledgePointsTable),
}))

/**
 * Relations for the sentences table
 */
export const sentencesRelations = relations(sentencesTable, ({ many }) => ({
  sentenceKnowledgePoints: many(sentenceKnowledgePointsTable),
}))

/**
 * Relations for the sentence knowledge points table
 */
export const sentenceKnowledgePointsRelations = relations(
  sentenceKnowledgePointsTable,
  ({ one }) => ({
    sentence: one(sentencesTable, {
      fields: [sentenceKnowledgePointsTable.sentenceId],
      references: [sentencesTable.id],
    }),
    knowledgePoint: one(knowledgePointsTable, {
      fields: [sentenceKnowledgePointsTable.knowledgePointId],
      references: [knowledgePointsTable.id],
    }),
  })
)
