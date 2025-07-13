import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'

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
