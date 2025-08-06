import { Pagination } from '@/components/Pagination'
import { SentenceViewer } from '@/components/SentenceViewer'
import { getSentences } from '@/server/sentences'
import type { Annotation } from '@kurasu-manta/content-schema/zod'
import Link from 'next/link'

interface Sentence {
  id: number
  content: string
  explanation: { en?: string } | null
  annotations: Annotation[] | null
  createdAt: string
  minLessonNumber: number
}

interface SearchParams {
  page?: string
  limit?: string
  knowledgePointId?: string
  type?: string
  content?: string
  lessonId?: string
}

interface SentencesPageProps {
  searchParams: Promise<SearchParams>
}

export default async function SentencesPage({ searchParams }: SentencesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 10
  const knowledgePointId = params.knowledgePointId ? Number(params.knowledgePointId) : undefined

  const filters = knowledgePointId ? { knowledgePointId } : undefined
  const result = await getSentences(filters, { page, limit })
  const sentences = result.items

  const isFiltered = !!knowledgePointId
  const backUrl = params.lessonId ? `/lessons/${params.lessonId}` : '/'
  const backText = params.lessonId ? 'Back to Lesson' : 'Back to Dashboard'

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href={backUrl} className="text-blue-600 hover:text-blue-800">
          &larr; {backText}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {isFiltered ? `Sentences for ${params.type}: "${params.content}"` : 'Sentences'}
        </h1>
        {isFiltered && (
          <div className="mt-2">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              Filtered by {params.type} ID: {knowledgePointId}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {sentences.map((sentence) => (
          <div key={sentence.id} className="p-6 bg-white border border-gray-200 rounded-lg shadow">
            <SentenceViewer
              text={sentence.content}
              annotations={sentence.annotations || []}
              explanation={sentence.explanation}
              highlightKnowledgePointId={knowledgePointId}
            />

            <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
              <div>Lesson: {sentence.minLessonNumber}</div>
              <div>Created: {new Date(sentence.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          itemsPerPage={result.limit}
          hasNextPage={result.hasNextPage}
          hasPrevPage={result.hasPrevPage}
        />
      </div>
    </div>
  )
}
