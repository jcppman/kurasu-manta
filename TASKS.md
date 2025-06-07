# Knowledge Admin Implementation

## Project Overview

The Knowledge Admin is a unified Next.js application that serves as the content management and generation system for Kurasu Manta. This application will merge the existing `packages/knowledge-gen` package into `apps/knowledge-admin`, creating a comprehensive platform for:

- **Content Generation**: AI-powered workflows to generate knowledge content for mobile/web apps
- **Knowledge Point Management**: CRUD operations for knowledge points and learning materials
- **Workflow Orchestration**: Visual interface for managing content generation workflows
- **Content Review**: Tools for reviewing and editing generated content before distribution

**Migration Goal**: After completion, `packages/knowledge-gen` will be fully integrated into `apps/knowledge-admin` and the separate package will be removed.

## Current Status

**✅ Phase 1: Core Workflow Infrastructure - COMPLETED** (in packages/knowledge-gen)
- Workflow state tracking with SQLite tables (workflow-schema.ts)
- WorkflowEngine class with progress reporting and resume capability
- Vue-style `defineWorkflow` API with type safety
- Automatic step dependency validation and ordering
- Step filtering and conditional execution
- Timeout configuration and enhanced error handling
- Full migration of existing minna-jp-1 workflow to new API
- Database integration with Drizzle + SQLite

**🔄 Phase 2: Knowledge Admin Integration - IN PROGRESS**
- Merge packages/knowledge-gen into apps/knowledge-admin
- Modern web interface for workflow management
- Real-time progress tracking and monitoring
- Visual workflow designer and configuration
- Enhanced user experience with shadcn/ui components
- CRUD interfaces for knowledge points and seeds

### Next.js Knowledge Admin Implementation Tasks

#### Task 1: Project Setup and Migration ✅
- [x] Create `apps/knowledge-admin` directory with Next.js 15 project
- [x] Configure TypeScript, Tailwind CSS, and ESLint
- [x] Install and configure shadcn/ui component library
- [x] Set up project configuration and routing structure
- [x] Add knowledge-admin to workspace and build configurations
- [x] **Merge packages/knowledge-gen into apps/knowledge-admin**
  - [x] Move workflow engine and API code
  - [x] Move database schemas and migrations
  - [x] Move existing workflows (minna-jp-1)
  - [x] Update import paths and dependencies
  - [x] Remove packages/knowledge-gen package

#### Task 2: Core Knowledge Admin Foundation ✅
- [x] Create main knowledge admin layout with navigation
- [x] Implement workflow listing and management pages
- [x] Set up database integration with merged SQLite + Drizzle code
- [x] Create API routes for workflow operations
- [x] Implement basic workflow execution controls

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
- [ ] Create workflow run history interface
- [ ] Implement filtering and search functionality
- [ ] Build performance analytics and metrics
- [ ] Add export functionality for workflow data
- [ ] Create detailed run logs and debugging interface

## Vue-Style API Design

### New Workflow Definition Format

```typescript
// apps/knowledge-admin/src/workflows/minna-jp-1/index.ts (after migration)
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
// Usage in knowledge admin
import workflowDefinition from './workflows/minna-jp-1'

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
- `packages/knowledge-gen/db/workflow-schema.ts` with `workflow_runs` and `workflow_steps` tables → **TO BE MIGRATED**
- Full type safety with Drizzle schema definitions  
- JSON fields for flexible context and step data storage

**WorkflowEngine Class**:
- Core engine in `packages/knowledge-gen/src/workflow-engine.ts` → **TO BE MIGRATED**
- State tracking for workflow runs and individual steps
- Progress reporting with `StepContext` interface
- Checkpoint saving and loading capabilities
- Resume functionality for interrupted workflows
- Error handling and failure tracking

**Vue-Style Workflow API**:
- Complete implementation in `packages/knowledge-gen/src/workflow-api.ts` → **TO BE MIGRATED**
- Type-safe `defineWorkflow` with dependency validation
- Automatic step ordering and circular dependency detection
- Integration with WorkflowEngine

**Workflow Implementation**:
- `packages/knowledge-gen/workflow/minna-jp-1/index.ts` → **TO BE MIGRATED**
- All steps using `defineWorkflow` pattern with dependencies
- Progress tracking for lesson creation and audio generation

### Future Usage (Post-Migration)

```typescript
// Web interface with API routes
// GET /api/workflows - List available workflows
// POST /api/workflows/run - Execute workflow with configuration
// GET /api/workflows/{id}/status - Get real-time progress
// PATCH /api/workflows/{id} - Pause/resume/stop workflow

// Programmatic usage within knowledge admin
import { WorkflowEngine } from '@/lib/workflow-engine'
import workflowDefinition from '@/workflows/minna-jp-1'

const engine = new WorkflowEngine()
await engine.runWorkflow(workflowDefinition, {
  steps: {
    init: false,
    createLesson: true, 
    generateAudio: true
  }
})
```

## Migration Plan: packages/knowledge-gen → apps/knowledge-admin

### Current Structure (TO BE MIGRATED)
```
packages/knowledge-gen/
├── src/
│   ├── workflow-engine.ts         # ✅ Complete → apps/knowledge-admin/src/lib/workflow-engine.ts
│   └── workflow-api.ts           # ✅ Complete → apps/knowledge-admin/src/lib/workflow-api.ts
├── workflow/
│   └── minna-jp-1/
│       └── index.ts              # ✅ Complete → apps/knowledge-admin/src/workflows/minna-jp-1/index.ts
├── db/
│   ├── index.ts                  # ✅ Complete → apps/knowledge-admin/src/db/index.ts
│   ├── schema.ts                 # ✅ Complete → apps/knowledge-admin/src/db/schema.ts
│   └── workflow-schema.ts        # ✅ Complete → apps/knowledge-admin/src/db/workflow-schema.ts
├── constants.ts                  # ✅ Complete → apps/knowledge-admin/src/lib/constants.ts
└── utils.ts                      # ✅ Complete → apps/knowledge-admin/src/lib/utils.ts
```

### Target Structure (POST-MIGRATION)
```
apps/knowledge-admin/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/workflows/        # Workflow API routes
│   │   ├── workflows/            # Workflow management pages
│   │   └── knowledge/            # Knowledge point CRUD pages
│   ├── lib/
│   │   ├── workflow-engine.ts    # ← Migrated from packages/knowledge-gen
│   │   ├── workflow-api.ts       # ← Migrated from packages/knowledge-gen
│   │   ├── constants.ts          # ← Migrated from packages/knowledge-gen
│   │   └── utils.ts              # ← Migrated from packages/knowledge-gen
│   ├── db/
│   │   ├── index.ts              # ← Migrated from packages/knowledge-gen
│   │   ├── schema.ts             # ← Migrated from packages/knowledge-gen
│   │   └── workflow-schema.ts    # ← Migrated from packages/knowledge-gen
│   ├── workflows/
│   │   └── minna-jp-1/
│   │       └── index.ts          # ← Migrated from packages/knowledge-gen
│   └── components/               # React components for UI
└── package.json                  # Updated dependencies
```
