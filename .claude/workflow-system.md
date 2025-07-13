# Workflow System Design

## Core Principles

### Code-Defined Architecture
Workflows are **source code files**, not database records. This provides:
- Version control integration
- Compile-time type checking
- Standard development workflows (review, testing, CI/CD)
- IDE support with autocomplete and refactoring

### Vue-Style Composition API
Inspired by Vue 3's composition API for familiar, declarative workflow definitions:

```typescript
export default defineWorkflow('workflow-name', ({ defineStep }) => {
  defineStep('stepName', {
    description: 'Human-readable step description',
    dependencies: ['prerequisiteStep'],
    timeout: 30000, // Optional timeout in ms
    handler: async (context) => {
      // Step implementation
    }
  })
})
```

## Technical Implementation

### Workflow Discovery System

**Location**: `src/lib/workflow-registry.ts`

**Process**:
1. Scans `src/workflows/` directory at runtime
2. Dynamically imports workflow definition files
3. Supports multiple export formats (default export, named exports)
4. Caches discovered workflows in memory
5. Provides type-safe access to workflow metadata

**Directory Structure**:
```
src/workflows/
├── minna-jp-1/                 # Workflow directory
│   ├── index.ts               # Main workflow definition (required)
│   ├── data/                  # Workflow-specific data files
│   │   ├── index.ts          # Data access layer
│   │   └── vocs.json         # Raw data files
│   ├── service/               # Business logic services
│   │   └── language.ts       # Domain-specific services
│   └── utils.ts              # Utility functions
```

### Workflow Definition API

**Location**: `src/lib/workflow-api.ts`

**Core Types**:
```typescript
interface StepDefinition {
  description: string           // Human-readable description
  dependencies?: string[]       // Prerequisites (step names)
  timeout?: number             // Execution timeout (ms)
  handler: (context: StepContext) => Promise<void>
}

interface WorkflowDefinition {
  name: string                 // Unique workflow identifier
  steps: WorkflowStepWithName[] // Ordered steps with dependencies
  metadata?: WorkflowMetadata   // Optional metadata
}

interface WorkflowMetadata {
  description?: string         // Workflow purpose
  tags?: string[]             // Categorization tags
  version?: string            // Semantic version
  author?: string             // Creator information
}
```

### Step Execution Context

**Location**: `src/lib/workflow-engine.ts`

**StepContext Interface**:
```typescript
interface StepContext {
  updateProgress(percent: number, message?: string): Promise<void>
  saveCheckpoint(data: Record<string, unknown>): Promise<void>
  loadCheckpoint(): Promise<Record<string, unknown>>
  logger: Logger
}
```

**Features**:
- **Progress Tracking**: Real-time progress updates for UI
- **Checkpointing**: Save/restore step state for resumability
- **Logging**: Structured logging with context
- **Error Handling**: Automatic error capture and reporting

### Dependency Management

**Automatic Ordering**:
- Steps automatically ordered based on dependency declarations
- Circular dependency detection prevents infinite loops
- Missing dependency validation before execution

**Recursive Resolution**:
- UI supports recursive dependency selection
- Enabling a step automatically enables all prerequisites
- Disabling a step automatically disables all dependents

**Implementation Example**:
```typescript
defineStep('processAudio', {
  dependencies: ['createLessons', 'generateContent'],
  handler: async (context) => {
    // This step only runs after both dependencies complete
    await processAudioFiles()
  }
})
```

## Database Integration

### Execution Tracking Schema

**Location**: `src/db/workflow-schema.ts`

```sql
-- Workflow run instances (not definitions)
CREATE TABLE workflow_runs (
  id INTEGER PRIMARY KEY,
  workflow_id TEXT NOT NULL,        -- References code-defined workflow name
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL,
  total_steps INTEGER NOT NULL,
  completed_steps INTEGER DEFAULT 0,
  current_step TEXT,
  config TEXT,                      -- JSON: step selection config
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Individual step execution tracking
CREATE TABLE workflow_steps (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL,          -- Foreign key to workflow_runs
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  message TEXT,
  error TEXT,
  context TEXT,                     -- JSON: step-specific context
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
);
```

### Content Schema Integration

Workflows generate content stored in domain-specific tables:

