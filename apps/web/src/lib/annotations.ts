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

/**
 * Get annotation color classes based on type and highlighting
 */
export function getAnnotationColor(
  type: string,
  annotation: Annotation,
  highlightKnowledgePointId?: number
): string {
  // If this annotation matches the highlighted knowledge point, use special highlighting
  if (highlightKnowledgePointId && annotation.id === highlightKnowledgePointId) {
    return 'bg-yellow-200 border-yellow-400 text-yellow-900 ring-2 ring-yellow-300'
  }

  switch (type.toLowerCase()) {
    case 'vocabulary':
      return 'bg-blue-100 border-blue-300 text-blue-800'
    case 'grammar':
      return 'bg-green-100 border-green-300 text-green-800'
    case 'particle':
      return 'bg-purple-100 border-purple-300 text-purple-800'
    case 'conjugation':
      return 'bg-orange-100 border-orange-300 text-orange-800'
    case 'furigana':
      return 'bg-transparent border-none text-inherit' // No highlighting for furigana
    default:
      return 'bg-gray-100 border-gray-300 text-gray-800'
  }
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
