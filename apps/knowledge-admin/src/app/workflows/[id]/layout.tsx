import { Header } from '@/components/layout/header'

interface Workflow {
  id: string
  name: string
  description: string
}

interface WorkflowLayoutProps {
  children: React.ReactNode
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

export default async function WorkflowLayout({ children, params }: WorkflowLayoutProps) {
  const { id } = await params
  const workflow = await getWorkflow(id)

  const breadcrumbs = [{ label: 'Workflows', href: '/workflows' }, { label: workflow?.name || id }]

  return (
    <>
      <Header breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
    </>
  )
}
