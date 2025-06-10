'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, CheckCircle, Clock, ExternalLink, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'

interface WorkflowRun {
  id: number
  status: 'running' | 'completed' | 'failed' | 'paused'
  createdAt: string
  completedSteps: number
  totalSteps: number
  currentStep?: string | null
  error?: string | null
  duration?: number | null
}

interface WorkflowRunHistoryProps {
  runs: WorkflowRun[]
  workflowId: string
  isLoading?: boolean
  onRefresh?: () => void
}

export function WorkflowRunHistory({
  runs,
  workflowId,
  isLoading = false,
  onRefresh,
}: WorkflowRunHistoryProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Running</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Paused</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getProgressPercentage = (run: WorkflowRun) => {
    if (run.totalSteps === 0) return 0
    return Math.round((run.completedSteps / run.totalSteps) * 100)
  }

  const formatDuration = (createdAt: string, duration?: number | null) => {
    if (duration) {
      return `${Math.round(duration / 1000)}s`
    }
    // Calculate rough duration from creation time
    const elapsed = Date.now() - new Date(createdAt).getTime()
    if (elapsed < 60000) {
      return `${Math.round(elapsed / 1000)}s`
    }
    if (elapsed < 3600000) {
      return `${Math.round(elapsed / 60000)}m`
    }
    return `${Math.round(elapsed / 3600000)}h`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>Loading workflow execution history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>No workflow executions found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">This workflow hasn't been executed yet</p>
            <p className="text-sm text-gray-400">
              Use the execution panel to start your first workflow run
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Run History</CardTitle>
            <CardDescription>Recent workflow executions and their results</CardDescription>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {runs.map((run) => (
            <div
              key={run.id}
              className={`p-4 border rounded-lg transition-colors ${
                run.status === 'running'
                  ? 'border-blue-200 bg-blue-50'
                  : run.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : run.status === 'failed'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(run.status)}
                    <span className="font-medium">Run #{run.id}</span>
                    {getStatusBadge(run.status)}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Started {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                    {run.status !== 'running' && (
                      <span> • Duration: {formatDuration(run.createdAt, run.duration)}</span>
                    )}
                  </div>

                  {run.currentStep && run.status === 'running' && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current step: </span>
                      <span className="font-medium">{run.currentStep}</span>
                    </div>
                  )}

                  {run.error && (
                    <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-200 rounded">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{run.error}</p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>
                        {run.completedSteps} / {run.totalSteps} steps ({getProgressPercentage(run)}
                        %)
                      </span>
                    </div>
                    <Progress value={getProgressPercentage(run)} className="h-2" />
                  </div>
                </div>

                <div className="ml-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/workflows/${workflowId}/runs/${run.id}`}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Details
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {runs.length >= 5 && (
          <div className="text-center pt-4 border-t">
            <Button variant="outline" asChild>
              <Link href={`/workflows/${workflowId}/history`}>View Full History</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
