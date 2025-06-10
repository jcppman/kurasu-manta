'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle, Clock, Download, Loader2, XCircle } from 'lucide-react'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  stepName?: string
  message: string
  data?: Record<string, unknown>
}

interface WorkflowRunLogsProps {
  runId: string | number
  workflowId: string
  logs: LogEntry[]
  isLoading?: boolean
  onRefresh?: () => void
  onExport?: () => void
}

export function WorkflowRunLogs({
  runId,
  workflowId,
  logs,
  isLoading = false,
  onRefresh,
  onExport,
}: WorkflowRunLogsProps) {
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />
    }
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <Badge variant="destructive" className="text-xs">
            Error
          </Badge>
        )
      case 'warning':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Warning</Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Info
          </Badge>
        )
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-l-red-500 bg-red-50'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50'
      default:
        return 'border-l-blue-500 bg-blue-50'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
          <CardDescription>Loading workflow execution logs...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
          <CardDescription>No logs available for this run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No log entries found</p>
            <p className="text-sm text-gray-400">
              Logs will appear here once the workflow starts executing
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Execution Logs</CardTitle>
            <CardDescription>
              Detailed logs for workflow run #{runId} in {workflowId}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 w-full">
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`}>
                <div className={`p-3 border-l-4 transition-colors ${getLevelColor(log.level)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                          </span>
                          {log.stepName && (
                            <Badge variant="outline" className="text-xs">
                              {log.stepName}
                            </Badge>
                          )}
                          {getLevelBadge(log.level)}
                        </div>
                        <p className="text-sm text-gray-700">{log.message}</p>
                        {log.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View additional data
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {index < logs.length - 1 && <Separator className="my-1" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Log Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {logs.filter((log) => log.level === 'info').length}
              </div>
              <div className="text-xs text-muted-foreground">Info Messages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {logs.filter((log) => log.level === 'warning').length}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {logs.filter((log) => log.level === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
