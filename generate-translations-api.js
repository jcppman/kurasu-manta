#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const BATCH_SIZE = 100; // Process 100 items at a time for API calls
const PROGRESS_FILE = './translation-progress-api.json';
const VOCS_PATH = './apps/generator/src/workflows/minna-jp-1/content/vocs.json';
const TRANSLATIONS_PATH = './apps/generator/src/workflows/minna-jp-1/content/translations/vocs-translations.json';
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between API calls

// Load data
const vocs = JSON.parse(fs.readFileSync(VOCS_PATH, 'utf8'));
let translations = {};

// Load existing translations if they exist
if (fs.existsSync(TRANSLATIONS_PATH)) {
  translations = JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, 'utf8'));
}

// Load progress if it exists
let progress = { lastProcessedIndex: 0, totalProcessed: 0, errors: [] };
if (fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

console.log(`🤖 Automated Vocabulary Translation Generator`);
console.log(`Total items: ${vocs.length}`);
console.log(`Already translated: ${Object.keys(translations).length}`);
console.log(`Batch size: ${BATCH_SIZE}`);

function saveProgress(lastIndex, totalProcessed, error = null) {
  progress.lastProcessedIndex = lastIndex;
  progress.totalProcessed = totalProcessed;
  progress.lastUpdated = new Date().toISOString();
  
  if (error) {
    progress.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      batchIndex: lastIndex
    });
  }
  
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveTranslations() {
  fs.writeFileSync(TRANSLATIONS_PATH, JSON.stringify(translations, null, 2));
  console.log(`💾 Saved ${Object.keys(translations).length} translations`);
}

function createTranslationPrompt(batch) {
  const promptItems = batch.map(item => {
    return `ID: ${item.id}
Japanese: ${item.content}
Simplified Chinese: ${item.translation}
Part of Speech: ${item.pos}`;
  }).join('\n---\n');

  return `You are a professional translator specializing in Japanese language education materials. Please translate the following Japanese vocabulary items to Traditional Chinese (zhTW) and English (enUS).

Guidelines:
- Traditional Chinese should use Taiwan conventions (繁體中文)
- English should be clear, educational, and include context when helpful
- Maintain consistency with existing translations in a learning context
- For particles and grammar elements, provide brief explanations
- Keep translations concise but informative

Please respond with ONLY a JSON object in this exact format:
{
  "1": {"zhTW": "traditional_chinese_translation", "enUS": "english_translation"},
  "2": {"zhTW": "traditional_chinese_translation", "enUS": "english_translation"}
}

Vocabulary items to translate:

${promptItems}

Respond with only the JSON object, no additional text.`;
}

// Mock API call function - replace with your actual API implementation
async function callTranslationAPI(prompt) {
  // This is a mock implementation. Replace with your actual API call:
  // - OpenAI API
  // - Claude API (Anthropic)
  // - Google Translate API
  // - Azure Translator
  // etc.
  
  throw new Error('API implementation required. Please implement callTranslationAPI function with your preferred translation service.');
  
  /* Example implementation for OpenAI:
  
  const { OpenAI } = require('openai');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a professional translator. Always respond with valid JSON only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 4000
  });
  
  return response.choices[0].message.content.trim();
  
  */
  
  /* Example implementation for Claude (Anthropic):
  
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4000,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });
  
  return response.content[0].text.trim();
  
  */
}

function validateTranslations(batchTranslations, batch) {
  const errors = [];
  
  if (!batchTranslations || typeof batchTranslations !== 'object') {
    return ['Invalid response format: expected JSON object'];
  }
  
  for (const item of batch) {
    const translation = batchTranslations[item.id.toString()];
    if (!translation) {
      errors.push(`Missing translation for ID ${item.id}`);
      continue;
    }
    
    if (!translation.zhTW || !translation.enUS) {
      errors.push(`Incomplete translation for ID ${item.id}: missing zhTW or enUS`);
    }
    
    if (typeof translation.zhTW !== 'string' || typeof translation.enUS !== 'string') {
      errors.push(`Invalid translation format for ID ${item.id}: translations must be strings`);
    }
    
    if (translation.zhTW.length > 500 || translation.enUS.length > 500) {
      errors.push(`Translation too long for ID ${item.id}: exceeds 500 characters`);
    }
  }
  
  return errors;
}

