import type { Logger } from 'pino'

/**
 * Context provided to step handlers during execution
 */
export interface StepContext {
  updateProgress(percent: number, message?: string): Promise<void>
  saveCheckpoint(data: Record<string, unknown>): Promise<void>
  loadCheckpoint(): Promise<Record<string, unknown>>
  logger: Logger
}

/**
 * Definition of a single workflow step
 */
export interface StepDefinitionBase {
  /** Human-readable description of what this step does */
  description: string
  /** Array of step names that must complete before this step can run */
  dependencies?: string[]
  /** Timeout in milliseconds for step execution */
  timeout?: number
}
export interface StepDefinitionWithHandler extends StepDefinitionBase {
  /** The function that executes the step logic */
  handler: (context: StepContext) => Promise<void>
}

/**
 * Internal representation of a step with its name
 */
export interface WorkflowStepWithName<S extends StepDefinitionBase = StepDefinitionBase> {
  name: string
  definition: S
}
export type WorkflowStepWithHandler = WorkflowStepWithName<StepDefinitionWithHandler>

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  description?: string
  tags?: string[]
  version?: string
  author?: string
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition<Step extends WorkflowStepWithName = WorkflowStepWithName> {
  /** Unique name for the workflow */
  name: string
  /** All steps defined in this workflow */
  steps: Step[]
  /** Optional metadata */
  metadata?: WorkflowMetadata
}
export type WorkflowDefinitionWithHandler = WorkflowDefinition<WorkflowStepWithHandler>

/**
 * Context provided to the workflow definition function
 */
export interface WorkflowContext {
  /**
   * Define a step in the workflow
   * @param name - Unique identifier for the step
   * @param definition - Step configuration and handler
   */
  defineStep(name: string, definition: StepDefinitionWithHandler): void
}

/**
 * Vue-style workflow definition function
 *
 * @example
 * ```typescript
 * export default defineWorkflow('my-workflow', ({ defineStep }) => {
 *   defineStep('init', {
 *     description: 'Initialize database',
 *     dependencies: [],
 *     handler: async (context) => {
 *       context.logger.info('Initializing...')
 *       await initDatabase()
 *       await context.updateProgress(100, 'Database initialized')
 *     }
 *   })
 *
 *   defineStep('process', {
 *     description: 'Process data',
 *     dependencies: ['init'],
 *     timeout: 30000,
 *     handler: async (context) => {
 *       context.logger.info('Processing data...')
 *       await processData()
 *     }
 *   })
 * }, {
 *   description: 'Example workflow for processing data',
 *   tags: ['data', 'processing'],
 *   version: '1.0.0'
 * })
 * ```
 */
export function defineWorkflow(
  name: string,
  defineFn: (context: WorkflowContext) => void,
  metadata?: WorkflowMetadata
): WorkflowDefinition {
  const steps: WorkflowStepWithName[] = []
  const stepNames = new Set<string>()

  const workflowContext: WorkflowContext = {
    defineStep(stepName: string, definition: StepDefinitionWithHandler) {
      // Validate step name uniqueness
      if (stepNames.has(stepName)) {
        throw new Error(`Step '${stepName}' is already defined in workflow '${name}'`)
      }

      // Validate dependencies exist (will be checked after all steps are defined)
      if (definition.dependencies) {
        for (const dep of definition.dependencies) {
          if (dep === stepName) {
            throw new Error(`Step '${stepName}' cannot depend on itself`)
          }
        }
      }

      stepNames.add(stepName)
      steps.push({
        name: stepName,
        definition,
      })
    },
  }

  // Execute the workflow definition function
  defineFn(workflowContext)

  // Validate all dependencies exist
  for (const step of steps) {
    if (step.definition.dependencies) {
      for (const dep of step.definition.dependencies) {
        if (!stepNames.has(dep)) {
          throw new Error(
            `Step '${step.name}' depends on '${dep}', but '${dep}' is not defined in workflow '${name}'`
          )
        }
      }
    }
  }

  // Validate no circular dependencies
  validateNoCycles(steps)

  return {
    name,
    steps,
    metadata,
  }
}

