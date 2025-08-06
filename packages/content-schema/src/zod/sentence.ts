import { annotationSchema } from '@/zod/annotation'
import { z } from 'zod'
import { localizedText } from './localized-text'

/**
 * Base sentence schema for validation
 */
export const baseSentenceSchema = z.object({
  content: z.string(),
  explanation: localizedText,
  annotations: z.array(annotationSchema),
  audio: z.string().optional(),
  // the lesson number this sentence generated for
  minLessonNumber: z.number(),
})

/**
 * Schema for creating a new sentence
 */
export const createSentenceSchema = baseSentenceSchema

/**
 * Schema for a complete sentence (includes ID and timestamps)
 */
export const sentenceSchema = baseSentenceSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/**
 * Schema for updating a sentence
 */
export const updateSentenceSchema = baseSentenceSchema.partial()

/**
 * TypeScript types derived from schemas
 */
export type CreateSentence = z.infer<typeof createSentenceSchema>
export type Sentence = z.infer<typeof sentenceSchema>
export type UpdateSentence = z.infer<typeof updateSentenceSchema>
