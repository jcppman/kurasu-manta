import { Header } from '@/components/layout/header'

interface WorkflowLayoutProps {
  children: React.ReactNode
  params: Promise<{
    id: string
  }>
}

export default async function WorkflowLayout({ children, params }: WorkflowLayoutProps) {
  const { id } = await params
  const breadcrumbs = [{ label: 'Workflows', href: '/workflows' }, { label: id }]

  return (
    <>
      <Header breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
    </>
  )
}
