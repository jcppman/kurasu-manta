# UI Components Architecture

## Overview

The Knowledge Admin UI is built with modern React patterns using Next.js 15, shadcn/ui components, and Tailwind CSS. The interface provides real-time workflow management with sophisticated dependency handling and progress tracking.

## Component Architecture

### Layout Components

**Location**: `src/components/layout/`

#### App Sidebar (`app-sidebar.tsx`)
- Navigation structure for the admin interface
- Workflow listing and quick access
- Integration with shadcn/ui Sidebar component
- Responsive design with mobile considerations

#### Header (`header.tsx`)
- Top navigation bar
- User actions and global controls
- Breadcrumb navigation
- Application title and branding

### Workflow Management Components

**Location**: `src/components/workflows/`

#### Execution Panel (`execution-panel.tsx`)
**Purpose**: Core workflow execution interface with step configuration

**Key Features**:
- **Step Selection**: Checkbox interface for step configuration
- **Dependency Validation**: Real-time validation with "Missing deps" indicators
- **Recursive Dependencies**: Smart selection operations
  - Enable step → automatically enables all prerequisites
  - Disable step → automatically disables all dependents
- **Bulk Operations**: 
  - "Select All Dependencies" button (recursive upward)
  - "Clear All Dependents" button (recursive downward)
- **Execution Controls**: Start, pause, stop workflow buttons
- **Progress Integration**: Real-time step status updates

**Implementation Pattern**:
```typescript
const handleStepConfigChange = (stepName: string, enabled: boolean) => {
  const newConfig = { ...stepConfig }
  
  if (enabled) {
    // Recursively enable all dependencies
    enableDependenciesRecursively(stepName, newConfig)
  } else {
    // Recursively disable all dependents
    disableDependentsRecursively(stepName, newConfig)
  }
  
  setStepConfig(newConfig)
}
```

#### Step Progress Indicator (`step-progress-indicator.tsx`)
**Purpose**: Visual representation of step execution state

**Features**:
- Progress bar with percentage completion
- Step status indicators (pending, running, completed, failed)
- Time estimates and elapsed time
- Error state visualization

#### Workflow Progress (`workflow-progress.tsx`)
**Purpose**: Overall workflow execution visualization

**Components**:
- Timeline view of step execution
- Real-time progress updates
- Execution metrics (total time, steps completed)
- Visual dependency graph

#### Workflow Run History (`workflow-run-history.tsx`)
**Purpose**: Historical execution records and analysis

**Features**:
- Chronological list of workflow executions
- Execution status and duration
- Quick access to logs and details
- Filter and search capabilities
- Execution statistics and trends

#### Workflow Run Logs (`workflow-run-logs.tsx`)
**Purpose**: Detailed execution logging and debugging

**Features**:
- Real-time log streaming during execution
- Structured log display with levels (info, warn, error)
- Step-specific log filtering
- Log export and sharing
- Search and highlighting

#### Delete Workflow Button (`delete-workflow-button.tsx`)
**Purpose**: Safe workflow run deletion with confirmation

**Features**:
- Confirmation dialog integration
- Bulk deletion support
- Preservation of important execution records
- Integration with shadcn/ui AlertDialog

### UI Component Library

**Location**: `src/components/ui/`

Built on shadcn/ui foundation with custom extensions:

#### Core Components
- `button.tsx` - Styled button variants
- `card.tsx` - Content containers
- `input.tsx` - Form inputs with validation
- `table.tsx` - Data display tables
- `tabs.tsx` - Tabbed interfaces
- `badge.tsx` - Status indicators
- `progress.tsx` - Progress bars and indicators

#### Dialog Components
- `alert-dialog.tsx` - Confirmation dialogs
- `sheet.tsx` - Slide-out panels

#### Navigation Components
- `breadcrumb.tsx` - Navigation breadcrumbs
- `navigation-menu.tsx` - Top-level navigation
- `sidebar.tsx` - Collapsible sidebar

#### Feedback Components
- `alert.tsx` - Status messages
- `skeleton.tsx` - Loading states
- `tooltip.tsx` - Contextual help

## State Management Patterns

### Workflow Execution State

**Custom Hook**: `src/hooks/use-workflow-execution.ts`

```typescript
interface WorkflowExecutionState {
  // Current execution state
  isRunning: boolean
  currentStep: string | null
  progress: number
  status: WorkflowStatus
  
  // Configuration
  stepConfig: Record<string, boolean>
  workflowDefinition: WorkflowDefinition
  
  // Actions
  startWorkflow: () => Promise<void>
  pauseWorkflow: () => Promise<void>
  stopWorkflow: () => Promise<void>
  updateStepConfig: (config: Record<string, boolean>) => void
}
```

**Features**:
- Real-time execution state management
- Step configuration with dependency validation
- Progress tracking and updates
- Error handling and recovery
- Integration with API routes

### Dependency Resolution Logic

**Algorithm**: Recursive dependency traversal

