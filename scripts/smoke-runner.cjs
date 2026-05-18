#!/usr/bin/env node
/**
 * Smoke test runner that accepts SMOKE_BASE_URL and SMOKE_STRICT env vars.
 * 
 * Usage:
 *   SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_STRICT=1 node scripts/smoke-runner.js
 *   node scripts/smoke-runner.js (uses defaults: http://127.0.0.1:8888, strict=1)
 */

const { execSync } = require('child_process');
const path = require('path');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8888';
const strict = process.env.SMOKE_STRICT !== '0';
const isProd = baseUrl.includes('bags-shield-api.vercel.app') || baseUrl.includes('vercel.app');

const collectionPath = path.join(__dirname, '..', 'docs', 'postman', 'bags-shield-api-v0.postman_collection.json');

// Determine which folder to use
const folder = isProd ? 'Production' : 'Local Dev (AJV)';
const envVarName = isProd ? 'baseUrlProd' : 'baseUrlLocal';

// Build newman command with proper quoting for folder names with spaces
// Use quotes around folder name to handle spaces
const folderQuoted = `"${folder}"`;
const newmanArgs = [
  'newman',
  'run',
  collectionPath,
  '--folder',
  folderQuoted,
  '--env-var',
  `${envVarName}=${baseUrl}`,
  '--reporters',
  'cli'
];

console.log(`[smoke] Base URL: ${baseUrl}`);
console.log(`[smoke] Strict mode: ${strict}`);
console.log(`[smoke] Folder: ${folder}`);
console.log('');

try {
  execSync(newmanArgs.join(' '), { 
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
  process.exit(0);
} catch (error) {
  if (!strict) {
    console.log('\n[smoke] Tests failed but running in relaxed mode (SMOKE_STRICT=0)');
    console.log('[smoke] This is expected during transitional periods.');
    process.exit(0);
  }
  console.error('\n[smoke] Tests failed in strict mode.');
  process.exit(1);
}
