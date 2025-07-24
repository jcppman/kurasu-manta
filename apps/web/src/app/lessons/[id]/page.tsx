import { getLessonById } from '@/server/lessons'
import Link from 'next/link'

interface Lesson {
  id: number
  title?: string
  description?: string
}

interface KnowledgePoint {
  id: number
  content: string
  explanation: { en?: string }
  type: string
  lesson: number
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getLessonById(Number.parseInt(id))

    if (!data) {
      return <div className="container mx-auto p-8">Lesson not found</div>
    }

    const { lesson, knowledgePoints } = data

    return (
      <div className="container mx-auto p-8">
        <div className="mb-6">
          <Link href="/lessons" className="text-blue-600 hover:text-blue-800">
            &larr; Back to Lessons
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-4">{lesson.title || 'Lesson Details'}</h1>

        {lesson.description && <p className="text-gray-700 mb-6">{lesson.description}</p>}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Knowledge Points</h2>

          {knowledgePoints.length === 0 ? (
            <p className="text-gray-500">No knowledge points found for this lesson.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledgePoints.map((kp) => (
                <div key={kp.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                  <h3 className="font-semibold">{kp.content}</h3>
                  {kp.explanation?.en && (
                    <p className="text-gray-600 text-sm mt-1">{kp.explanation.en}</p>
                  )}
                  <div className="text-xs text-gray-500 mt-2">Type: {kp.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  } catch (error) {
    return <div className="container mx-auto p-8">Error: Failed to load lesson</div>
  }
}
