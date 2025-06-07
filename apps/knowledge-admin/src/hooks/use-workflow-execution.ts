'use client'

import { useCallback, useState } from 'react'

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused'

export interface WorkflowStepConfig {
  [stepName: string]: boolean
}

export interface WorkflowExecutionState {
  status: WorkflowStatus
  runId: string | null
  progress: number
  currentStep: string | null
  error: string | null
  isExecuting: boolean
}

export function useWorkflowExecution(workflowId: string) {
  const [state, setState] = useState<WorkflowExecutionState>({
    status: 'idle',
    runId: null,
    progress: 0,
    currentStep: null,
    error: null,
    isExecuting: false,
  })

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
        }))

        return result.status
      } catch (error) {
        console.error('Failed to check workflow status:', error)
      }
    },
    [workflowId]
  )

  return {
    state,
    executeWorkflow,
    stopWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    checkStatus,
  }
}
