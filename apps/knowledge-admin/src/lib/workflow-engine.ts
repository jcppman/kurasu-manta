import initDb from '@/db'
import { workflowRunsTable, workflowStepsTable } from '@/db/workflow-schema'
import { logger } from '@/lib/server/utils'
import { and, desc, eq } from 'drizzle-orm'
import type { Logger } from 'pino'
import type { WorkflowDefinition } from './workflow-api'
import { getStepsInDependencyOrder } from './workflow-api'

export type WorkflowStatus = 'started' | 'running' | 'completed' | 'failed' | 'paused'

export interface StepContext {
  updateProgress(percent: number, message?: string): Promise<void>
  saveCheckpoint(data: Record<string, unknown>): Promise<void>
  loadCheckpoint(): Promise<Record<string, unknown>>
  logger: Logger
}

// Legacy interface for internal use only
interface WorkflowStep {
  name: string
  handler: (context: StepContext) => Promise<void>
}

export interface WorkflowResume {
  id: number
  workflowName: string
  status: WorkflowStatus
  totalSteps: number
  completedSteps: number
  currentStep: string | null
  createdAt: string
  updatedAt: string
}

export class WorkflowEngine {
  private db = initDb()
  private runId: number | null = null

  async start(
    workflowName: string,
    steps: WorkflowStep[],
    config: Record<string, unknown> = {}
  ): Promise<number> {
    // Create workflow run record
    const [workflowRun] = await this.db
      .insert(workflowRunsTable)
      .values({
        workflowId: workflowName,
        workflowName,
        status: 'started',
        totalSteps: steps.length,
        completedSteps: 0,
        config,
        contextData: {},
      })
      .returning()

    if (!workflowRun) {
      throw new Error('Failed to create workflow run')
    }

    this.runId = workflowRun.id

    // Create step records
    for (const step of steps) {
      await this.db.insert(workflowStepsTable).values({
        runId: this.runId,
        stepName: step.name,
        status: 'pending',
        progress: 0,
      })
    }

    logger.info(`Started workflow ${workflowName} with ID ${this.runId}`)
    return this.runId
  }

