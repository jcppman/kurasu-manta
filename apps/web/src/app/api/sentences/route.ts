import { db } from '@/lib/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const courseService = new CourseContentService(db)
    // Use the new getSentences method
    const sentences = await courseService.getSentences()

    return NextResponse.json(sentences.items)
  } catch (error) {
    console.error('Failed to fetch sentences:', error)
    return NextResponse.json({ error: 'Failed to fetch sentences' }, { status: 500 })
  }
}
