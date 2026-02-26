const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'src', 'i18n', 'en.ts');
const koPath = path.join(__dirname, '..', 'src', 'i18n', 'ko.ts');
const enRaw = fs.readFileSync(enPath, 'utf8');
const koRaw = fs.readFileSync(koPath, 'utf8');

function extractKeys(raw) {
  const objText = raw.split('export const')[1];
  // crude regex to find 'key': 'value' pairs
  const regex = /'([^']+)'\s*:\s*`([^`]*)`|'([^']+)'\s*:\s*'([^']*)'/g;
  const keys = new Map();
  let m;
  while ((m = regex.exec(raw))) {
    const key = m[1] || m[3];
    const value = m[2] || m[4] || '';
    if (key) keys.set(key, value);
  }
  return keys;
}

const enKeys = extractKeys(enRaw);
const koKeys = extractKeys(koRaw);
const missing = [];
for (const [k, v] of enKeys.entries()) {
  if (!koKeys.has(k)) missing.push({k, v});
}
console.log(`Found ${missing.length} missing keys in ko.ts`);
if (missing.length === 0) process.exit(0);

// Insert missing keys before the final closing '};' in ko.ts
const insertionPoint = koRaw.lastIndexOf('\n};');
if (insertionPoint === -1) {
  console.error('Cannot find insertion point in ko.ts');
  process.exit(2);
}

let toInsert = '\n  // AUTO-ADDED: missing translations (fallback to EN, please translate)\n';
for (const item of missing) {
  const safeVal = String(item.v).replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\n/g, '\\n');
  toInsert += `  '${item.k}': '${safeVal}',\n`;
}

const newKo = koRaw.slice(0, insertionPoint) + toInsert + koRaw.slice(insertionPoint);
fs.writeFileSync(koPath, newKo, 'utf8');
console.log('Patched ko.ts with missing keys');
process.exit(0);
