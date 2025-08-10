#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Paths
const VOCS_PATH = './apps/generator/src/workflows/minna-jp-1/content/vocs.json';
const TRANSLATIONS_PATH = './apps/generator/src/workflows/minna-jp-1/content/translations/vocs-translations.json';
const PROGRESS_PATH = './translation-progress.json';

class TranslationGenerator {
  constructor() {
    this.vocs = JSON.parse(fs.readFileSync(VOCS_PATH, 'utf8'));
    this.translations = this.loadExistingTranslations();
    this.progress = this.loadProgress();
    this.batchSize = 50; // Smaller batches for more manageable processing
  }

  loadExistingTranslations() {
    try {
      return JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, 'utf8'));
    } catch (error) {
      return {};
    }
  }

  loadProgress() {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    } catch (error) {
      return { lastProcessedIndex: 0, totalProcessed: 0, totalItems: this.vocs.length };
    }
  }

  saveProgress() {
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(this.progress, null, 2));
  }

  saveTranslations() {
    fs.writeFileSync(TRANSLATIONS_PATH, JSON.stringify(this.translations, null, 2));
  }

  showProgress() {
    const percent = ((this.progress.totalProcessed / this.progress.totalItems) * 100).toFixed(1);
    console.log(`Progress: ${this.progress.totalProcessed}/${this.progress.totalItems} (${percent}%)`);
    console.log(`Next batch starts at index: ${this.progress.lastProcessedIndex}`);
  }

  getBatch(startIndex) {
    return this.vocs.slice(startIndex, startIndex + this.batchSize);
  }

  displayBatchForTranslation(batch, startIndex) {
    console.log(`\n=== TRANSLATION BATCH ${startIndex} - ${startIndex + batch.length - 1} ===`);
    console.log(`Please translate the following ${batch.length} items:\n`);
    
    batch.forEach((item, i) => {
      console.log(`${i + 1}. ID: ${item.id}`);
      console.log(`   Japanese: ${item.content}`);
      console.log(`   Simplified Chinese: ${item.translation}`);
      console.log('');
    });

    console.log('\nPlease provide translations in this JSON format:');
    console.log('{');
    console.log('  "' + batch[0].id + '": {"zhCN": "' + batch[0].translation + '", "zhTW": "[Traditional Chinese]", "enUS": "[English]"},');
    if (batch.length > 1) {
      console.log('  "' + batch[1].id + '": {"zhCN": "' + batch[1].translation + '", "zhTW": "[Traditional Chinese]", "enUS": "[English]"},');
      console.log('  ...');
    }
    console.log('}');
  }

  processBatch(batchTranslations) {
    // Validate the translations
    for (const [id, translations] of Object.entries(batchTranslations)) {
      if (!translations.zhCN || !translations.zhTW || !translations.enUS) {
        throw new Error(`Incomplete translations for ID ${id}`);
      }
    }

    // Add to main translations
    Object.assign(this.translations, batchTranslations);

    // Update progress
    this.progress.totalProcessed += Object.keys(batchTranslations).length;
    this.progress.lastProcessedIndex += Object.keys(batchTranslations).length;

    // Save both translations and progress
    this.saveTranslations();
    this.saveProgress();

    console.log(`✅ Saved ${Object.keys(batchTranslations).length} translations`);
    this.showProgress();
  }

  getNextBatch() {
    const startIndex = this.progress.lastProcessedIndex;
    if (startIndex >= this.vocs.length) {
      console.log('🎉 All translations completed!');
      return null;
    }

    const batch = this.getBatch(startIndex);
    this.displayBatchForTranslation(batch, startIndex);
    return batch;
  }

  stats() {
    this.showProgress();
    console.log(`Existing translations: ${Object.keys(this.translations).length}`);
    console.log(`Remaining items: ${this.vocs.length - this.progress.totalProcessed}`);
  }
}

// Main execution
const generator = new TranslationGenerator();

const command = process.argv[2];

switch (command) {
  case 'stats':
    generator.stats();
    break;
  
  case 'next':
    generator.getNextBatch();
    break;
  
  case 'save':
    try {
      const translations = JSON.parse(process.argv[3] || '{}');
      generator.processBatch(translations);
    } catch (error) {
      console.error('Error processing translations:', error.message);
      console.log('Usage: node generate-translations.js save \'{"1": {"zhCN": "...", "zhTW": "...", "enUS": "..."}}\'');
    }
    break;
  
  default:
    console.log('Japanese Vocabulary Translation Generator');
    console.log('=========================================');
    generator.stats();
    console.log('\nCommands:');
    console.log('  node generate-translations.js stats  - Show current progress');
    console.log('  node generate-translations.js next   - Show next batch to translate');  
    console.log('  node generate-translations.js save \'{"id":{"zhCN":"","zhTW":"","enUS":""}}\' - Save translations');
    console.log('\nTo start translating, run: node generate-translations.js next');
    break;
}