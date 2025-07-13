# LangLearn: Technical Design Knowledge Base

## Index
- **Technology Stack** - [.claude/tech-stack.md](.claude/tech-stack):  Core technologies and implementation approach
- **Type-Safe Data Design** - [.claude/type-safe-data.md](.claude/type-safe-data): Detailed implementation patterns for type safety
- **Task Orchestration** - [packages/task-queue](packages/task-queue): Local SQLite-based task queue system
- **Knowledge Admin Architecture** - [.claude/knowledge-admin-architecture.md](.claude/knowledge-admin-architecture): Complete workflow management system
- **Workflow System** - [.claude/workflow-system.md](.claude/workflow-system): Code-defined workflow engine and execution
- **UI Components** - [.claude/ui-components.md](.claude/ui-components): React interface architecture and patterns

## Core Architecture
```
Knowledge Admin (Next.js) → Code-Defined Workflows → SQLite (Drizzle) → React Native (expo-sqlite)
                    ↓                        ↓
          Content Generation Pipeline    Task Queue (local orchestration)
```
- End-to-end type-safe architecture with shared schema
- Support for heterogeneous knowledge types
- Multilingual content via LocalizedText
- Offline-first design with bundled database
- Local task orchestration with SQLite-based job queue

## Technology Choices

### Package Manager
- Always use pnpm

### Database: Drizzle + SQLite
- Same tech stack across server and client
- Type-safe queries via Drizzle
- JSON fields for type-specific data
- Pre-populated SQLite database bundled with app

### Task Orchestration: @repo/task-queue
- Local SQLite-based job queue
- TypeScript-native for type safety
- Task chaining and workflow support
- Built-in retry logic and error handling
- Integrates with existing Drizzle schema

### Type Safety Stack
- Zod: Domain model validation
- Drizzle: Type-safe database schema
- TypeScript: Shared types across layers
- Mappers: Type-safe conversion between layers
- Repository: Abstract database implementation

## Knowledge Admin Implementation

### Completed Features
The Knowledge Admin (`apps/knowledge-admin`) is a fully functional Next.js application providing:

- **Code-Defined Workflows**: Vue-style composition API for workflow definitions
- **Workflow Engine**: Complete execution engine with progress tracking and resumability
- **Modern UI**: React interface with shadcn/ui components and real-time updates
- **Dependency Management**: Automatic step ordering and recursive dependency resolution
- **Execution Tracking**: SQLite-based persistence for workflow runs and progress
- **Auto-Discovery**: Dynamic workflow loading from filesystem

### Migration Achievement
Successfully consolidated `packages/knowledge-gen` into `apps/knowledge-admin`:
- ✅ Unified codebase with improved maintainability
- ✅ Enhanced type safety throughout the application
- ✅ Modern React UI replacing command-line interface
- ✅ Real-time progress tracking and workflow management
- ✅ Code-defined workflow architecture for better development experience

### Usage
```bash
cd apps/knowledge-admin
pnpm dev  # Start development server
pnpm build  # Build for production
```

## Key Patterns

### Task Queue Features
- **Type-Safe Tasks**: Full TypeScript support with Zod payload validation
- **Job Persistence**: All jobs stored in SQLite with full audit trail
- **Task Chaining**: Tasks can trigger other tasks via `context.enqueue()`
- **Workflow Grouping**: Related tasks grouped with `workflowId`
- **Priority Queues**: Higher priority jobs processed first
- **Retry Logic**: Automatic retries with exponential backoff
- **Error Handling**: Comprehensive error logging and failure tracking
- **Worker Management**: Configurable concurrency and polling

### Task Queue Integration
```typescript
// Define type-safe tasks
const generateExamplesTask: TaskDefinition<{
  knowledgePointId: string
  count: number
}> = {
  name: 'generate-examples',
  handler: async (payload, context) => {
    // Generate content
    const examples = await generateExamples(payload)
    
    // Chain to next task
    await context.enqueue('process-sentences', {
      examples
    })
  },
  schema: z.object({
    knowledgePointId: z.string(),
    count: z.number().min(1).max(20)
  })
}

// Register and run
taskQueue.define(generateExamplesTask)
await taskQueue.start()

// Trigger workflows
await taskQueue.enqueue({
  name: 'generate-examples',
  payload: { knowledgePointId: 'jp-particle-wa', count: 5 },
  options: { workflowId: 'content-batch-1', priority: 10 }
})
```

### Heterogeneous Data Approach
- Base schema with universal properties
- Type-specific data stored in JSON fields
- Strong typing and validation via Zod
- Clean mapping between domain and database

### Multilingual Support
- LocalizedText type for multilingual content
- JSON storage in database
- Type-safe access in application code

### Shared Schema
```
kurasu-manta-schema/
├── zod/       # Validation schemas
├── drizzle/   # DB schema with JSON fields
├── mappers/   # Type mapping layer
└── index.ts   # Unified exports
```

### Data Flow
1. **Server**: External/AI → Zod Validation → Domain Objects → Mappers → Drizzle → SQLite
2. **Client**: Bundled SQLite → expo-sqlite → Drizzle → Mappers → Typed Domain Objects

## Domain Extensibility
The architecture supports extending to other domains beyond language learning:

1. Define new domain-specific schemas
2. Use the same database structure with type-specific JSON
3. Maintain type safety through the mapping layer

## Content Pipeline
1. **Knowledge Admin**: Define workflows as TypeScript code in `src/workflows/`
2. **Workflow Engine**: Execute content generation workflows with dependency management
3. **Content Generation**: AI-powered creation of examples, annotations, and explanations
4. **Audio Processing**: TTS generation and audio file management
5. **Database Population**: Store generated content in SQLite with Drizzle
6. **Bundle Distribution**: Package database for mobile app distribution

### Example Workflow
```typescript
// apps/knowledge-admin/src/workflows/minna-jp-1/index.ts
export default defineWorkflow('minna-jp-1', ({ defineStep }) => {
  defineStep('init', {
    description: 'Initialize database and reset content',
    dependencies: [],
    handler: async (context) => {
      await resetDatabase()
      context.logger.info('Database initialized')
    }
  })
  
  defineStep('createLessons', {
    description: 'Process vocabulary and create lessons',
    dependencies: ['init'],
    handler: async (context) => {
      await createLessonsFromVocabulary()
      await context.updateProgress(50, 'Lessons created')
    }
  })
  
  defineStep('generateAudio', {
    description: 'Generate TTS audio for vocabulary',
    dependencies: ['createLessons'], 
    handler: async (context) => {
      await generateVocabularyAudio()
      context.logger.info('Audio generation completed')
    }
  })
})
```

## Database Bundling
1. Generate complete SQLite on server
2. Bundle with React Native app build
3. Copy to app document directory on first launch
4. Access via expo-sqlite with Drizzle

## Key Benefits
- End-to-end type safety with heterogeneous data
- Single source of truth for schema
- Multilingual support via localized text
- Extensible to multiple domains
- Simple database structure with powerful typing
- Strong validation at system boundaries
- Developer-friendly with TypeScript inference

## Development Workflow: Quality Checks

### Code Quality Verification Process
When making changes, follow this sequence to ensure code quality:

1. **Type Checking** (if needed):
   ```bash
   # Note: This project doesn't have explicit typecheck scripts
   # Type checking happens during build or via IDE
   pnpm build  # Includes type checking
   ```

2. **Lint Checking & Fixing**:
   ```bash
   pnpm lint-fix
   ```

This workflow ensures:
- Type safety is maintained across the codebase
- Code style and formatting are consistent
- Common issues are automatically fixed
- All quality gates pass before committing changes
