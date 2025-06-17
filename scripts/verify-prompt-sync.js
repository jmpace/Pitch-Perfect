#!/usr/bin/env node

/**
 * Verification script to ensure pitch-analysis-prompt.md 
 * stays synchronized with the production API prompt
 */

const fs = require('fs');
const path = require('path');

// Read the markdown file
const markdownPath = path.join(__dirname, '..', 'pitch-analysis-prompt.md');
const markdownContent = fs.readFileSync(markdownPath, 'utf8');

// Read the API route file
const apiRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'experiment', 'analyze-pitch', 'route.ts');
const apiRouteContent = fs.readFileSync(apiRoutePath, 'utf8');

// Extract the prompt from the API route (between the backticks)
const promptMatch = apiRouteContent.match(/return `([\s\S]*?)`;?\s*}/);
if (!promptMatch) {
  console.error('❌ Could not extract prompt from API route');
  process.exit(1);
}

const apiPrompt = promptMatch[1];

// Remove markdown header and code block formatting for comparison
const cleanMarkdown = markdownContent
  .replace(/^# PitchPerfect: Multimodal Pitch Analysis\n\n/, '') // Remove header
  .replace(/```json\n/g, '\n{')  // Convert json blocks
  .replace(/\n```/g, '\n}')      // Convert json blocks
  .trim();

const cleanApiPrompt = apiPrompt.trim();

// Compare key sections
const keyPhrases = [
  'IMPORTANT: Do NOT suggest creating visuals that already exist',
  'You will receive actual slide images alongside transcript text',
  '[SESSION_ID_FROM_REQUEST]',
  'Analyze the ACTUAL content provided. Do not copy these placeholder values'
];

let allMatch = true;
console.log('🔍 Verifying prompt synchronization...\n');

keyPhrases.forEach(phrase => {
  const inMarkdown = cleanMarkdown.includes(phrase);
  const inApi = cleanApiPrompt.includes(phrase);
  
  if (inMarkdown && inApi) {
    console.log(`✅ "${phrase.substring(0, 50)}..."`);
  } else {
    console.log(`❌ "${phrase.substring(0, 50)}..." - MD:${inMarkdown} API:${inApi}`);
    allMatch = false;
  }
});

if (allMatch) {
  console.log('\n✅ All key sections are synchronized!');
  console.log(`📄 Markdown file: ${markdownPath}`);
  console.log(`🔧 API route: ${apiRoutePath}`);
} else {
  console.log('\n❌ Prompts are out of sync!');
  process.exit(1);
}