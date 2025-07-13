# Kurasu Manta Schema

This package contains the shared schema definitions for the Kurasu Manta project.

## Structure

The package is organized into the following directories:

- `zod/`: Zod schemas for validation
- `drizzle/`: Drizzle ORM schemas for database access
- `mappers/`: Mappers between Zod and Drizzle schemas
- `repository/`: Repository classes for data access
- `service/`: Service classes for business logic and orchestration

## Usage

### Zod Schemas

```typescript
import { knowledgePointSchema, vocabularySchema, grammarSchema } from '@kurasu-manta/knowledge-schema/zod/knowledge'
import { annotationSchema } from '@kurasu-manta/knowledge-schema/zod/annotation'
import { localizedText } from '@kurasu-manta/knowledge-schema/zod/localized-text'

// Validate data
const result = knowledgePointSchema.safeParse(data)
```

### Drizzle Schemas

```typescript
import { knowledgePointsTable, lessonsTable, lessonKnowledgePointsTable } from '@kurasu-manta/knowledge-schema/drizzle/schema'
import { jsonField, jsonFieldOptional } from '@kurasu-manta/knowledge-schema/drizzle/utils'

// Use in Drizzle queries
const knowledgePoints = await db.select().from(knowledgePointsTable)
```

### Mappers

```typescript
import { mapKnowledgePointToDrizzle, mapDrizzleToKnowledgePoint } from '@kurasu-manta/knowledge-schema/mappers/knowledge'
import { mapLessonToDrizzle, mapDrizzleToLesson } from '@kurasu-manta/knowledge-schema/mappers/lesson'

// Map between domain objects and database rows
const dbData = mapKnowledgePointToDrizzle(knowledgePoint)
const domainObject = mapDrizzleToKnowledgePoint(dbRow)
```

### Repositories

```typescript
import { KnowledgeRepository } from '@kurasu-manta/knowledge-schema/repository/knowledge'
import { LessonRepository } from '@kurasu-manta/knowledge-schema/repository/lesson'

// Create repositories
const knowledgeRepo = new KnowledgeRepository(db)
const lessonRepo = new LessonRepository(db)

// Use repositories
const knowledgePoints = await knowledgeRepo.getAll()
const lesson = await lessonRepo.getById(1)
```

### Services

```typescript
import { CourseContentService } from '@kurasu-manta/knowledge-schema/service/course-content'

// Create service
const courseContentService = new CourseContentService(db)

// Use service
const lessonsWithContent = await courseContentService.getAllLessonsWithContent()
const lessonWithContent = await courseContentService.getLessonWithContent(1)
```

## Type Safety

This package ensures type safety throughout the application by:

1. Validating data with Zod schemas
2. Using Drizzle for type-safe database access
3. Providing mappers between domain objects and database rows
4. Offering repositories with type-safe methods
5. Implementing services for business logic and orchestration
