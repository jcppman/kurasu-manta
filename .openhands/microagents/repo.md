---
name: repo
type: repo
agent: CodeActAgent
---
This is a monorepo for the Kurasu Manta project, built using pnpm workspace and Turborepo. The project consists of a EXPO based mobile/web client application and a backend server.

## General Setup:
To set up the entire repo, run `pnpm install` in the root directory.
Before pushing any changes, ensure that any lint errors or test errors have been fixed:

* Run `pnpm lint` to check and fix code style issues
* Run `pnpm test` to run all tests
* Run `pnpm build` to ensure the project builds correctly

## Repository Structure
Apps:
- `kurasu-manta-client`: A React Native/Expo mobile application
  - Testing: Uses Jest for unit and integration tests
  - Run tests: `pnpm test` in the client directory

- `kurasu-manta-backend`: An AdonisJS backend server
  - Authentication system with PostgreSQL database
  - Database migrations for users and access tokens
  - Testing: Run tests in the backend directory

Packages:
- `kurasu-manta-schema`: Shared TypeScript schema definitions
  - Contains chat-related type definitions

## Tech Stack and Tools
- Package Manager: pnpm (v9.15.4)
- Build System: Turborepo
- Code Quality:
  - Biome for linting and formatting
  - TypeScript for type safety
  - Husky for git hooks
  - Lefthook for workflow automation

## Environment Setup
Each app has its own environment configuration:
- Backend: Uses AdonisJS .env setup
- Client: Uses Expo's built-in .env support

Before running the project, ensure all environment variables are properly set in each app's respective .env file.