```typescript
// Get all dependencies (recursive upward)
const getAllDependencies = (stepName: string, workflow: WorkflowDefinition): string[] => {
  const visited = new Set<string>()
  const dependencies: string[] = []
  
  const traverse = (currentStep: string) => {
    if (visited.has(currentStep)) return
    visited.add(currentStep)
    
    const step = workflow.steps.find(s => s.name === currentStep)
    if (step?.definition.dependencies) {
      for (const dep of step.definition.dependencies) {
        dependencies.push(dep)
        traverse(dep) // Recursive call
      }
    }
  }
  
  traverse(stepName)
  return [...new Set(dependencies)]
}

// Get all dependents (recursive downward)  
const getAllDependents = (stepName: string, workflow: WorkflowDefinition): string[] => {
  const visited = new Set<string>()
  const dependents: string[] = []
  
  const traverse = (currentStep: string) => {
    if (visited.has(currentStep)) return
    visited.add(currentStep)
    
    // Find steps that depend on currentStep
    const stepDependents = workflow.steps.filter(s => 
      s.definition.dependencies?.includes(currentStep)
    )
    
    for (const dependent of stepDependents) {
      dependents.push(dependent.name)
      traverse(dependent.name) // Recursive call
    }
  }
  
  traverse(stepName)
  return [...new Set(dependents)]
}
```

## API Integration

### Route Handlers

**Location**: `src/app/api/workflows/`

#### Workflow Listing (`route.ts`)
```typescript
// GET /api/workflows
export async function GET() {
  const registry = new WorkflowRegistry(workflowsPath)
  await registry.discoverWorkflows()
  return Response.json(registry.getAllWorkflows())
}
```

#### Workflow Execution (`[id]/route.ts`)
```typescript
// POST /api/workflows/[id]
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { stepConfig } = await request.json()
  const engine = new WorkflowEngine()
  
  // Start workflow execution
  const runId = await engine.runWorkflow(workflowDefinition, { steps: stepConfig })
  return Response.json({ runId, status: 'started' })
}
```

#### Status Polling (`[id]/status/route.ts`)
```typescript
// GET /api/workflows/[id]/status
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const status = await getWorkflowRunStatus(params.id)
  return Response.json(status)
}
```

### Real-Time Updates

**Polling Strategy**:
```typescript
// In useWorkflowExecution hook
useEffect(() => {
  if (!isRunning) return
  
  const interval = setInterval(async () => {
    const status = await fetch(`/api/workflows/${workflowId}/status`)
    const data = await status.json()
    
    setProgress(data.progress)
    setCurrentStep(data.currentStep)
    setStatus(data.status)
    
    if (data.status === 'completed' || data.status === 'failed') {
      setIsRunning(false)
    }
  }, 1000) // Poll every second
  
  return () => clearInterval(interval)
}, [isRunning, workflowId])
```

## Page Structure

### App Router Pages

**Location**: `src/app/`

#### Workflow Management
- `/workflows/page.tsx` - Workflow listing and discovery
- `/workflows/[id]/page.tsx` - Workflow detail and execution
- `/workflows/[id]/edit/page.tsx` - Step configuration (deprecated)
- `/workflows/[id]/layout.tsx` - Shared layout for workflow pages
- `/workflows/layout.tsx` - Workflow section layout

#### API Routes
- `/api/workflows/route.ts` - Workflow CRUD operations
- `/api/workflows/[id]/route.ts` - Individual workflow operations
- `/api/workflows/[id]/status/route.ts` - Real-time status updates

### Layout Hierarchy

```typescript
// Root layout
app/layout.tsx
├── Global styles and providers
├── App sidebar integration
└── Main content area

// Workflow section layout  
app/workflows/layout.tsx
├── Workflow-specific navigation
├── Breadcrumb integration
└── Workflow content wrapper

// Individual workflow layout
app/workflows/[id]/layout.tsx  
├── Workflow header with metadata
├── Tab navigation (detail, logs, history)
└── Dynamic content area
```

## Styling Architecture

### Tailwind CSS Integration

**Configuration**: `tailwind.config.ts`
- Custom color palette for workflow states
- Typography scale for technical content
- Component-specific utilities
- Dark mode support

**Design System**:
```css
/* Workflow status colors */
.status-pending { @apply bg-gray-100 text-gray-700; }
.status-running { @apply bg-blue-100 text-blue-700; }
.status-completed { @apply bg-green-100 text-green-700; }
.status-failed { @apply bg-red-100 text-red-700; }

/* Progress indicators */
.progress-bar { @apply bg-gray-200 rounded-full overflow-hidden; }
.progress-fill { @apply bg-blue-500 h-full transition-all duration-300; }

/* Dependency indicators */
.dependency-missing { @apply border-2 border-dashed border-orange-300; }
.dependency-satisfied { @apply border-2 border-solid border-green-300; }
```

### Component Styling Patterns

**Consistent State Representation**:
- Color coding for workflow and step states
- Icon usage for quick visual identification  
- Typography hierarchy for information density
- Responsive design for mobile and desktop

**Interactive Elements**:
- Hover states for all clickable elements
- Loading states during async operations
- Disabled states for invalid configurations
- Focus management for accessibility

## Accessibility Considerations

### Keyboard Navigation
- Tab ordering for workflow step configuration
- Keyboard shortcuts for common actions
- Focus indicators for all interactive elements

### Screen Reader Support
- ARIA labels for workflow state information
- Semantic HTML structure
- Progress announcements for screen readers

### Visual Accessibility
- High contrast color schemes
- Clear visual hierarchy
- Scalable text and UI elements
- Alternative text for status indicators

## Performance Optimizations

### Component Optimization
- React.memo for expensive components
- useMemo for complex calculations
- useCallback for stable function references
- Code splitting for large workflow components

### Data Fetching
- SWR or React Query for API state management
- Optimistic updates for immediate feedback
- Error boundaries for graceful error handling
- Polling optimization to reduce server load

### Rendering Performance
- Virtual scrolling for large step lists
- Lazy loading for workflow history
- Debounced search and filtering
- Efficient re-rendering patterns