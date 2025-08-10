# Vocabulary Translation Scripts

This directory contains scripts to efficiently generate Traditional Chinese (zhTW) and English (enUS) translations for all Japanese vocabulary items.

## Current Status
- **Total vocabulary items**: 2,387
- **Currently translated**: 20 items (0.84%)
- **Remaining**: 2,367 items

## Available Scripts

### 1. `generate-translations.js` (Recommended for manual workflow)
Interactive script that processes items in batches and allows you to use any AI service manually.

**Usage:**
```bash
node generate-translations.js
```

**Features:**
- Processes 150 items per batch (configurable)
- Shows clear prompts for AI translation services
- Validates all translations before saving
- Resumes from where you left off
- Saves progress after each successful batch
- Graceful error handling and interruption support

**Workflow:**
1. Script shows a batch of vocabulary items
2. Displays an AI prompt for translation
3. You copy the prompt to Claude/ChatGPT/etc.
4. Paste the JSON response back
5. Script validates and saves the translations
6. Continues to next batch

### 2. `generate-translations-api.js` (For API integration)
Automated script for direct API integration (requires implementation).

**Setup required:**
- Edit the `callTranslationAPI` function to use your preferred service:
  - OpenAI GPT-4
  - Claude (Anthropic)
  - Google Translate API
  - Azure Translator

**Usage:**
```bash
node generate-translations-api.js
```

### 3. `translation-utils.js` (Analysis and management)
Utility script for analyzing progress and managing translations.

**Commands:**
```bash
# Show translation statistics
node translation-utils.js stats

# Show missing translations (first 20)
node translation-utils.js missing

# Show missing translations (first 50)
node translation-utils.js missing 50

# Validate existing translations
node translation-utils.js validate

# Show sample translations
node translation-utils.js sample

# Export next batch for translation
node translation-utils.js export

# Search in existing translations
node translation-utils.js search "student"
```

## Data Format

### Input (vocs.json):
```json
[
  {
    "id": 1,
    "lesson": 1,
    "content": "私",
    "translation": "我",
    "pos": "名",
    "accent": 0,
    "annotations": [...]
  }
]
```

### Output (vocs-translations.json):
```json
{
  "1": {
    "zhCN": "我", 
    "zhTW": "我", 
    "enUS": "I, me"
  },
  "2": {
    "zhCN": "先生、女士、同志（称呼人时，为了表示礼貌接在名字后面的接尾词）", 
    "zhTW": "先生、女士、同志（稱呼人時，為了表示禮貌接在名字後面的接尾詞）", 
    "enUS": "Mr./Ms. (polite suffix added after names)"
  }
}
```

## Translation Guidelines

When translating, follow these principles:

### Traditional Chinese (zhTW):
- Use Taiwan conventions (繁體中文)
- Convert from Simplified Chinese appropriately
- Maintain educational context and clarity
- Use proper Traditional Chinese characters

### English (enUS):
- Clear and educational translations
- Include context when helpful for learning
- Concise but informative
- Consistent with language learning materials
- For particles and grammar elements, provide brief explanations

## Recommended Workflow

1. **Start translation session:**
   ```bash
   node generate-translations.js
   ```

2. **Monitor progress:**
   ```bash
   node translation-utils.js stats
   ```

3. **Validate translations:**
   ```bash
   node translation-utils.js validate
   ```

4. **Search for specific items:**
   ```bash
   node translation-utils.js search "your term"
   ```

## Progress Tracking

- Progress is automatically saved after each successful batch
- You can resume at any time by running the script again
- Translation files are incrementally updated to prevent data loss
- Graceful handling of interruptions (Ctrl+C)

## Error Handling

- Validation ensures all translations meet quality standards
- Failed batches can be retried
- Progress is preserved even if errors occur
- Clear error messages guide you through issues

## Batch Processing

- Default batch size: 150 items (optimal for most AI services)
- Configurable batch sizes for different needs
- Smart batching avoids splitting related vocabulary
- Resume capability ensures no duplicate work

## Time Estimation

At 150 items per batch:
- **Total batches needed**: ~16 batches
- **Estimated time per batch**: 3-5 minutes
- **Total estimated time**: 1-2 hours

The actual time depends on:
- AI service response speed
- Your copy/paste efficiency
- Validation and review time

## Tips for Efficient Translation

1. **Use a fast AI service**: Claude or GPT-4 provide good results
2. **Work in focused sessions**: Process 3-5 batches at a time
3. **Review samples**: Check the sample translations after each batch
4. **Take breaks**: Maintain translation quality with regular breaks
5. **Validate regularly**: Use the validation command to catch issues early

---

**Start your translation session with:**
```bash
node generate-translations.js
```