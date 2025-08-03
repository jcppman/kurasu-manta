import { KnowledgePointCard } from '@/components/KnowledgePointCard'
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
                <KnowledgePointCard key={kp.id} knowledgePoint={kp} />
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
