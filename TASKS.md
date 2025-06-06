# Knowledge-Gen Next.js Dashboard Implementation

## Current Status

**✅ Phase 1: Core Workflow Infrastructure - COMPLETED**
- Workflow state tracking with SQLite tables (workflow-schema.ts)
- WorkflowEngine class with progress reporting and resume capability
- Vue-style `defineWorkflow` API with type safety
- Automatic step dependency validation and ordering
- Step filtering and conditional execution
- Timeout configuration and enhanced error handling
- Full migration of existing minna-jp-1 workflow to new API
- Database integration with Drizzle + SQLite

**🔄 Phase 2: Next.js Dashboard - IN PROGRESS**
- Modern web interface for workflow management
- Real-time progress tracking and monitoring
- Visual workflow designer and configuration
- Enhanced user experience with shadcn/ui components

### Next.js Dashboard Implementation Tasks

#### Task 1: Project Setup and Structure 🔄
- [x] Create `apps/dashboard` directory with Next.js 15 project
- [x] Configure TypeScript, Tailwind CSS, and ESLint
- [ ] Install and configure shadcn/ui component library
- [x] Set up project configuration and routing structure
- [x] Add dashboard to workspace and build configurations

#### Task 2: Core Dashboard Foundation 📋
- [ ] Create main dashboard layout with navigation
- [ ] Implement workflow listing and management pages
- [ ] Set up database integration with existing SQLite + Drizzle
- [ ] Create API routes for workflow operations
- [ ] Implement basic workflow execution controls

#### Task 3: Workflow Management Interface 🎯
- [ ] Build workflow selection and configuration UI
- [ ] Create step configuration interface with checkboxes
- [ ] Implement workflow creation and editing forms
- [ ] Add workflow metadata management (name, description, tags)
- [ ] Integrate with existing WorkflowEngine for execution

#### Task 4: Real-time Progress Tracking 📊
- [ ] Implement WebSocket/SSE for real-time updates
- [ ] Create progress visualization components
- [ ] Build step-by-step progress indicators
- [ ] Add interactive controls (pause/resume/stop)
- [ ] Implement error handling and recovery UI

#### Task 5: Workflow History and Analytics 📈
- [ ] Create workflow run history dashboard
- [ ] Implement filtering and search functionality
- [ ] Build performance analytics and metrics
- [ ] Add export functionality for workflow data
- [ ] Create detailed run logs and debugging interface

#### Task 6: Enhanced User Experience 🎨
- [ ] Implement responsive design for mobile/tablet
- [ ] Add dark/light theme support
- [ ] Create workflow templates and favorites
- [ ] Build notification system for workflow events
- [ ] Add keyboard shortcuts and accessibility features

## Vue-Style API Design

### New Workflow Definition Format

```typescript
// packages/knowledge-gen/workflow/minna-jp-1/index.ts
export default defineWorkflow('minna-jp-1', ({ defineStep }) => {
  defineStep('init', {
    description: 'Initialize database and reset content',
    dependencies: [],
    handler: async (context) => {
      context.logger.info('Initializing database...')
      await resetDatabase()
      context.logger.info('Database initialization completed')
    }
  })

  defineStep('createLesson', {
    description: 'Process vocabulary data and create lessons',
    dependencies: ['init'],
    handler: async (context) => {
      context.logger.info('Creating lessons...')
      const data = getData()
      
      // Implementation with progress tracking
      for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
        if (lessonNumber > 25) continue
        
        await createLesson(lessonNumber, lessonVocabularies)
        const progress = Math.round((completedLessons / totalLessons) * 100)
        await context.updateProgress(progress, `Processed lesson ${lessonNumber}`)
      }
    }
  })

  defineStep('generateAudio', {
    description: 'Generate TTS audio files for vocabulary',
    dependencies: ['createLesson'],
    handler: async (context) => {
      context.logger.info('Generating audio clips...')
      await generateVocabularyAudioClips(context)
      context.logger.info('Audio generation completed')
    }
  })
})
```

### Core API Types

```typescript
// src/workflow-api.ts
interface WorkflowContext {
  defineStep(name: string, definition: StepDefinition): void
}

interface StepDefinition {
  description: string
  dependencies?: string[]
  timeout?: number
  handler: (context: StepContext) => Promise<void>
}

interface WorkflowDefinition {
  name: string
  steps: Array<{
    name: string
    definition: StepDefinition
  }>
}

function defineWorkflow(
  name: string,
  defineFn: (context: WorkflowContext) => void
): WorkflowDefinition
```

### Enhanced Workflow Execution

```typescript
// Usage in main entry point
import workflowDefinition from './workflow/minna-jp-1'

const engine = new WorkflowEngine()
await engine.runWorkflow(workflowDefinition, {
  steps: {
    init: false,
    createLesson: true,
    generateAudio: true
  }
})
```

### Benefits

1. **Declarative**: Clear separation between workflow definition and execution
2. **Type-Safe**: Full TypeScript support with auto-completion
3. **Dependency Management**: Built-in step dependency validation
4. **Metadata Rich**: Steps include descriptions, timeouts, and dependencies
5. **Conditional Execution**: Framework handles step filtering based on config
6. **Vue-Style**: Familiar composition API pattern for developers
7. **Extensible**: Easy to add new step properties and features

## Current Implementation Status

### ✅ Core Infrastructure Complete

**Workflow State Persistence Schema**: 
- `packages/knowledge-gen/db/workflow-schema.ts` with `workflow_runs` and `workflow_steps` tables
- Full type safety with Drizzle schema definitions  
- JSON fields for flexible context and step data storage

**WorkflowEngine Class**:
- Core engine in `packages/knowledge-gen/src/workflow-engine.ts`
- State tracking for workflow runs and individual steps
- Progress reporting with `StepContext` interface
- Checkpoint saving and loading capabilities
- Resume functionality for interrupted workflows
- Error handling and failure tracking

**Vue-Style Workflow API**:
- Complete implementation in `packages/knowledge-gen/src/workflow-api.ts`
- Type-safe `defineWorkflow` with dependency validation
- Automatic step ordering and circular dependency detection
- Integration with WorkflowEngine

**Workflow Implementation**:
- `packages/knowledge-gen/workflow/minna-jp-1/index.ts` fully migrated to new API
- All steps using `defineWorkflow` pattern with dependencies
- Progress tracking for lesson creation and audio generation

### ❌ Missing Components

**CLI Interface**: 
- Main entry point `packages/knowledge-gen/index.ts` has been deleted
- No command-line interface for workflow execution or management
- Engine functions as library only, requires programmatic usage

### Current Usage (Programmatic Only)

```typescript
// No CLI - must import and use directly
import { WorkflowEngine } from './src/workflow-engine'
import workflowDefinition from './workflow/minna-jp-1'

const engine = new WorkflowEngine()
await engine.runWorkflow(workflowDefinition, {
  steps: {
    init: false,
    createLesson: true, 
    generateAudio: true
  }
})
```

## Actual Project Structure

```
packages/knowledge-gen/
├── src/
│   ├── workflow-engine.ts         # ✅ Complete with state persistence
│   └── workflow-api.ts           # ✅ Vue-style API implemented
├── workflow/
│   └── minna-jp-1/
│       └── index.ts              # ✅ Migrated to defineWorkflow
├── db/
│   ├── index.ts                  # ✅ Database connection
│   ├── schema.ts                 # ✅ Main schema exports
│   └── workflow-schema.ts        # ✅ Workflow state tables
├── constants.ts                  # ✅ Environment configuration
└── utils.ts                      # ✅ Logger utilities
```
