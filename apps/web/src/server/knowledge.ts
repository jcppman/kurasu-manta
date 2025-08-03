import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

const courseService = new CourseContentService(db)

export async function getKnowledgePoints(pagination?: { page?: number; limit?: number }) {
  try {
    const knowledgePoints = await courseService.getKnowledgePointsByConditions({}, pagination)
    return knowledgePoints
  } catch (error) {
    console.error('Failed to fetch knowledge points:', error)
    throw new Error('Failed to fetch knowledge points')
  }
}
