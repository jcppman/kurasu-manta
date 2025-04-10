import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import { z } from 'zod'
import { annotationSchema } from './annotation'
import { localizedText } from './localized-text'

export const baseKnowledgePointSchema = z.object({
  id: z.number().optional(),
  lesson: z.number(),
  content: z.string(),
  explanation: localizedText,
})

export const vocabularySchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.VOCABULARY),
  pos: z.string(),
  annotations: z.array(annotationSchema),
  examples: z.array(z.string()),
})

export const grammarSchema = baseKnowledgePointSchema.extend({
  type: z.literal(KNOWLEDGE_POINT_TYPES.GRAMMAR),
  examples: z.array(z.string()),
})

export const knowledgePointSchema = z.discriminatedUnion('type', [vocabularySchema, grammarSchema])

export type CreateKnowledgePoint = z.infer<typeof knowledgePointSchema>
export type KnowledgePoint = z.infer<typeof knowledgePointSchema> & { id: number }
export type Vocabulary = z.infer<typeof vocabularySchema>
export type Grammar = z.infer<typeof grammarSchema>
