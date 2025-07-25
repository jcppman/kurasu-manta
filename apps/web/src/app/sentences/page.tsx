import { SentenceViewer } from '@/components/SentenceViewer'
import { getSentences } from '@/server/sentences'
import type { Annotation } from '@kurasu-manta/knowledge-schema/zod/annotation'
import Link from 'next/link'

interface Sentence {
  id: number
  content: string
  explanation: { en?: string } | null
  annotations: Annotation[] | null
  createdAt: string
  minLessonNumber: number
}

export default async function SentencesPage() {
  const sentences = await getSentences()

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Sentences</h1>

      <div className="space-y-6">
        {sentences.map((sentence) => (
          <div key={sentence.id} className="p-6 bg-white border border-gray-200 rounded-lg shadow">
            <SentenceViewer text={sentence.content} annotations={sentence.annotations || []} />

            {sentence.explanation?.en && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <strong>Translation:</strong> {sentence.explanation.en}
              </div>
            )}

            <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
              <div>Lesson: {sentence.minLessonNumber}</div>
              <div>Created: {new Date(sentence.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
