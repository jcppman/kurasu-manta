import { z } from 'zod'

export const localizedText = z.record(z.string(), z.string())

export type LocalizedText = z.infer<typeof localizedText>
