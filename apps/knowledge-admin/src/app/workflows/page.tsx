import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function WorkflowsPage() {
  // This will eventually come from the database/API
  const workflows = [
    {
      id: 'minna-jp-1',
      name: 'Minna no Nihongo JP-1',
      description:
        'Generate lessons and audio for Japanese vocabulary from Minna no Nihongo textbook',
      steps: ['init', 'createLesson', 'generateAudio'],
      status: 'ready',
      lastRun: null,
      createdAt: '2024-01-01',
    },
  ]

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
          <p className="text-muted-foreground">Manage and execute content generation workflows</p>
        </div>
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
                  <Badge variant="secondary">Last run: {workflow.lastRun}</Badge>
                ) : (
                  <Badge variant="outline">Never executed</Badge>
                )}
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
