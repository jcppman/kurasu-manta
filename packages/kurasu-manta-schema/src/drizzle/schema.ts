import type { KnowledgePointType } from '@/common/types'
import type { Annotation } from '@/zod/annotation'
import type { LocalizedText } from '@/zod/localized-text'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

const createdAndUpdatedAt = {
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
}

/**
 * Lessons table - represents a lesson
 */
export const lessonsTable = pgTable('lessons', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  // Lesson number
  number: integer().notNull().unique(),
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
export const knowledgePointsTable = pgTable('knowledge_points', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  // Foreign key to lessons table (one-to-many relationship)
  lessonId: integer()
    .notNull()
    .references(() => lessonsTable.id, { onDelete: 'cascade' }),
  // Type of knowledge point (vocabulary or grammar)
  type: text().notNull().$type<KnowledgePointType>(),
  // Content in Japanese
  content: text().notNull(),
  // Explanation of the knowledge point (localized)
  explanation: jsonb('explanation').$type<LocalizedText>(),
  // Type-specific data stored in JSON fields
  // For vocabulary: pos, annotations, examples
  // For grammar: examples
  typeSpecificData: jsonb('type_specific_data').$type<Record<string, unknown>>(),
  ...createdAndUpdatedAt,
})

/**
 * Sentence table
 */
export const sentencesTable = pgTable('sentences', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  // Content in Japanese
  content: text().notNull(),
  // Explanation of the knowledge point (localized)
  explanation: jsonb('explanation').$type<LocalizedText>().notNull(),
  // Annotations for the sentence
  annotations: jsonb('annotations').$type<Annotation[]>(),
  // Audio file path/URL for the sentence
  audio: text('audio'),
  // The lesson number this sentence is generated for
  minLessonNumber: integer().notNull(),
  ...createdAndUpdatedAt,
})

/**
 * Sentence to Knowledge Point relationship (many-to-many)
 */
export const sentenceKnowledgePointsTable = pgTable(
  'sentence_knowledge_points',
  {
    sentenceId: integer()
      .notNull()
      .references(() => sentencesTable.id, { onDelete: 'cascade' }),
    knowledgePointId: integer()
      .notNull()
      .references(() => knowledgePointsTable.id, { onDelete: 'cascade' }),
    // Creation timestamp
    createdAt: timestamp().notNull().defaultNow(),
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
