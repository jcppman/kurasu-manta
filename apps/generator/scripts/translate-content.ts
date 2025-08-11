#!/usr/bin/env tsx

import fs from 'node:fs/promises'
import path from 'node:path'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

interface TranslationConfig {
  batchSize: number
  maxRetries: number
  delayBetweenBatches: number
  provider: 'openai' | 'google'
  resumeFrom?: number
  vocabOnly?: boolean
  grammarOnly?: boolean
  dryRun?: boolean
}

interface VocabularyItem {
  id: number
  lesson: number
  content: string
  translation: string
  pos: string
  accent: number | number[] | null
  annotations: Array<{
    type: string
    loc: number
    len: number
    content: string
  }>
}

interface GrammarItem {
  lesson: number
  content: string
  explanation: string
  id?: number
}

interface Translation {
  zhCN: string
  zhTW: string
  enUS: string
}

const translationSchema = z.object({
  translations: z.record(
    z.string(),
    z.object({
      zhCN: z.string(),
      zhTW: z.string(),
      enUS: z.string(),
    })
  ),
})

class TranslationService {
  private config: TranslationConfig
  private contentDir: string
  private translationsDir: string

  constructor(config: TranslationConfig) {
    this.config = config
    this.contentDir = path.join(process.cwd(), 'src/workflows/minna-jp-1/content')
    this.translationsDir = path.join(this.contentDir, 'translations')
  }

  async loadVocabulary(): Promise<VocabularyItem[]> {
    const vocPath = path.join(this.contentDir, 'vocs.json')
    const content = await fs.readFile(vocPath, 'utf8')
    return JSON.parse(content)
  }

  async loadGrammar(): Promise<GrammarItem[]> {
    const grammarPath = path.join(this.contentDir, 'grammar.json')
    const content = await fs.readFile(grammarPath, 'utf8')
    const grammarItems = JSON.parse(content)

    // Add IDs to grammar items if they don't exist
    return grammarItems.map((item: GrammarItem, index: number) => ({
      ...item,
      id: item.id || index + 1,
    }))
  }

  async loadExistingTranslations(type: 'vocs' | 'grammar'): Promise<Record<string, Translation>> {
    const filePath = path.join(this.translationsDir, `${type}-translations.json`)

    try {
      const content = await fs.readFile(filePath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.log(`No existing ${type} translations found, starting fresh`)
      return {}
    }
  }

  async saveTranslations(
    type: 'vocs' | 'grammar',
    translations: Record<string, Translation>
  ): Promise<void> {
    const filePath = path.join(this.translationsDir, `${type}-translations.json`)

    // Create backup
    try {
      await fs.access(filePath)
      const backupPath = `${filePath}.backup.${Date.now()}`
      await fs.copyFile(filePath, backupPath)
      console.log(`Backup created: ${backupPath}`)
    } catch (error) {
      // File doesn't exist, no backup needed
    }

    // Ensure directory exists
    await fs.mkdir(this.translationsDir, { recursive: true })

    // Save translations
    await fs.writeFile(filePath, JSON.stringify(translations, null, 2))
    console.log(`Saved ${Object.keys(translations).length} ${type} translations`)
  }

  async translateBatch(
    items: Array<{ id: number; content: string; translation: string }>
  ): Promise<Record<string, Translation>> {
    const prompt = `You are translating Japanese vocabulary/grammar content. 
    
For each item, you need to:
1. Keep the existing Simplified Chinese (zhCN) exactly as provided
2. Convert to Traditional Chinese (zhTW) using Taiwan conventions
3. Provide natural English translations (enUS)

Items to translate:
${items.map((item) => `ID ${item.id}: "${item.content}" (zhCN: "${item.translation}")`).join('\n')}

Return ONLY a JSON object with this exact structure:
{
  "translations": {
    "${items[0].id}": {"zhCN": "existing_simplified", "zhTW": "traditional_chinese", "enUS": "english_translation"},
    ...
  }
}`

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      prompt,
      schema: translationSchema,
      temperature: 0.1, // Low temperature for consistent translations
    })

