import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import db from '@/db'
import { AUDIO_DIR } from '@/lib/constants'
import { logger } from '@/lib/utils'
import { calculateSHA1, toFullFurigana } from '@/workflows/minna-jp-1/utils'
import { openai } from '@ai-sdk/openai'
import textToSpeech from '@google-cloud/text-to-speech'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { generateObject } from 'ai'
import sh from 'shelljs'
import { z } from 'zod'

const client = new textToSpeech.TextToSpeechClient()
interface GenerateAudioParams {
  content: string
  annotations?: Annotation[]
}

const TTS_PRONOUNCE_ERROR_RISK_THRESHOLD = 0.5

interface GenerateAudioReturns {
  content: Uint8Array
  sha1: string
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
    model: openai('gpt-4o'),
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

  const sha1 = calculateSHA1(audio)

  return {
    sha1,
    content: audio,
  }
}

export async function generateVocabularyAudioClips() {
  const courseContentService = new CourseContentService(db)

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

  let processedCount = 0

  for (const voc of items) {
    const { sha1, content } = await generateAudio({
      content: voc.content,
      annotations: voc.annotations,
    })

    const dir = join(AUDIO_DIR, sha1.slice(0, 2))
    const filename = `${sha1}.mp3`

    // save audio to file system
    sh.mkdir('-p', dir)
    writeFileSync(join(dir, filename), content)

    // update database
    await courseContentService.partialUpdateKnowledgePoint(voc.id, {
      audio: sha1,
    })

    processedCount++
  }
}
