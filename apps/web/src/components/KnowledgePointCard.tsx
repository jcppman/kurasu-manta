'use client'

import { KNOWLEDGE_POINT_TYPES } from '@kurasu-manta/knowledge-schema/common/types'
import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { useRouter } from 'next/navigation'
import { FuriganaText } from './FuriganaText'

interface KnowledgePoint {
  id: number
  content: string
  explanation: { [languageCode: string]: string }
  type: string
  lessonId: number
  sentenceCount?: number
  annotations?: Annotation[]
}

interface KnowledgePointCardProps {
  knowledgePoint: KnowledgePoint
}

export function KnowledgePointCard({ knowledgePoint }: KnowledgePointCardProps) {
  const router = useRouter()

  const handleClick = () => {
    // Navigate to sentences page filtered by this knowledge point
    const params = new URLSearchParams({
      knowledgePointId: knowledgePoint.id.toString(),
      type: knowledgePoint.type,
      content: knowledgePoint.content,
      lessonId: knowledgePoint.lessonId.toString(),
    })
    router.push(`/sentences?${params.toString()}`)
  }

  return (
    <button
      type="button"
      className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-left w-full"
      onClick={handleClick}
    >
      <h3 className="font-semibold mb-2">
        {knowledgePoint.type === KNOWLEDGE_POINT_TYPES.VOCABULARY && knowledgePoint.annotations ? (
          <FuriganaText text={knowledgePoint.content} annotations={knowledgePoint.annotations} />
        ) : (
          knowledgePoint.content
        )}
      </h3>

      {/* Show explanations */}
      {knowledgePoint.explanation && Object.keys(knowledgePoint.explanation).length > 0 && (
        <div className="mb-3">
          {Object.entries(knowledgePoint.explanation).map(([lang, explanation]) => (
            <div key={lang} className="text-gray-600 text-sm mb-1">
              <span className="font-medium text-xs text-gray-500 uppercase mr-2">{lang}:</span>
              {explanation}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">Type: {knowledgePoint.type}</div>
          {typeof knowledgePoint.sentenceCount === 'number' && (
            <div className="text-xs text-gray-500">
              {knowledgePoint.sentenceCount} sentence{knowledgePoint.sentenceCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="text-xs text-blue-600 hover:text-blue-800">View sentences →</div>
      </div>
    </button>
  )
}
