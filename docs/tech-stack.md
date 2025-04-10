# LangLearn Tech Stack Summary

## Core Architecture
- Type-safe architecture with heterogeneous data support:
  ```
  Content Generation (Inngest) → SQLite (Drizzle) → React Native (expo-sqlite)
  ```

## Database: Drizzle + SQLite
- **Server**: Content generation with SQLite/Drizzle
- **Client**: expo-sqlite with Drizzle integration
- **Distribution**: Pre-populated SQLite bundled with app
- **Schema**: Unified approach for heterogeneous data types
- **Storage**: JSON fields for type-specific properties

## Task Orchestration: Inngest
- Event-driven content generation workflow
- Step-based execution with caching
- TypeScript-native implementation

## Type Safety
- Shared TypeScript models with Zod validation
- Drizzle schema for type-safe DB access
- Zod validation for heterogeneous data structures
- Repository pattern for DB abstraction
- Service layer for business logic and orchestration
- Type mapping layer for domain/database conversion

## Content Pipeline
1. Seed knowledge ETL → DB
2. Example generation with AI
3. Process sentences (annotations, translations)
4. Bundle database for mobile

## Heterogeneous Data Approach
- Common fields as direct columns
- Type-specific data in JSON fields
- Strong typing with Zod
- Type-safe mapping between layers

## Multilingual Support
- LocalizedText type for multilingual content
- JSON storage for language variants
- Domain models with proper typing

## React Native Implementation
- Offline-first with bundled SQLite
- Type-safe queries with Drizzle
- Support for heterogeneous knowledge types

## Key Advantages
- Unified schema across stack
- Flexible design for multiple knowledge types
- Support for domain expansion beyond language learning
- End-to-end type safety
- Offline functionality
- Clean domain model with proper typing</content>
