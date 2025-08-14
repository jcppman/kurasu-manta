import {
  type Annotation,
  type KnowledgePoint,
  isVocabulary,
} from '@kurasu-manta/content-schema/zod'

/**
 * Check if an annotation is a furigana annotation
 */
export function isFuriganaAnnotation(annotation: Annotation): boolean {
  return annotation.type.toLowerCase() === 'furigana'
}

/**
 * Filter annotations to only include furigana annotations
 */
export function getFuriganaAnnotations(annotations: Annotation[]): Annotation[] {
  return annotations.filter(isFuriganaAnnotation).sort((a, b) => a.loc - b.loc)
}

/**
 * Filter annotations to exclude furigana annotations
 */
export function getNonFuriganaAnnotations(annotations: Annotation[]): Annotation[] {
  return annotations.filter((annotation) => !isFuriganaAnnotation(annotation))
}

export function getSegments(
  knowledgePoint: KnowledgePoint
): Array<{ text: string; furigana?: string }> {
  if (!isVocabulary(knowledgePoint)) {
    return [{ text: knowledgePoint.content }]
  }
  const segments: Array<{ text: string; furigana?: string }> = []

  const furiganaAnnotations = getFuriganaAnnotations(knowledgePoint.annotations)
  let index = 0
  for (const annotation of furiganaAnnotations) {
    // all content AFTER the furigana annotation to a { text } segment
    const textBeforeFurigana = knowledgePoint.content.slice(index, annotation.loc)
    if (textBeforeFurigana) {
      segments.push({ text: textBeforeFurigana })
    }
    // add the furigana annotation as a segment
    segments.push({
      text: knowledgePoint.content.slice(annotation.loc, annotation.loc + annotation.len),
      furigana: annotation.content,
    })
    index = annotation.loc + annotation.len
  }
  // the rest
  const textAfterAllAnnotations = knowledgePoint.content.slice(index)
  if (textAfterAllAnnotations) {
    segments.push({ text: textAfterAllAnnotations })
  }

  return segments
}
