import type { MinaVocabulary } from '@/workflow/minna-jp-1/data'
import { openai } from '@ai-sdk/openai'
import textToSpeech from '@google-cloud/text-to-speech'
import { generateObject } from 'ai'

export async function findPosOfVocabulary(voc: MinaVocabulary): Promise<string> {
  const ret = await generateObject({
    model: openai('gpt-4o'),
    prompt: `Given a Japanese word or phrase, your task is to determine its part of speech (POS).

    The answer MUST be one of the following:
    - '名': noun
    - '句型': phrase
    - '搭配': common collocation

    ### examples:
    エスカレーター => 名
    〜から来ました => 句型
    お名前は => 句型
    どうも => 句型
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
  input:
    | {
        text: string
      }
    | {
        ssml: string
      }
}
export async function generateAudio({ input }: GenerateAudioParams): Promise<Uint8Array> {
  const [res] = await client.synthesizeSpeech({
    input,
    voice: {
      languageCode: 'ja-JP',
      name: 'ja-JP-Chirp3-HD-Orus',
    },
    audioConfig: {
      audioEncoding: 'MP3',
    },
  })
  const audio = res.audioContent
  if (!(audio instanceof Uint8Array)) {
    throw new Error('Audio content is not a Uint8Array')
  }
  return audio
}
