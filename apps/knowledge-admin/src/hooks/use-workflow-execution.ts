'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused'

export interface WorkflowStepConfig {
  [stepName: string]: boolean
}

export interface StepExecutionStatus {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string | null
  startedAt?: string | null
  completedAt?: string | null
  duration?: number | null
  error?: string | null
}

export interface WorkflowExecutionState {
  status: WorkflowStatus
  runId: string | null
  progress: number
  currentStep: string | null
  error: string | null
  isExecuting: boolean
  startedAt?: string | null
  completedAt?: string | null
  totalSteps: number
  completedSteps: number
  steps: StepExecutionStatus[]
}

export function useWorkflowExecution(workflowId: string) {
  const [state, setState] = useState<WorkflowExecutionState>({
    status: 'idle',
    runId: null,
    progress: 0,
    currentStep: null,
    error: null,
    isExecuting: false,
    startedAt: undefined,
    completedAt: undefined,
    totalSteps: 0,
    completedSteps: 0,
    steps: [],
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Define checkStatus first (moved up)
  const checkStatus = useCallback(
    async (runId: string) => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/status?runId=${runId}`)

        if (!response.ok) {
          throw new Error('Failed to check workflow status')
        }

        const result = await response.json()

        setState((prev) => ({
          ...prev,
          status: result.status.status,
          progress: result.status.progress,
          currentStep: result.status.currentStep,
          error: result.status.error,
          startedAt: result.status.startedAt,
          completedAt: result.status.completedAt,
          totalSteps: result.status.totalSteps,
          completedSteps: result.status.completedSteps,
          steps: result.status.steps || [],
        }))

        return result.status
      } catch (error) {
        console.error('Failed to check workflow status:', error)
      }
    },
    [workflowId]
  )

  // Start polling when workflow is running
  const startPolling = useCallback(
    (runId: string) => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          await checkStatus(runId)
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 2000) // Poll every 2 seconds
    },
    [checkStatus]
  )

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Auto-start polling when runId changes and status is running
  useEffect(() => {
    if (state.runId && state.status === 'running') {
      startPolling(state.runId)
    } else {
      stopPolling()
    }

    return () => stopPolling()
  }, [state.runId, state.status, startPolling, stopPolling])

  // Stop polling when status changes to completed or failed
  useEffect(() => {
    if (state.status === 'completed' || state.status === 'failed') {
      stopPolling()
    }
  }, [state.status, stopPolling])

  const executeWorkflow = useCallback(
    async (steps: WorkflowStepConfig) => {
      try {
        setState((prev) => ({ ...prev, isExecuting: true, error: null }))

        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'execute',
            steps,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to start workflow execution')
        }

        const result = await response.json()

        setState((prev) => ({
          ...prev,
          status: 'running',
          runId: result.runId,
          isExecuting: false,
        }))

        return result.runId
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          isExecuting: false,
        }))
        throw error
      }
    },
    [workflowId]
  )

  const stopWorkflow = useCallback(async () => {
    // TODO: Implement workflow stopping
    setState((prev) => ({ ...prev, status: 'idle', runId: null }))
  }, [])

  const pauseWorkflow = useCallback(async () => {
    // TODO: Implement workflow pausing
    setState((prev) => ({ ...prev, status: 'paused' }))
  }, [])

  const resumeWorkflow = useCallback(async () => {
    // TODO: Implement workflow resuming
    setState((prev) => ({ ...prev, status: 'running' }))
  }, [])

  return {
    state,
    executeWorkflow,
    stopWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    checkStatus,
  }
}