    return result.object.translations
  }

  async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async processWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (retries > 0) {
        console.log(`Operation failed, retrying... (${retries} retries left)`)
        await this.delay(2000 * (this.config.maxRetries - retries + 1)) // Exponential backoff
        return this.processWithRetry(operation, retries - 1)
      }
      throw error
    }
  }

  async processVocabulary(): Promise<void> {
    console.log('\n🔤 Processing vocabulary translations...')

    const vocabulary = await this.loadVocabulary()
    const existingTranslations = await this.loadExistingTranslations('vocs')

    // Filter items that need translation
    const itemsToTranslate = vocabulary.filter((item) => {
      const hasExisting = existingTranslations[item.id.toString()]
      const shouldSkip = this.config.resumeFrom && item.id < this.config.resumeFrom
      return !hasExisting && !shouldSkip
    })

    if (itemsToTranslate.length === 0) {
      console.log('✅ All vocabulary items already translated!')
      return
    }

    console.log(
      `📊 Found ${itemsToTranslate.length} items to translate (${Object.keys(existingTranslations).length} already done)`
    )

    if (this.config.dryRun) {
      console.log(
        '🔍 DRY RUN: Would translate items:',
        itemsToTranslate.slice(0, 5).map((item) => `${item.id}: ${item.content}`)
      )
      return
    }

    // Process in batches
    for (let i = 0; i < itemsToTranslate.length; i += this.config.batchSize) {
      const batch = itemsToTranslate.slice(i, i + this.config.batchSize)
      const batchNumber = Math.floor(i / this.config.batchSize) + 1
      const totalBatches = Math.ceil(itemsToTranslate.length / this.config.batchSize)

      console.log(
        `\n📦 Processing batch ${batchNumber}/${totalBatches} (items ${batch[0].id}-${batch[batch.length - 1].id})`
      )

      try {
        const batchTranslations = await this.processWithRetry(async () => {
          return await this.translateBatch(
            batch.map((item) => ({
              id: item.id,
              content: item.content,
              translation: item.translation,
            }))
          )
        })

        // Merge with existing translations
        const updatedTranslations = { ...existingTranslations, ...batchTranslations }

        // Save incrementally
        await this.saveTranslations('vocs', updatedTranslations)

        // Update for next iteration
        Object.assign(existingTranslations, batchTranslations)

        console.log(
          `✅ Completed batch ${batchNumber}/${totalBatches} (${Object.keys(updatedTranslations).length}/${vocabulary.length} total)`
        )

        // Progress percentage
        const progress = (
          (Object.keys(updatedTranslations).length / vocabulary.length) *
          100
        ).toFixed(1)
        console.log(`📈 Progress: ${progress}% complete`)

        // Delay between batches to be respectful to API
        if (i + this.config.batchSize < itemsToTranslate.length) {
          console.log(`⏳ Waiting ${this.config.delayBetweenBatches}ms before next batch...`)
          await this.delay(this.config.delayBetweenBatches)
        }
      } catch (error) {
        console.error(`❌ Failed to process batch ${batchNumber}:`, error)
        console.log(`💾 Progress saved up to item ${i > 0 ? itemsToTranslate[i - 1].id : 'none'}`)
        throw error
      }
    }

    console.log('🎉 Vocabulary translation completed!')
  }

  async processGrammar(): Promise<void> {
    console.log('\n📚 Processing grammar translations...')

    const grammar = await this.loadGrammar()
    const existingTranslations = await this.loadExistingTranslations('grammar')

    // Filter items that need translation
    const itemsToTranslate = grammar.filter((item) => {
      if (!item.id) return false
      const hasExisting = existingTranslations[item.id.toString()]
      return !hasExisting
    })

    if (itemsToTranslate.length === 0) {
      console.log('✅ All grammar items already translated!')
      return
    }

    console.log(`📊 Found ${itemsToTranslate.length} grammar items to translate`)

    if (this.config.dryRun) {
      console.log(
        '🔍 DRY RUN: Would translate grammar items:',
        itemsToTranslate.slice(0, 3).map((item) => `${item.id}: ${item.content}`)
      )
      return
    }

    // Process in batches (grammar items are usually fewer)
    for (let i = 0; i < itemsToTranslate.length; i += this.config.batchSize) {
      const batch = itemsToTranslate.slice(i, i + this.config.batchSize)
      const batchNumber = Math.floor(i / this.config.batchSize) + 1
      const totalBatches = Math.ceil(itemsToTranslate.length / this.config.batchSize)

      console.log(`📦 Processing grammar batch ${batchNumber}/${totalBatches}`)

      try {
        const batchTranslations = await this.processWithRetry(async () => {
          return await this.translateBatch(
            batch.map((item) => ({
              id: item.id as number,
              content: item.content,
              translation: item.explanation,
            }))
          )
        })

        // Merge with existing translations
        const updatedTranslations = { ...existingTranslations, ...batchTranslations }
        await this.saveTranslations('grammar', updatedTranslations)

        Object.assign(existingTranslations, batchTranslations)

        console.log(`✅ Completed grammar batch ${batchNumber}/${totalBatches}`)

        if (i + this.config.batchSize < itemsToTranslate.length) {
          await this.delay(this.config.delayBetweenBatches)
        }
      } catch (error) {
        console.error(`❌ Failed to process grammar batch ${batchNumber}:`, error)
        throw error
      }
    }

    console.log('🎉 Grammar translation completed!')
  }

  async run(): Promise<void> {
    console.log('🚀 Starting automated translation process...')
    console.log(
      `⚙️  Config: batch=${this.config.batchSize}, provider=${this.config.provider}, delay=${this.config.delayBetweenBatches}ms`
    )

    if (this.config.dryRun) {
      console.log('🔍 DRY RUN MODE - No actual translations will be made')
    }

    try {
      if (!this.config.grammarOnly) {
        await this.processVocabulary()
      }

      if (!this.config.vocabOnly) {
        await this.processGrammar()
      }

      console.log('\n🎊 Translation process completed successfully!')
    } catch (error) {
      console.error('\n💥 Translation process failed:', error)
      process.exit(1)
    }
  }
}

