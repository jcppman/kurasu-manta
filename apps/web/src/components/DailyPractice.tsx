import { KnowledgePointCard } from '@/components/KnowledgePointCard'
import { getDailyPractice } from '@/server/daily'

export async function DailyPractice() {
  const { vocabularies, grammarList, lessons } = await getDailyPractice({
    maxLessonNumber: 10, // Adjust as needed
    vocabularyLimit: 7, // Limit for vocabulary items
    grammarLimit: 3, // Limit for grammar items
  })

  const vocabulariesWithLessons = vocabularies.map((v) => ({
    ...v,
    lesson: lessons[v.lessonId],
  }))
  const grammarWithLessons = grammarList.map((g) => ({
    ...g,
    lesson: lessons[g.lessonId],
  }))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {grammarWithLessons.map((g) => (
        <KnowledgePointCard key={g.id} knowledgePoint={g} lesson={g.lesson} />
      ))}
      {vocabulariesWithLessons.map((v) => (
        <KnowledgePointCard key={v.id} knowledgePoint={v} lesson={v.lesson} />
      ))}
    </div>
  )
}
