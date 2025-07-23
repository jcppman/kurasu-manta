import { db } from '@/lib/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const courseService = new CourseContentService(db)
    // Use the new getLessons method
    const lessons = await courseService.getLessons()
    return NextResponse.json(lessons.items)
  } catch (error) {
    console.error('Failed to fetch lessons:', error)
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  }
}