// CLI argument parsing
function parseArgs(): TranslationConfig {
  const args = process.argv.slice(2)
  const config: TranslationConfig = {
    batchSize: 50,
    maxRetries: 3,
    delayBetweenBatches: 1000,
    provider: 'openai',
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        config.batchSize = Number.parseInt(args[++i])
        break
      case '--provider':
        config.provider = args[++i] as 'openai' | 'google'
        break
      case '--resume-from':
        config.resumeFrom = Number.parseInt(args[++i])
        break
      case '--vocab-only':
        config.vocabOnly = true
        break
      case '--grammar-only':
        config.grammarOnly = true
        break
      case '--dry-run':
        config.dryRun = true
        break
      case '--help':
        console.log(`
Usage: npx tsx scripts/translate-content.ts [options]

Options:
  --batch-size <number>     Number of items per API call (default: 50)
  --provider <provider>     AI provider: openai|google (default: openai)
  --resume-from <id>        Resume from specific item ID
  --vocab-only             Only process vocabulary
  --grammar-only           Only process grammar
  --dry-run                Preview what would be translated
  --help                   Show this help

Examples:
  npx tsx scripts/translate-content.ts
  npx tsx scripts/translate-content.ts --vocab-only --batch-size 25
  npx tsx scripts/translate-content.ts --resume-from 600
  npx tsx scripts/translate-content.ts --dry-run
        `)
        process.exit(0)
    }
  }

  return config
}

// Main execution
async function main() {
  const config = parseArgs()
  const service = new TranslationService(config)
  await service.run()
}

if (require.main === module) {
  main().catch(console.error)
}

export { TranslationService }
