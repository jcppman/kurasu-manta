import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Code2, FileText, GitBranch } from 'lucide-react'
import Link from 'next/link'

interface EditWorkflowPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditWorkflowPage({ params }: EditWorkflowPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Edit Workflow: {id}</h2>
          <p className="text-muted-foreground">
            Workflows are now code-defined and must be edited in the source code
          </p>
        </div>
      </div>

      <Alert>
        <Code2 className="h-4 w-4" />
        <AlertDescription>
          This workflow is defined as code and cannot be edited through the web interface. Please
          modify the source code directly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            How to Edit Code-Defined Workflows
          </CardTitle>
          <CardDescription>Follow these steps to modify the workflow definition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">1. Locate Workflow File</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Find the workflow definition in the source code:
                </p>
                <code className="block rounded bg-muted px-3 py-2 text-sm">
                  src/workflows/{id}/index.ts
                </code>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Code2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">2. Edit Using defineWorkflow API</h4>
                <p className="text-sm text-muted-foreground">
                  Modify the workflow using the type-safe{' '}
                  <code className="rounded bg-muted px-1 py-0.5">defineWorkflow</code> function
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <GitBranch className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">3. Version Control</h4>
                <p className="text-sm text-muted-foreground">
                  Commit your changes to git for full version history and team collaboration
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-2">Benefits of Code-Defined Workflows:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Full TypeScript type safety and IDE support</li>
              <li>• Version control with git history</li>
              <li>• Code review process for workflow changes</li>
              <li>• Unit testing capabilities</li>
              <li>• Automated deployment with CI/CD</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-4">
            <Button asChild variant="outline">
              <Link href={`/workflows/${id}`} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Workflow
              </Link>
            </Button>
            <Button asChild>
              <Link href="/workflows">View All Workflows</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
