# Optimization Tasks

## Fix generateSentenceAnnotations Function Accuracy Issues

**Location**: `apps/generator/src/workflows/minna-jp-1/services/sentence.ts:31-108`

### Current Problems
- AI model (GPT-4o) provides incorrect character positions and lengths for annotations
- No validation of returned positions against actual sentence content  
- Complex prompt trying to do vocabulary matching + furigana generation + positioning in one step
- Unreliable character counting from LLM output

### Optimization Strategy: Hybrid Approach

#### Phase 1: Add Deterministic Validation
- [ ] Create `validateAnnotation(sentence: string, annotation: Annotation): boolean` function
- [ ] Add position validation to check AI-generated positions against actual text
- [ ] Implement automatic position correction for vocabulary annotations
- [ ] Add comprehensive logging for debugging annotation issues

#### Phase 2: Implement Hybrid Vocabulary Matching
- [ ] Split vocabulary annotation (deterministic) from furigana generation (AI)
- [ ] Replace AI vocabulary positioning with exact string matching using `String.indexOf()`
- [ ] Implement fuzzy matching for vocabulary variations (conjugations, particles)
- [ ] Keep AI only for furigana content generation, not positioning

#### Phase 3: Optimize Furigana Processing
- [ ] Use regex patterns for kanji detection: `/[\u4e00-\u9faf]/g`
- [ ] Implement character-by-character processing for accurate positioning
- [ ] Consider using Japanese text processing library (kuromoji.js) for tokenization
- [ ] Generate furigana content via AI but calculate positions deterministically

#### Phase 4: Enhanced Error Handling
- [ ] Add fallback strategies for failed annotations
- [ ] Implement overlap detection and resolution
- [ ] Add comprehensive validation layer with automatic correction
- [ ] Create unit tests for annotation accuracy

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