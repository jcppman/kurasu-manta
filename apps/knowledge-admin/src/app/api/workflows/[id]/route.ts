import { workflowRunsTable, workflowStepsTable } from '@/db/workflow-schema'
import { getDatabase } from '@/lib/db'
import { workflowDefinition } from '@/workflows/minna-jp-1'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

interface Context {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params

    // For now, only support the minna-jp-1 workflow
    if (id !== workflowDefinition.name) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const db = getDatabase()

    // Get recent runs for this workflow
    const recentRuns = await db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.workflowName, id))
      .orderBy(workflowRunsTable.createdAt)
      .limit(5)

    const workflow = {
      id: workflowDefinition.name,
      name: 'Minna no Nihongo JP-1',
      description:
        'Generate lessons and audio for Japanese vocabulary from Minna no Nihongo textbook',
      steps: workflowDefinition.steps.map((step) => ({
        name: step.name,
        description: step.definition.description,
        dependencies: step.definition.dependencies || [],
        status: 'ready',
      })),
      status: 'ready',
      lastRun: recentRuns[0]?.createdAt || null,
      createdAt: '2024-01-01',
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

    if (id !== workflowDefinition.name) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (action === 'execute') {
      // TODO: Actually execute the workflow using WorkflowEngine
      // This is where we would:
      // 1. Import and initialize WorkflowEngine
      // 2. Call engine.runWorkflow(workflowDefinition, { steps })
      // 3. Return the run ID for progress tracking

      return NextResponse.json({
        message: 'Workflow execution started',
        workflowId: id,
        steps: steps || {},
        runId: `run_${Date.now()}`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to execute workflow action:', error)
    return NextResponse.json({ error: 'Failed to execute workflow action' }, { status: 500 })
  }
}
