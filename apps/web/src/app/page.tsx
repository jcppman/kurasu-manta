import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Knowledge Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/lessons"
          className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Lessons</h2>
          <p className="text-gray-600">View and manage all lessons</p>
        </Link>

        <Link
          href="/knowledge"
          className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Knowledge Points</h2>
          <p className="text-gray-600">Browse knowledge points and concepts</p>
        </Link>

        <Link
          href="/sentences"
          className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Sentences</h2>
          <p className="text-gray-600">View sentences with annotations</p>
        </Link>
      </div>
    </div>
  )
}
