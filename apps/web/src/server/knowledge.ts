import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

const courseService = new CourseContentService(db)

export async function getKnowledgePoints() {
  try {
    const knowledgePoints = await courseService.getKnowledgePointsByConditions({})
    return knowledgePoints.items
  } catch (error) {
    console.error('Failed to fetch knowledge points:', error)
    throw new Error('Failed to fetch knowledge points')
  }
}
