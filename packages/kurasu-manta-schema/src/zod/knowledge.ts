import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { z } from 'zod'
import { annotationSchema } from './annotation'
import { localizedText } from './localized-text'
import type { sentenceSchema } from './sentence'

export const baseKnowledgePointSchema = z.object({
  id: z.number().optional(),
  lesson: z.number(),
  content: z.string(),
  explanation: localizedText,
})

export const createVocabularySchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.VOCABULARY),
  pos: z.string(),
  annotations: z.array(annotationSchema),
  examples: z.array(z.string()),
  audio: z.string().optional(),
})

export const createGrammarSchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.GRAMMAR),
  examples: z.array(z.string()),
})

export const createKnowledgePointSchema = z.discriminatedUnion('type', [
  createVocabularySchema,
  createGrammarSchema,
])

export type CreateKnowledgePoint = z.infer<typeof createKnowledgePointSchema>
export type KnowledgePoint = z.infer<typeof createKnowledgePointSchema> & {
  id: number
  sentences?: z.infer<typeof sentenceSchema>[]
}
export type Vocabulary = z.infer<typeof createVocabularySchema> & {
  id: number
  sentences?: z.infer<typeof sentenceSchema>[]
}
export type Grammar = z.infer<typeof createGrammarSchema> & {
  id: number
  sentences?: z.infer<typeof sentenceSchema>[]
}
