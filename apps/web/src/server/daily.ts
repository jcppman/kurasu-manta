import { db, schema } from '@/server/db'
import { KNOWLEDGE_POINT_TYPES } from '@kurasu-manta/content-schema/common'
import { mapDrizzleToGrammar, mapDrizzleToVocabulary } from '@kurasu-manta/content-schema/mapper'
import { mapDrizzleToLesson } from '@kurasu-manta/content-schema/mapper'
import { CourseContentService } from '@kurasu-manta/content-schema/service'
import type { Grammar, Vocabulary } from '@kurasu-manta/content-schema/zod'
import type { Lesson } from '@kurasu-manta/content-schema/zod'
import { and, eq, lte, sql } from 'drizzle-orm'

export interface DailyPractice {
  // lesson id -> Lesson
  lessons: Record<string, Lesson>
  vocabularies: Vocabulary[]
  grammarList: Grammar[]
  sentenceCountMap: Record<number, number>
}

export interface DailyPracticeOptions {
  maxLessonNumber?: number
  vocabularyLimit?: number
  grammarLimit?: number
}

export async function getDailyPractice(options?: DailyPracticeOptions): Promise<DailyPractice> {
  const {
    maxLessonNumber = 1000, // Default to a high number to include all lessons
    vocabularyLimit = 7, // Default limit for vocabulary items
    grammarLimit = 3, // Default limit for grammar items
  } = options ?? {}

  const vocabulariesRaw = await db
    .select()
    .from(schema.knowledgePointsTable)
    .innerJoin(
      schema.lessonsTable,
      eq(schema.lessonsTable.id, schema.knowledgePointsTable.lessonId)
    )
    .where(
      and(
        lte(schema.lessonsTable.number, maxLessonNumber),
        eq(schema.knowledgePointsTable.type, KNOWLEDGE_POINT_TYPES.VOCABULARY)
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(vocabularyLimit)
  const vocabularies = vocabulariesRaw.map((kp) => mapDrizzleToVocabulary(kp.knowledge_points))

  const grammarListRaw = await db
    .select()
    .from(schema.knowledgePointsTable)
    .innerJoin(
      schema.lessonsTable,
      eq(schema.lessonsTable.id, schema.knowledgePointsTable.lessonId)
    )
    .where(
      and(
        lte(schema.lessonsTable.number, maxLessonNumber),
        eq(schema.knowledgePointsTable.type, KNOWLEDGE_POINT_TYPES.GRAMMAR)
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(grammarLimit)

  const grammarList = grammarListRaw.map((kp) => mapDrizzleToGrammar(kp.knowledge_points))

  const lessons = grammarListRaw
    .concat(vocabulariesRaw)
    .map((i) => i.lessons)
    .reduce(
      (accum, curr) => {
        accum[curr.id] = mapDrizzleToLesson(curr)
        return accum
      },
      {} as Record<string, Lesson>
    )

  const contentService = new CourseContentService(db)
  const sentenceCountMap = await contentService.getSentenceCountsByKnowledgePointIds([
    ...vocabularies.map((v) => v.id),
    ...grammarList.map((g) => g.id),
  ])

  return {
    vocabularies,
    grammarList,
    lessons,
    sentenceCountMap: [...sentenceCountMap.entries()].reduce(
      (accum, [key, value]) => {
        accum[key] = value
        return accum
      },
      {} as Record<number, number>
    ),
  }
}
