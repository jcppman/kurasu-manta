#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// File paths
const VOCS_PATH = './apps/generator/src/workflows/minna-jp-1/content/vocs.json';
const TRANSLATIONS_PATH = './apps/generator/src/workflows/minna-jp-1/content/translations/vocs-translations.json';

// Load data
const vocs = JSON.parse(fs.readFileSync(VOCS_PATH, 'utf8'));
let translations = {};

if (fs.existsSync(TRANSLATIONS_PATH)) {
  translations = JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, 'utf8'));
}

function showStats() {
  const totalItems = vocs.length;
  const translatedItems = Object.keys(translations).length;
  const remainingItems = totalItems - translatedItems;
  const percentComplete = ((translatedItems / totalItems) * 100).toFixed(2);
  
  console.log('\n📊 Translation Statistics');
  console.log('='.repeat(50));
  console.log(`Total vocabulary items: ${totalItems}`);
  console.log(`Translated items: ${translatedItems}`);
  console.log(`Remaining items: ${remainingItems}`);
  console.log(`Progress: ${percentComplete}%`);
  
  // Show progress by lesson
  const lessonStats = new Map();
  
  vocs.forEach(item => {
    const lesson = item.lesson;
    if (!lessonStats.has(lesson)) {
      lessonStats.set(lesson, { total: 0, translated: 0 });
    }
    lessonStats.get(lesson).total++;
    
    if (translations[item.id.toString()]) {
      lessonStats.get(lesson).translated++;
    }
  });
  
  console.log('\n📚 Progress by Lesson:');
  console.log('Lesson | Translated | Total | Progress');
  console.log('-'.repeat(40));
  
  for (const [lesson, stats] of [...lessonStats.entries()].sort((a, b) => a[0] - b[0])) {
    const progress = ((stats.translated / stats.total) * 100).toFixed(1);
    console.log(`${lesson.toString().padStart(6)} | ${stats.translated.toString().padStart(10)} | ${stats.total.toString().padStart(5)} | ${progress.padStart(7)}%`);
  }
}

function showMissingTranslations(limit = 20) {
  const missing = vocs.filter(item => !translations[item.id.toString()]);
  
  console.log(`\n❌ Missing Translations (showing first ${limit})`);
  console.log('='.repeat(60));
  
  missing.slice(0, limit).forEach(item => {
    console.log(`ID ${item.id} (Lesson ${item.lesson}): ${item.content} (${item.translation})`);
  });
  
  if (missing.length > limit) {
    console.log(`\n... and ${missing.length - limit} more items`);
  }
}

