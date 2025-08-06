import { getAudioStorage } from '@/lib/audio-storage'
import {
  AudioStoreErrorResponseSchema,
  AudioStoreSuccessResponseSchema,
} from '@kurasu-manta/api-schema/audio'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Validate content type
  const contentType = request.headers.get('content-type')
  if (contentType !== 'audio/mpeg') {
    const errorResponse = AudioStoreErrorResponseSchema.parse({
      error: 'Invalid content type. Expected audio/mpeg',
    })
    return NextResponse.json(errorResponse, { status: 400 })
  }

  try {
    const arrayBuffer = await request.arrayBuffer()
    const audioData = Buffer.from(arrayBuffer)

    if (audioData.length === 0) {
      const errorResponse = AudioStoreErrorResponseSchema.parse({
        error: 'Empty audio data',
      })
      return NextResponse.json(errorResponse, { status: 400 })
    }

    const storage = getAudioStorage()
    const hash = await storage.storeAudioWithHash(audioData)

    const successResponse = AudioStoreSuccessResponseSchema.parse({
      hash,
      stored: true,
      size: audioData.length,
      url: `/api/audio/${hash}`,
    })

    return NextResponse.json(successResponse)
  } catch (error) {
    console.error('Error storing audio file:', error)
    const errorResponse = AudioStoreErrorResponseSchema.parse({
      error: 'Failed to store audio file',
    })
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
