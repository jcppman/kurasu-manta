# Repository Information

## Project Overview
This is a monorepo for the Kurasu Manta project, built using pnpm workspace and Turborepo. The project consists of a EXPO based mobile/web client application and a backend server.

## Structure

### Apps
- `kurasu-manta-client`: A React Native/Expo mobile application
  - Has testing setup with Jest

- `kurasu-manta-backend`: An AdonisJS backend server
  - Implements authentication system
  - Uses PostgreSQL database
  - Includes migrations for users and access tokens

### Packages
- `kurasu-manta-schema`: Shared TypeScript schema definitions
  - Contains chat-related type definitions

## Tech Stack
- Package Manager: pnpm (v9.15.4)
- Build System: Turborepo
- Code Quality:
  - Biome for linting and formatting
  - TypeScript for type safety
  - Husky for git hooks
  - Lefthook for workflow automation

## Development Commands
- `pnpm install`: Install dependencies
- `pnpm dev`: Start development servers for all apps
- `pnpm lint`: Run code analysis
- `pnpm test`: Run tests
- `pnpm build`: Build all apps and packages for production

## Environment Setup
The project uses environment variables for configuration. Each app has its own environment configuration:
- Backend: Uses AdonisJS .env setup
- Client: Uses Expo's built-in .env support

## Notes
- The project follows a monorepo structure for better code sharing and development workflow
- Uses Biome for consistent code formatting across the project
- Implements proper TypeScript configurations for type safety
- Has testing infrastructure set up with Jest