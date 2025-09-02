'use client'

import { getNonFuriganaAnnotations, isFuriganaAnnotation } from '@/lib/annotations'
import type { Annotation } from '@kurasu-manta/content-schema/zod'
import { useState } from 'react'
import { AudioPlayer } from './AudioPlayer'
import { FuriganaText } from './FuriganaText'

interface SentenceViewerProps {
  text: string
  annotations: Annotation[]
  explanation?: { [languageCode: string]: string } | null
  highlightKnowledgePointId?: number
  audioHash?: string
}

export function SentenceViewer({
  text,
  annotations,
  explanation,
  highlightKnowledgePointId,
  audioHash,
}: SentenceViewerProps) {
  console.log('annotations', annotations)
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Separate furigana and non-furigana annotations
  const furiganaAnnotations = annotations.filter(isFuriganaAnnotation).sort((a, b) => a.loc - b.loc)
  const nonFuriganaAnnotations = getNonFuriganaAnnotations(annotations).sort(
    (a, b) => a.loc - b.loc
  )

  // Helper function to find furigana annotation that covers a specific position
  const findFuriganaAnnotation = (position: number): Annotation | undefined => {
    return furiganaAnnotations.find(
      (annotation) => annotation.loc <= position && position < annotation.loc + annotation.len
    )
  }

  // Create segments handling multi-character furigana annotations
  const createSegments = () => {
    const segments: Array<{
      text: string
      furigana?: string
      vocabularyAnnotations: Annotation[]
      start: number
      end: number
    }> = []

    let i = 0
    while (i < text.length) {
      const furiganaAnnotation = findFuriganaAnnotation(i)

      if (furiganaAnnotation) {
        // Handle multi-character furigana annotation
        const start = furiganaAnnotation.loc
        const end = furiganaAnnotation.loc + furiganaAnnotation.len
        const segmentText = text.slice(start, end)

        // Find vocabulary annotations that overlap with this furigana segment
        const vocabularyAnnotations = nonFuriganaAnnotations.filter(
          (ann) => ann.loc < end && start < ann.loc + ann.len
        )

        segments.push({
          text: segmentText,
          furigana: furiganaAnnotation.content,
          vocabularyAnnotations,
          start,
          end,
        })

        // Skip to the end of this furigana annotation
        i = end
      } else {
        // Handle single character without furigana
        const char = text[i]

        // Find vocabulary annotations that include this position
        const vocabularyAnnotations = nonFuriganaAnnotations.filter(
          (ann) => ann.loc <= i && i < ann.loc + ann.len
        )

        segments.push({
          text: char,
          vocabularyAnnotations,
          start: i,
          end: i + 1,
        })

        i++
      }
    }

    return segments
  }

  const segments = createSegments()

  // Get available languages from explanation
  const availableLanguages = explanation ? Object.keys(explanation) : []

  // Check if tooltip should be positioned on the left to avoid going off-screen
  const shouldPositionLeft =
    typeof window !== 'undefined' && mousePosition.x > window.innerWidth - 300

  // Group consecutive segments that should be rendered together
  const groupSegments = () => {
    const groups: Array<{
      segments: typeof segments
      vocabularyAnnotation?: Annotation
      startIndex: number
    }> = []

    let currentGroup: typeof segments = []
    let currentVocabAnnotation: Annotation | undefined
    let groupStartIndex = 0

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const vocabularyAnnotation = segment.vocabularyAnnotations[0] // Use first vocabulary annotation

      if (
        vocabularyAnnotation &&
        currentVocabAnnotation &&
        vocabularyAnnotation.id === currentVocabAnnotation.id
      ) {
        // Continue current vocabulary group
        currentGroup.push(segment)
      } else if (vocabularyAnnotation && !currentVocabAnnotation) {
        // Start new vocabulary group
        if (currentGroup.length > 0) {
          groups.push({
            segments: currentGroup,
            vocabularyAnnotation: currentVocabAnnotation,
            startIndex: groupStartIndex,
          })
        }
        currentGroup = [segment]
        currentVocabAnnotation = vocabularyAnnotation
        groupStartIndex = i
      } else if (!vocabularyAnnotation && currentVocabAnnotation) {
        // End current vocabulary group
        groups.push({
          segments: currentGroup,
          vocabularyAnnotation: currentVocabAnnotation,
          startIndex: groupStartIndex,
        })
        currentGroup = [segment]
        currentVocabAnnotation = undefined
        groupStartIndex = i
      } else {
        // Continue current non-vocabulary group or no annotation change
        currentGroup.push(segment)
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push({
        segments: currentGroup,
        vocabularyAnnotation: currentVocabAnnotation,
        startIndex: groupStartIndex,
      })
    }

    return groups
  }

  const renderGroup = (group: ReturnType<typeof groupSegments>[0], groupIndex: number) => {
    const content = (
      <FuriganaText
        key={`group-${groupIndex}-${group.startIndex}`}
        segments={group.segments}
        className="inline-block"
      />
    )

    if (!group.vocabularyAnnotation) {
      return content
    }

    // Wrap with vocabulary annotation styling
    const isHighlighted = group.vocabularyAnnotation?.id === highlightKnowledgePointId

    return (
      <span
        key={`vocab-${groupIndex}-${group.startIndex}-${group.vocabularyAnnotation.id}`}
        className={`relative px-1 py-0.5 cursor-help border-b-2 ${
          isHighlighted
            ? 'bg-yellow-200 border-yellow-400'
            : 'border-blue-300 hover:border-blue-500'
        }`}
        onMouseEnter={(e) => {
          setHoveredAnnotation(group.vocabularyAnnotation || null)
          setMousePosition({ x: e.clientX, y: e.clientY })
        }}
        onMouseMove={(e) => {
          setMousePosition({ x: e.clientX, y: e.clientY })
        }}
        onMouseLeave={() => setHoveredAnnotation(null)}
      >
        {content}
      </span>
    )
  }

  const groups = groupSegments()

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-lg leading-relaxed" style={{ lineHeight: '2.5' }}>
          {groups.map((group, index) => renderGroup(group, index))}
        </div>
        {audioHash && <AudioPlayer audioHash={audioHash} />}
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
