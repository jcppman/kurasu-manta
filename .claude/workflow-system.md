# Content Generation System Design

## Core Principles

### Direct Script Execution
Content generation is handled by **simple TypeScript scripts**, not complex workflow engines. This provides:
- Direct function calls for better debugging
- Simplified control flow
- Standard TypeScript patterns
- No orchestration overhead
- Focus on business logic

### Business Logic First
Focus on actual content generation rather than workflow management:

```typescript
// Simple, direct execution pattern
export async function execute() {
  await cleanVocabularies()
  await createLessons()
  // await generateVocabularyAudioClips()
}

// Direct execution with standard error handling
if (require.main === module) {
  execute()
    .then(() => logger.info('Completed successfully'))
    .catch((error) => logger.error('Failed:', error))
}
```

## Technical Implementation

### Script Structure

**Location**: `src/workflows/[content-type]/`

**Directory Structure**:
```
src/workflows/
├── minna-jp-1/                 # Content generation for Minna Book 1
│   ├── index.ts               # Main execution script
│   ├── data/                  # Content-specific data files
│   │   ├── index.ts          # Data access layer
│   │   └── vocs.json         # Raw vocabulary data
│   ├── service/               # Business logic services
│   │   └── language.ts       # Language processing services
│   └── utils.ts              # Utility functions
```

### Content Generation Pattern

**Core Script Structure**:
```typescript
// Main execution function
export async function execute() {
  // Step 1: Clean existing data
  await cleanVocabularies()
  
  // Step 2: Generate new content
  await createLessons()
  
  // Step 3: Process audio (optional)
  // await generateVocabularyAudioClips()
}

// Individual business logic functions
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
  
  // Process each lesson
  for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
    await createLesson(lessonNumber, lessonVocabularies)
  }
}
```

### Service Layer Pattern

**Content Generation Services**:
```typescript
// Language processing service
export async function findPosOfVocabulary(vocabulary: MinaVocabulary): Promise<string> {
  // AI-powered POS tagging
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Determine part of speech for Japanese vocabulary" },
      { role: "user", content: vocabulary.content }
    ]
  })
  return response.choices[0].message.content
}

// Audio generation service
export async function generateAudio(content: AudioGenerationInput): Promise<AudioResult> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: content.content
  })
  
  const buffer = Buffer.from(await response.arrayBuffer())
  const sha1 = createHash('sha1').update(buffer).digest('hex')
  
  return { sha1, content: buffer }
}
```

## Database Integration

### Direct Drizzle Operations

**No Abstraction Layers**:
```typescript
// Direct database operations with type safety
async function cleanVocabularies() {
  // Get vocabulary knowledge point IDs
  const vocabularyKnowledgePoints = await db
    .select({ id: knowledgePointsTable.id })
    .from(knowledgePointsTable)
    .where(eq(knowledgePointsTable.type, 'vocabulary'))

  const vocabularyIds = vocabularyKnowledgePoints.map((kp) => kp.id)

  // Delete associations
  await db
    .delete(lessonKnowledgePointsTable)
    .where(inArray(lessonKnowledgePointsTable.knowledgePointId, vocabularyIds))

  // Delete knowledge points
  await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'vocabulary'))
}
```

### Content Schema Integration

Content generation directly populates domain-specific tables:

```typescript
// Knowledge content created by scripts
export const knowledgePointsTable = pgTable('knowledge_points', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),                    // vocabulary, grammar, etc.
  content: text('content').notNull(),              // Main content
  annotations: json('annotations'),                // Structured annotations
  explanation: json('explanation'),                // Multilingual explanations
  examples: json('examples').default([]),          // Usage examples
  metadata: json('metadata'),                      // Type-specific data
})

// Content generation service usage
async function createLesson(lessonNumber: number, vocabularies: MinaVocabulary[]) {
  const courseContentService = new CourseContentService(db)
  
  // Direct service call with type safety
  courseContentService.createKnowledgePointsWithLesson(
    vocabularies.map((v) => ({
      lesson: lessonNumber,
      type: 'vocabulary',
      content: v.content,
      annotations: v.annotations,
      pos: v.pos,
      explanation: { zhCN: v.translation },
      examples: [],
    }))
  )
}
```

