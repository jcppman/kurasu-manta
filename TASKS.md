# Tasks

## Create Internal Dashboard in @apps/web

### Overview
Create a simple internal dashboard in the Next.js web app to view lessons, knowledge points, and sentences. The dashboard should be functional but not fancy, focused on clarity and simplicity.

### Key Requirements
- Dashboard to view lessons, knowledge points, and sentences
- Reusable Sentence Viewer component with annotations support
- Simple, clear UI (internal tool - no need for fancy styling)

### Tasks Breakdown

#### 1. Database Configuration Setup
- Copy drizzle configuration from `apps/generator` to `apps/web`
- Modify the web app's drizzle config to point to the correct database path
  - refer to the `.env` file in `apps/generator` for database path and filename
- Add necessary database dependencies to `apps/web/package.json`
- Set up database connection in the web app

#### 2. Schema Integration
- Add `@kurasu-manta/kurasu-manta-schema` package dependency to `apps/web`
- Verify the existing schema package has all necessary types for lessons, knowledge points, and sentences
- Test database connectivity and schema integration

#### 3. Dashboard Pages Structure
- Create main dashboard layout in Next.js app router structure
- Create `/lessons` route to list all lessons
- Create `/lessons/[id]` route to view individual lesson details
- Create `/knowledge` route to list knowledge points
- Create `/sentences` route to list sentences

#### 4. Sentence Viewer Component
- Create reusable `SentenceViewer` component that:
  - Displays sentence text with annotations
  - Shows annotation details (tooltips, highlights, etc.)
  - Supports different annotation types
  - Is designed for reuse across the application
- Place component in appropriate shared components directory

#### 5. Data Fetching & API Routes
- Create Next.js API routes or server components to fetch:
  - Lessons list and details
  - Knowledge points
  - Sentences with annotations
- Implement proper error handling and loading states

#### 6. Basic Dashboard UI
- Create simple, functional layouts for each view
- Use basic HTML/CSS or Tailwind for styling (already configured)
- Focus on data presentation over visual design
- Ensure responsive layout for different screen sizes

#### 7. Navigation & Layout
- Add simple navigation between different dashboard sections
- Create consistent layout component
- Add breadcrumbs or basic navigation indicators

### Implementation Notes
- Use existing `@kurasu-manta/kurasu-manta-schema` package for type safety
- The drizzle config in `apps/generator` can be copied/modified for `apps/web`
- Keep UI simple - this is an internal tool focused on functionality
- Prioritize the reusable Sentence Viewer component as it will be used elsewhere

### Technical Dependencies
- Next.js (already configured)
- Tailwind CSS (already configured)  
- Drizzle ORM (needs to be added)
- SQLite (needs to be added)
- `@kurasu-manta/kurasu-manta-schema` package (needs to be added as dependency)
