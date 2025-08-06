import { DailyPractice } from '@/components/DailyPractice'

export default async function Dashboard() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Daily Practice</h1>
      <DailyPractice />
    </div>
  )
}
