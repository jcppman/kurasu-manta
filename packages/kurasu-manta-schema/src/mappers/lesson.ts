import type { lessonsTable } from '@/drizzle/schema'

/**
 * Interface for Lesson domain object
 */
export interface Lesson {
  id?: number
  number: number
  title: string
  description?: string
}

/**
 * Maps a Lesson domain object to a Drizzle lessonsTable insert object
 */
export function mapLessonToDrizzle(lesson: Lesson) {
  return {
    number: lesson.number,
    title: lesson.title,
    description: lesson.description,
  }
}

/**
 * Maps a Drizzle lessonsTable row to a Lesson domain object
 */
export function mapDrizzleToLesson(row: typeof lessonsTable.$inferSelect): Lesson {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description ?? undefined,
  }
}
