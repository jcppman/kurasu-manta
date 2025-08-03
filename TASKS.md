# Optimization Tasks

## Create Standalone Translation Generation Function

**Location**: `apps/generator/src/workflows/minna-jp-1/services/sentence.ts`

### Refactor Strategy: Separate Translation Generation
- [x] Extract translation generation into standalone function: `generateSentenceExplanations(sentences: string[]): Promise<{zhCN: string, enUS: string}[]>`
- [x] Design focused prompt for accurate Japanese-to-Chinese/English translations
- [x] Implement batch processing for multiple sentences efficiently
- [x] Add validation for translation quality and completeness
- [x] Remove translation generation from current sentence generation prompt

### Benefits of Separation
- **Reduced cognitive load**: Each LLM call focuses on a single, clear objective
- **Better quality**: Dedicated translation prompt produces more accurate translations
- **Modular testing**: Can optimize sentence generation and translations independently
- **Easier debugging**: Isolate issues to specific generation steps

## Fix generateSentenceAnnotations Function Accuracy Issues

**Location**: `apps/generator/src/workflows/minna-jp-1/services/sentence.ts:31-108`

### Current Problems
- AI model (GPT-4o) provides incorrect character positions and lengths for annotations
- No validation of returned positions against actual sentence content  
- Complex prompt trying to do vocabulary matching + furigana generation + positioning in one step
- Unreliable character counting from LLM output

### Optimization Strategy: Tokenized Output Approach

#### Primary Solution: Generation-Time Tokenization + Separate Explanations

**Concept**:
- **Generation Input**: Vocabulary buckets + constraints
- **LLM Generation Output**: `{content: '私は日本人です', tokens: ['私[わたし]', 'は', '日本人[にほんじん]', 'です'], vocabularyIds: [1,3], grammarIds: [2]}`
- **Explanation Step**: Separate call to generate explanations for batch of sentences
- **Post-processing**: Calculate positions deterministically from tokenized output

**Updated Implementation Steps**:
- [x] Modify sentence generation prompt to include tokenization output (remove explanation generation)
- [x] Update `GeneratedSentence` schema to include `tokens: string[]` field
- [x] Implement `generateSentenceExplanations(sentences: string[]): Promise<{zhCN: string, enUS: string}[]>` function
- [x] Create token parser function to extract furigana from bracketed notation `token[furigana]`
- [x] Build deterministic position calculator that processes tokens sequentially
- [x] Map vocabulary IDs by matching tokens against provided vocabulary list
- [x] Integrate explanation generation step after sentence creation in main pipeline
- [x] Generate final `Annotation[]` with accurate `loc` and `len` values

**Enhanced Benefits**:
- **Generation-time tokenization**: LLM tokenizes content it just created (perfect context understanding)
- **Reduced cognitive load**: Sentence generation focuses purely on Japanese structure + tokenization
- **Better explanations**: Dedicated explanation prompt produces higher quality pedagogical content
- **Eliminates character counting errors**: Deterministic calculation from tokens
- **Modular approach**: Independent testing and optimization of each step
- **More reliable**: Leverages LLM's understanding of its own output structure

### Implementation Notes
- Maintain backwards compatibility with existing `Annotation` interface
- Ensure deterministic and reproducible results
- Add performance monitoring for annotation generation time
- Consider caching frequently used vocabulary patterns

### Success Metrics
- 100% accurate character positions for vocabulary annotations
- Significant reduction in annotation errors
- Faster annotation generation through reduced AI dependency
- Better error handling and recovery

## Add Retry Mechanism to Sentence Generation

**Location**: `apps/generator/src/workflows/minna-jp-1/services/data.ts:198-202`

### Completed Work
- [x] Created generic retry utility with exponential backoff in `src/lib/async.ts`
- [x] Added retry mechanism to `generateSentencesForLessonNumber` call using `MAX_LLM_RETRY_TIMES` constant
- [x] Refactored existing retry logic in `generateSentenceExplanations` to use new reusable utility
- [x] Implemented comprehensive unit tests covering all retry scenarios (success, failure, backoff, max delay)
- [x] Ensured code passes linting and type checking

### Features
- **Exponential backoff**: Configurable initial delay with backoff factor to avoid overwhelming services
- **Maximum delay cap**: Prevents excessive wait times on repeated failures  
- **Proper error logging**: Logs each retry attempt with attempt count and delay information
- **Type-safe**: Preserves return types and provides proper TypeScript inference
- **Configurable**: Supports custom retry options while providing sensible defaults
- **Reusable**: Can be applied to any async function that needs retry logic

### Benefits
- **Improved reliability**: Handles transient failures in LLM API calls automatically
- **Consistent retry behavior**: All retry logic uses the same tested utility
- **Better error handling**: Proper logging and error propagation on final failure
- **Reduced maintenance**: Centralized retry logic instead of scattered implementations

## Web Application UI/UX Improvements

**Location**: `apps/web/`

### Sentence Viewer Enhancements

#### 1. Add Explanations for All Languages
- [x] Add explanation field display in sentence viewer component
- [x] Implement language toggle for explanations (if multiple languages available)
- [x] Ensure explanations are fetched and displayed properly from backend data
- [x] Test explanation display with existing sentence data

#### 2. Fix Annotation Hover Card Positioning
- [x] Identify current tooltip/card positioning logic for annotations
- [x] Implement precise positioning to place card directly below mouse pointer
- [x] Add boundary detection to prevent cards from going off-screen
- [x] Test hover positioning across different screen sizes and browser zoom levels
- [x] Ensure card follows pointer movement when hovering over long annotations

#### 3. Display Furigana Above Kanji (Remove Hover Tooltip)
- [x] Modify furigana annotation rendering to show permanently above kanji
- [x] Remove hover tooltip behavior for furigana annotations
- [x] Implement proper vertical spacing to avoid text overlap
- [x] Ensure furigana display works correctly with different font sizes
- [x] Test furigana positioning with mixed kanji/hiragana content

### Lesson List Page Improvements

#### 4. Show Content Count Statistics
- [x] Add database queries to count vocabularies, grammar items, and sentences per lesson
- [x] Create UI components to display count statistics in lesson list cards
- [x] Implement proper loading states while fetching count data
- [x] Design clear visual presentation of count information (badges, icons, etc.)
- [x] Add caching mechanism for count data to improve performance

### Lesson Detail Page Enhancements

#### 5. Vocabulary/Grammar Navigation to Related Sentences
- [x] Implement click handlers for vocabulary and grammar items in lesson detail
- [x] Create sentence filtering logic to show only sentences containing selected item
- [x] Build dedicated sentence view page with filtering parameters
- [x] Add navigation routing between lesson detail and filtered sentence view
- [x] Implement back navigation from filtered sentences to lesson detail
- [x] Add visual indicators showing which sentences contain the selected item

#### 6. Show Explanations in Vocabulary and Grammar Cards
- [x] Add explanation display to vocabulary cards in lesson detail
- [x] Add explanation display to grammar cards in lesson detail
- [x] Implement expandable/collapsible explanation sections if content is long
- [x] Ensure explanations support multiple languages if available
- [x] Add proper styling and formatting for explanation text

### Implementation Considerations
- Ensure all changes maintain responsive design across desktop and mobile
- Follow existing component patterns and styling conventions in the codebase
- Add proper TypeScript types for new data structures
- Implement loading states and error handling for all new features
- Write unit tests for new components and functionality
- Test accessibility features (keyboard navigation, screen readers)