/**
 * Validate that there are no circular dependencies in the workflow
 */
function validateNoCycles(steps: WorkflowStepWithName[]): void {
  const stepMap = new Map<string, string[]>()

  // Build dependency map
  for (const step of steps) {
    stepMap.set(step.name, step.definition.dependencies || [])
  }

  // Check for cycles using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(stepName: string): boolean {
    if (recursionStack.has(stepName)) {
      return true // Found a cycle
    }

    if (visited.has(stepName)) {
      return false // Already processed this path
    }

    visited.add(stepName)
    recursionStack.add(stepName)

    const dependencies = stepMap.get(stepName) || []
    for (const dep of dependencies) {
      if (hasCycle(dep)) {
        return true
      }
    }

    recursionStack.delete(stepName)
    return false
  }

  for (const step of steps) {
    if (hasCycle(step.name)) {
      throw new Error(`Circular dependency detected in workflow involving step '${step.name}'`)
    }
  }
}

/**
 * Helper function to get steps in dependency order
 * Steps with no dependencies come first, followed by steps whose dependencies are satisfied
 */
export function getStepsInDependencyOrder<S extends WorkflowStepWithName = WorkflowStepWithName>(
  steps: S[]
): S[] {
  const result: S[] = []
  const completed = new Set<string>()
  const remaining = [...steps]

  while (remaining.length > 0) {
    const readySteps = remaining.filter((step) => {
      const deps = step.definition.dependencies || []
      return deps.every((dep) => completed.has(dep))
    })

    if (readySteps.length === 0) {
      const remainingNames = remaining.map((s) => s.name).join(', ')
      throw new Error(
        `Circular dependency or missing dependency detected among steps: ${remainingNames}`
      )
    }

    // Add ready steps to result
    for (const step of readySteps) {
      result.push(step)
      completed.add(step.name)

      // Remove from remaining
      const index = remaining.indexOf(step)
      remaining.splice(index, 1)
    }
  }

  return result
}

/**
 * Get all recursive dependencies for a given step
 * @param stepName - Name of the step to analyze
 * @param steps - All workflow steps
 * @returns Array of step names that this step depends on (directly or indirectly)
 */
export function getAllDependencies(stepName: string, steps: WorkflowStepWithName[]): string[] {
  const stepMap = new Map<string, string[]>()

  // Build dependency map
  for (const step of steps) {
    stepMap.set(step.name, step.definition.dependencies || [])
  }

  const visited = new Set<string>()
  const result: string[] = []

  function collectDependencies(currentStep: string) {
    if (visited.has(currentStep)) {
      return // Avoid cycles
    }

    visited.add(currentStep)
    const deps = stepMap.get(currentStep) || []

    for (const dep of deps) {
      if (!result.includes(dep)) {
        result.push(dep)
      }
      collectDependencies(dep)
    }
  }

  collectDependencies(stepName)
  return result
}

/**
 * Get all recursive dependents for a given step
 * @param stepName - Name of the step to analyze
 * @param steps - All workflow steps
 * @returns Array of step names that depend on this step (directly or indirectly)
 */
export function getAllDependents(stepName: string, steps: WorkflowStepWithName[]): string[] {
  const dependentMap = new Map<string, string[]>()

  // Build reverse dependency map (who depends on whom)
  for (const step of steps) {
    const deps = step.definition.dependencies || []
    for (const dep of deps) {
      if (!dependentMap.has(dep)) {
        dependentMap.set(dep, [])
      }
      const dependents = dependentMap.get(dep)
      if (dependents) {
        dependents.push(step.name)
      }
    }
  }

  const visited = new Set<string>()
  const result: string[] = []

  function collectDependents(currentStep: string) {
    if (visited.has(currentStep)) {
      return // Avoid cycles
    }

    visited.add(currentStep)
    const dependents = dependentMap.get(currentStep) || []

    for (const dependent of dependents) {
      if (!result.includes(dependent)) {
        result.push(dependent)
      }
      collectDependents(dependent)
    }
  }

  collectDependents(stepName)
  return result
}
