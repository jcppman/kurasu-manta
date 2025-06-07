import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ExecutionPanel } from '@/components/workflows/execution-panel'
import { CheckCircle, Clock, Play } from 'lucide-react'
import { notFound } from 'next/navigation'

interface WorkflowDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  // This will eventually come from the database/API
  const getWorkflow = (id: string) => {
    if (id === 'minna-jp-1') {
      return {
        id: 'minna-jp-1',
        name: 'Minna no Nihongo JP-1',
        description:
          'Generate lessons and audio for Japanese vocabulary from Minna no Nihongo textbook',
        steps: [
          {
            name: 'init',
            description: 'Initialize database and reset content',
            dependencies: [],
            status: 'ready',
          },
          {
            name: 'createLesson',
            description: 'Process vocabulary data and create lessons',
            dependencies: ['init'],
            status: 'ready',
          },
          {
            name: 'generateAudio',
            description: 'Generate TTS audio files for vocabulary',
            dependencies: ['createLesson'],
            status: 'ready',
          },
        ],
        status: 'ready',
        lastRun: null,
        createdAt: '2024-01-01',
      }
    }
    return null
  }

  const { id } = await params
  const workflow = getWorkflow(id)

  if (!workflow) {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{workflow.name}</h2>
          <p className="text-muted-foreground">{workflow.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Configure</Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
          <CardDescription>Configure which steps to execute in this workflow run</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflow.steps.map((step, index) => (
            <div key={step.name}>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{step.name}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {step.dependencies.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Depends on:</span>
                        {step.dependencies.map((dep) => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={step.status === 'ready' ? 'default' : 'secondary'}>
                    {step.status === 'ready' && <CheckCircle className="mr-1 h-3 w-3" />}
                    {step.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                    {step.status}
                  </Badge>
                </div>
              </div>
              {index < workflow.steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <div className="w-px h-4 bg-border" />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ExecutionPanel workflowId={workflow.id} steps={workflow.steps} />

        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Recent workflow executions and their results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No execution history</p>
              <p className="text-sm">Previous runs will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
