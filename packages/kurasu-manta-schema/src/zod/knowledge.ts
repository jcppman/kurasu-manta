import { z } from 'zod'
import { annotationSchema } from './annotation'
import { localizedText } from './localized-text'

export const baseKnowledgePointSchema = z.object({
  lesson: z.number(),
  content: z.string(),
  explanation: localizedText,
})

export const vocabularySchema = baseKnowledgePointSchema.extend({
  type: z.literal('vocabulary'),
  pos: z.string(),
  annotations: z.array(annotationSchema),
  examples: z.array(z.string()),
})

export const grammarSchema = baseKnowledgePointSchema.extend({
  type: z.literal('grammar'),
  examples: z.array(z.string()),
})

export const knowledgePointSchema = z.discriminatedUnion('type', [vocabularySchema, grammarSchema])

export type KnowledgePoint = z.infer<typeof knowledgePointSchema>
export type Vocabulary = z.infer<typeof vocabularySchema>
export type Grammar = z.infer<typeof grammarSchema>
