import { createHash } from 'node:crypto'
import { logger } from '@/lib/server/utils'
import { openai } from '@ai-sdk/openai'
import textToSpeech from '@google-cloud/text-to-speech'
import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { MinaVocabulary } from '../data'
import { toFullFurigana } from '../utils'

export async function findPosOfVocabulary(voc: MinaVocabulary): Promise<string> {
  const ret = await generateObject({
    model: openai('gpt-4o'),
    prompt: `Given a Japanese word or phrase, your task is to determine its part of speech (POS).

    The answer MUST be one of the following:
    - '名': noun
    - '句型': phrase
    - '搭配': common collocation like subject and verb, longer common phrases is '句型' not '搭配'

    ### examples:
    エスカレーター => 名
    〜から来ました => 句型
    お名前は => 句型
    どうも => 句型
    どうもありがとうございます => 句型
    九時半 => 搭配
    写真を撮ります => 搭配

    ### The question
    ${voc.content}
    `,
    output: 'enum',
    enum: ['名', '句型', '搭配'],
  })

  return ret.object
}

const client = new textToSpeech.TextToSpeechClient()
interface GenerateAudioParams {
  content: string
  annotations?: Annotation[]
}

/*
 * AUDIO
 */

const TTS_PRONOUNCE_ERROR_RISK_THRESHOLD = 0.5

function calculateSHA1(buffer: Uint8Array): string {
  const hash = createHash('sha1')
  hash.update(buffer)
  return hash.digest('hex')
}
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
