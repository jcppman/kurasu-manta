'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { type WorkflowStepConfig, useWorkflowExecution } from '@/hooks/use-workflow-execution'
import { AlertCircle, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useState } from 'react'

interface WorkflowStep {
  name: string
  description: string
  dependencies: string[]
  status: string
}

interface ExecutionPanelProps {
  workflowId: string
  steps: WorkflowStep[]
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

      // If disabling a step, also disable dependent steps
      if (!enabled) {
        const dependentSteps = steps.filter((step) => step.dependencies.includes(stepName))
        for (const dependentStep of dependentSteps) {
          newConfig[dependentStep.name] = false
        }
      }

      // If enabling a step, also enable its dependencies
      if (enabled) {
        const step = steps.find((s) => s.name === stepName)
        if (step?.dependencies) {
          for (const dep of step.dependencies) {
            newConfig[dep] = true
          }
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
    const hasMissingDependencies = step.dependencies.some((dep) => !stepConfig[dep])
    return isEnabled && hasMissingDependencies
  })

  const canExecute = enabledSteps.length > 0 && state.status === 'idle' && invalidSteps.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Control</CardTitle>
        <CardDescription>Configure and execute the workflow steps</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge
              variant={
                state.status === 'running'
                  ? 'default'
                  : state.status === 'completed'
                    ? 'default'
                    : state.status === 'failed'
                      ? 'destructive'
                      : state.status === 'paused'
                        ? 'secondary'
                        : 'outline'
              }
            >
              {state.status}
            </Badge>
          </div>

          {state.status === 'running' && (
            <div className="space-y-2">
              <Progress value={state.progress} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress: {state.progress}%</span>
                {state.currentStep && <span>Current: {state.currentStep}</span>}
              </div>
            </div>
          )}

          {state.runId && (
            <div className="text-xs text-muted-foreground">Run ID: {state.runId}</div>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Step Configuration */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Steps to Execute</h4>
          <div className="space-y-2">
            {steps.map((step) => {
              const isEnabled = stepConfig[step.name] || false
              const hasMissingDependencies = step.dependencies.some((dep) => !stepConfig[dep])
              const isValid = !isEnabled || !hasMissingDependencies

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
                  <div className="flex-1 space-y-1">
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
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {step.dependencies.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Depends on:</span>
                        {step.dependencies.map((dep) => {
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
  )
}
