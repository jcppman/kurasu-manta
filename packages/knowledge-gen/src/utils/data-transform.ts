import { db } from '@/db'
import { KNOWLEDGE_POINT_TYPES } from '@/db/schema'
import { lessonKnowledgePointsTable } from '@/db/schema'
import { type VocabularyData, isVocabularyData } from '@/types/knowledge-point'

/**
 * Validates and transforms raw vocabulary data from JSON
 * @param data The raw data from JSON
 * @returns Validated and transformed vocabulary data ready for database insertion
 */
export function validateAndTransformVocabulary(data: unknown[]): {
  valid: VocabularyData[]
  invalid: unknown[]
} {
  const valid: VocabularyData[] = []
  const invalid: unknown[] = []

  for (const item of data) {
    if (isVocabularyData(item)) {
      valid.push(item)
    } else {
      invalid.push(item)
    }
  }

  return { valid, invalid }
}

/**
 * Prepares vocabulary data for insertion into the knowledgePointsTable
 * @param data Validated vocabulary data
 * @returns Data ready for insertion into knowledgePointsTable
 */
export function prepareVocabularyForInsertion(data: VocabularyData[]) {
  return data.map((item) => ({
    type: KNOWLEDGE_POINT_TYPES.VOCABULARY,
    content: item.content,
    translation: item.translation,
    annotations: item.annotations,
  }))
}

/**
 * Creates relationships between lessons and knowledge points
 * @param lessonId The ID of the lesson
 * @param knowledgePointIds Array of knowledge point IDs to associate with the lesson
 */
export async function createLessonKnowledgePointRelationships(
  lessonId: number,
  knowledgePointIds: number[]
) {
  const relationships = knowledgePointIds.map((knowledgePointId) => ({
    lessonId,
    knowledgePointId,
  }))

  if (relationships.length > 0) {
    await db.insert(lessonKnowledgePointsTable).values(relationships)
    console.log(`Created ${relationships.length} lesson-knowledge point relationships`)
  }
}
