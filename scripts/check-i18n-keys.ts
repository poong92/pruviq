#!/usr/bin/env npx tsx
/**
 * check-i18n-keys.ts
 * Finds all t('key') usages in .astro/.tsx/.ts files
 * and reports keys missing from en.ts
 *
 * Usage: npx tsx scripts/check-i18n-keys.ts
 * Exit code 1 if missing keys found (use in CI)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const EN_FILE = join(SRC_DIR, 'i18n/en.ts');

// Extract all keys defined in en.ts
function getDefinedKeys(): Set<string> {
  const content = readFileSync(EN_FILE, 'utf-8');
  const keys = new Set<string>();
  const regex = /"([^"]+)":\s/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// Recursively find all .astro, .tsx, .ts files (excluding i18n/ itself)
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'i18n' || entry === 'node_modules') continue;
      files.push(...findSourceFiles(fullPath));
    } else if (/\.(astro|tsx|ts)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract all t('key') usages from file content
function extractKeys(content: string): string[] {
  const keys: string[] = [];
  const regex = /\bt\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

const definedKeys = getDefinedKeys();
const sourceFiles = findSourceFiles(SRC_DIR);

const missing: { file: string; key: string }[] = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8');
  const usedKeys = extractKeys(content);
  for (const key of usedKeys) {
    if (!definedKeys.has(key)) {
      missing.push({ file: relative(process.cwd(), file), key });
    }
  }
}

if (missing.length === 0) {
  console.log('All i18n keys are defined in en.ts');
  process.exit(0);
} else {
  console.error(`Missing i18n keys: ${missing.length} found\n`);
  const byFile = new Map<string, string[]>();
  for (const { file, key } of missing) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push(key);
  }
  for (const [file, keys] of byFile) {
    console.error(`  ${file}:`);
    for (const key of keys) console.error(`    - ${key}`);
  }
  process.exit(1);
}
