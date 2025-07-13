# Knowledge Admin Architecture

## Overview

The Knowledge Admin is a simplified TypeScript-based content generation system for Kurasu Manta. After removing the over-engineered workflow engine and dashboard, it now focuses on direct script execution for business logic.

## Core Architecture

```
TypeScript Scripts (src/workflows/) → Direct Function Execution → SQLite (Drizzle) → Database Output
                    ↓
               Content Generation Pipeline
```

## Design Philosophy

**Simplicity Over Complexity**: Focus on actual content generation rather than orchestration overhead.

**Benefits**:
- **Direct Execution**: Scripts run directly without complex workflow management
- **Better Maintainability**: Reduced complexity makes debugging and modification easier
- **Type Safety**: Full TypeScript support throughout
- **Business Logic Focus**: No UI overhead, concentrate on content generation
- **Simple Function Calls**: Direct function invocation instead of complex step orchestration

## Current Structure

```
apps/knowledge-admin/
├── src/
│   ├── workflows/               # Content generation scripts
│   │   └── minna-jp-1/
│   │       ├── index.ts        # Main execution script
│   │       ├── data/           # Workflow-specific data
│   │       └── service/        # Business logic services
│   ├── db/
│   │   └── schema.ts           # Database schema (Drizzle)
│   └── lib/
│       └── server/
│           └── utils.ts        # Shared utilities
└── package.json                # Dependencies and scripts
```

## Key Components

### 1. Direct Script Execution

**Philosophy**: Simple TypeScript functions that execute content generation logic directly.

```typescript
// apps/knowledge-admin/src/workflows/minna-jp-1/index.ts
export async function execute() {
  await cleanVocabularies()
  await createLessons()
  // await generateVocabularyAudioClips()
}

// Direct execution - no complex orchestration
if (require.main === module) {
  execute()
    .then(() => {
      logger.info('Workflow completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Workflow failed:', error)
      process.exit(1)
    })
}
```

### 2. Content Generation Services

**Location**: `src/workflows/[workflow-name]/service/`

**Features**:
- **Language Processing**: POS tagging, vocabulary analysis
- **Audio Generation**: TTS for vocabulary pronunciation
- **AI Integration**: OpenAI for content generation
- **Database Operations**: Direct Drizzle ORM usage

### 3. Database Schema

**Content Management**:
```typescript  
// schema.ts
export const knowledgePointsTable = // Core learning content
export const lessonKnowledgePointsTable = // Lesson organization
```

**Simple Data Flow**:
1. **Script Execution**: Direct TypeScript function calls
2. **Content Processing**: Business logic with type safety
3. **Database Storage**: Direct Drizzle operations
4. **Output**: Generated SQLite database ready for bundling

## Technology Stack

### Core Technologies
- **TypeScript**: End-to-end type safety
- **Drizzle ORM**: Type-safe database operations
- **SQLite**: Local database for content generation
- **tsx**: Direct TypeScript execution

### Database Architecture
- **Drizzle + SQLite**: Type-safe queries with TypeScript integration
- **JSON fields**: Flexible storage for content metadata
- **Direct Operations**: No abstraction layers, direct database calls

## Usage

### Running Content Generation
```bash
cd apps/knowledge-admin
npx tsx src/workflows/minna-jp-1/index.ts  # Run script directly
```

### Development Workflow
1. **Edit Scripts**: Modify TypeScript files directly
2. **Type Checking**: Handled by TypeScript compiler
3. **Execution**: Run scripts with tsx
4. **Database Output**: Generated SQLite ready for mobile app

## Key Design Decisions

### Why Simple Scripts?
- **Maintainability**: Easy to understand and modify
- **Type Safety**: Full TypeScript support without abstraction overhead
- **Debugging**: Direct function calls make debugging straightforward
- **Focus**: Concentrate on actual content generation, not orchestration
- **Performance**: No overhead from complex workflow engines

### Database Usage Strategy
- **Direct Operations**: Use Drizzle ORM directly for all database interactions
- **Type Safety**: Leverage TypeScript for compile-time validation
- **Simple Queries**: Straightforward database operations without abstraction

### Content Generation Approach
- **Sequential Execution**: Simple async function calls in order
- **Error Handling**: Standard try/catch patterns
- **Logging**: Direct console/logger usage
- **Progress**: Simple console output for progress tracking

## Extensibility

The simplified architecture supports:
- **Multiple Content Types**: Easy to add new content generation scripts
- **Type Safety**: Full TypeScript support throughout
- **Custom Services**: Domain-specific services for different content types
- **Database Evolution**: Schema changes through Drizzle migrations
- **AI Integration**: Easy integration with various AI services

## Migration Benefits

After removing the workflow engine and dashboard:
- ✅ **Simplified Codebase**: Removed thousands of lines of complex orchestration code
- ✅ **Better Focus**: Concentrate on actual business logic
- ✅ **Easier Debugging**: Direct function calls make issues easier to trace
- ✅ **Faster Development**: No need to understand complex workflow abstractions
- ✅ **Type Safety**: Maintained full TypeScript benefits without overhead