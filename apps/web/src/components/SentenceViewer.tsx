'use client'

import {
  getAnnotationColor,
  getNonFuriganaAnnotations,
  isFuriganaAnnotation,
} from '@/lib/annotations'
import type { Annotation } from '@kurasu-manta/content-schema/zod'
import { useState } from 'react'
import { FuriganaText } from './FuriganaText'

interface SentenceViewerProps {
  text: string
  annotations: Annotation[]
  explanation?: { [languageCode: string]: string } | null
  highlightKnowledgePointId?: number
}

export function SentenceViewer({
  text,
  annotations,
  explanation,
  highlightKnowledgePointId,
}: SentenceViewerProps) {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

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

  // Get available languages from explanation
  const availableLanguages = explanation ? Object.keys(explanation) : []

  // Check if tooltip should be positioned on the left to avoid going off-screen
  const shouldPositionLeft =
    typeof window !== 'undefined' && mousePosition.x > window.innerWidth - 300

  return (
    <div className="relative">
      <div className="text-lg leading-relaxed mb-4" style={{ lineHeight: '2.5' }}>
        {segments.map((segment, index) =>
          segment.isAnnotated && segment.annotation ? (
            isFuriganaAnnotation(segment.annotation) ? (
              // Use FuriganaText component for furigana display
              <FuriganaText
                key={`furigana-${segment.annotation?.id || index}-${segment.annotation?.loc}`}
                text={segment.text}
                annotations={[segment.annotation]}
                className="inline-block"
              />
            ) : (
              // Regular annotation - display with hover tooltip
              <span
                key={`annotated-${segment.annotation?.id || index}-${segment.annotation?.loc}`}
                className={`relative px-1 py-0.5 rounded border cursor-help ${getAnnotationColor(segment.annotation.type, segment.annotation, highlightKnowledgePointId)}`}
                onMouseEnter={(e) => {
                  setHoveredAnnotation(segment.annotation || null)
                  setMousePosition({ x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => {
                  setMousePosition({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => setHoveredAnnotation(null)}
              >
                {segment.text}
              </span>
            )
          ) : (
            <span key={`text-${index}-${segment.text.substring(0, 10)}`}>{segment.text}</span>
          )
        )}
      </div>

      {/* Explanation section */}
      {explanation && availableLanguages.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-900 mb-2">Explanations:</div>

          {/* Display all language explanations simultaneously */}
          <div className="space-y-2">
            {availableLanguages.map((lang) => (
              <div key={lang} className="text-sm">
                <span className="font-medium text-xs text-gray-600 uppercase mr-2">{lang}:</span>
                <span className="text-gray-700">{explanation[lang]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip for hovered annotation */}
      {hoveredAnnotation && (
        <div
          className="fixed z-50 p-3 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs pointer-events-none"
          style={{
            left: `${mousePosition.x + 10}px`,
            top: `${mousePosition.y + 10}px`,
            transform: shouldPositionLeft ? 'translateX(-100%)' : undefined,
          }}
        >
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
