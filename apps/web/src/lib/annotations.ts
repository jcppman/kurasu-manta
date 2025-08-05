import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'

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
  return annotations.filter(isFuriganaAnnotation)
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
