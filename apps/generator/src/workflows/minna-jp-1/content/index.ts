import { z } from 'zod'
import grammarData from './grammar.json'
import vocData from './vocs.json'

export const minaVocabularySchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  translation: z.string(),
  pos: z.string(),
  accent: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  annotations: z.array(
    z.object({
      type: z.string(),
      loc: z.number().int(),
      len: z.number().int(),
      content: z.string(),
    })
  ),
})
export const minaGrammarSchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  explanation: z.string(),
})

export type MinaVocabulary = z.infer<typeof minaVocabularySchema>
export type MinaGrammar = z.infer<typeof minaGrammarSchema>

export function getVocData(): MinaVocabulary[] {
  return vocData.map((item) => minaVocabularySchema.parse(item))
}
export function getGrammarData(): MinaGrammar[] {
  return grammarData.map((item) => minaGrammarSchema.parse(item))
}
