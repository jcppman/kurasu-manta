import type { sentencesTable } from '@/drizzle/schema'
import type { Annotation } from '@/zod/annotation'
import type { LocalizedText } from '@/zod/localized-text'
import type { CreateSentence, Sentence } from '@/zod/sentence'

/**
 * Maps a Zod CreateSentence to a Drizzle sentencesTable insert object
 */
export function mapCreateSentenceToDrizzle(sentence: CreateSentence) {
  return {
    content: sentence.content,
    explanation: sentence.explanation,
    annotations: sentence.annotations,
    audio: sentence.audio,
    minLessonNumber: sentence.minLessonNumber,
  }
}

/**
 * Maps a Zod Sentence to a Drizzle sentencesTable update object
 */
export function mapSentenceToDrizzle(sentence: Sentence) {
  return {
    id: sentence.id,
    ...mapCreateSentenceToDrizzle(sentence),
  }
}

/**
 * Maps a Drizzle sentencesTable row to a Zod Sentence
 */
export function mapDrizzleToSentence(row: typeof sentencesTable.$inferSelect): Sentence {
  return {
    id: row.id,
    content: row.content,
    explanation: row.explanation as LocalizedText,
    annotations: (row.annotations as Annotation[]) || [],
    audio: row.audio ?? undefined,
    minLessonNumber: row.minLessonNumber,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
