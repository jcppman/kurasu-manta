import { Pagination } from '@/components/Pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getLessons } from '@/server/lessons'
import Link from 'next/link'

interface Lesson {
  id: number
  number: number
  title?: string
  description?: string
  counts?: {
    vocabulary: number
    grammar: number
    sentences: number
  }
}

interface SearchParams {
  page?: string
  limit?: string
}

interface LessonsPageProps {
  searchParams: Promise<SearchParams>
}

export default async function LessonsPage({ searchParams }: LessonsPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 10

  const result = await getLessons({ page, limit })
  const lessons = result.items

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Lessons</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Vocabulary</TableHead>
              <TableHead className="text-center">Grammar</TableHead>
              <TableHead className="text-center">Sentences</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length > 0 ? (
              lessons.map((lesson) => (
                <TableRow key={lesson.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      Lesson {lesson.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      {lesson.title || `Lesson ${lesson.number}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      {lesson.description || 'No description'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        {lesson.counts?.vocabulary || 0}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        {lesson.counts?.grammar || 0}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/lessons/${lesson.id}`} className="block w-full h-full py-2 -my-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 bg-purple-500 rounded-full" />
                        {lesson.counts?.sentences || 0}
                      </span>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No lessons found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8">
        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          itemsPerPage={result.limit}
          hasNextPage={result.hasNextPage}
          hasPrevPage={result.hasPrevPage}
        />
      </div>
    </div>
  )
}
