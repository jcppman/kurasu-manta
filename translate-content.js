#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the content files
const vocsPath = './apps/generator/src/workflows/minna-jp-1/content/vocs.json';
const grammarPath = './apps/generator/src/workflows/minna-jp-1/content/grammar.json';
const vocsTranslationsPath = './apps/generator/src/workflows/minna-jp-1/content/translations/vocs-translations.json';
const grammarTranslationsPath = './apps/generator/src/workflows/minna-jp-1/content/translations/grammar-translations.json';

const vocs = JSON.parse(fs.readFileSync(vocsPath, 'utf8'));
const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));

console.log(`Loaded ${vocs.length} vocabulary items and ${grammar.length} grammar items`);

// This script will help Claude Code generate translations systematically
// by processing items in batches

function processVocabularyBatch(startIndex = 0, batchSize = 50) {
  const batch = vocs.slice(startIndex, startIndex + batchSize);
  
  console.log(`\n=== VOCABULARY BATCH ${startIndex}-${startIndex + batch.length - 1} ===`);
  
  batch.forEach(item => {
    console.log(`ID: ${item.id}`);
    console.log(`Japanese: ${item.content}`);
    console.log(`Simplified Chinese: ${item.translation}`);
    console.log(`---`);
  });
  
  return batch;
}

function processGrammarBatch(startIndex = 0, batchSize = 10) {
  const batch = grammar.slice(startIndex, startIndex + batchSize);
  
  console.log(`\n=== GRAMMAR BATCH ${startIndex}-${startIndex + batch.length - 1} ===`);
  
  batch.forEach(item => {
    console.log(`Lesson: ${item.lesson}`);
    console.log(`Japanese: ${item.content}`);
    console.log(`Simplified Chinese: ${item.explanation}`);
    console.log(`---`);
  });
  
  return batch;
}

// Start with first batch
if (process.argv[2] === 'vocs') {
  const startIndex = parseInt(process.argv[3]) || 0;
  const batchSize = parseInt(process.argv[4]) || 50;
  processVocabularyBatch(startIndex, batchSize);
} else if (process.argv[2] === 'grammar') {
  const startIndex = parseInt(process.argv[3]) || 0;
  const batchSize = parseInt(process.argv[4]) || 10;
  processGrammarBatch(startIndex, batchSize);
} else {
  console.log('Usage: node translate-content.js [vocs|grammar] [startIndex] [batchSize]');
  console.log('Example: node translate-content.js vocs 0 20');
}