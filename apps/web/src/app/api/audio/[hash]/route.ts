import { getAudioStorage } from '@/lib/audio-storage'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ hash: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { hash } = await params

  // Validate hash format (SHA1 - 40 hex characters)
  if (!/^[a-f0-9]{40}$/.test(hash)) {
    return NextResponse.json({ error: 'Invalid hash format' }, { status: 400 })
  }

  try {
    const storage = getAudioStorage()
    const audioData = await storage.getAudioFile(hash)

    if (!audioData) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }

    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Content-Length': audioData.length.toString(),
      },
    })
  } catch (error) {
    console.error(`Error serving audio file ${hash}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
