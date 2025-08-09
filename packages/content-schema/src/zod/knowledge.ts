import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { z } from 'zod'
import { annotationSchema } from './annotation'
import { localizedText } from './localized-text'
import type { sentenceSchema } from './sentence'

export const baseKnowledgePointSchema = z.object({
  lessonId: z.number(),
  content: z.string(),
  explanation: localizedText,
})

export const createVocabularySchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.VOCABULARY),
  pos: z.string(),
  accent: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  annotations: z.array(annotationSchema),
  audio: z.string().optional(),
})

export const createGrammarSchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.GRAMMAR),
})

export const createKnowledgePointSchema = z.discriminatedUnion('type', [
  createVocabularySchema,
  createGrammarSchema,
])

export const vocabularySchema = createVocabularySchema.extend({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const grammarSchema = createGrammarSchema.extend({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const knowledgePointSchema = z.discriminatedUnion('type', [vocabularySchema, grammarSchema])

export type CreateKnowledgePoint = z.infer<typeof createKnowledgePointSchema>
export type KnowledgePoint = z.infer<typeof knowledgePointSchema> & {
  sentences?: z.infer<typeof sentenceSchema>[]
}
export type Vocabulary = z.infer<typeof createVocabularySchema> & {
  id: number
  createdAt: Date
  updatedAt: Date
  sentences?: z.infer<typeof sentenceSchema>[]
}
export type Grammar = z.infer<typeof createGrammarSchema> & {
  id: number
  createdAt: Date
  updatedAt: Date
  sentences?: z.infer<typeof sentenceSchema>[]
}

export function isVocabulary(knowledgePoint: KnowledgePoint): knowledgePoint is Vocabulary {
  return knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY
}
export function isGrammar(knowledgePoint: KnowledgePoint): knowledgePoint is Grammar {
  return knowledgePoint.type === KNOWLEDGE_POINT_TYPES.GRAMMAR
}