function validateTranslations() {
  console.log('\n✅ Validating Translations');
  console.log('='.repeat(50));
  
  const issues = [];
  
  for (const [id, translation] of Object.entries(translations)) {
    const vocItem = vocs.find(item => item.id.toString() === id);
    
    if (!vocItem) {
      issues.push(`Translation exists for non-existent vocabulary ID: ${id}`);
      continue;
    }
    
    // Check required fields
    if (!translation.zhCN || !translation.zhTW || !translation.enUS) {
      issues.push(`Incomplete translation for ID ${id}: missing required fields`);
    }
    
    // Check field types
    if (typeof translation.zhCN !== 'string' || 
        typeof translation.zhTW !== 'string' || 
        typeof translation.enUS !== 'string') {
      issues.push(`Invalid field types for ID ${id}: all fields must be strings`);
    }
    
    // Check for empty translations
    if (!translation.zhTW.trim() || !translation.enUS.trim()) {
      issues.push(`Empty translations for ID ${id}`);
    }
    
    // Check for suspiciously long translations (might indicate errors)
    if (translation.zhTW.length > 200 || translation.enUS.length > 300) {
      issues.push(`Suspiciously long translation for ID ${id} (${vocItem.content})`);
    }
    
    // Check if zhCN matches original (should be the same)
    if (translation.zhCN !== vocItem.translation) {
      issues.push(`Simplified Chinese mismatch for ID ${id}: expected "${vocItem.translation}", got "${translation.zhCN}"`);
    }
  }
  
  if (issues.length === 0) {
    console.log('✅ All translations are valid!');
  } else {
    console.log(`❌ Found ${issues.length} validation issues:`);
    issues.forEach((issue, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${issue}`);
    });
  }
  
  return issues.length === 0;
}

function showSampleTranslations(count = 10) {
  console.log(`\n📝 Sample Translations (${count} items)`);
  console.log('='.repeat(80));
  
  const translatedIds = Object.keys(translations);
  const sampleIds = translatedIds.slice(0, count);
  
  sampleIds.forEach(id => {
    const vocItem = vocs.find(item => item.id.toString() === id);
    const translation = translations[id];
    
    if (vocItem && translation) {
      console.log(`\nID ${id} (Lesson ${vocItem.lesson}):`);
      console.log(`  Japanese: ${vocItem.content}`);
      console.log(`  ZH-CN: ${translation.zhCN}`);
      console.log(`  ZH-TW: ${translation.zhTW}`);
      console.log(`  EN-US: ${translation.enUS}`);
    }
  });
}

function exportNextBatch(startId = null, batchSize = 100) {
  let startIndex = 0;
  
  if (startId) {
    startIndex = vocs.findIndex(item => item.id === parseInt(startId));
    if (startIndex === -1) {
      console.log(`❌ Item with ID ${startId} not found`);
      return;
    }
  } else {
    // Find first untranslated item
    startIndex = vocs.findIndex(item => !translations[item.id.toString()]);
    if (startIndex === -1) {
      console.log('✅ All items are already translated!');
      return;
    }
  }
  
  const batch = vocs.slice(startIndex, startIndex + batchSize)
    .filter(item => !translations[item.id.toString()]);
  
  if (batch.length === 0) {
    console.log('✅ No untranslated items in this range!');
    return;
  }
  
  const exportData = {
    metadata: {
      batchSize: batch.length,
      startId: batch[0].id,
      endId: batch[batch.length - 1].id,
      exportDate: new Date().toISOString()
    },
    items: batch
  };
  
  const fileName = `./translation-batch-${batch[0].id}-${batch[batch.length - 1].id}.json`;
  fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
  
  console.log(`\n📤 Exported batch to ${fileName}`);
  console.log(`   Items: ${batch.length}`);
  console.log(`   Range: ID ${batch[0].id} - ${batch[batch.length - 1].id}`);
  console.log(`   Lessons: ${Math.min(...batch.map(i => i.lesson))} - ${Math.max(...batch.map(i => i.lesson))}`);
}

function searchTranslations(query) {
  console.log(`\n🔍 Searching for "${query}"`);
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const [id, translation] of Object.entries(translations)) {
    const vocItem = vocs.find(item => item.id.toString() === id);
    if (!vocItem) continue;
    
    const searchText = `${vocItem.content} ${translation.zhCN} ${translation.zhTW} ${translation.enUS}`.toLowerCase();
    
    if (searchText.includes(query.toLowerCase())) {
      results.push({ vocItem, translation });
    }
  }
  
  if (results.length === 0) {
    console.log('No results found');
  } else {
    results.slice(0, 10).forEach(({ vocItem, translation }) => {
      console.log(`\nID ${vocItem.id} (Lesson ${vocItem.lesson}):`);
      console.log(`  JP: ${vocItem.content}`);
      console.log(`  ZH-TW: ${translation.zhTW}`);
      console.log(`  EN-US: ${translation.enUS}`);
    });
    
    if (results.length > 10) {
      console.log(`\n... and ${results.length - 10} more results`);
    }
  }
}

// Main function
function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'stats':
      showStats();
      break;
      
    case 'missing':
      const limit = parseInt(process.argv[3]) || 20;
      showMissingTranslations(limit);
      break;
      
    case 'validate':
      validateTranslations();
      break;
      
    case 'sample':
      const count = parseInt(process.argv[3]) || 10;
      showSampleTranslations(count);
      break;
      
    case 'export':
      const startId = process.argv[3] || null;
      const batchSize = parseInt(process.argv[4]) || 100;
      exportNextBatch(startId, batchSize);
      break;
      
    case 'search':
      const query = process.argv[3];
      if (!query) {
        console.log('Usage: node translation-utils.js search "your query"');
        break;
      }
      searchTranslations(query);
      break;
      
    default:
      console.log('🛠️  Translation Utilities');
      console.log('Usage: node translation-utils.js <command> [options]');
      console.log('\nCommands:');
      console.log('  stats                    - Show translation statistics');
      console.log('  missing [limit]          - Show missing translations (default: 20)');
      console.log('  validate                 - Validate existing translations');
      console.log('  sample [count]           - Show sample translations (default: 10)');
      console.log('  export [startId] [size]  - Export next batch for translation (default: 100)');
      console.log('  search "query"           - Search in translations');
      console.log('\nExamples:');
      console.log('  node translation-utils.js stats');
      console.log('  node translation-utils.js missing 50');
      console.log('  node translation-utils.js export 100 150');
      console.log('  node translation-utils.js search "student"');
  }
}

main();