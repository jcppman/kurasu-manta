import { workflowRunsTable } from '@/db/workflow-schema'
import { getDatabase } from '@/lib/db'
import { getWorkflowRegistry } from '@/lib/workflow-registry'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const db = getDatabase()
    const registry = getWorkflowRegistry()

    // Ensure workflows are discovered
    await registry.discoverWorkflows()

    // Get recent workflow runs
    const recentRuns = await db
      .select()
      .from(workflowRunsTable)
      .orderBy(workflowRunsTable.createdAt)
      .limit(10)

    // Return discovered workflows
    const discoveredWorkflows = registry.getAllWorkflows()
    const workflows = discoveredWorkflows.map((workflow) => ({
      id: workflow.name,
      name: workflow.name,
      description: workflow.metadata?.description || workflow.name,
      steps: workflow.steps.map((step) => ({
        name: step.name,
        description: step.definition.description,
        dependencies: step.definition.dependencies || [],
        timeout: step.definition.timeout,
      })),
      status: 'ready',
      lastRun: recentRuns.find((run) => run.workflowId === workflow.name)?.createdAt || null,
      tags: workflow.metadata?.tags || [],
      version: workflow.metadata?.version,
      author: workflow.metadata?.author,
    }))

    return NextResponse.json({ workflows, recentRuns })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workflowId, steps } = await request.json()

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }

    const registry = getWorkflowRegistry()
    await registry.discoverWorkflows()

    // Check if workflow exists
    if (!registry.hasWorkflow(workflowId)) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // TODO: Actually execute the workflow using WorkflowEngine
    // This would involve:
    // 1. Create a new workflow run record
    // 2. Initialize WorkflowEngine
    // 3. Execute the workflow with selected steps
    // 4. Return the run ID for tracking progress

    return NextResponse.json({
      message: 'Workflow execution started',
      workflowId,
      steps: steps || {},
      // TODO: Return actual run ID
      runId: `run_${Date.now()}`,
    })
  } catch (error) {
    console.error('Failed to process workflow request:', error)
    return NextResponse.json({ error: 'Failed to process workflow request' }, { status: 500 })
  }
}
