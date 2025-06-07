import { Header } from '@/components/layout/header'

interface WorkflowsLayoutProps {
  children: React.ReactNode
}

export default function WorkflowsLayout({ children }: WorkflowsLayoutProps) {
  const breadcrumbs = [{ label: 'Workflows' }]

  return (
    <>
      <Header breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
    </>
  )
}
