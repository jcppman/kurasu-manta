import { getLessons } from '@/server/lessons'
import Link from 'next/link'

interface Lesson {
  id: number
  number: number
  title?: string
  description?: string
}

export default async function LessonsPage() {
  const lessons = await getLessons()

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
            <p className="text-gray-600 mb-2">{lesson.description || 'No description'}</p>
            <div className="text-sm text-gray-500">Lesson {lesson.number}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
