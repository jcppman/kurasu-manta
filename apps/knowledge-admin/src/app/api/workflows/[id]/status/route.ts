import { workflowRunsTable, workflowStepsTable } from '@/db/workflow-schema'
import { getDatabase } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

interface Context {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const runId = url.searchParams.get('runId')

    if (!runId) {
      return NextResponse.json({ error: 'runId parameter is required' }, { status: 400 })
    }

    const db = getDatabase()

    // Get the workflow run
    const run = await db
      .select()
      .from(workflowRunsTable)
      .where(
        and(
          eq(workflowRunsTable.id, Number.parseInt(runId.replace('run_', ''))),
          eq(workflowRunsTable.workflowName, id)
        )
      )
      .limit(1)

    if (!run.length) {
      return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 })
    }

    // Get the workflow steps
    const steps = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.runId, run[0].id))

    const completedStepsCount = steps.filter((step) => step.status === 'completed').length
    const totalStepsCount = steps.length
    const overallProgress =
      totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0

    // If there's a running step, add its progress to the overall calculation
    const runningStep = steps.find((step) => step.status === 'running')
    const adjustedProgress =
      runningStep && totalStepsCount > 0
        ? Math.round(((completedStepsCount + runningStep.progress / 100) / totalStepsCount) * 100)
        : overallProgress

    const status = {
      runId,
      workflowId: id,
      status: run[0].status,
      progress: adjustedProgress,
      totalSteps: totalStepsCount,
      completedSteps: completedStepsCount,
      currentStep: run[0].currentStep,
      error: steps.find((step) => step.status === 'failed')?.errorMessage || null,
      startedAt: run[0].createdAt,
      completedAt: run[0].status === 'completed' ? run[0].updatedAt : null,
      steps: steps.map((step) => ({
        name: step.stepName,
        status: step.status,
        progress: step.progress,
        message: step.message,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        duration: step.duration,
        error: step.errorMessage,
      })),
    }

    return NextResponse.json({ status })
  } catch (error) {
    console.error('Failed to fetch workflow status:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow status' }, { status: 500 })
  }
}
