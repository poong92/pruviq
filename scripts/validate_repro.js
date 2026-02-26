const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'data', 'reproducible');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let ok = true;
for (const f of files) {
  const p = path.join(dir, f);
  try {
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    const required = ['strategy','data_version','engine_version','result_hash','package_url','created'];
    for (const key of required) {
      if (!json[key]) {
        console.error(`${f}: missing required key ${key}`);
        ok = false;
      }
    }
    if (json.result_hash && !/^sha256:[0-9a-f]{64}/.test(json.result_hash)) {
      console.error(`${f}: result_hash does not look like sha256:...`);
      ok = false;
    }
    // check package_url file exists (relative to public)
    if (json.package_url) {
      const pkgPath = path.join(__dirname, '..', 'public', json.package_url.replace(/^\//, ''));
      if (!fs.existsSync(pkgPath)) {
        console.error(`${f}: package_url ${json.package_url} does not exist at ${pkgPath}`);
        ok = false;
      }
    }
    // created iso
    if (json.created && isNaN(Date.parse(json.created))) {
      console.error(`${f}: created is not a valid ISO date: ${json.created}`);
      ok = false;
    }
  } catch (err) {
    console.error(`Failed to parse ${f}: ${err.message}`);
    ok = false;
  }
}
if (!ok) {
  console.error('Repro manifest validation failed');
  process.exit(2);
}
console.log('All reproducible manifests look good');
process.exit(0);
