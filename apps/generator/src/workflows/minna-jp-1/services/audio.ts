import { Readable } from 'node:stream'
import db from '@/db'
import { logger } from '@/lib/utils'
import { buildYomiganaPhoneme, toFullFurigana } from '@/workflows/minna-jp-1/utils'
import { openai } from '@ai-sdk/openai'
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type SynthesizeSpeechCommandOutput,
} from '@aws-sdk/client-polly'
import { fromSSO } from '@aws-sdk/credential-providers'
import {
  isAudioStoreSuccessResponse,
  safeValidateAudioStoreResponse,
  validateAudioStoreResponse,
} from '@kurasu-manta/api-schema/audio'
import { CourseContentService } from '@kurasu-manta/content-schema/service'
import type { Annotation } from '@kurasu-manta/content-schema/zod'
import { isVocabulary } from '@kurasu-manta/content-schema/zod'
import { generateObject } from 'ai'
import { z } from 'zod'

const pollyClient = new PollyClient({
  credentials: fromSSO({ profile: 'default' }),
})
interface GenerateAudioParams {
  content: string
  annotations?: Annotation[]
  accent?: number | number[] | null
}

const TTS_PRONOUNCE_ERROR_RISK_THRESHOLD = 0.5

// Web service URL for audio storage
const AUDIO_API_BASE_URL = process.env.AUDIO_API_BASE_URL || 'http://localhost:3000'

async function storeAudioViaAPI(audioData: Uint8Array): Promise<string> {
  const url = `${AUDIO_API_BASE_URL}/api/audio`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
      },
      body: audioData,
    })

    const responseData = await response.json()

    if (!response.ok) {
      // Try to parse as error response
      const validation = safeValidateAudioStoreResponse(responseData)

      if (validation.success && 'error' in validation.data) {
        throw new Error(
          `Failed to store audio via API: ${response.status} - ${validation.data.error}`
        )
      }
      throw new Error(`Failed to store audio via API: ${response.status} - Unknown error`)
    }

    // Validate successful response
    const validatedResponse = validateAudioStoreResponse(responseData)

    if (!isAudioStoreSuccessResponse(validatedResponse)) {
      throw new Error('Unexpected response format from audio API')
    }

    logger.info(
      `Audio stored successfully: hash=${validatedResponse.hash}, size=${validatedResponse.size}`
    )
    return validatedResponse.hash
  } catch (error) {
    logger.error('Failed to store audio via API:', error)
    throw error
  }
}

interface GenerateAudioReturns {
  content: Uint8Array
}
export async function generateAudio({
  content,
  annotations,
  accent,
}: GenerateAudioParams): Promise<GenerateAudioReturns> {
  logger.info(`Generating audio for ${content}...`)

  // preprocess

  const fullReading = toFullFurigana(content, annotations ?? [])
  const hasAccentData = accent !== undefined && accent !== null

  let ssml: string

  if (hasAccentData) {
    // Use yomigana phoneme with pitch accent markers
    const phonemeTag = buildYomiganaPhoneme(content, fullReading, accent)
    ssml = `<speak>${phonemeTag}</speak>`
    logger.info('Using yomigana phoneme with accent data')
  } else {
    ssml = `<speak>${content}</speak>`
  }

  logger.debug(`SSML: ${ssml}`)
  const command = new SynthesizeSpeechCommand({
    Text: ssml,
    TextType: 'ssml',
    OutputFormat: 'mp3',
    Engine: 'neural',
    VoiceId: 'Kazuha',
    LanguageCode: 'ja-JP',
  })

  let response: SynthesizeSpeechCommandOutput
  try {
    response = await pollyClient.send(command)
  } catch (error) {
    logger.error('Polly synthesis failed:', error)
    if (error instanceof Error) {
      throw new Error(`AWS Polly synthesis failed: ${error.message}`)
    }
    throw new Error('AWS Polly synthesis failed with unknown error')
  }
  const audio = response.AudioStream
  if (!audio) {
    throw new Error('No audio stream received from Polly')
  }

  // Convert AWS SDK stream to Uint8Array
  const chunks: Uint8Array[] = []

  if (audio instanceof Readable) {
    for await (const chunk of audio) {
      chunks.push(new Uint8Array(chunk))
    }
  } else {
    // Handle as Uint8Array directly - convert unknown type
    chunks.push(new Uint8Array(audio as unknown as ArrayBuffer))
  }

  // Combine all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const audioBuffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    audioBuffer.set(chunk, offset)
    offset += chunk.length
  }

  return {
    content: audioBuffer,
  }
}

export async function generateVocabularyAudioClips() {
  const courseContentService = new CourseContentService(db)

  while (true) {
    // get vocabularies that has no audio clips
    const { items } = await courseContentService.getKnowledgePointsByConditions(
      {
        hasAudio: false,
        type: 'vocabulary',
      },
      {
        page: 1,
        limit: 100,
      }
    )

    if (items.length === 0) {
      logger.info('No more vocabularies to process')
      break
    }

    for (const voc of items) {
      if (!isVocabulary(voc)) {
        continue
      }
      const { content } = await generateAudio({
        content: voc.content,
        annotations: voc.annotations,
        accent: voc.accent,
      })

      // save audio via API and get back the calculated hash
      const hash = await storeAudioViaAPI(content)

      // update database
      await courseContentService.partialUpdateKnowledgePoint(voc.id, {
        audio: hash,
      })
    }
  }
}

export async function generateSentenceAudioClips() {
  const courseContentService = new CourseContentService(db)

  while (true) {
    // get sentences that have no audio clips
    const { items } = await courseContentService.getSentencesWithoutAudio({
      page: 1,
      limit: 100,
    })

    if (items.length === 0) {
      logger.info('No more sentences to process')
      break
    }

    for (const sentence of items) {
      logger.info(`Generating audio for sentence: "${sentence.content}"`)

      const { content } = await generateAudio({
        content: sentence.content,
        annotations: sentence.annotations,
        // sentences don't have accent data, so this will use risk assessment
      })

      // save audio via API and get back the calculated hash
      const hash = await storeAudioViaAPI(content)

      // update database with audio hash
      await courseContentService.updateSentenceAudio(sentence.id, hash)
      logger.info(`Updated sentence ${sentence.id} with audio hash: ${hash}`)
    }
  }
}
