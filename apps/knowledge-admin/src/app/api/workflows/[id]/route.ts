import { workflowRunsTable } from '@/db/workflow-schema'
import { getDatabase } from '@/lib/db'
import { WorkflowEngine } from '@/lib/workflow-engine'
import { getWorkflowRegistry } from '@/lib/workflow-registry'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

interface Context {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params
    const registry = getWorkflowRegistry()
    await registry.discoverWorkflows()

    // Check if workflow exists
    const workflowDefinition = registry.getWorkflow(id)
    if (!workflowDefinition) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const db = getDatabase()

    // Get recent runs for this workflow
    const recentRuns = await db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.workflowId, id))
      .orderBy(workflowRunsTable.createdAt)
      .limit(5)

    const workflow = {
      id: workflowDefinition.name,
      name: workflowDefinition.name,
      description: workflowDefinition.metadata?.description || workflowDefinition.name,
      steps: workflowDefinition.steps.map((step) => ({
        name: step.name,
        description: step.definition.description,
        dependencies: step.definition.dependencies || [],
        timeout: step.definition.timeout,
        status: 'ready',
      })),
      status: 'ready',
      lastRun: recentRuns[0]?.createdAt || null,
      tags: workflowDefinition.metadata?.tags || [],
      version: workflowDefinition.metadata?.version,
      author: workflowDefinition.metadata?.author,
      recentRuns,
    }

    return NextResponse.json({ workflow })
  } catch (error) {
    console.error('Failed to fetch workflow:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params
    const { action, steps } = await request.json()

    if (action === 'execute') {
      const registry = getWorkflowRegistry()
      await registry.discoverWorkflows()

      // Check if workflow exists
      const workflowDefinition = registry.getWorkflowForExecution(id)
      if (!workflowDefinition) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      try {
        const engine = new WorkflowEngine()

        // For now, execute the workflow synchronously
        // In production, you'd want to run this in a worker/queue
        const runId = await engine.runWorkflow(workflowDefinition, { steps })

        return NextResponse.json({
          message: 'Workflow execution completed',
          workflowId: id,
          steps: steps || {},
          runId: `run_${runId}`,
        })
      } catch (error) {
        console.error('Failed to execute workflow:', error)
        return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to execute workflow action:', error)
    return NextResponse.json({ error: 'Failed to execute workflow action' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params

  // Code-defined workflows cannot be edited via API
  return NextResponse.json(
    { error: 'Code-defined workflows cannot be edited via API. Please modify the source code.' },
    { status: 403 }
  )
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { id } = await params

  // Code-defined workflows cannot be deleted via API
  return NextResponse.json(
    { error: 'Code-defined workflows cannot be deleted via API. Please remove the source code.' },
    { status: 403 }
  )
}
