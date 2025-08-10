import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/content-schema/service'

const courseService = new CourseContentService(db)

export async function getSentences(
  filters?: { knowledgePointId?: number; minLessonNumber?: number },
  pagination?: { page?: number; limit?: number }
) {
  try {
    return await courseService.getSentences(filters, pagination)
  } catch (error) {
    console.error('Failed to fetch sentences:', error)
    throw new Error('Failed to fetch sentences')
  }
}
