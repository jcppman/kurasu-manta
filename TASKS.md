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

#### Task 3: Workflow Management Interface ✅
- [x] Build workflow selection and configuration UI
- [x] Create step configuration interface with checkboxes
- [x] Integrate with existing WorkflowEngine for execution
- [x] ~~Implement workflow creation and editing forms~~ **DEPRECATED**
- [x] ~~Add workflow metadata management (name, description, tags)~~ **DEPRECATED**
- [x] **COMPLETED: Implement code-defined workflow registry**
  - [x] Remove database-stored workflow definitions (`workflowsTable`)
  - [x] Remove workflow CRUD forms and API endpoints  
  - [x] Create workflow registry that scans `src/workflows/` directory
  - [x] Auto-discover workflow definitions from TypeScript files
  - [x] Enhance `defineWorkflow` API to include metadata (description, tags)
  - [x] Update API routes to return discovered workflow definitions
  - [x] Keep database only for execution tracking (`workflowRunsTable`, `workflowStepsTable`)

#### Task 4: Workflow management and progress Tracking 📊
- [ ] Create progress visualization components
- [ ] Build step-by-step progress indicators
- [ ] Add interactive controls (stop task)
- [ ] Implement error handling
- [ ] Create workflow run history interface
- [ ] Create detailed run logs interface

#### Task 5: Enhanced Recursive Task Selection in Workflow Detail Page
**Goal**: Enhance the existing step selection logic in the execution panel to provide more sophisticated recursive dependency management with improved user experience.

**Current State Analysis**:
- ✅ Basic dependency management exists in `execution-panel.tsx`
- ✅ Enabling a step automatically enables its direct dependencies  
- ✅ Disabling a step automatically disables direct dependent steps
- ✅ Visual "Missing deps" indicators for validation
- ❌ **Limitation**: Only handles direct dependencies, not recursive chains
- ❌ **Limitation**: No bulk selection operations or dependency visualization

**Enhancement Requirements**:

1. **Recursive Dependency Resolution** (Core Enhancement):
   - Extend current `handleStepConfigChange` to handle **nested dependency chains**
   - When enabling step C (depends on B, which depends on A), automatically enable A → B → C
   - When disabling step A, automatically disable all downstream dependents (B → C → etc.)

2. **Smart Selection Operations**:   
   - Add "Select All Dependencies" button for a step (recursive upward)
   - Add "Clear All Dependents" for bulk deselection (recursive downward)

**Implementation Approach**:

1. **Enhance Dependency Resolution Logic** (`execution-panel.tsx`):
   ```typescript
   // Current: Only direct dependencies
   if (enabled && step?.dependencies) {
     for (const dep of step.dependencies) {
       newConfig[dep] = true
     }
   }
   
   // Enhanced: Recursive dependency resolution
   const enableDependenciesRecursively = (stepName: string) => {
     // Implement recursive traversal up dependency chain
   }
   ```

2. **Add Dependency Analysis Utilities** (`lib/workflow-api.ts`):
   - `getAllDependencies(stepName)` - Get all recursive dependencies
   - `getAllDependents(stepName)` - Get all recursive dependents  

3. **Add Smart Selection UI** (`execution-panel.tsx`):
   - Add "Select All Dependencies" button for each step
   - Add "Clear All Dependents" button for each step
   - Integrate buttons with existing step interface

4. **Preserve Existing Functionality**:
   - Keep current dependency validation and error handling
   - Maintain existing execution flow and engine integration
   - Ensure backward compatibility with current workflow definitions

**Files to Modify**:
- `src/components/workflows/execution-panel.tsx` - Main enhancement target
- `src/lib/workflow-api.ts` - Add dependency analysis utilities  

**Success Criteria**:
- Recursive dependency chains work correctly in both directions
- Smart selection buttons function properly for all dependency scenarios
- No performance degradation with complex workflows  
- All existing workflows continue to function without changes

## Code-Defined Workflow Architecture

**Core Principle**: Workflows are **purely defined as code** and discovered at runtime, not stored in database.

### Design Benefits
1. **Version Control**: Workflow definitions tracked in git with full history
2. **Type Safety**: Full TypeScript support with compile-time validation  
3. **Code Review**: Workflow changes go through standard development process
4. **Testing**: Workflow definitions can be unit tested
5. **Deployment**: Workflows deployed with application code
6. **IDE Support**: Full autocomplete, refactoring, and debugging support

### Architecture Overview
```
src/workflows/               # Code-defined workflow directory
├── minna-jp-1/
│   ├── index.ts            # Main workflow definition
│   ├── data/               # Workflow-specific data
│   └── service/            # Workflow-specific services
├── new-workflow/
│   └── index.ts            # Another workflow
└── registry.ts             # Auto-discovery system

Runtime Discovery:
Code Files → Workflow Registry → API Routes → UI Components
```

### Database Usage
- **❌ NOT for**: Workflow definitions, metadata, step configurations
- **✅ ONLY for**: Execution tracking, run history, progress state, logs

### Vue-Style API Design

### Enhanced Workflow Definition Format

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
- ✅ **MIGRATED** to `apps/knowledge-admin/src/db/workflow-schema.ts` with `workflow_runs` and `workflow_steps` tables
- Full type safety with Drizzle schema definitions  
- JSON fields for flexible context and step data storage

**WorkflowEngine Class**:
- ✅ **MIGRATED** to `apps/knowledge-admin/src/lib/workflow-engine.ts`
- State tracking for workflow runs and individual steps
- Progress reporting with `StepContext` interface
- Checkpoint saving and loading capabilities
- Resume functionality for interrupted workflows
- Error handling and failure tracking

**Vue-Style Workflow API**:
- ✅ **MIGRATED** to `apps/knowledge-admin/src/lib/workflow-api.ts`
- Type-safe `defineWorkflow` with dependency validation
- Automatic step ordering and circular dependency detection
- Integration with WorkflowEngine

**Code-Defined Workflow Registry**:
- ✅ **IMPLEMENTED** in `apps/knowledge-admin/src/lib/workflow-registry.ts`
- Automatic discovery of workflows from `src/workflows/` directory
- Dynamic loading with support for multiple export formats
- Full metadata support (description, tags, version, author)

**Workflow Implementation**:
- ✅ **MIGRATED** to `apps/knowledge-admin/src/workflows/minna-jp-1/index.ts`
- All steps using `defineWorkflow` pattern with dependencies
- Progress tracking for lesson creation and audio generation
- Rich metadata with description, tags, version, and author

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
