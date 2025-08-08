'use client'

interface FuriganaSegment {
  text: string
  furigana?: string
}

interface FuriganaTextProps {
  segments: FuriganaSegment[]
  className?: string
}

export function FuriganaText({ segments, className = '' }: FuriganaTextProps) {
  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.furigana ? (
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
