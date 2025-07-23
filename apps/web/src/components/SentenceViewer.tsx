'use client'

import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { useState } from 'react'

interface SentenceViewerProps {
  text: string
  annotations: Annotation[]
}

export function SentenceViewer({ text, annotations }: SentenceViewerProps) {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null)

  // Sort annotations by location to process them in order
  const sortedAnnotations = [...annotations].sort((a, b) => a.loc - b.loc)

  // Create segments of text with annotations
  const createSegments = () => {
    const segments: Array<{
      text: string
      annotation?: Annotation
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

      // Add annotated text
      segments.push({
        text: text.slice(annotation.loc, annotation.loc + annotation.len),
        annotation,
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

  const getAnnotationColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'vocabulary':
        return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'grammar':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'particle':
        return 'bg-purple-100 border-purple-300 text-purple-800'
      case 'conjugation':
        return 'bg-orange-100 border-orange-300 text-orange-800'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  return (
    <div className="relative">
      <div className="text-lg leading-relaxed">
        {segments.map((segment, index) =>
          segment.isAnnotated && segment.annotation ? (
            <span
              key={`annotated-${segment.annotation?.id || index}-${segment.annotation?.loc}`}
              className={`relative px-1 py-0.5 rounded border cursor-help ${getAnnotationColor(segment.annotation.type)}`}
              onMouseEnter={() => setHoveredAnnotation(segment.annotation)}
              onMouseLeave={() => setHoveredAnnotation(null)}
            >
              {segment.text}
            </span>
          ) : (
            <span key={`text-${index}-${segment.text.substring(0, 10)}`}>{segment.text}</span>
          )
        )}
      </div>

      {/* Tooltip for hovered annotation */}
      {hoveredAnnotation && (
        <div className="absolute z-10 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <div className="font-semibold text-sm text-gray-900 mb-1">{hoveredAnnotation.type}</div>
          <div className="text-sm text-gray-700">{hoveredAnnotation.content}</div>
          {hoveredAnnotation.id && (
            <div className="text-xs text-gray-500 mt-1">ID: {hoveredAnnotation.id}</div>
          )}
        </div>
      )}
    </div>
  )
}
