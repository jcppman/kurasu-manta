import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkflowDefinition } from './workflow-api'

/**
 * Workflow metadata that can be included in workflow definitions
 */
export interface WorkflowMetadata {
  description?: string
  tags?: string[]
  version?: string
  author?: string
}

/**
 * Extended workflow definition with metadata
 */
export interface WorkflowWithMetadata extends WorkflowDefinition {
  metadata?: WorkflowMetadata
}

/**
 * Registry for managing code-defined workflows
 */
export class WorkflowRegistry {
  private workflows = new Map<string, WorkflowWithMetadata>()
  private readonly workflowsDir: string

  constructor(workflowsDir: string) {
    this.workflowsDir = workflowsDir
  }

  /**
   * Scan the workflows directory and load all workflow definitions
   */
  async discoverWorkflows(): Promise<void> {
    try {
      const entries = readdirSync(this.workflowsDir)

      for (const entry of entries) {
        const entryPath = join(this.workflowsDir, entry)
        const stat = statSync(entryPath)

        if (stat.isDirectory()) {
          await this.loadWorkflowFromDirectory(entry, entryPath)
        }
      }
    } catch (error) {
      console.error('Failed to discover workflows:', error)
      throw error
    }
  }

  /**
   * Load a workflow from a directory containing an index.ts file
   */
  private async loadWorkflowFromDirectory(name: string, dirPath: string): Promise<void> {
    try {
      const indexPath = join(dirPath, 'index.ts')
      const indexJsPath = join(dirPath, 'index.js')

      // Check if index file exists
      let hasIndex = false
      try {
        statSync(indexPath)
        hasIndex = true
      } catch {
        try {
          statSync(indexJsPath)
          hasIndex = true
        } catch {
          // No index file found
        }
      }

      if (!hasIndex) {
        console.warn(`No index.ts or index.js found in workflow directory: ${dirPath}`)
        return
      }

      // Dynamically import the workflow
      // Use relative path from the workflows directory for consistent imports
      const module = await import(`@/workflows/${name}`)

      // Look for workflow definition in various export formats
      let workflowDefinition: WorkflowDefinition | undefined

      if (module.workflowDefinition) {
        workflowDefinition = module.workflowDefinition
      } else if (module.default) {
        workflowDefinition = module.default
      } else {
        // Look for any exported WorkflowDefinition
        for (const exportName of Object.keys(module)) {
          const exportValue = module[exportName]
          if (
            exportValue &&
            typeof exportValue === 'object' &&
            exportValue.name &&
            exportValue.steps
          ) {
            workflowDefinition = exportValue
            break
          }
        }
      }

      if (workflowDefinition && typeof workflowDefinition === 'object') {
        const workflowWithMetadata: WorkflowWithMetadata = {
          ...workflowDefinition,
        }

        this.workflows.set(workflowDefinition.name, workflowWithMetadata)
        console.log(`Loaded workflow: ${workflowDefinition.name} from ${name}`)
      } else {
        console.warn(`No valid workflow definition found in ${dirPath}`)
      }
    } catch (error) {
      console.error(`Failed to load workflow from ${dirPath}:`, error)
    }
  }

  /**
   * Get all discovered workflows
   */
  getAllWorkflows(): WorkflowWithMetadata[] {
    return Array.from(this.workflows.values())
  }

  /**
   * Get a specific workflow by name
   */
  getWorkflow(name: string): WorkflowWithMetadata | undefined {
    return this.workflows.get(name)
  }

  /**
   * Check if a workflow exists
   */
  hasWorkflow(name: string): boolean {
    return this.workflows.has(name)
  }

  /**
   * Get workflow names
   */
  getWorkflowNames(): string[] {
    return Array.from(this.workflows.keys())
  }

  /**
   * Refresh the registry by re-scanning the workflows directory
   */
  async refresh(): Promise<void> {
    this.workflows.clear()
    await this.discoverWorkflows()
  }
}

// Global registry instance
let globalRegistry: WorkflowRegistry | null = null

/**
 * Get the global workflow registry instance
 */
export function getWorkflowRegistry(): WorkflowRegistry {
  if (!globalRegistry) {
    // In Next.js, resolve relative to the current working directory
    const workflowsDir = join(process.cwd(), 'src', 'workflows')
    globalRegistry = new WorkflowRegistry(workflowsDir)
  }
  return globalRegistry
}

/**
 * Initialize the workflow registry by discovering all workflows
 */
export async function initializeWorkflowRegistry(): Promise<WorkflowRegistry> {
  const registry = getWorkflowRegistry()
  await registry.discoverWorkflows()
  return registry
}
