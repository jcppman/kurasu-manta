'use client'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'

interface StepStatus {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string | null
  startedAt?: string | null
  completedAt?: string | null
  duration?: number | null
  error?: string | null
}

interface StepProgressIndicatorProps {
  steps: StepStatus[]
  currentStep?: string | null
}

export function StepProgressIndicator({ steps, currentStep }: StepProgressIndicatorProps) {
  const getStepIcon = (step: StepStatus) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStepBadge = (step: StepStatus) => {
    switch (step.status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            Completed
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
            Running
          </Badge>
        )
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  const formatDuration = (
    duration: number | null | undefined,
    startedAt: string | null | undefined
  ) => {
    if (duration) {
      return `${Math.round(duration / 1000)}s`
    }
    if (startedAt) {
      return formatDistanceToNow(new Date(startedAt), { addSuffix: false })
    }
    return null
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isActive = step.name === currentStep
        const isCompleted = step.status === 'completed'
        const isRunning = step.status === 'running'
        const isFailed = step.status === 'failed'

        return (
          <div
            key={step.name}
            className={`relative p-4 border rounded-lg transition-all ${
              isActive
                ? 'border-blue-500 bg-blue-50'
                : isCompleted
                  ? 'border-green-200 bg-green-50'
                  : isFailed
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200'
            }`}
          >
            {/* Step number indicator on the left */}
            <div className="absolute left-4 top-4">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted
                    ? 'bg-green-500 border-green-500 text-white'
                    : isRunning
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : isFailed
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}
              >
                {isCompleted || isRunning || isFailed ? (
                  getStepIcon(step)
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
            </div>

            {/* Step content */}
            <div className="ml-12 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{step.name}</h4>
                  {getStepBadge(step)}
                </div>
                {step.startedAt && (
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(step.duration, step.startedAt)}
                  </div>
                )}
              </div>

              {step.message && <p className="text-sm text-muted-foreground">{step.message}</p>}

              {/* Progress bar for running steps */}
              {isRunning && (
                <div className="space-y-1">
                  <Progress value={step.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress: {step.progress}%</span>
                  </div>
                </div>
              )}

              {/* Error message for failed steps */}
              {isFailed && step.error && (
                <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-200 rounded">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{step.error}</p>
                </div>
              )}

              {/* Timing information */}
              {(step.startedAt || step.completedAt) && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {step.startedAt && (
                    <span>Started: {new Date(step.startedAt).toLocaleTimeString()}</span>
                  )}
                  {step.completedAt && (
                    <span>Completed: {new Date(step.completedAt).toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>

            {/* Connection line to next step */}
            {index < steps.length - 1 && (
              <div className="absolute left-8 bottom-0 w-0.5 h-4 bg-gray-200 transform translate-y-full" />
            )}
          </div>
        )
      })}
    </div>
  )
}
