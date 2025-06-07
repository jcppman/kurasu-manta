import { workflowRunsTable } from '@/db/workflow-schema'
import { getDatabase } from '@/lib/db'
import { workflowDefinition } from '@/workflows/minna-jp-1'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const db = getDatabase()

    // Get recent workflow runs
    const recentRuns = await db
      .select()
      .from(workflowRunsTable)
      .orderBy(workflowRunsTable.createdAt)
      .limit(10)

    // For now, return the hardcoded workflow definition
    // In the future, this could come from a workflows registry
    const workflows = [
      {
        id: workflowDefinition.name,
        name: 'Minna no Nihongo JP-1',
        description:
          'Generate lessons and audio for Japanese vocabulary from Minna no Nihongo textbook',
        steps: workflowDefinition.steps.map((step) => ({
          name: step.name,
          description: step.definition.description,
          dependencies: step.definition.dependencies || [],
        })),
        status: 'ready',
        lastRun:
          recentRuns.find((run) => run.workflowName === workflowDefinition.name)?.createdAt || null,
        createdAt: '2024-01-01',
      },
    ]

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

    // For now, just validate that the workflow exists
    if (workflowId !== workflowDefinition.name) {
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
    console.error('Failed to execute workflow:', error)
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 })
  }
}