```typescript
// Knowledge content created by workflows
export const knowledgePointsTable = pgTable('knowledge_points', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),                    // vocabulary, grammar, etc.
  content: text('content').notNull(),              // Main content
  annotations: json('annotations'),                // Structured annotations
  explanation: json('explanation'),                // Multilingual explanations
  examples: json('examples').default([]),          // Usage examples
  metadata: json('metadata'),                      // Type-specific data
})

// Lesson organization
export const lessonKnowledgePointsTable = pgTable('lesson_knowledge_points', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull(),
  knowledgePointId: integer('knowledge_point_id').notNull(),
  orderInLesson: integer('order_in_lesson').notNull(),
})
```

## Workflow Engine Architecture

### State Management

**Lifecycle States**:
- `started`: Workflow initiated, preparing for execution
- `running`: Active execution in progress
- `completed`: All selected steps completed successfully
- `failed`: Execution stopped due to error
- `paused`: Manually paused by user

**Step States**:
- `pending`: Step not yet started
- `running`: Step currently executing
- `completed`: Step finished successfully
- `failed`: Step encountered error
- `skipped`: Step bypassed due to configuration

### Execution Flow

```typescript
class WorkflowEngine {
  async runWorkflow(
    definition: WorkflowDefinition,
    config: { steps: Record<string, boolean> }
  ): Promise<void> {
    // 1. Create workflow run record
    const runId = await this.createWorkflowRun(definition, config)
    
    // 2. Filter and order steps based on config and dependencies
    const selectedSteps = this.getSelectedSteps(definition, config)
    const orderedSteps = getStepsInDependencyOrder(selectedSteps)
    
    // 3. Execute steps sequentially
    for (const step of orderedSteps) {
      await this.executeStep(runId, step)
    }
    
    // 4. Mark workflow as completed
    await this.completeWorkflowRun(runId)
  }
}
```

### Resume Capability

**Checkpoint System**:
- Each step can save arbitrary checkpoint data
- Engine tracks step completion state in database
- Failed workflows can resume from last successful step
- Context data preserved across resumptions

**Implementation**:
```typescript
// In step handler
await context.saveCheckpoint({
  processedFiles: fileList,
  currentBatch: batchNumber,
  customState: additionalData
})

// On resume
const checkpointData = await context.loadCheckpoint()
const { processedFiles, currentBatch } = checkpointData
```

## User Interface Integration

### Workflow Management UI

**Pages**:
- `/workflows` - List all discovered workflows
- `/workflows/[id]` - Workflow detail and execution
- `/workflows/[id]/edit` - Step configuration (deprecated for code-defined)

**Components**:
- `execution-panel.tsx` - Step selection and execution controls
- `workflow-progress.tsx` - Real-time progress visualization
- `workflow-run-history.tsx` - Historical execution records
- `workflow-run-logs.tsx` - Detailed execution logs

### Real-Time Features

**Progress Tracking**:
- WebSocket or polling for real-time updates
- Step-by-step progress indicators
- Live log streaming
- Execution time estimates

**Interactive Controls**:
- Start/pause/stop workflow execution
- Step-by-step configuration with dependency validation
- Bulk selection operations (select all dependencies, clear dependents)
- Resume interrupted workflows

## Best Practices

### Workflow Design
1. **Small, Focused Steps**: Each step should have a single responsibility
2. **Clear Dependencies**: Explicit dependency declarations for proper ordering
3. **Progress Reporting**: Regular progress updates for long-running operations
4. **Error Handling**: Graceful error handling with detailed error messages
5. **Checkpointing**: Save state for resumable operations

### Implementation Patterns
1. **Service Layer**: Extract business logic into reusable services
2. **Data Layer**: Separate data access from workflow logic
3. **Type Safety**: Leverage TypeScript for compile-time validation
4. **Testing**: Unit test individual steps and integration test workflows
5. **Documentation**: Rich metadata and inline documentation

### Performance Considerations
1. **Async Operations**: Use async/await for I/O operations
2. **Progress Updates**: Throttle progress updates to avoid UI overload
3. **Memory Management**: Process large datasets in chunks
4. **Database Connections**: Reuse database connections where possible
5. **Error Recovery**: Implement retry logic for transient failures