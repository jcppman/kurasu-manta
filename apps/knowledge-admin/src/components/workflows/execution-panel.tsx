'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { type WorkflowStepConfig, useWorkflowExecution } from '@/hooks/use-workflow-execution'
import { type WorkflowStepWithName, getAllDependencies, getAllDependents } from '@/lib/workflow-api'
import { AlertCircle, ChevronDown, ChevronUp, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useState } from 'react'
import { StepProgressIndicator } from './step-progress-indicator'
import { WorkflowProgress } from './workflow-progress'

interface ExecutionPanelProps {
  workflowId: string
  steps: WorkflowStepWithName[]
}

export function ExecutionPanel({ workflowId, steps }: ExecutionPanelProps) {
  const { state, executeWorkflow, stopWorkflow, pauseWorkflow, resumeWorkflow } =
    useWorkflowExecution(workflowId)

  const [stepConfig, setStepConfig] = useState<WorkflowStepConfig>(() => {
    // Initialize all steps as enabled by default
    const config: WorkflowStepConfig = {}
    for (const step of steps) {
      config[step.name] = true
    }
    return config
  })

  const handleStepConfigChange = (stepName: string, enabled: boolean) => {
    setStepConfig((prev) => {
      const newConfig = { ...prev, [stepName]: enabled }

      // If disabling a step, also disable all recursive dependents
      if (!enabled) {
        const allDependents = getAllDependents(stepName, steps)
        for (const dependent of allDependents) {
          newConfig[dependent] = false
        }
      }

      // If enabling a step, also enable all recursive dependencies
      if (enabled) {
        const allDependencies = getAllDependencies(stepName, steps)
        for (const dep of allDependencies) {
          newConfig[dep] = true
        }
      }

      return newConfig
    })
  }

  const handleExecute = async () => {
    try {
      await executeWorkflow(stepConfig)
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  const enabledSteps = Object.entries(stepConfig)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name)

  // Check for dependency validation
  const invalidSteps = steps.filter((step) => {
    const isEnabled = stepConfig[step.name]
    const hasMissingDependencies = (step.definition.dependencies || []).some(
      (dep: string) => !stepConfig[dep]
    )
    return isEnabled && hasMissingDependencies
  })

  const canExecute = enabledSteps.length > 0 && state.status === 'idle' && invalidSteps.length === 0

  // Smart selection handlers
  const handleSelectAllDependencies = (stepName: string) => {
    setStepConfig((prev) => {
      const newConfig = { ...prev }
      const allDependencies = getAllDependencies(stepName, steps)
      for (const dep of allDependencies) {
        newConfig[dep] = true
      }
      newConfig[stepName] = true
      return newConfig
    })
  }

  const handleClearAllDependents = (stepName: string) => {
    setStepConfig((prev) => {
      const newConfig = { ...prev }
      const allDependents = getAllDependents(stepName, steps)
      for (const dependent of allDependents) {
        newConfig[dependent] = false
      }
      newConfig[stepName] = false
      return newConfig
    })
  }

  const workflowStats = {
    totalSteps: state.totalSteps,
    completedSteps: state.completedSteps,
    runningSteps: state.steps.filter((s) => s.status === 'running').length,
    failedSteps: state.steps.filter((s) => s.status === 'failed').length,
    pendingSteps: state.steps.filter((s) => s.status === 'pending').length,
  }

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <WorkflowProgress
        runId={state.runId}
        status={state.status}
        progress={state.progress}
        currentStep={state.currentStep}
        startedAt={state.startedAt}
        completedAt={state.completedAt}
        stats={workflowStats}
        error={state.error}
      />

      <Card>
        <CardHeader>
          <CardTitle>Execution Control</CardTitle>
          <CardDescription>Configure and execute the workflow steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Steps to Execute</h4>
            <div className="space-y-2">
              {steps.map((step) => {
                const isEnabled = stepConfig[step.name] || false
                const dependencies = step.definition.dependencies || []
                const hasMissingDependencies = dependencies.some((dep: string) => !stepConfig[dep])
                const isValid = !isEnabled || !hasMissingDependencies
                const allDependencies = getAllDependencies(step.name, steps)
                const allDependents = getAllDependents(step.name, steps)

                return (
                  <div
                    key={step.name}
                    className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${
                      !isValid
                        ? 'border-destructive/50 bg-destructive/5'
                        : isEnabled
                          ? 'border-primary/50 bg-primary/5'
                          : ''
                    }`}
                  >
                    <Checkbox
                      id={step.name}
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        handleStepConfigChange(step.name, checked === true)
                      }
                      disabled={state.status === 'running'}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={step.name}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {step.name}
                        </label>
                        {isEnabled && !isValid && (
                          <Badge variant="destructive" className="text-xs">
                            Missing deps
                          </Badge>
                        )}
                        {isEnabled && isValid && (
                          <Badge variant="default" className="text-xs">
                            Ready
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{step.definition.description}</p>

                      {/* Smart Selection Buttons */}
                      {state.status !== 'running' && (
                        <div className="flex gap-2">
                          {allDependencies.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectAllDependencies(step.name)}
                              className="h-6 text-xs"
                            >
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Select All Dependencies ({allDependencies.length})
                            </Button>
                          )}
                          {allDependents.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleClearAllDependents(step.name)}
                              className="h-6 text-xs"
                            >
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Clear All Dependents ({allDependents.length})
                            </Button>
                          )}
                        </div>
                      )}

                      {dependencies.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Depends on:</span>
                          {dependencies.map((dep: string) => {
                            const depEnabled = stepConfig[dep]
                            return (
                              <Badge
                                key={dep}
                                variant={depEnabled ? 'default' : 'outline'}
                                className={`text-xs ${!depEnabled && isEnabled ? 'border-destructive text-destructive' : ''}`}
                              >
                                {dep}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {state.status === 'idle' && (
              <Button
                onClick={handleExecute}
                disabled={!canExecute || state.isExecuting}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                Execute Workflow
              </Button>
            )}

            {state.status === 'running' && (
              <>
                <Button variant="outline" onClick={pauseWorkflow} className="flex-1">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={stopWorkflow} className="flex-1">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            )}

            {state.status === 'paused' && (
              <>
                <Button onClick={resumeWorkflow} className="flex-1">
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
                <Button variant="destructive" onClick={stopWorkflow} className="flex-1">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            )}

            {(state.status === 'completed' || state.status === 'failed') && (
              <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {enabledSteps.length} of {steps.length} steps selected for execution
            </div>

            {invalidSteps.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Steps with missing dependencies: {invalidSteps.map((s) => s.name).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {enabledSteps.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Please select at least one step to execute
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step Progress Display - Only show when there's execution data */}
      {state.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step Progress</CardTitle>
            <CardDescription>Detailed progress for each workflow step</CardDescription>
          </CardHeader>
          <CardContent>
            <StepProgressIndicator steps={state.steps} currentStep={state.currentStep} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
