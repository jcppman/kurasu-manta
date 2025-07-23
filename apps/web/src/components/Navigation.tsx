import Link from 'next/link'

export function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Knowledge Dashboard
          </Link>

          <div className="flex space-x-6">
            <Link href="/lessons" className="text-gray-600 hover:text-gray-900 font-medium">
              Lessons
            </Link>
            <Link href="/knowledge" className="text-gray-600 hover:text-gray-900 font-medium">
              Knowledge
            </Link>
            <Link href="/sentences" className="text-gray-600 hover:text-gray-900 font-medium">
              Sentences
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
