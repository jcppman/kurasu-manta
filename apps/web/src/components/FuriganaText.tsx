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
          <ruby key={`furigana-${index}-${segment.text}`}>
            {segment.text}
            <rt>{segment.furigana}</rt>
          </ruby>
        ) : (
          <span key={`text-${index}-${segment.text.substring(0, 10)}`}>{segment.text}</span>
        )
      )}
    </span>
  )
}
