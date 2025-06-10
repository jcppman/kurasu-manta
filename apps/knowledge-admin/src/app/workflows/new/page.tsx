import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Code2, FileText, Zap } from 'lucide-react'
import Link from 'next/link'

export default function NewWorkflowPage() {
  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create New Workflow</h2>
          <p className="text-muted-foreground">
            Workflows are now code-defined for better version control and type safety
          </p>
        </div>
      </div>

      <Alert>
        <Code2 className="h-4 w-4" />
        <AlertDescription>
          Workflows are now purely defined as code in TypeScript files. They cannot be created
          through the web interface.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Code-Defined Workflows
          </CardTitle>
          <CardDescription>
            To create a new workflow, you need to define it as a TypeScript file in the codebase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">1. Create Workflow Directory</h4>
                <p className="text-sm text-muted-foreground">
                  Create a new directory in{' '}
                  <code className="rounded bg-muted px-1 py-0.5">src/workflows/</code>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Code2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">2. Define Workflow</h4>
                <p className="text-sm text-muted-foreground">
                  Create an <code className="rounded bg-muted px-1 py-0.5">index.ts</code> file
                  using the <code className="rounded bg-muted px-1 py-0.5">defineWorkflow</code> API
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">3. Auto-Discovery</h4>
                <p className="text-sm text-muted-foreground">
                  The workflow will be automatically discovered and available in the admin interface
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-2">Example Workflow Structure:</h4>
            <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto">
              {`src/workflows/
├── my-workflow/
│   ├── index.ts          # Workflow definition
│   ├── data/            # Workflow-specific data
│   └── service/         # Workflow-specific services
└── another-workflow/
    └── index.ts`}
            </pre>
          </div>

          <div className="flex gap-2 pt-4">
            <Button asChild variant="outline">
              <Link href="/workflows" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Workflows
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
