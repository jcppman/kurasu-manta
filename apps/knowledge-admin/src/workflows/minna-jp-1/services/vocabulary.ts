import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import type { MinaVocabulary } from '../content'

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
