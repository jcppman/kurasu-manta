import { jsonField } from '@repo/kurasu-manta-schema/drizzle/utils'
import { relations } from 'drizzle-orm'
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// NOTE: workflowsTable removed - workflows are now code-defined, not database-stored

/**
 * Workflow runs table - tracks workflow execution state
 */
export const workflowRunsTable = sqliteTable('workflow_runs', {
  id: int().primaryKey({ autoIncrement: true }),
  // Reference to the workflow definition (code-defined workflow name)
  workflowId: text().notNull(),
  // Name of the workflow (for compatibility)
  workflowName: text().notNull(),
  // Current status
  status: text().notNull().$type<'started' | 'running' | 'completed' | 'failed' | 'paused'>(),
  // Total number of steps in the workflow
  totalSteps: int().notNull(),
  // Number of completed steps
  completedSteps: int().notNull().default(0),
  // Current step being executed
  currentStep: text(),
  // Workflow configuration (step flags, etc.)
  config: jsonField<Record<string, unknown>>('config'),
  // Context data for resuming workflow
  contextData: jsonField<Record<string, unknown>>('context_data'),
  // Creation timestamp
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  // Last update timestamp
  updatedAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/**
 * Workflow steps table - tracks individual step execution
 */
export const workflowStepsTable = sqliteTable('workflow_steps', {
  id: int().primaryKey({ autoIncrement: true }),
  // Reference to the workflow run
  runId: int()
    .notNull()
    .references(() => workflowRunsTable.id, { onDelete: 'cascade' }),
  // Name of the step
  stepName: text().notNull(),
  // Current status
  status: text().notNull().$type<'pending' | 'running' | 'completed' | 'failed' | 'skipped'>(),
  // Progress percentage (0-100)
  progress: int().notNull().default(0),
  // Current status message
  message: text(),
  // Step-specific data
  stepData: jsonField<Record<string, unknown>>('step_data'),
  // Error message if failed
  errorMessage: text(),
  // When step started
  startedAt: text(),
  // When step completed
  completedAt: text(),
  // Duration in milliseconds
  duration: int(),
  // Creation timestamp
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/**
 * Relations for the workflow runs table
 */
export const workflowRunsRelations = relations(workflowRunsTable, ({ many }) => ({
  steps: many(workflowStepsTable),
}))

/**
 * Relations for the workflow steps table
 */
export const workflowStepsRelations = relations(workflowStepsTable, ({ one }) => ({
  run: one(workflowRunsTable, {
    fields: [workflowStepsTable.runId],
    references: [workflowRunsTable.id],
  }),
}))
