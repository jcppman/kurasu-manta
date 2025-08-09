import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import type { knowledgePointsTable } from '@/drizzle/schema'
import { annotationSchema } from '@/zod/annotation'
import type { CreateKnowledgePoint, Grammar, KnowledgePoint, Vocabulary } from '@/zod/knowledge'
import { isGrammar, isVocabulary, knowledgePointSchema } from '@/zod/knowledge'
import { localizedText } from '@/zod/localized-text'
import { z } from 'zod'

/**
 * Maps a Zod KnowledgePoint to a Drizzle knowledgePointsTable insert object
 */
export function mapCreateKnowledgePointToDrizzle(knowledgePoint: CreateKnowledgePoint) {
  const baseData = {
    type: knowledgePoint.type,
    content: knowledgePoint.content,
    explanation: knowledgePoint.explanation,
    lessonId: knowledgePoint.lessonId,
  }

  let typeSpecificData: Record<string, unknown> = {}

  if (knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY) {
    // TypeScript discriminated union ensures this is a Vocabulary type
    typeSpecificData = {
      audio: knowledgePoint.audio,
      pos: knowledgePoint.pos,
      accent: knowledgePoint.accent,
      annotations: knowledgePoint.annotations,
    }
  } else if (knowledgePoint.type === KNOWLEDGE_POINT_TYPES.GRAMMAR) {
    typeSpecificData = {}
  }

  return {
    ...baseData,
    typeSpecificData,
  }
}
export function mapKnowledgePointToDrizzle(knowledgePoint: KnowledgePoint) {
  return {
    id: knowledgePoint.id,
    ...mapCreateKnowledgePointToDrizzle(knowledgePoint),
  }
}

/**
 * Maps a Drizzle knowledgePointsTable row to a Zod KnowledgePoint
 */
export function mapDrizzleToKnowledgePoint(
  row: typeof knowledgePointsTable.$inferSelect
): KnowledgePoint {
  const { type, content, explanation, typeSpecificData, lessonId } = row

  // Validate explanation using Zod
  const validatedExplanation = localizedText.parse(explanation)

  const baseData = {
    id: row.id,
    lessonId: lessonId,
    content,
    explanation: validatedExplanation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  if (type === KNOWLEDGE_POINT_TYPES.VOCABULARY) {
    // Validate typeSpecificData for vocabulary
    const vocabularyDataSchema = z.object({
      pos: z.string(),
      accent: z
        .union([z.number(), z.array(z.number())])
        .nullable()
        .optional(),
      audio: z.string().optional(),
      annotations: z.array(annotationSchema),
    })

    const vocData = vocabularyDataSchema.parse(typeSpecificData)

    const knowledgePoint = {
      ...baseData,
      type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
      pos: vocData.pos,
      accent: vocData.accent,
      audio: vocData.audio,
      annotations: vocData.annotations,
    }

    // Validate the complete knowledge point using our schema
    return knowledgePointSchema.parse(knowledgePoint)
  }

  // Grammar
  const knowledgePoint = {
    ...baseData,
    type: KNOWLEDGE_POINT_TYPES.GRAMMAR,
  }

  // Validate the complete knowledge point using our schema
  return knowledgePointSchema.parse(knowledgePoint)
}

export function mapDrizzleToVocabulary(row: typeof knowledgePointsTable.$inferSelect): Vocabulary {
  const kp = mapDrizzleToKnowledgePoint(row)
  if (!isVocabulary(kp)) {
    throw new Error('Row is not a Vocabulary')
  }
  return kp
}

export function mapDrizzleToGrammar(row: typeof knowledgePointsTable.$inferSelect): Grammar {
  const kp = mapDrizzleToKnowledgePoint(row)
  if (!isGrammar(kp)) {
    throw new Error('Row is not a Grammar')
  }
  return kp
}
