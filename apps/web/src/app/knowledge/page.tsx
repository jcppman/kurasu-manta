'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface KnowledgePoint {
  id: number
  content: string
  explanation: { en?: string } | null
  type: string
  createdAt: string
}

export default function KnowledgePage() {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge')
      .then((res) => res.json())
      .then((data) => {
        setKnowledgePoints(data)
        setLoading(false)
      })
      .catch((err) => {
        setError('Failed to load knowledge points')
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="container mx-auto p-8">Loading...</div>
  if (error) return <div className="container mx-auto p-8">Error: {error}</div>

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Knowledge Points</h1>

      <div className="space-y-4">
        {knowledgePoints.map((kp) => (
          <div key={kp.id} className="p-6 bg-white border border-gray-200 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold">{kp.content}</h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                {kp.type}
              </span>
            </div>

            {kp.explanation?.en && <p className="text-gray-700 mb-3">{kp.explanation.en}</p>}

            <div className="flex justify-between items-center text-sm text-gray-500">
              <div>{/* Lesson relationship to be implemented later */}</div>
              <div>Created: {new Date(kp.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
