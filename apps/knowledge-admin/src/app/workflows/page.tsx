import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Workflow {
  id: string
  name: string
  description: string
  steps: { name: string; description: string; dependencies: string[] }[]
  status: string
  lastRun: string | null
  createdAt: string
  tags?: string[]
}

// Force dynamic rendering for this page since it fetches data
export const dynamic = 'force-dynamic'

async function getWorkflows(): Promise<Workflow[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/workflows`,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch workflows')
    }

    const data = await response.json()
    return data.workflows || []
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return []
  }
}

export default async function WorkflowsPage() {
  const workflows = await getWorkflows()

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
          <p className="text-muted-foreground">Manage and execute content generation workflows</p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">Create Workflow</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Card key={workflow.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{workflow.name}</CardTitle>
                <Badge variant={workflow.status === 'ready' ? 'default' : 'secondary'}>
                  {workflow.status}
                </Badge>
              </div>
              <CardDescription>{workflow.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{workflow.steps.length} steps</Badge>
                {workflow.lastRun ? (
                  <Badge variant="secondary">
                    Last run: {new Date(workflow.lastRun).toLocaleDateString()}
                  </Badge>
                ) : (
                  <Badge variant="outline">Never executed</Badge>
                )}
              </div>

              {workflow.tags && workflow.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">Tags:</p>
                  {workflow.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Steps:</p>
                <div className="flex flex-wrap gap-1">
                  {workflow.steps.slice(0, 3).map((step) => (
                    <Badge key={step.name} variant="secondary" className="text-xs">
                      {step.name}
                    </Badge>
                  ))}
                  {workflow.steps.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{workflow.steps.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/workflows/${workflow.id}`}>View Details</Link>
                </Button>
                <Button size="sm">Execute</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workflows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">No workflows found</p>
              <p className="text-muted-foreground">
                Workflows will appear here once they're registered in the system
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
