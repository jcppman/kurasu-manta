import { db } from '@/lib/db'
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'
import { NextResponse } from 'next/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params
    const lessonId = Number.parseInt(id)

    const courseService = new CourseContentService(db)
    const lessonWithContent = await courseService.getLessonById(lessonId, { withContent: true })

    if (!lessonWithContent) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    return NextResponse.json({
      lesson: {
        id: lessonWithContent.id,
        title: lessonWithContent.title,
        description: lessonWithContent.description,
        number: lessonWithContent.number,
      },
      knowledgePoints: lessonWithContent.knowledgePoints,
    })
  } catch (error) {
    console.error('Failed to fetch lesson:', error)
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 })
  }
}
