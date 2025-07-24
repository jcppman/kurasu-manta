import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

const courseService = new CourseContentService(db)

export async function getSentences() {
  try {
    const sentences = await courseService.getSentences()
    return sentences.items
  } catch (error) {
    console.error('Failed to fetch sentences:', error)
    throw new Error('Failed to fetch sentences')
  }
}
