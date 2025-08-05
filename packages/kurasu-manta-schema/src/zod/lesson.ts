import { z } from 'zod'

export const baseLessonSchema = z.object({
  number: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
})

export const lessonSchema = baseLessonSchema.extend({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateLesson = z.infer<typeof baseLessonSchema>
export type Lesson = z.infer<typeof lessonSchema>
