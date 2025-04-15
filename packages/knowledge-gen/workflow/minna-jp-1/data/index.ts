import { z } from 'zod'
import data from './vocs.json'

export const minaVocabularySchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  translation: z.string(),
  pos: z.string(),
  annotations: z.array(
    z.object({
      type: z.string(),
      loc: z.number().int(),
      len: z.number().int(),
      content: z.string(),
    })
  ),
})

export type MinaVocabulary = z.infer<typeof minaVocabularySchema>

export function getData(): MinaVocabulary[] {
  return data.map((item) => minaVocabularySchema.parse(item))
}
