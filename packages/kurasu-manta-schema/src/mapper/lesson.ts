import type { lessonsTable } from '@/drizzle/schema'
import type { CreateLesson, Lesson } from '@/zod/lesson'

/**
 * Maps a Lesson domain object to a Drizzle lessonsTable insert object
 */
export function mapCreateLessonToDrizzle(lesson: CreateLesson) {
  return {
    id: lesson.id,
    number: lesson.number,
    title: lesson.title,
    description: lesson.description,
  }
}
export function mapLessonToDrizzle(lesson: Lesson) {
  return {
    ...mapCreateLessonToDrizzle(lesson),
    id: lesson.id,
  }
}

/**
 * Maps a Drizzle lessonsTable row to a Lesson domain object
 */
export function mapDrizzleToLesson(row: typeof lessonsTable.$inferSelect): Lesson {
  return {
    id: row.id,
    number: row.number,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
  }
}
