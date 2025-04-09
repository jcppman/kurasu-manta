# LangLearn: Technical Design Knowledge Base

## Index
- **Technology Stack** - [.ai/tech-stack.md](.ai/tech-stack): Core technologies and implementation approach
- **Type-Safe Data Design** - [.ai/type-safe-data.md](.ai/type-safe-data): Detailed implementation patterns for type safety

## Core Architecture
```
Content Generation (Inngest) → SQLite (Drizzle) → React Native (expo-sqlite)
```
- End-to-end type-safe architecture with shared schema
- Support for heterogeneous knowledge types
- Multilingual content via LocalizedText
- Offline-first design with bundled database

## Technology Choices

### Database: Drizzle + SQLite
- Same tech stack across server and client
- Type-safe queries via Drizzle
- JSON fields for type-specific data
- Pre-populated SQLite database bundled with app

### Task Orchestration: Inngest
- Event-driven content generation workflow
- Cacheable steps with version flags
- TypeScript-native for type safety

### Type Safety Stack
- Zod: Domain model validation
- Drizzle: Type-safe database schema
- TypeScript: Shared types across layers
- Mappers: Type-safe conversion between layers
- Repository: Abstract database implementation

## Key Patterns

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
1. Seed knowledge ETL into SQLite with Drizzle
2. Generate examples with AI for knowledge points
3. Process sentences (annotations, explanations, audio)
4. Bundle database for mobile distribution

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
- Developer-friendly with TypeScript inference</content>
