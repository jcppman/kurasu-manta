import { z } from 'zod'

export const lessonSchema = z.object({
  id: z.number().optional(),
  number: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
})

export type CreateLesson = z.infer<typeof lessonSchema>
export type Lesson = z.infer<typeof lessonSchema> & { id: number }
