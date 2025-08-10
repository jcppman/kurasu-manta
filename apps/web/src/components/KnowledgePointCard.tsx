'use client'

import { Button } from '@/components/ui/button'
import { KNOWLEDGE_POINT_TYPES } from '@kurasu-manta/content-schema/common'
import type { KnowledgePoint } from '@kurasu-manta/content-schema/zod'
import type { Lesson } from '@kurasu-manta/content-schema/zod'
import { useRouter } from 'next/navigation'
import { AudioPlayer } from './AudioPlayer'
import { FuriganaText } from './FuriganaText'

interface KnowledgePointCardProps {
  knowledgePoint: KnowledgePoint
  lesson?: Lesson
  sentenceCount?: number
}

export function KnowledgePointCard({
  knowledgePoint,
  lesson,
  sentenceCount,
}: KnowledgePointCardProps) {
  const router = useRouter()

  const handleClick = () => {
    // Navigate to sentences page filtered by this knowledge point
    const params = new URLSearchParams({
      knowledgePointId: knowledgePoint.id.toString(),
      type: knowledgePoint.type,
      backUrl: window.location.pathname, // Pass current page as back URL
    })
    router.push(`/sentences?${params.toString()}`)
  }

  return (
    <div className="p-8 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <span>
          {knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY &&
          knowledgePoint.annotations ? (
            <FuriganaText
              segments={
                knowledgePoint.annotations.filter((ann) => ann.type.toLowerCase() === 'furigana')
                  .length > 0
                  ? [
                      {
                        text: knowledgePoint.content,
                        furigana: knowledgePoint.annotations.find(
                          (ann) => ann.type.toLowerCase() === 'furigana'
                        )?.content,
                      },
                    ]
                  : [{ text: knowledgePoint.content }]
              }
            />
          ) : (
            knowledgePoint.content
          )}
        </span>
        {knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY && knowledgePoint.audio && (
          <AudioPlayer audioHash={knowledgePoint.audio} />
        )}
      </h3>

      {/* Show explanations */}
      {knowledgePoint.explanation && Object.keys(knowledgePoint.explanation).length > 0 && (
        <div className="mb-3">
          {Object.entries(knowledgePoint.explanation).map(([lang, explanation]) => (
            <div key={lang} className="text-gray-600 text-sm mb-1">
              <span className="font-medium text-xs text-gray-500 uppercase mr-2">
                {explanation}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-row items-center">
        <div className="flex-1">
          <div className="text-xs">Lesson {lesson?.number}</div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">{knowledgePoint.type}</div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          {/* Show sentence count if available */}
          {(sentenceCount ?? 0) > 0 && (
            <Button variant="ghost" onClick={handleClick}>
              View Example Sentences
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