## Execution Model

### Simple Sequential Execution

**No Orchestration Complexity**:
- Functions execute in order
- Standard async/await patterns
- Direct error handling with try/catch
- Simple logging for progress tracking
- No dependency management overhead

**Execution Flow**:
```typescript
// Standard execution pattern
async function execute() {
  try {
    // Step 1: Data cleanup
    logger.info('Starting data cleanup...')
    await cleanVocabularies()
    logger.info('Data cleanup completed')
    
    // Step 2: Content generation
    logger.info('Starting lesson creation...')
    await createLessons()
    logger.info('Lesson creation completed')
    
    // Step 3: Optional audio processing
    // logger.info('Starting audio generation...')
    // await generateVocabularyAudioClips()
    // logger.info('Audio generation completed')
    
  } catch (error) {
    logger.error('Execution failed:', error)
    throw error
  }
}
```

### Error Handling Strategy

**Standard TypeScript Patterns**:
- Try/catch blocks for error boundaries
- Detailed error logging
- Graceful failure with cleanup
- Process exit codes for script status

## Development Workflow

### Script Development Process

1. **Create Script Directory**: `src/workflows/[content-type]/`
2. **Implement Main Function**: `export async function execute()`
3. **Add Business Logic**: Content generation functions
4. **Create Services**: Reusable business logic components
5. **Add Data Layer**: Content-specific data access
6. **Run Script**: `npx tsx src/workflows/[script]/index.ts`

### Content Generation Workflow

1. **Data Preparation**: Load raw content data (JSON, CSV, etc.)
2. **Data Processing**: Transform and enrich content
3. **AI Enhancement**: Use AI services for content generation
4. **Database Population**: Store processed content with Drizzle
5. **Asset Generation**: Create audio files, images, etc.
6. **Validation**: Verify generated content integrity

## Best Practices

### Script Design
1. **Single Responsibility**: Each script focuses on one content type
2. **Clear Functions**: Well-named functions with specific purposes
3. **Error Handling**: Comprehensive error catching and logging
4. **Progress Logging**: Regular status updates during execution
5. **Type Safety**: Full TypeScript usage throughout

### Performance Considerations
1. **Batch Operations**: Process content in batches for efficiency
2. **Database Connections**: Reuse connections within scripts
3. **Memory Management**: Process large datasets in chunks
4. **API Rate Limits**: Respect AI service rate limits
5. **File Operations**: Efficient file system operations

### Maintainability
1. **Clear Documentation**: Document script purpose and usage
2. **Service Extraction**: Extract reusable logic into services
3. **Type Definitions**: Strong typing for all data structures
4. **Testing**: Unit tests for critical business logic
5. **Version Control**: Track changes in git with proper commits

## Migration Benefits

### From Complex Workflow Engine to Simple Scripts

**Removed Complexity**:
- ❌ Workflow engine with state management
- ❌ Complex dependency resolution
- ❌ UI dashboard and real-time updates
- ❌ Database-stored workflow definitions
- ❌ Step orchestration and progress tracking

**Gained Simplicity**:
- ✅ Direct function execution
- ✅ Standard TypeScript patterns
- ✅ Simple error handling
- ✅ Easy debugging and modification
- ✅ Focus on business logic

**Maintained Benefits**:
- ✅ Full type safety with TypeScript
- ✅ Content generation capabilities
- ✅ Database integration with Drizzle
- ✅ AI service integration
- ✅ File system operations

## Usage Examples

### Running Content Generation
```bash
# Navigate to knowledge admin
cd apps/knowledge-admin

# Run vocabulary generation for Minna Book 1
npx tsx src/workflows/minna-jp-1/index.ts

# Run with specific environment
NODE_ENV=development npx tsx src/workflows/minna-jp-1/index.ts
```

### Adding New Content Types
```bash
# Create new content script
mkdir src/workflows/grammar-patterns
touch src/workflows/grammar-patterns/index.ts

# Implement generation logic
# Follow the same pattern as existing scripts
```