import { db } from '@/lib/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const courseService = new CourseContentService(db)
    // Use the new getKnowledgePointsByConditions method to get all knowledge points
    const knowledgePoints = await courseService.getKnowledgePointsByConditions({})

    return NextResponse.json(knowledgePoints.items)
  } catch (error) {
    console.error('Failed to fetch knowledge points:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge points' }, { status: 500 })
  }
}
