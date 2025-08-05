import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import type { knowledgePointsTable } from '@/drizzle/schema'
import type { Annotation } from '@/zod/annotation'
import type { CreateKnowledgePoint, KnowledgePoint, Vocabulary } from '@/zod/knowledge'
import type { LocalizedText } from '@/zod/localized-text'

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
    const vocabulary = knowledgePoint as Vocabulary
    typeSpecificData = {
      audio: vocabulary.audio,
      pos: vocabulary.pos,
      annotations: vocabulary.annotations,
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
  const baseData = {
    id: row.id,
    lessonId: lessonId,
    content,
    explanation: explanation as LocalizedText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  if (type === KNOWLEDGE_POINT_TYPES.VOCABULARY) {
    const vocData = typeSpecificData as Record<string, unknown>
    return {
      ...baseData,
      type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
      pos: vocData.pos as string,
      audio: vocData.audio as string | undefined,
      annotations: vocData.annotations as Annotation[],
    }
  }

  // Grammar
  return {
    ...baseData,
    type: KNOWLEDGE_POINT_TYPES.GRAMMAR,
  }
}
