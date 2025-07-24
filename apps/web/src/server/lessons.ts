import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

const courseService = new CourseContentService(db)

export async function getLessons() {
  try {
    const lessons = await courseService.getLessons()
    return lessons.items
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

    return {
      lesson: {
        id: lessonWithContent.id,
        title: lessonWithContent.title,
        description: lessonWithContent.description,
        number: lessonWithContent.number,
      },
      knowledgePoints: lessonWithContent.knowledgePoints,
    }
  } catch (error) {
    console.error('Failed to fetch lesson:', error)
    throw new Error('Failed to fetch lesson')
  }
}
