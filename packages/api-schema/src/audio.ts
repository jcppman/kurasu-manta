import { z } from 'zod'

// Request schema for storing audio
export const AudioStoreRequestSchema = z.object({
  contentType: z.literal('audio/mpeg'),
  data: z.instanceof(Buffer).or(z.instanceof(Uint8Array)),
})

// Success response schema
export const AudioStoreSuccessResponseSchema = z.object({
  hash: z.string().min(1),
  stored: z.literal(true),
  size: z.number().positive(),
  url: z.string().min(1),
})

// Error response schema
export const AudioStoreErrorResponseSchema = z.object({
  error: z.string().min(1),
})

// Union type for complete response
export const AudioStoreResponseSchema = z.union([
  AudioStoreSuccessResponseSchema,
  AudioStoreErrorResponseSchema,
])

// TypeScript types
export type AudioStoreRequest = z.infer<typeof AudioStoreRequestSchema>
export type AudioStoreSuccessResponse = z.infer<typeof AudioStoreSuccessResponseSchema>
export type AudioStoreErrorResponse = z.infer<typeof AudioStoreErrorResponseSchema>
export type AudioStoreResponse = z.infer<typeof AudioStoreResponseSchema>

// Type guards
export function isAudioStoreSuccessResponse(
  response: AudioStoreResponse
): response is AudioStoreSuccessResponse {
  return 'hash' in response && 'stored' in response
}

export function isAudioStoreErrorResponse(
  response: AudioStoreResponse
): response is AudioStoreErrorResponse {
  return 'error' in response
}

// Validation helpers
export function validateAudioStoreResponse(data: unknown): AudioStoreResponse {
  return AudioStoreResponseSchema.parse(data)
}

export function safeValidateAudioStoreResponse(
  data: unknown
): { success: true; data: AudioStoreResponse } | { success: false; error: z.ZodError } {
  const result = AudioStoreResponseSchema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}
