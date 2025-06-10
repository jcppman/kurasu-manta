import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteWorkflowButton } from '@/components/workflows/delete-workflow-button'
import { ExecutionPanel } from '@/components/workflows/execution-panel'
import { WorkflowRunHistory } from '@/components/workflows/workflow-run-history'
import type { WorkflowStepWithName } from '@/lib/workflow-api'
import { CheckCircle, Clock, Play, Settings } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Force dynamic rendering for this page since it fetches data
export const dynamic = 'force-dynamic'

interface WorkflowStep {
  name: string
  description: string
  dependencies: string[]
  status: string
  timeout?: number
}

interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  status: string
  lastRun: string | null
  createdAt: string
  tags?: string[]
  recentRuns?: Array<{
    id: number
    status: string
    createdAt: string
    completedSteps: number
    totalSteps: number
  }>
}

interface WorkflowDetailPageProps {
  params: Promise<{
    id: string
  }>
}

async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/workflows/${id}`,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch workflow')
    }

    const data = await response.json()
    return data.workflow
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return null
  }
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params
  const workflow = await getWorkflow(id)

  if (!workflow) {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{workflow.name}</h2>
          <p className="text-muted-foreground">{workflow.description}</p>
          {workflow.tags && workflow.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {workflow.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/workflows/${workflow.id}/edit`}>
              <Settings className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <DeleteWorkflowButton
            workflowId={workflow.id}
            workflowName={workflow.name}
            isBuiltIn={true}
          />
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Execute Workflow
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{workflow.status}</div>
            <p className="text-xs text-muted-foreground">
              {workflow.lastRun ? `Last run: ${workflow.lastRun}` : 'Never executed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflow.steps.length}</div>
            <p className="text-xs text-muted-foreground">Total workflow steps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflow.createdAt}</div>
            <p className="text-xs text-muted-foreground">Workflow created</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExecutionPanel
          workflowId={workflow.id}
          steps={workflow.steps.map(
            (step): WorkflowStepWithName => ({
              name: step.name,
              definition: {
                description: step.description,
                dependencies: step.dependencies,
                timeout: step.timeout,
                handler: async () => {}, // Not used in UI
              },
            })
          )}
        />

        <WorkflowRunHistory
          runs={(workflow.recentRuns || []).map((run) => ({
            ...run,
            status: run.status as 'running' | 'completed' | 'failed' | 'paused',
          }))}
          workflowId={workflow.id}
        />
      </div>
    </div>
  )
}
