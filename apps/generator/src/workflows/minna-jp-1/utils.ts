import { createHash } from 'node:crypto'
import type { Annotation } from '@kurasu-manta/content-schema/zod'

export function toFullFurigana(text: string, annotations: Annotation[]): string {
  const result: string[] = []
  let current = 0

  const sorted = [...annotations].sort((a, b) => a.loc - b.loc)

  for (const ann of sorted) {
    // Skip if not furigana
    if (ann.type !== 'furigana') continue

    const loc = ann.loc
    let len = ann.len
    const kana = ann.content

    // Skip if loc is out of bounds or overlaps with previous
    if (loc < current || loc >= text.length) continue

    // Clamp length to avoid overflow
    if (loc + len > text.length) {
      len = text.length - loc
    }

    // Append unannotated text before this annotation
    if (loc > current) {
      result.push(text.slice(current, loc))
    }

    // Append the kana reading
    result.push(kana)
    current = loc + len
  }

  // Append remaining text
  if (current < text.length) {
    result.push(text.slice(current))
  }

  return result.join('')
}

export function calculateSHA1(buffer: Uint8Array): string {
  const hash = createHash('sha1')
  hash.update(buffer)
  return hash.digest('hex')
}

export function sanitizeVocabularyContent(text: string): string {
  // no '～', no '―'
  return text.replace(/～/g, '').replace(/―/g, '').replace(/\s+/g, ' ').trim()
}

export function selectPrimaryAccent(accent: number | number[] | null): number | null {
  if (accent === null) return null
  return Array.isArray(accent) ? accent[0] : accent
}

export function convertAccentToYomigana(reading: string, accent: number): string {
  if (accent === 0) {
    // Heiban (flat) - no downstep
    return `^${reading}`
  }

  // Convert to mora array (handling small kana like ゃ, ゅ, ょ, っ)
  const morae = convertToMorae(reading)

  if (accent >= morae.length) {
    // If accent position is beyond mora count, treat as heiban
    return `^${reading}`
  }

  // Insert downstep marker after the specified mora
  const beforeDownstep = morae.slice(0, accent).join('')
  const afterDownstep = morae.slice(accent).join('')

  return `^${beforeDownstep}!${afterDownstep}`
}

function convertToMorae(text: string): string[] {
  const chars = [...text]
  const morae: string[] = []

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const nextChar = chars[i + 1]

    // Check if next character is a small kana that combines with current
    if (nextChar && isSmallKana(nextChar)) {
      morae.push(char + nextChar)
      i++ // skip the small kana in next iteration
    } else {
      morae.push(char)
    }
  }

  return morae
}

function isSmallKana(char: string): boolean {
  // Small hiragana and katakana characters that combine with previous mora
  // Note: っ and ッ are NOT included as they form their own mora for geminate consonants
  const smallKana = [
    'ゃ',
    'ゅ',
    'ょ',
    'ぁ',
    'ぃ',
    'ぅ',
    'ぇ',
    'ぉ',
    'ャ',
    'ュ',
    'ョ',
    'ァ',
    'ィ',
    'ゥ',
    'ェ',
    'ォ',
  ]
  return smallKana.includes(char)
}

export function buildYomiganaPhoneme(
  text: string,
  reading: string,
  accent: number | number[] | null
): string {
  const primaryAccent = selectPrimaryAccent(accent)

  if (primaryAccent === null) {
    // No accent data - return simple phoneme without pitch markers
    return `<phoneme alphabet="yomigana" ph="${reading}">${text}</phoneme>`
  }

  const yomiganaReading = convertAccentToYomigana(reading, primaryAccent)
  return `<phoneme alphabet="yomigana" ph="${yomiganaReading}">${text}</phoneme>`
}
