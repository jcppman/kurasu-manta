'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  hasNextPage,
  hasPrevPage,
}: PaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createPageURL = (pageNumber: number, limit?: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', pageNumber.toString())
    if (limit) {
      params.set('limit', limit.toString())
    }
    return `${pathname}?${params.toString()}`
  }

  const createLimitURL = (limit: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('limit', limit.toString())
    params.set('page', '1') // Reset to first page when changing limit
    return `${pathname}?${params.toString()}`
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, 'dots-start')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('dots-end', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  if (totalPages <= 1) {
    return (
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Showing {totalItems} item{totalItems !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">Items per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              window.location.href = createLimitURL(Number(e.target.value))
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="text-sm text-gray-700">
        Showing {startItem}-{endItem} of {totalItems} items
      </div>

      <div className="flex items-center space-x-1">
        {/* Previous button */}
        {hasPrevPage ? (
          <Link
            href={createPageURL(currentPage - 1)}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50"
          >
            Previous
          </Link>
        ) : (
          <span className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-100 border border-gray-300 rounded-l-md cursor-not-allowed">
            Previous
          </span>
        )}

        {/* Page numbers */}
        {getVisiblePages().map((page) => {
          if (page === 'dots-start' || page === 'dots-end') {
            return (
              <span
                key={page}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300"
              >
                ...
              </span>
            )
          }

          const pageNumber = page as number
          const isCurrentPage = pageNumber === currentPage

          return (
            <Link
              key={pageNumber}
              href={createPageURL(pageNumber)}
              className={`px-3 py-2 text-sm font-medium border-t border-b border-gray-300 ${
                isCurrentPage
                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {pageNumber}
            </Link>
          )
        })}

        {/* Next button */}
        {hasNextPage ? (
          <Link
            href={createPageURL(currentPage + 1)}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50"
          >
            Next
          </Link>
        ) : (
          <span className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-100 border border-gray-300 rounded-r-md cursor-not-allowed">
            Next
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">Items per page:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            window.location.href = createLimitURL(Number(e.target.value))
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  )
}