async function processBatch(batch, batchIndex, totalBatches) {
  console.log(`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches} (items ${batch[0].id}-${batch[batch.length-1].id})`);
  
  const prompt = createTranslationPrompt(batch);
  
  try {
    console.log('🌐 Calling translation API...');
    const response = await callTranslationAPI(prompt);
    
    // Clean and parse response
    const cleanResponse = response.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
    let batchTranslations;
    
    try {
      batchTranslations = JSON.parse(cleanResponse);
    } catch (parseError) {
      throw new Error(`Failed to parse API response as JSON: ${parseError.message}`);
    }
    
    // Validate translations
    const errors = validateTranslations(batchTranslations, batch);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Add translations to the main object
    for (const item of batch) {
      const id = item.id.toString();
      const newTranslation = batchTranslations[id];
      if (newTranslation) {
        translations[id] = {
          zhCN: item.translation, // Keep original Simplified Chinese
          zhTW: newTranslation.zhTW,
          enUS: newTranslation.enUS
        };
      }
    }
    
    console.log('✅ Batch processed successfully!');
    
    // Show sample translations
    const sampleItems = batch.slice(0, 2);
    sampleItems.forEach(item => {
      const trans = translations[item.id.toString()];
      console.log(`  ${item.id}: ${item.content}`);
      console.log(`    ZH-TW: ${trans.zhTW}`);
      console.log(`    EN-US: ${trans.enUS}`);
    });
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error processing batch ${batchIndex + 1}:`, error.message);
    
    // Save error info
    saveProgress(batchIndex, progress.totalProcessed, error);
    
    return false;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    // Check if API function is implemented
    try {
      await callTranslationAPI("test");
    } catch (error) {
      if (error.message.includes('API implementation required')) {
        console.log('\n⚠️  API Implementation Required');
        console.log('Please edit the callTranslationAPI function in this script to use your preferred translation service:');
        console.log('- OpenAI GPT-4');
        console.log('- Claude (Anthropic)');
        console.log('- Google Translate API');
        console.log('- Azure Translator');
        console.log('\nSee the commented examples in the callTranslationAPI function.');
        return;
      }
    }
    
    // Find items that need translation
    const itemsNeedingTranslation = vocs.filter(item => !translations[item.id.toString()]);
    
    if (itemsNeedingTranslation.length === 0) {
      console.log('🎉 All items are already translated!');
      return;
    }
    
    console.log(`\n📊 Items needing translation: ${itemsNeedingTranslation.length}`);
    
    // Create batches starting from progress point
    const startIndex = Math.max(0, progress.lastProcessedIndex);
    const remainingItems = itemsNeedingTranslation.slice(startIndex);
    
    const batches = [];
    for (let i = 0; i < remainingItems.length; i += BATCH_SIZE) {
      batches.push(remainingItems.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`🔢 Total batches to process: ${batches.length}`);
    console.log(`⏱️  Estimated time: ${Math.ceil(batches.length * DELAY_BETWEEN_BATCHES / 1000 / 60)} minutes\n`);
    
    let successfulBatches = 0;
    let failedBatches = 0;
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const success = await processBatch(batch, i, batches.length);
      
      if (success) {
        successfulBatches++;
        
        // Save progress after each successful batch
        saveProgress(startIndex + (i + 1) * BATCH_SIZE, successfulBatches);
        saveTranslations();
        
        const totalTranslated = Object.keys(translations).length;
        const percentComplete = ((totalTranslated / vocs.length) * 100).toFixed(1);
        console.log(`📈 Progress: ${totalTranslated}/${vocs.length} (${percentComplete}%) translated`);
        
      } else {
        failedBatches++;
        console.log(`⚠️  Failed batch will be retried on next run`);
      }
      
      // Delay between API calls to avoid rate limits
      if (i < batches.length - 1) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    console.log(`\n🎯 Translation session completed!`);
    console.log(`   Successful batches: ${successfulBatches}/${batches.length}`);
    console.log(`   Failed batches: ${failedBatches}/${batches.length}`);
    console.log(`   Total translated: ${Object.keys(translations).length}/${vocs.length}`);
    console.log(`   Remaining: ${vocs.length - Object.keys(translations).length}`);
    
    if (failedBatches > 0) {
      console.log(`\n💡 Run the script again to retry failed batches.`);
    }
    
    if (Object.keys(translations).length === vocs.length) {
      console.log('\n🎉 Congratulations! All vocabulary items have been translated!');
      
      // Clean up progress file
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('🧹 Progress file cleaned up.');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    saveProgress(progress.lastProcessedIndex, progress.totalProcessed, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️ Received interrupt signal. Saving progress...');
  saveTranslations();
  saveProgress(progress.lastProcessedIndex, progress.totalProcessed);
  console.log('✅ Progress saved. You can resume later by running this script again.');
  process.exit(0);
});

// Start the main process
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});