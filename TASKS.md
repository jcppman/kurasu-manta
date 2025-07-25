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