  async resume(runId: number): Promise<void> {
    // Verify workflow exists and can be resumed
    const [workflowRun] = await this.db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.id, runId))

    if (!workflowRun) {
      throw new Error(`Workflow run ${runId} not found`)
    }

    if (workflowRun.status === 'completed') {
      throw new Error(`Workflow run ${runId} is already completed`)
    }

    this.runId = runId
    logger.info(`Resuming workflow ${workflowRun.workflowName} with ID ${runId}`)
  }

  async executeStep(
    stepName: string,
    handler: (context: StepContext) => Promise<void>
  ): Promise<void> {
    if (!this.runId) {
      throw new Error('Workflow not started. Call start() or resume() first.')
    }

    // Find the step record
    const [step] = await this.db
      .select()
      .from(workflowStepsTable)
      .where(
        and(eq(workflowStepsTable.runId, this.runId), eq(workflowStepsTable.stepName, stepName))
      )

    if (!step) {
      throw new Error(`Step ${stepName} not found in workflow run ${this.runId}`)
    }

    // Skip if already completed
    if (step.status === 'completed') {
      logger.info(`Step ${stepName} already completed, skipping`)
      return
    }

    // Track current step for this execution

    // Update workflow status to running
    await this.db
      .update(workflowRunsTable)
      .set({
        status: 'running',
        currentStep: stepName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowRunsTable.id, this.runId))

    // Update step status to running
    await this.db
      .update(workflowStepsTable)
      .set({
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      .where(eq(workflowStepsTable.id, step.id))

    const startTime = Date.now()

    try {
      // Create step context
      const context: StepContext = {
        updateProgress: async (percent: number, message?: string) => {
          await this.updateStepProgress(step.id, percent, message)
        },
        saveCheckpoint: async (data: Record<string, unknown>) => {
          await this.saveCheckpoint(step.id, data)
        },
        loadCheckpoint: async () => {
          return await this.loadCheckpoint(step.id)
        },
        logger: logger.child({ step: stepName, runId: this.runId }),
      }

      // Execute the step
      await handler(context)

      // Mark step as completed
      const duration = Date.now() - startTime
      await this.db
        .update(workflowStepsTable)
        .set({
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
          duration,
        })
        .where(eq(workflowStepsTable.id, step.id))

      // Update workflow progress
      await this.updateWorkflowProgress()

      logger.info(`Step ${stepName} completed successfully in ${duration}ms`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Mark step as failed
      await this.db
        .update(workflowStepsTable)
        .set({
          status: 'failed',
          errorMessage,
          completedAt: new Date().toISOString(),
          duration,
        })
        .where(eq(workflowStepsTable.id, step.id))

      // Mark workflow as failed
      await this.db
        .update(workflowRunsTable)
        .set({
          status: 'failed',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workflowRunsTable.id, this.runId))

      logger.error(`Step ${stepName} failed: ${errorMessage}`)
      throw error
    }
  }

  async complete(): Promise<void> {
    if (!this.runId) {
      throw new Error('Workflow not started')
    }

    await this.db
      .update(workflowRunsTable)
      .set({
        status: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowRunsTable.id, this.runId))

    logger.info(`Workflow ${this.runId} completed successfully`)
  }

  /**
   * Run a complete workflow definition with optional step filtering
   */
  async runWorkflow(
    workflowDefinition: WorkflowDefinition,
    options: {
      steps?: Record<string, boolean>
      resumeId?: number
    } = {}
  ): Promise<number> {
    const { steps: stepConfig = {}, resumeId } = options

    // Filter steps based on configuration
    const filteredSteps = workflowDefinition.steps.filter((step) => {
      // If step config is provided, use it; otherwise include all steps
      return stepConfig[step.name] !== false
    })

    // Sort steps in dependency order
    const orderedSteps = getStepsInDependencyOrder(filteredSteps)

    // Validate dependencies are satisfied for filtered steps
    const availableSteps = new Set(orderedSteps.map((s) => s.name))
    for (const step of orderedSteps) {
      const missingDeps = (step.definition.dependencies || []).filter(
        (dep) => !availableSteps.has(dep)
      )
      if (missingDeps.length > 0) {
        throw new Error(
          `Step '${step.name}' has dependencies [${missingDeps.join(', ')}] that are not included in the execution plan`
        )
      }
    }

    // Convert to legacy WorkflowStep format for existing engine
    const workflowSteps = orderedSteps.map((step) => ({
      name: step.name,
      handler: step.definition.handler,
    }))

    // Start or resume workflow
    if (resumeId) {
      await this.resume(resumeId)
    } else {
      await this.start(workflowDefinition.name, workflowSteps)
    }

    // Execute steps with timeout support
    for (const step of orderedSteps) {
      try {
        if (step.definition.timeout) {
          await this.executeStepWithTimeout(
            step.name,
            step.definition.handler,
            step.definition.timeout
          )
        } else {
          await this.executeStep(step.name, step.definition.handler)
        }
      } catch (error) {
        logger.error(`Workflow failed at step '${step.name}': ${error}`)
        throw error
      }
    }

    await this.complete()
    logger.info(`Workflow '${workflowDefinition.name}' completed successfully`)

    if (!this.runId) {
      throw new Error('Run ID not available')
    }

    return this.runId
  }

  /**
   * Execute a step with timeout support
   */
  private async executeStepWithTimeout(
    stepName: string,
    handler: (context: StepContext) => Promise<void>,
    timeoutMs: number
  ): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step '${stepName}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    await Promise.race([this.executeStep(stepName, handler), timeoutPromise])
  }

  /**
   * Get workflow definition metadata
   */
  getWorkflowInfo(workflowDefinition: WorkflowDefinition): {
    name: string
    totalSteps: number
    stepNames: string[]
    dependencies: Record<string, string[]>
  } {
    return {
      name: workflowDefinition.name,
      totalSteps: workflowDefinition.steps.length,
      stepNames: workflowDefinition.steps.map((s) => s.name),
      dependencies: Object.fromEntries(
        workflowDefinition.steps.map((s) => [s.name, s.definition.dependencies || []])
      ),
    }
  }

  async getAvailableResumes(): Promise<WorkflowResume[]> {
    const runs = await this.db
      .select({
        id: workflowRunsTable.id,
        workflowName: workflowRunsTable.workflowName,
        status: workflowRunsTable.status,
        totalSteps: workflowRunsTable.totalSteps,
        completedSteps: workflowRunsTable.completedSteps,
        currentStep: workflowRunsTable.currentStep,
        createdAt: workflowRunsTable.createdAt,
        updatedAt: workflowRunsTable.updatedAt,
      })
      .from(workflowRunsTable)
      .where(
        and(
          eq(workflowRunsTable.status, 'running')
          // Only show runs from last 7 days
          // Note: SQLite date comparison - you might want to adjust this
        )
      )
      .orderBy(desc(workflowRunsTable.updatedAt))

    return runs
  }

  private async updateStepProgress(
    stepId: number,
    percent: number,
    message?: string
  ): Promise<void> {
    await this.db
      .update(workflowStepsTable)
      .set({
        progress: Math.min(100, Math.max(0, percent)),
        message,
      })
      .where(eq(workflowStepsTable.id, stepId))
  }

  private async saveCheckpoint(stepId: number, data: Record<string, unknown>): Promise<void> {
    await this.db
      .update(workflowStepsTable)
      .set({
        stepData: data,
      })
      .where(eq(workflowStepsTable.id, stepId))
  }

  private async loadCheckpoint(stepId: number): Promise<Record<string, unknown>> {
    const [step] = await this.db
      .select({ stepData: workflowStepsTable.stepData })
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.id, stepId))

    return step?.stepData || {}
  }

  private async updateWorkflowProgress(): Promise<void> {
    if (!this.runId) return

    // Count completed steps
    const [result] = await this.db
      .select({
        completedCount: workflowStepsTable.id,
      })
      .from(workflowStepsTable)
      .where(
        and(eq(workflowStepsTable.runId, this.runId), eq(workflowStepsTable.status, 'completed'))
      )

    const completedSteps = result?.completedCount || 0

    await this.db
      .update(workflowRunsTable)
      .set({
        completedSteps,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowRunsTable.id, this.runId))
  }
}
