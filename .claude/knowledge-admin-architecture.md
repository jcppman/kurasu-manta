# Knowledge Admin Architecture

## Overview

The Knowledge Admin is a unified Next.js application that serves as the content management and generation system for Kurasu Manta. It provides a comprehensive platform for AI-powered content generation, workflow orchestration, and knowledge point management.

## Core Architecture

```
Code-Defined Workflows (src/workflows/) → Workflow Engine → SQLite (Drizzle) → React Interface
                    ↓
               Content Generation Pipeline
```

## Key Components

### 1. Code-Defined Workflow System

**Philosophy**: Workflows are **purely defined as code** and discovered at runtime, not stored in database.

**Benefits**:
- Version control: Workflow definitions tracked in git
- Type safety: Full TypeScript support with compile-time validation  
- Code review: Workflow changes go through standard development process
- Testing: Workflow definitions can be unit tested
- IDE support: Full autocomplete, refactoring, and debugging

**Architecture**:
```
src/workflows/               # Code-defined workflow directory
├── minna-jp-1/
│   ├── index.ts            # Main workflow definition
│   ├── data/               # Workflow-specific data
│   └── service/            # Workflow-specific services
├── new-workflow/
│   └── index.ts            # Another workflow
└── registry.ts             # Auto-discovery system
```

### 2. Vue-Style Workflow API

Workflows use a declarative, Vue-inspired composition API:

```typescript
export default defineWorkflow('minna-jp-1', ({ defineStep }) => {
  defineStep('init', {
    description: 'Initialize database and reset content',
    dependencies: [],
    handler: async (context) => {
      context.logger.info('Initializing database...')
      await resetDatabase()
    }
  })

  defineStep('createLesson', {
    description: 'Process vocabulary data and create lessons',
    dependencies: ['init'],
    handler: async (context) => {
      // Implementation with progress tracking
      await context.updateProgress(50, 'Processing lessons...')
    }
  })
})
```

### 3. Workflow Engine

**Location**: `src/lib/workflow-engine.ts`

**Features**:
- State tracking for workflow runs and individual steps
- Progress reporting with `StepContext` interface  
- Checkpoint saving and loading capabilities
- Resume functionality for interrupted workflows
- Error handling and failure tracking
- Dependency validation and automatic ordering

### 4. Workflow Registry

**Location**: `src/lib/workflow-registry.ts`

**Features**:
- Automatic discovery of workflows from `src/workflows/` directory
- Dynamic loading with support for multiple export formats
- Full metadata support (description, tags, version, author)
- Runtime registration without database storage

### 5. Database Schema

**Execution Tracking Only** (not workflow definitions):

```typescript
// workflow-schema.ts
export const workflowRunsTable = // Track execution instances
export const workflowStepsTable = // Track step progress and results
```

**Content Management**:
```typescript  
// schema.ts
export const knowledgePointsTable = // Core learning content
export const lessonKnowledgePointsTable = // Lesson organization
```

## Data Flow

1. **Discovery**: Registry scans `src/workflows/` directory for workflow definitions
2. **Registration**: Workflows loaded into memory with full type safety
3. **Execution**: Engine runs selected workflows with step filtering
4. **Tracking**: Progress and results stored in SQLite for monitoring
5. **UI**: React interface provides real-time progress and controls

## Technology Stack

### Core Technologies
- **Next.js 15**: Modern React framework with App Router
- **TypeScript**: End-to-end type safety
- **Drizzle ORM**: Type-safe database operations
- **SQLite**: Local database for development and content generation
- **shadcn/ui**: Modern React component library
- **Tailwind CSS**: Utility-first CSS framework

### Database Architecture
- **Drizzle + SQLite**: Same tech stack across server and client
- **Type-safe queries**: Full TypeScript integration
- **JSON fields**: Flexible storage for workflow context and metadata
- **Migration support**: Schema versioning and updates

## Development Workflow

### Code Quality Process
1. **Type Checking**: Happens during build or via IDE
2. **Lint Checking & Fixing**: `pnpm lint-fix`
3. **Build Verification**: `pnpm build` (includes type checking)

### Adding New Workflows
1. Create directory in `src/workflows/[workflow-name]/`
2. Implement `index.ts` with `defineWorkflow` pattern
3. Add workflow-specific services and data in subdirectories
4. Registry automatically discovers and registers the workflow
5. UI immediately reflects new workflow availability

## Key Design Decisions

### Why Code-Defined Workflows?
- **Maintainability**: Workflows live alongside application code
- **Type Safety**: Compile-time validation and IDE support
- **Version Control**: Full git history and code review process
- **Testing**: Unit testable workflow logic
- **Deployment**: Workflows deployed with application

### Database Usage Strategy
- **❌ NOT for**: Workflow definitions, metadata, step configurations
- **✅ ONLY for**: Execution tracking, run history, progress state, logs

### Dependency Management
- Automatic step ordering based on dependencies
- Circular dependency detection and prevention
- Recursive dependency resolution for complex workflows
- Visual validation in UI with "Missing deps" indicators

## Extensibility

The architecture supports:
- Multiple workflow types and domains
- Custom step types and handlers
- Pluggable execution strategies
- External service integrations
- Custom UI components for workflow management