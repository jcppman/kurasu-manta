export interface WorkflowRunConfig<Step extends string> {
  steps: Partial<Record<Step, boolean>>
}
