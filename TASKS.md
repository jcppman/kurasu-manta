# Project Tasks

## ✅ Refactor Web App: Replace API Routes with Direct Database Access (COMPLETED)

### Overview
Refactor the `@apps/web` application to use direct database access via `content-service` instead of Next.js API routes. Extract API logic into server functions and call them directly from pages.

### Completed Tasks

#### ✅ 1. Create Server Functions
- ✅ Created `src/server/lessons.ts` with `getLessons()` and `getLessonById()` functions
- ✅ Created `src/server/knowledge.ts` with `getKnowledgePoints()` function  
- ✅ Created `src/server/sentences.ts` with `getSentences()` function
- ✅ All functions properly use `CourseContentService` and handle errors

#### ✅ 2. Update Page Components to Use Server Functions
- ✅ Converted `src/app/lessons/page.tsx` from client to server component
- ✅ Converted `src/app/knowledge/page.tsx` from client to server component
- ✅ Converted `src/app/sentences/page.tsx` from client to server component
- ✅ Converted `src/app/lessons/[id]/page.tsx` from client to server component
- ✅ Removed all `useEffect`, `useState`, and `fetch` calls
- ✅ Fixed Next.js 15 async params requirements

#### ✅ 3. Remove Unused API Routes
- ✅ Deleted `src/app/api/lessons/route.ts`
- ✅ Deleted `src/app/api/knowledge/route.ts`
- ✅ Deleted `src/app/api/sentences/route.ts`
- ✅ Deleted entire `src/app/api/lessons/` directory including `[id]/route.ts`

#### ✅ 4. Update Error Handling
- ✅ Server functions throw appropriate errors for Next.js to handle
- ✅ Fixed TypeScript interface issues (removed non-existent `createdAt` property)
- ✅ Fixed SentenceViewer component type safety

#### ✅ 5. Testing and Verification
- ✅ All pages build successfully without errors
- ✅ Code linting passes with `pnpm lint-fix` 
- ✅ Build verification completed successfully
- ✅ Static generation working for all routes

### Achieved Benefits
- ✅ Improved performance by removing API round-trips
- ✅ Better type safety with direct service usage
- ✅ Simplified architecture following Next.js App Router patterns
- ✅ Reduced client-side JavaScript bundle size (all pages now server-rendered)