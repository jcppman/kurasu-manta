import { strictEqual } from 'node:assert'
import test from 'node:test'
import type { Annotation } from '@repo/kurasu-manta-schema/zod/annotation'
import { toFullFurigana } from './utils'

test('annotations out of bounds are ignored gracefully', () => {
  const text = 'こんにちは'
  const annotations: Annotation[] = [
    { type: 'furigana', loc: 100, len: 1, content: 'こん' }, // invalid
  ]
  const result = toFullFurigana(text, annotations)
  strictEqual(result, 'こんにちは')
})

test('annotations not sorted should still produce correct result', () => {
  const text = '友達に会います'
  const annotations: Annotation[] = [
    { type: 'furigana', loc: 1, len: 1, content: 'だち' },
    { type: 'furigana', loc: 0, len: 1, content: 'とも' },
    { type: 'furigana', loc: 3, len: 1, content: 'あ' },
  ]
  const result = toFullFurigana(text, annotations)
  strictEqual(result, 'ともだちにあいます')
})

test('annotation length exceeding bounds is truncated by function logic', () => {
  const text = '彼女'
  const annotations: Annotation[] = [
    { type: 'furigana', loc: 0, len: 5, content: 'かのじょ' }, // length exceeds
  ]
  const result = toFullFurigana(text, annotations)
  strictEqual(result, 'かのじょ')
})

test('overlapping annotations - later ones overwrite earlier ones', () => {
  const text = '友達'
  const annotations: Annotation[] = [
    { type: 'furigana', loc: 0, len: 2, content: 'ともだち' },
    { type: 'furigana', loc: 1, len: 1, content: 'だち' }, // overlaps
  ]
  const result = toFullFurigana(text, annotations)
  // Only the first should be applied due to sorting + skipping overlap
  strictEqual(result, 'ともだち')
})

test('invalid annotation type is ignored', () => {
  const text = '先生'
  const annotations: Annotation[] = [
    { type: 'emoji', loc: 0, len: 2, content: 'せんせい' }, // invalid type
  ]
  const result = toFullFurigana(text, annotations)
  strictEqual(result, '先生')
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
  strictEqual(result, 'いつ')
})
