# Type-Safe Data Design

## Architecture
- Unified type-safe architecture with SQLite/Drizzle across server and mobile
- Support for heterogeneous data types within a shared schema

## Key Components

### 1. Shared Schema Package
```
kurasu-manta-schema/
├── zod/         # Data validation
├── drizzle/     # DB schema with JSON for type-specific data
├── mappers/     # Type mapping between layers
└── index.ts     # Unified exports
```

### 2. Zod Validation
- Base schema for universal properties
- Type-specific validation schemas
- Runtime validation of heterogeneous types
- Multilingual support via LocalizedText

### 3. Drizzle Schema with JSON Fields
- Universal properties as direct columns
- Type-specific data in JSON fields
- Consistent schema across environments
- Flexible design for evolving types

### 4. Type Mapping
- Convert domain objects ⟷ DB rows
- Extract/insert type-specific fields
- Handle validation with proper typing
- Maintain type safety across boundaries

## Data Flow

### Server-Side
```
External/AI → Zod Validation → Domain Objects → Mappers → Drizzle → SQLite
```

### Client-Side
```
Bundled SQLite → expo-sqlite → Drizzle → Mappers → Typed Domain Objects
```

## Implementation Patterns

### Heterogeneous Data Approach
The system supports different types of knowledge (vocabulary, grammar, conjugation) with different data structures:

```typescript
// Base schema for all knowledge types
const baseKnowledgePointSchema = z.object({
  id: z.number().optional(),
  content: z.string(),
  explanation: localizedTextSchema,
  // Other universal fields
});

// Database schema with JSON for type-specific data
export const knowledgePointsTable = sqliteTable('knowledge_points', {
  id: int().primaryKey({ autoIncrement: true }),
  type: text().notNull(),
  content: text().notNull(),
  explanation: jsonField<LocalizedText>('explanation'),
  // JSON field for type-specific data
  typeSpecificData: jsonField<Record<string, unknown>>('type_specific_data'),
});
```

### Multilingual Support

```typescript
// Type for multilingual text content
type LocalizedText = Record<string, string>;

// Schema for localized text
const localizedTextSchema = z.record(z.string(), z.string());

// Used in knowledge point schema
const baseKnowledgePointSchema = z.object({
  // Other fields...
  explanation: localizedTextSchema,
});

// In database schema
export const knowledgePointsTable = sqliteTable('knowledge_points', {
  // Other fields...
  explanation: jsonField<LocalizedText>('explanation'),
});
```

### Repository Pattern
```typescript
export class KnowledgeRepository {
  // Insert any knowledge point type
  async insertKnowledgePoint(point: KnowledgePoint): Promise<number> {
    const validated = validateKnowledgePoint(point);
    const row = mapKnowledgePointToRow(validated);
    const result = await db.insert(knowledgePointsTable).values(row);
    return result[0].id;
  }
  
  // Get and return properly typed knowledge point
  async getById(id: number): Promise<KnowledgePoint | null> {
    const row = await db.query.knowledgePointsTable.findFirst({
      where: eq(knowledgePointsTable.id, id)
    });
    return row ? mapRowToKnowledgePoint(row) : null;
  }
}
```

## React Native Integration
```typescript
// Setup DB with schema supporting heterogeneous types
const expoDb = SQLite.openDatabase('langlearn.db');
export const db = drizzle(expoDb, { schema });

// Type-safe queries across knowledge types
async function fetchKnowledgePoints(lessonId: number): Promise<KnowledgePoint[]> {
  const rows = await db.query.lessonKnowledgePointsTable.findMany({
    where: eq(lessonKnowledgePointsTable.lessonId, lessonId),
    with: { knowledgePoint: true }
  });
  
  return rows.map(row => mapRowToKnowledgePoint(row.knowledgePoint));
}
```

## Domain Extensibility
The architecture supports extending to other domains beyond language learning by:

1. Creating new domain-specific schemas
2. Maintaining the same database structure
3. Using the mapper functions to handle serialization

## Key Benefits
- End-to-end type safety with heterogeneous data
- JSON fields for flexible type-specific data
- Multilingual support via localized text fields
- Extensible to multiple domains
- Simple database structure with powerful typing
- Strong validation at system boundaries</content>
