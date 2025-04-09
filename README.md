<div align="center">
  <h1>Kurasu Manta</h1>
  <p>A language learning platform for textbook-based learners</p>
</div>

<p align="center">
  <a href="#-about"><b>About</b></a>
  &ensp;&mdash;&ensp;
  <a href="#-philosophy"><b>Philosophy</b></a>
  &ensp;&mdash;&ensp;
  <a href="#-structure"><b>Structure</b></a>
  &ensp;&mdash;&ensp;
  <a href="#-development"><b>Development</b></a>
  &ensp;&mdash;&ensp;
  <a href="#-code-style"><b>Code Style</b></a>
</p>

<br />

## 📚 About

Kurasu Manta is a language learning platform designed specifically for students who are learning with structured textbook systems like "大家的日本语" (Minna no Nihongo). The platform provides targeted practice materials that align with a learner's current progress in their textbook.

### Current Focus

The initial version focuses on supporting learners of Japanese using the "大家的日本语" Book 1 textbook, with plans to expand to other textbooks and languages in the future.

## 🧠 Philosophy

The core philosophy of Kurasu Manta is building learning tools for learners who are studying in a classroom environment with textbook systems. In this scenario:

- Learners know exactly their progress (Lesson 2, Lesson 15, etc.)
- The app can provide practices that are on-point and within the scope of what they've learned
- Materials are carefully curated to match the vocabulary and grammar points introduced in each lesson

This approach differs from many language learning apps that follow their own curriculum, making it difficult for classroom learners to find supplementary practice that aligns with their textbook progress.

## 🚀 Development

This project is built as a monorepo using pnpm workspaces and Turborepo for efficient development across multiple packages.

### Getting Started

To run the repository locally:

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Key Commands

- `pnpm dev` - Build and watch all apps and packages for development
- `pnpm lint` - Check code style with Biome
- `pnpm lint-fix` - Fix code style issues with Biome
- `pnpm test` - Run all tests
- `pnpm build` - Build all apps and packages for production

### App-Specific Commands

#### General Commands
- `pnpm dev:kurasu-manta-client` - Start the mobile/web client development server
- `pnpm dev:kurasu-manta-backend` - Start the backend development server
- `pnpm build:kurasu-manta-client` - Build the mobile/web client for production
- `pnpm build:kurasu-manta-backend` - Build the backend for production

#### Backend (NestJS)
- Run backend: `pnpm --filter kurasu-manta-backend dev`
- Test backend: `pnpm --filter kurasu-manta-backend test`
- Test single file: `pnpm --filter kurasu-manta-backend test -- path/to/test.spec.ts`

#### Frontend (Expo)
- Run frontend: `pnpm --filter kurasu-manta-client dev`
- Test frontend: `pnpm --filter kurasu-manta-client test`

## 📁 Structure

This is a monorepo managed with PNPM workspaces. The main folders are:

### Apps

- `apps/kurasu-manta-client` - React Native/Expo mobile application (offline-first)
  - Provides daily practice exercises for language learners
  - Allows users to track their progress through textbook lessons
  - Built with Expo for cross-platform compatibility

- `apps/kurasu-manta-backend` - Backend server
  - Provides API endpoints for the client application
  - Handles AI-powered chat functionality for language learning assistance

### Packages

- `packages/kurasu-manta-schema` - Shared TypeScript schema definitions
  - Contains chat-related type definitions and other shared schemas

- `packages/knowledge-gen` - Knowledge generation system
  - Generates learning materials from vocabulary and grammar points
  - Uses AI to create practice exercises aligned with textbook lessons
  - Stores and manages data for the offline-first mobile application

## 🧩 Technical Stack

- **Frontend**: React Native with Expo
- **Backend**: NestJS
- **Database**: SQLite (client-side), PostgreSQL (server-side)
- **AI Integration**: OpenAI for content generation
- **Build System**: Turborepo with pnpm workspaces
- **Code Quality**: Biome for linting and formatting

## 💻 Code Style

- Uses Biome for linting/formatting with customized rules
- Indent: 2 spaces
- Line width: 100 characters
- Quotes: Single quotes, double for JSX
- Semicolons: As needed (not always required)
- Trailing commas: ES5 style
- Use TypeScript for type safety
- Follow NestJS conventions for backend modules/controllers/services
- Follow Expo/React Native conventions for frontend components
- Use named exports for better import clarity
- Organize imports with Biome
- Prefer async/await over raw Promises

<div align="center">
  <br />
  <p>Kurasu Manta - Learning with purpose</p>
  <br />
</div>
