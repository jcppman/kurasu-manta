# LangLearn: Technical Design Knowledge Base

## Project Structure
- put unit test file beside the .ts file rather than in test/ folder

## Index
- **Knowledge Admin** - [apps/knowledge-admin](apps/generator): Simple TypeScript scripts for content generation

## Core Architecture
```
Knowledge Admin (TypeScript Scripts) → Content Generation → SQLite (Drizzle) → React Native (expo-sqlite)
                    ↓                        
          Direct Business Logic Execution
```
- End-to-end type-safe architecture with shared schema
- Support for heterogeneous knowledge types
- Multilingual content via LocalizedText
- Offline-first design with bundled database
- Simple script-based content generation (no complex orchestration)

## Technology Choices

### Package Manager
- Always use pnpm
- use pnpm test rather than npm test
- ALWAYS use pnpm instead of npm

### Database: Drizzle + SQLite
- Same tech stack across server and client
- Type-safe queries via Drizzle
- JSON fields for type-specific data
- Pre-populated SQLite database bundled with app

### Content Generation: Direct Script Execution
- Simple TypeScript scripts for content generation
- Direct business logic execution without orchestration overhead
- Type-safe database operations via Drizzle
- Focused on actual content creation rather than workflow management

### Type Safety Stack
- Zod: Domain model validation
- Drizzle: Type-safe database schema
- TypeScript: Shared types across layers
- Mappers: Type-safe conversion between layers
- Repository: Abstract database implementation
- Service: Business logic layer (consumers should only use services, not repositories directly)

## Knowledge Admin Implementation

### Current Approach
The Knowledge Admin (`apps/knowledge-admin`) focuses on business logic with simple script execution:

- **Direct TypeScript Scripts**: Simple functions that execute content generation logic
- **Type-Safe Database Operations**: Direct use of Drizzle for database interactions
- **Content Generation**: AI-powered creation of examples, annotations, and explanations
- **Audio Processing**: TTS generation and audio file management
- **Database Population**: Store generated content in SQLite with Drizzle

### Design Philosophy
After removing the over-engineered workflow engine and dashboard:
- ✅ Focus on actual business logic rather than orchestration complexity
- ✅ Simple script-based execution for better maintainability
- ✅ Enhanced type safety throughout the application
- ✅ Removed UI overhead to focus on content generation
- ✅ Direct function calls instead of complex workflow management

### Usage
```bash
cd apps/knowledge-admin
npx tsx src/workflows/minna-jp-1/index.ts  # Run content generation script directly
```

## Key Patterns

### Content Generation Script Pattern
```typescript
// apps/knowledge-admin/src/workflows/minna-jp-1/index.ts
export async function execute() {
  await cleanVocabularies()
  await createLessons()
  // await generateVocabularyAudioClips()
}

async function createLessons() {
  logger.info('Creating lessons...')
  const data = getData()
  
  // Group by lesson
  const groupedData = data.reduce((acc, item) => {
    const lesson = item.lesson
    acc.set(lesson, acc.get(lesson) ?? [])
    acc.get(lesson)?.push(item)
    return acc
  }, new Map<number, MinaVocabulary[]>())
  
  for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
    await createLesson(lessonNumber, lessonVocabularies)
  }
}
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

### Database Relationships
- **Lessons ↔ Knowledge Points**: One-to-many relationship
  - Each lesson contains multiple knowledge points
  - Each knowledge point belongs to exactly one lesson
  - Direct foreign key constraint (lessonId) for data integrity
  - Simplified queries without junction tables

### Shared Schema
```
content-schema/
├── zod/       # Validation schemas
├── drizzle/   # DB schema with JSON fields
├── mappers/   # Type mapping layer
├── repository/ # Data access layer (internal use only)
├── service/   # Business logic layer (public API for consumers)
└── index.ts   # Unified exports
```

**Important**: Consumers of @kurasu-manta/content-schema should only use services, not repositories directly. Services provide the proper business logic abstraction and ensure data consistency.

### Data Flow
1. **Server**: External/AI → Zod Validation → Domain Objects → Mappers → Drizzle → SQLite
2. **Client**: Bundled SQLite → expo-sqlite → Drizzle → Mappers → Typed Domain Objects

## Domain Extensibility
The architecture supports extending to other domains beyond language learning:

1. Define new domain-specific schemas
2. Use the same database structure with type-specific JSON
3. Maintain type safety through the mapping layer

## Content Pipeline
1. **Knowledge Admin**: Simple TypeScript scripts in `src/workflows/`
2. **Content Generation**: Direct function calls for AI-powered content creation
3. **Audio Processing**: TTS generation and audio file management
4. **Database Population**: Store generated content in SQLite with Drizzle
5. **Bundle Distribution**: Package database for mobile app distribution

### Example Script Structure
```typescript
// apps/knowledge-admin/src/workflows/minna-jp-1/index.ts
export async function execute() {
  await cleanVocabularies()
  await createLessons()
  // await generateVocabularyAudioClips()
}

// Direct function execution - no complex orchestration
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
- **Simplified Architecture**: Focus on business logic without orchestration overhead
- **Direct Execution**: Scripts run directly without complex workflow management
- **Better Maintainability**: Reduced complexity makes debugging and modification easier

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
execute in the root directory:
   ```bash
   pnpm lint-fix
   ```

This workflow ensures:
- Type safety is maintained across the codebase
- Code style and formatting are consistent
- Common issues are automatically fixed
- All quality gates pass before committing changes