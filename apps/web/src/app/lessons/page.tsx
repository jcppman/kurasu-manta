import { Pagination } from '@/components/Pagination'
import { getLessons } from '@/server/lessons'
import Link from 'next/link'

interface Lesson {
  id: number
  number: number
  title?: string
  description?: string
  counts?: {
    vocabulary: number
    grammar: number
    sentences: number
  }
}

interface SearchParams {
  page?: string
  limit?: string
}

interface LessonsPageProps {
  searchParams: Promise<SearchParams>
}

export default async function LessonsPage({ searchParams }: LessonsPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 10

  const result = await getLessons({ page, limit })
  const lessons = result.items

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Lessons</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/lessons/${lesson.id}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-50"
          >
            <h2 className="text-xl font-semibold mb-2">
              {lesson.title || `Lesson ${lesson.number}`}
            </h2>
            <p className="text-gray-600 mb-3">{lesson.description || 'No description'}</p>

            {/* Content counts */}
            {lesson.counts && (
              <div className="flex gap-4 mb-3">
                <div className="flex items-center gap-1 text-sm">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-gray-600">{lesson.counts.vocabulary} vocab</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-gray-600">{lesson.counts.grammar} grammar</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="w-3 h-3 bg-purple-500 rounded-full" />
                  <span className="text-gray-600">{lesson.counts.sentences} sentences</span>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500">Lesson {lesson.number}</div>
          </Link>
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
