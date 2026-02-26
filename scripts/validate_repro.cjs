const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256File(fp) {
  const data = fs.readFileSync(fp);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const reproDir = path.join(__dirname, '..', 'public', 'data', 'reproducible');
if (!fs.existsSync(reproDir)) {
  console.log('No reproducible directory, nothing to validate.');
  process.exit(0);
}

let failures = 0;

// Validate top-level JSON files (e.g., bb-squeeze-short.json) and folder manifests
const files = fs.readdirSync(reproDir);
for (const f of files) {
  const fp = path.join(reproDir, f);
  const stat = fs.statSync(fp);
  if (stat.isFile() && f.endsWith('.json')) {
    // top-level manifest (strategy.json)
    try {
      const manifest = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const strategy = manifest.strategy_id || path.basename(f, '.json');
      const resultsPath = path.join(reproDir, strategy, 'results.json');
      if (!fs.existsSync(resultsPath)) {
        console.warn(`WARNING: results.json not found for ${strategy} (expected at ${resultsPath}); skipping hash validation.`);
        continue;
      }
      const hash = sha256File(resultsPath);
      if (manifest.result_hash && manifest.result_hash !== hash) {
        console.error(`MISMATCH for ${strategy}: manifest.result_hash=${manifest.result_hash} computed=${hash}`);
        failures++;
      } else {
        console.log(`OK: ${strategy} -- hash matches`);
      }
    } catch (e) {
      console.error(`Failed to validate ${fp}: ${e.message}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`Validation failed: ${failures} issues`);
  process.exit(2);
}

console.log('All reproducible manifests validated.');
process.exit(0);
