'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'

interface WorkflowProgressStats {
  totalSteps: number
  completedSteps: number
  runningSteps: number
  failedSteps: number
  pendingSteps: number
}

interface WorkflowProgressProps {
  runId?: string | null
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number
  currentStep?: string | null
  startedAt?: string | null
  completedAt?: string | null
  stats?: WorkflowProgressStats
  error?: string | null
}

export function WorkflowProgress({
  runId,
  status,
  progress,
  currentStep,
  startedAt,
  completedAt,
  stats,
  error,
}: WorkflowProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'paused':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
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
        return <Badge variant="outline">Ready</Badge>
    }
  }

  const getElapsedTime = () => {
    if (!startedAt) return null

    const endTime = completedAt ? new Date(completedAt) : new Date()
    const startTime = new Date(startedAt)
    const elapsed = endTime.getTime() - startTime.getTime()

    if (elapsed < 60000) {
      return `${Math.round(elapsed / 1000)}s`
    }
    if (elapsed < 3600000) {
      return `${Math.round(elapsed / 60000)}m`
    }
    return `${Math.round(elapsed / 3600000)}h`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Workflow Progress
            </CardTitle>
            <CardDescription>{runId ? `Run ID: ${runId}` : 'No active run'}</CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Current Step */}
        {currentStep && status === 'running' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-blue-900">
                Currently running: {currentStep}
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-900">Workflow Failed</div>
                <div className="text-sm text-red-700 mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Step Statistics */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Completed
                </span>
                <span className="font-medium">{stats.completedSteps}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 text-blue-500" />
                  Running
                </span>
                <span className="font-medium">{stats.runningSteps}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  Failed
                </span>
                <span className="font-medium">{stats.failedSteps}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  Pending
                </span>
                <span className="font-medium">{stats.pendingSteps}</span>
              </div>
            </div>
          </div>
        )}

        {/* Timing Information */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          {startedAt && (
            <span>Started {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}</span>
          )}
          {getElapsedTime() && <span>Duration: {getElapsedTime()}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
