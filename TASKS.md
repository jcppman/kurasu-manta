# Knowledge-Gen Next.js Dashboard Implementation

## Current Status

**✅ Phase 1: State Persistence Foundation - COMPLETED**
- Workflow state tracking with SQLite tables
- WorkflowEngine class with progress reporting
- Basic CLI improvements (--resume, --list-resumes)
- Full backward compatibility maintained

**✅ Vue-Style Workflow API - COMPLETED**
- Vue-style `defineWorkflow` API with type safety
- Automatic step dependency validation and ordering
- Step filtering and conditional execution
- Timeout configuration and enhanced error handling
- Full migration of existing minna-jp-1 workflow
- Backward compatibility maintained

**🔄 Phase 2: Next.js Dashboard - IN PROGRESS**
- Modern web interface for workflow management
- Real-time progress tracking and monitoring
- Visual workflow designer and configuration
- Enhanced user experience with shadcn/ui components

### Next.js Dashboard Implementation Tasks

#### Task 1: Project Setup and Structure 🔄
- [ ] Create `apps/dashboard` directory with Next.js 15 project
- [ ] Configure TypeScript, Tailwind CSS, and ESLint
- [ ] Install and configure shadcn/ui component library
- [ ] Set up project configuration and routing structure
- [ ] Add dashboard to workspace and build configurations

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

## Future Phases (After Vue-Style API)

### Phase 2: Interactive CLI with Ink
- Setup Ink infrastructure for React-like CLI components
- Build workflow selection UI with interactive menus
- Step configuration interface with checkboxes
- Integration with WorkflowEngine for execution

### Phase 3: Live Progress Display
- Real-time progress tracking components with Ink
- Overall workflow and step-by-step progress bars
- Interactive controls (pause/resume/quit)
- Enhanced error display with recovery options

## Current Implementation Status

### ✅ Completed (Phase 1)

**Workflow State Persistence Schema**: 
- Created `packages/knowledge-gen/db/workflow-schema.ts` with `workflow_runs` and `workflow_steps` tables
- Full type safety with Drizzle schema definitions
- JSON fields for flexible context and step data storage

**WorkflowEngine Class**:
- Core engine in `packages/knowledge-gen/src/workflow-engine.ts`
- State tracking for workflow runs and individual steps
- Progress reporting with `StepContext` interface
- Checkpoint saving and loading capabilities
- Resume functionality for interrupted workflows
- Error handling and failure tracking

**Enhanced Workflow Integration**:
- Modified `packages/knowledge-gen/workflow/minna-jp-1/index.ts` to use WorkflowEngine
- Added progress tracking for lesson creation and audio generation
- Maintained backward compatibility with existing step configuration
- Type-safe step handlers with context

**Basic CLI Enhancements**:
- Modified `packages/knowledge-gen/index.ts` to support command line arguments
- Added `--list-resumes` to show available workflows to resume
- Added `--resume <id>` to resume specific workflow runs
- Better error handling and logging

### Current Capabilities
- Workflows can be interrupted and their state is preserved in SQLite
- Real-time progress tracking during workflow execution
- Step-level granular progress reporting
- CLI commands to list and resume interrupted workflows
- Full backward compatibility with existing manual step configuration

### CLI Usage
```bash
# Normal execution (unchanged)
pnpm r

# List available workflows to resume  
pnpm r -- --list-resumes

# Resume specific workflow by ID
pnpm r -- --resume 123
```

## Project Structure

```
packages/knowledge-gen/
├── src/
│   ├── workflow-engine.ts         # ✅ State persistence engine
│   └── workflow-api.ts           # 🔄 NEXT: Vue-style API
├── workflow/
│   ├── types.ts                  # Current workflow types
│   └── minna-jp-1/
│       └── index.ts              # 🔄 NEXT: Convert to defineWorkflow
├── db/
│   ├── schema.ts                 # Main schema exports
│   └── workflow-schema.ts        # ✅ Workflow state tables
└── index.ts                      # ✅ CLI with resume support
```