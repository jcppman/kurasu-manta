'use client'

import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { useState } from 'react'

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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')

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

  const getAnnotationColor = (type: string, annotation: Annotation) => {
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

  const isFuriganaAnnotation = (annotation: Annotation) => {
    return annotation.type.toLowerCase() === 'furigana'
  }

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
              // Furigana annotation - display reading above kanji
              <span
                key={`furigana-${segment.annotation?.id || index}-${segment.annotation?.loc}`}
                className="relative inline-block"
              >
                <span className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-xs text-gray-600 whitespace-nowrap">
                  {segment.annotation.content}
                </span>
                {segment.text}
              </span>
            ) : (
              // Regular annotation - display with hover tooltip
              <span
                key={`annotated-${segment.annotation?.id || index}-${segment.annotation?.loc}`}
                className={`relative px-1 py-0.5 rounded border cursor-help ${getAnnotationColor(segment.annotation.type, segment.annotation)}`}
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
          {/* Language toggle buttons */}
          {availableLanguages.length > 1 && (
            <div className="flex gap-2 mb-2">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedLanguage === lang
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Display explanation in selected language */}
          <div className="text-sm text-gray-700">
            <strong>Explanation:</strong>{' '}
            {explanation[selectedLanguage] || explanation[availableLanguages[0]]}
          </div>
        </div>
      )}

      {/* Tooltip for hovered annotation (excluding furigana) */}
      {hoveredAnnotation && !isFuriganaAnnotation(hoveredAnnotation) && (
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
