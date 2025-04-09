import { z } from 'zod'

export const annotationSchema = z.object({
  loc: z.number(),
  len: z.number(),
  type: z.string(),
  content: z.string(),
})

export type Annotation = z.infer<typeof annotationSchema>
