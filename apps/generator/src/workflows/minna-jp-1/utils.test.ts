import type { Annotation } from '@kurasu-manta/content-schema/zod'
import { describe, expect, test } from 'vitest'
import {
  buildYomiganaPhoneme,
  convertAccentToYomigana,
  selectPrimaryAccent,
  toFullFurigana,
} from './utils'

describe('toFullFurigana', () => {
  test('annotations out of bounds are ignored gracefully', () => {
    const text = 'こんにちは'
    const annotations: Annotation[] = [
      { type: 'furigana', loc: 100, len: 1, content: 'こん' }, // invalid
    ]
    const result = toFullFurigana(text, annotations)
    expect(result).toBe('こんにちは')
  })

  test('annotations not sorted should still produce correct result', () => {
    const text = '友達に会います'
    const annotations: Annotation[] = [
      { type: 'furigana', loc: 1, len: 1, content: 'だち' },
      { type: 'furigana', loc: 0, len: 1, content: 'とも' },
      { type: 'furigana', loc: 3, len: 1, content: 'あ' },
    ]
    const result = toFullFurigana(text, annotations)
    expect(result).toBe('ともだちにあいます')
  })

  test('annotation length exceeding bounds is truncated by function logic', () => {
    const text = '彼女'
    const annotations: Annotation[] = [
      { type: 'furigana', loc: 0, len: 5, content: 'かのじょ' }, // length exceeds
    ]
    const result = toFullFurigana(text, annotations)
    expect(result).toBe('かのじょ')
  })

  test('overlapping annotations - later ones overwrite earlier ones', () => {
    const text = '友達'
    const annotations: Annotation[] = [
      { type: 'furigana', loc: 0, len: 2, content: 'ともだち' },
      { type: 'furigana', loc: 1, len: 1, content: 'だち' }, // overlaps
    ]
    const result = toFullFurigana(text, annotations)
    // Only the first should be applied due to sorting + skipping overlap
    expect(result).toBe('ともだち')
  })

  test('invalid annotation type is ignored', () => {
    const text = '先生'
    const annotations: Annotation[] = [
      { type: 'emoji', loc: 0, len: 2, content: 'せんせい' }, // invalid type
    ]
    const result = toFullFurigana(text, annotations)
    expect(result).toBe('先生')
  })

  test('何時', () => {
    const text = '何時'
    const annotations: Annotation[] = [
      {
        type: 'furigana',
        loc: 1,
        len: 1,
        content: 'いつ',
      },
    ]

    const result = toFullFurigana(text, annotations)
    expect(result).toBe('何いつ')
  })
})

describe('selectPrimaryAccent', () => {
  test('should return null for null input', () => {
    expect(selectPrimaryAccent(null)).toBe(null)
  })

  test('should return the number for single accent', () => {
    expect(selectPrimaryAccent(1)).toBe(1)
    expect(selectPrimaryAccent(0)).toBe(0)
    expect(selectPrimaryAccent(3)).toBe(3)
  })

  test('should return first element for array accent', () => {
    expect(selectPrimaryAccent([3, 4])).toBe(3)
    expect(selectPrimaryAccent([1, 0])).toBe(1)
    expect(selectPrimaryAccent([2, 4])).toBe(2)
  })
})

describe('convertAccentToYomigana', () => {
  test('should handle heiban (flat) accent correctly', () => {
    expect(convertAccentToYomigana('わたし', 0)).toBe('^わたし')
    expect(convertAccentToYomigana('アメリカ', 0)).toBe('^アメリカ')
  })

  test('should handle accent on first mora', () => {
    expect(convertAccentToYomigana('はい', 1)).toBe('^は!い')
    expect(convertAccentToYomigana('カード', 1)).toBe('^カ!ード')
  })

  test('should handle accent on second mora', () => {
    expect(convertAccentToYomigana('あなた', 2)).toBe('^あな!た')
    expect(convertAccentToYomigana('にほん', 2)).toBe('^にほ!ん')
  })

  test('should handle accent on third mora', () => {
    expect(convertAccentToYomigana('あのかた', 3)).toBe('^あのか!た')
  })

  test('should handle small kana combinations correctly', () => {
    // Small ゅ combines with previous character to form one mora
    expect(convertAccentToYomigana('ちゅうごく', 1)).toBe('^ちゅ!うごく')
    // Small ゃ combines with previous character
    expect(convertAccentToYomigana('かいしゃいん', 3)).toBe('^かいしゃ!いん')
    // Small ょ combines with previous character
    expect(convertAccentToYomigana('りょう', 1)).toBe('^りょ!う')
  })

  test('should handle geminate consonant っ', () => {
    expect(convertAccentToYomigana('がっこう', 0)).toBe('^がっこう')
    expect(convertAccentToYomigana('きって', 2)).toBe('^きっ!て')
  })

  test('should handle katakana with small characters', () => {
    expect(convertAccentToYomigana('コーヒー', 3)).toBe('^コーヒ!ー')
    expect(convertAccentToYomigana('シャープ', 1)).toBe('^シャ!ープ')
  })

  test('should treat accent beyond reading length as heiban', () => {
    expect(convertAccentToYomigana('あい', 5)).toBe('^あい')
    expect(convertAccentToYomigana('あ', 2)).toBe('^あ')
  })

  test('should handle edge cases gracefully', () => {
    expect(convertAccentToYomigana('', 1)).toBe('^')
    expect(convertAccentToYomigana('あ', 0)).toBe('^あ')
  })
})

describe('buildYomiganaPhoneme', () => {
  test('should build phoneme with pitch accent markers', () => {
    expect(buildYomiganaPhoneme('私', 'わたし', 0)).toBe(
      '<phoneme alphabet="yomigana" ph="^わたし">私</phoneme>'
    )
    expect(buildYomiganaPhoneme('はい', 'はい', 1)).toBe(
      '<phoneme alphabet="yomigana" ph="^は!い">はい</phoneme>'
    )
  })

  test('should handle array accents by using first value', () => {
    expect(buildYomiganaPhoneme('あの方', 'あのかた', [3, 4])).toBe(
      '<phoneme alphabet="yomigana" ph="^あのか!た">あの方</phoneme>'
    )
  })

  test('should handle null accent without pitch markers', () => {
    expect(buildYomiganaPhoneme('テスト', 'テスト', null)).toBe(
      '<phoneme alphabet="yomigana" ph="テスト">テスト</phoneme>'
    )
  })

  test('should handle complex readings with small kana', () => {
    expect(buildYomiganaPhoneme('中国', 'ちゅうごく', 1)).toBe(
      '<phoneme alphabet="yomigana" ph="^ちゅ!うごく">中国</phoneme>'
    )
    expect(buildYomiganaPhoneme('会社員', 'かいしゃいん', 3)).toBe(
      '<phoneme alphabet="yomigana" ph="^かいしゃ!いん">会社員</phoneme>'
    )
  })

  test('should handle various accent patterns from vocabulary data', () => {
    // Test cases from actual vocabulary data
    const testCases = [
      { text: '銀行員', reading: 'ぎんこういん', accent: 3 },
      { text: '医者', reading: 'いしゃ', accent: 0 },
      { text: 'あの人', reading: 'あのひと', accent: [2, 4] },
      { text: 'だれ', reading: 'だれ', accent: 1 },
      { text: '社員', reading: 'しゃいん', accent: 1 },
    ]

    for (const { text, reading, accent } of testCases) {
      const result = buildYomiganaPhoneme(text, reading, accent)
      expect(result).toMatch(/^<phoneme alphabet="yomigana" ph=".+">.+<\/phoneme>$/)
    }
  })
})
