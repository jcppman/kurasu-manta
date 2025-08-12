import { z } from 'zod'
import grammarData from './grammar.json'
import grammarTranslationsRaw from './translations/grammar-translations.json'
import vocTranslationsRaw from './translations/vocs-translations.json'
import vocData from './vocs.json'

// Translation schemas
const translationSchema = z.object({
  zhCN: z.string(),
  zhTW: z.string(),
  enUS: z.string(),
})

const vocTranslationsSchema = z.record(z.string(), translationSchema)
const grammarTranslationsSchema = z.record(z.string(), translationSchema)

// Base schemas for original data
export const minaVocabularyBaseSchema = z.object({
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
  id: z.number().int(),
})

export const minaGrammarBaseSchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  explanation: z.string(),
})

// Enhanced schemas with multilingual support
export const minaVocabularySchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  translation: z.record(z.string(), z.string()), // Now multilingual
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
  id: z.number().int(),
})
export const minaGrammarSchema = z.object({
  lesson: z.number().int(),
  content: z.string(),
  explanation: z.record(z.string(), z.string()), // Now multilingual
})

export type MinaVocabularyBase = z.infer<typeof minaVocabularyBaseSchema>
export type MinaGrammarBase = z.infer<typeof minaGrammarBaseSchema>
export type MinaVocabulary = z.infer<typeof minaVocabularySchema>
export type MinaGrammar = z.infer<typeof minaGrammarSchema>

export function getVocData(): MinaVocabulary[] {
  const vocTranslations = vocTranslationsSchema.parse(vocTranslationsRaw)

  return vocData
    .map((item) => {
      const baseItem = minaVocabularyBaseSchema.parse(item)
      const translations = vocTranslations[baseItem.id.toString()]

      return minaVocabularySchema.parse({
        ...baseItem,
        translation: translations || {
          zhCN: baseItem.translation,
          zhTW: baseItem.translation, // Fallback to original
          enUS: baseItem.translation, // Fallback to original
        },
      })
    })
    .map((item) => ({
      ...item,
      // in source data the verb accent is the accent of the normal form, which is not what we want
      accent: item.pos.startsWith('動') ? undefined : item.accent,
    }))
}

export function getGrammarData(): MinaGrammar[] {
  const grammarTranslations = grammarTranslationsSchema.parse(grammarTranslationsRaw)

  return grammarData.map((item, index) => {
    const baseItem = minaGrammarBaseSchema.parse(item)
    const grammarId = (index + 1).toString() // Grammar uses 1-based indexing
    const translations = grammarTranslations[grammarId]

    return minaGrammarSchema.parse({
      ...baseItem,
      explanation: translations || {
        zhCN: baseItem.explanation,
        zhTW: baseItem.explanation, // Fallback to original
        enUS: baseItem.explanation, // Fallback to original
      },
    })
  })
}
