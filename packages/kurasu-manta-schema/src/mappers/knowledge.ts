import { KNOWLEDGE_POINT_TYPES } from '@/common/types'
import type { knowledgePointsTable } from '@/drizzle/schema'
import type { Annotation } from '@/zod/annotation'
import type { Grammar, KnowledgePoint, Vocabulary } from '@/zod/knowledge'
import type { LocalizedText } from '@/zod/localized-text'

/**
 * Maps a Zod KnowledgePoint to a Drizzle knowledgePointsTable insert object
 */
export function mapKnowledgePointToDrizzle(knowledgePoint: KnowledgePoint) {
  const baseData = {
    type: knowledgePoint.type,
    content: knowledgePoint.content,
    explanation: knowledgePoint.explanation,
  }

  let typeSpecificData: Record<string, unknown> = {}

  if (knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY) {
    const vocabulary = knowledgePoint as Vocabulary
    typeSpecificData = {
      pos: vocabulary.pos,
      annotations: vocabulary.annotations,
      examples: vocabulary.examples,
    }
  } else if (knowledgePoint.type === KNOWLEDGE_POINT_TYPES.GRAMMAR) {
    const grammar = knowledgePoint as Grammar
    typeSpecificData = {
      examples: grammar.examples,
    }
  }

  return {
    ...baseData,
    typeSpecificData,
  }
}

/**
 * Maps a Drizzle knowledgePointsTable row to a Zod KnowledgePoint
 */
export function mapDrizzleToKnowledgePoint(
  row: typeof knowledgePointsTable.$inferSelect
): KnowledgePoint {
  const { type, content, explanation, typeSpecificData } = row
  const baseData = {
    lesson: 0, // This will be set from the lesson relationship
    content,
    explanation: explanation as LocalizedText,
  }

  if (type === KNOWLEDGE_POINT_TYPES.VOCABULARY) {
    const vocData = typeSpecificData as Record<string, unknown>
    return {
      ...baseData,
      type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
      pos: vocData.pos as string,
      annotations: vocData.annotations as Annotation[],
      examples: vocData.examples as string[],
    }
  }

  // Grammar
  const grammarData = typeSpecificData as Record<string, unknown>
  return {
    ...baseData,
    type: KNOWLEDGE_POINT_TYPES.GRAMMAR,
    examples: grammarData.examples as string[],
  }
}
