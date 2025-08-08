import db from '@/db'
import { logger } from '@/lib/utils'
import { toFullFurigana } from '@/workflows/minna-jp-1/utils'
import { openai } from '@ai-sdk/openai'
import textToSpeech from '@google-cloud/text-to-speech'
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

const client = new textToSpeech.TextToSpeechClient()
interface GenerateAudioParams {
  content: string
  annotations?: Annotation[]
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
}: GenerateAudioParams): Promise<GenerateAudioReturns> {
  logger.info(`Generating audio for ${content}...`)

  // preprocess

  const fullReading = toFullFurigana(content, annotations ?? [])
  // estimate mispronouncing risk
  const {
    object: { risk, reason },
  } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt: `
You are a Japanese TTS assistant. Given a Japanese phrase and its expected reading (kana), return a numeric confidence score between 0.0 and 1.0.

The score reflects how likely a TTS engine would misread or mispronounce the phrase if spoken **in complete isolation**, compared to the expected reading. Consider risks such as:
- Incorrect kanji reading
- Fragmented pitch accent due to per-character synthesis
- Ambiguous homographs

Examples of phrases at high risk:
- 「私」 → expected: わたし, risk of し
- 「大人」 → expected: おとな, risk of だいにん
- 「失礼」 → expected: しつれい, risk of unnatural pitch if split

A score of:
- 0.0 means no risk (TTS will read it perfectly)
- 1.0 means very high risk of misreading or accent error

Respond with a single number (e.g., \`0.75\`) and the reason. If the risk is lower than ${TTS_PRONOUNCE_ERROR_RISK_THRESHOLD / 2}, no need to provide reason.

### Phrase to evaluate
Text: 「${content}」
Expected reading: 「${fullReading}」
`,
    schema: z.object({
      risk: z.number(),
      reason: z.string(),
    }),
  })

  logger.debug(`Risk of mispronouncing: ${risk} (${reason})`)

  let ssml: string
  if (risk > TTS_PRONOUNCE_ERROR_RISK_THRESHOLD) {
    logger.info(`threshold exceeded (${risk}), using full reading`)
    logger.info(`reason: ${reason}`)
    // use full reading
    ssml = `<speak><sub alias="${toFullFurigana(content, annotations ?? [])}">${content}</sub></speak>`
  } else {
    ssml = `<speak>${content}</speak>`
  }

  logger.debug(`SSML: ${ssml}`)
  const [res] = await client.synthesizeSpeech({
    input: {
      ssml,
    },
    voice: {
      languageCode: 'ja-JP',
      name: 'ja-JP-Neural2-C',
    },
    audioConfig: {
      audioEncoding: 'MP3',
    },
  })
  const audio = res.audioContent
  if (!(audio instanceof Uint8Array)) {
    throw new Error('Audio content is not a Uint8Array')
  }

  return {
    content: audio,
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
