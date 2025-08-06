import { db } from '@/server/db'
import { CourseContentService } from '@kurasu-manta/content-schema/service'

const courseService = new CourseContentService(db)

export async function getSentences(
  filters?: { knowledgePointId?: number; minLessonNumber?: number },
  pagination?: { page?: number; limit?: number }
) {
  try {
    // If filtering by knowledge point, we need to get sentences that contain that knowledge point
    if (filters?.knowledgePointId) {
      // This would require a more complex query - for now, get all sentences and filter
      // In a real implementation, you'd want to add this filtering to the service layer
      const allSentences = await courseService.getSentences(
        { minLessonNumber: filters.minLessonNumber },
        { limit: 1000 } // Get more to filter
      )

      // Filter sentences that have annotations referencing this knowledge point
      const filteredSentences = allSentences.items.filter((sentence) =>
        sentence.annotations?.some((annotation) => annotation.id === filters.knowledgePointId)
      )

      // Apply pagination manually
      const startIndex = ((pagination?.page || 1) - 1) * (pagination?.limit || 10)
      const endIndex = startIndex + (pagination?.limit || 10)
      const paginatedItems = filteredSentences.slice(startIndex, endIndex)

      return {
        items: paginatedItems,
        total: filteredSentences.length,
        page: pagination?.page || 1,
        limit: pagination?.limit || 10,
        totalPages: Math.ceil(filteredSentences.length / (pagination?.limit || 10)),
        hasNextPage: endIndex < filteredSentences.length,
        hasPrevPage: (pagination?.page || 1) > 1,
      }
    }

    // Normal filtering
    const sentences = await courseService.getSentences(
      { minLessonNumber: filters?.minLessonNumber },
      pagination
    )
    return sentences
  } catch (error) {
    console.error('Failed to fetch sentences:', error)
    throw new Error('Failed to fetch sentences')
  }
}
