import { KnowledgePointCard } from '@/components/KnowledgePointCard'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { getLessonById } from '@/server/lessons'
import Link from 'next/link'

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getLessonById(Number.parseInt(id))

    if (!data) {
      return <div className="container mx-auto p-8">Lesson not found</div>
    }

    const { lesson, knowledgePoints } = data

    const grammarPoints = knowledgePoints.filter((kp) => kp.type === 'grammar')
    const vocabularyPoints = knowledgePoints.filter((kp) => kp.type === 'vocabulary')

    return (
      <div className="container mx-auto p-8">
        <div className="mb-6">
          <Link href="/lessons" className="text-blue-600 hover:text-blue-800">
            &larr; Back to Lessons
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-4">{lesson.title || 'Lesson Details'}</h1>

        {lesson.description && <p className="text-gray-700 mb-6">{lesson.description}</p>}

        {knowledgePoints.length === 0 ? (
          <p className="text-gray-500">No knowledge points found for this lesson.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {grammarPoints.length > 0 && (
              <AccordionItem value="grammar">
                <AccordionTrigger className="text-xl font-semibold">
                  Grammar ({grammarPoints.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {grammarPoints.map((kp) => (
                      <KnowledgePointCard
                        key={kp.id}
                        knowledgePoint={kp}
                        sentenceCount={kp.sentenceCount}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {vocabularyPoints.length > 0 && (
              <AccordionItem value="vocabulary">
                <AccordionTrigger className="text-xl font-semibold">
                  Vocabulary ({vocabularyPoints.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {vocabularyPoints.map((kp) => (
                      <KnowledgePointCard
                        key={kp.id}
                        knowledgePoint={kp}
                        sentenceCount={kp.sentenceCount}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>
    )
  } catch (error) {
    return <div className="container mx-auto p-8">Error: Failed to load lesson</div>
  }
}
