import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/content-schema/service'

const courseService = new CourseContentService(db)

export async function getLessons(pagination?: { page?: number; limit?: number }) {
  try {
    const lessons = await courseService.getLessons(pagination)

    // Enhance lessons with content counts
    const lessonsWithCounts = await Promise.all(
      lessons.items.map(async (lesson) => {
        try {
          // Get knowledge points by lesson ID to count vocab and grammar
          const vocabularyResult = await courseService.getKnowledgePointsByConditions(
            { lessonId: lesson.id, type: 'vocabulary' },
            { limit: 1000 } // Get all to count
          )

          const grammarResult = await courseService.getKnowledgePointsByConditions(
            { lessonId: lesson.id, type: 'grammar' },
            { limit: 1000 } // Get all to count
          )

          // Get sentences for this lesson (using minLessonNumber)
          const sentencesResult = await courseService.getSentences(
            { minLessonNumber: lesson.number },
            { limit: 1000 } // Get all to count
          )

          // Filter sentences to only count those that are exactly for this lesson
          const sentencesForThisLesson = sentencesResult.items.filter(
            (sentence) => sentence.minLessonNumber === lesson.number
          )

          return {
            ...lesson,
            counts: {
              vocabulary: vocabularyResult.total,
              grammar: grammarResult.total,
              sentences: sentencesForThisLesson.length,
            },
          }
        } catch (error) {
          console.error(`Failed to fetch counts for lesson ${lesson.id}:`, error)
          return {
            ...lesson,
            counts: {
              vocabulary: 0,
              grammar: 0,
              sentences: 0,
            },
          }
        }
      })
    )

    return {
      ...lessons,
      items: lessonsWithCounts,
    }
  } catch (error) {
    console.error('Failed to fetch lessons:', error)
    throw new Error('Failed to fetch lessons')
  }
}

export async function getLessonById(id: number) {
  try {
    const lessonWithContent = await courseService.getLessonById(id, { withContent: true })

    if (!lessonWithContent) {
      return null
    }

    // Get sentence counts for all knowledge points in this lesson
    const knowledgePointIds = lessonWithContent.knowledgePoints.map((kp) => kp.id)
    const sentenceCounts =
      await courseService.getSentenceCountsByKnowledgePointIds(knowledgePointIds)

    // Enhance knowledge points with sentence counts
    const knowledgePointsWithCounts = lessonWithContent.knowledgePoints.map((kp) => ({
      ...kp,
      sentenceCount: sentenceCounts.get(kp.id) ?? 0,
    }))

    return {
      lesson: {
        id: lessonWithContent.id,
        title: lessonWithContent.title,
        description: lessonWithContent.description,
        number: lessonWithContent.number,
      },
      knowledgePoints: knowledgePointsWithCounts,
    }
  } catch (error) {
    console.error('Failed to fetch lesson:', error)
    throw new Error('Failed to fetch lesson')
  }
}
