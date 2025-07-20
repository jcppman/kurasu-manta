import { z } from 'zod'

export const annotationSchema = z.object({
  loc: z.number(),
  len: z.number(),
  type: z.string(),
  content: z.string(),
  // Optional ID for vocabulary
  id: z.number().int().positive().optional(),
})

export type Annotation = z.infer<typeof annotationSchema>
