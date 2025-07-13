# Testing Strategy for Kurasu Manta Schema

This document outlines the testing strategy for the Kurasu Manta Schema package, which contains shared schema definitions for the Kurasu Manta project.

## Overview

The Kurasu Manta Schema package is a critical component that ensures type safety throughout the application by:

1. Validating data with Zod schemas
2. Using Drizzle for type-safe database access
3. Providing mappers between domain objects and database rows
4. Offering repositories with type-safe methods

Given its importance in maintaining data integrity and type safety, a comprehensive testing approach is essential.

## Test Types

### Unit Tests

Unit tests will be co-located with the source files they test, focusing on:

- **Utility Functions**: Testing the helper functions in `drizzle/utils.ts` that handle JSON serialization/deserialization and database result processing.

### Integration Tests

Integration tests will be organized in a separate `tests` directory and will focus on:

- **Repository Tests**: Testing repositories with an actual in-memory database to ensure CRUD operations work correctly.
- **Mapper Tests**: Testing mappers in the context of database operations to ensure proper conversion between domain objects and database rows.
- **Data Flow Tests**: Testing the complete flow from validation to storage and retrieval to ensure end-to-end type safety.

## Testing Tools

1. **Testing Framework**: Node.js built-in test runner (`node:test`)
2. **Test Runner**: tsx for TypeScript support (`tsx --test`)
3. **Database**: libsql in-memory database for integration tests
4. **Assertions**: Node.js built-in assertions (`node:assert`)

## Test Structure

```
packages/knowledge-schema/
├── src/
│   ├── drizzle/
│   │   ├── utils.ts
│   │   └── utils.test.ts  // Co-located unit test
│   └── ...
├── tests/
│   ├── integration/
│   │   ├── repository.test.ts
│   │   ├── mappers.test.ts
│   │   └── data-flow.test.ts
│   └── utils/
│       ├── db-setup.ts
│       └── fixtures.ts
└── package.json
```

## Testing Approach

### Database Setup for Integration Tests

For integration tests, we'll use an in-memory libsql database. The approach will be:

1. Create an in-memory libsql database and create tables
2. Use the repository pattern to populate test fixtures
3. Test repository methods against the database
4. Verify data integrity and type safety

### Test Fixtures

We'll create realistic test fixtures for:

- Lessons
- Knowledge points (vocabulary and grammar)
- Annotations
- Localized text

These fixtures will be used across all integration tests to ensure consistency.

## Test Cases

### Unit Tests for Utils

- Test `requireResult` function:
  - Maps valid results correctly
  - Throws error on undefined result
  - Throws error on empty result array
  - Throws error with custom message

- Test `optionalResult` function:
  - Maps valid results correctly
  - Returns null on undefined result
  - Returns null on empty result array

### Integration Tests for Repositories

- Test `KnowledgeRepository`:
  - Create knowledge points (vocabulary and grammar)
  - Retrieve knowledge points by ID
  - Update knowledge points
  - Delete knowledge points
  - Associate knowledge points with lessons

- Test `LessonRepository`:
  - Create lessons
  - Retrieve lessons by ID and number
  - Update lessons
  - Delete lessons
  - Get knowledge point IDs associated with a lesson

### Integration Tests for Mappers

- Test `mapKnowledgePointToDrizzle` and `mapDrizzleToKnowledgePoint`:
  - Correctly map vocabulary knowledge points
  - Correctly map grammar knowledge points
  - Handle edge cases (null values, optional fields)

- Test `mapLessonToDrizzle` and `mapDrizzleToLesson`:
  - Correctly map lessons
  - Handle edge cases (null values, optional fields)

### Data Flow Tests

- Test end-to-end flow:
  - Validate data with Zod schemas
  - Map to database rows
  - Store in database
  - Retrieve from database
  - Map back to domain objects
  - Verify data integrity

## Conclusion

This testing strategy ensures that the Kurasu Manta Schema package maintains its type safety guarantees and correctly handles data conversion between different layers of the application. By focusing on integration tests with real database operations, we can be confident that the package will work correctly in production.
