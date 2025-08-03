import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

const courseService = new CourseContentService(db)

export async function getSentences(pagination?: { page?: number; limit?: number }) {
  try {
    const sentences = await courseService.getSentences({}, pagination)
    return sentences
  } catch (error) {
    console.error('Failed to fetch sentences:', error)
    throw new Error('Failed to fetch sentences')
  }
}
