'use client'

import type { Annotation } from '@kurasu-manta/content-schema/zod'

interface FuriganaTextProps {
  text: string
  annotations: Annotation[]
  className?: string
}

export function FuriganaText({ text, annotations, className = '' }: FuriganaTextProps) {
  // Sort annotations by location to process them in order
  const sortedAnnotations = [...annotations]
    .filter((annotation) => annotation.type.toLowerCase() === 'furigana')
    .sort((a, b) => a.loc - b.loc)

  // Create segments of text with furigana annotations
  const createSegments = () => {
    const segments: Array<{
      text: string
      furigana?: string
      isAnnotated: boolean
    }> = []

    let currentIndex = 0

    for (const annotation of sortedAnnotations) {
      // Add text before annotation if any
      if (currentIndex < annotation.loc) {
        segments.push({
          text: text.slice(currentIndex, annotation.loc),
          isAnnotated: false,
        })
      }

      // Add annotated text with furigana
      segments.push({
        text: text.slice(annotation.loc, annotation.loc + annotation.len),
        furigana: annotation.content,
        isAnnotated: true,
      })

      currentIndex = annotation.loc + annotation.len
    }

    // Add remaining text after last annotation
    if (currentIndex < text.length) {
      segments.push({
        text: text.slice(currentIndex),
        isAnnotated: false,
      })
    }

    return segments
  }

  const segments = createSegments()

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.isAnnotated && segment.furigana ? (
          // Furigana annotation - display reading above kanji
          <span key={`furigana-${index}-${segment.text}`} className="relative inline-block">
            <span className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-xs text-gray-600 whitespace-nowrap">
              {segment.furigana}
            </span>
            {segment.text}
          </span>
        ) : (
          <span key={`text-${index}-${segment.text.substring(0, 10)}`}>{segment.text}</span>
        )
      )}
    </span>
  )
}
