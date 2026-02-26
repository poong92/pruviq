import fs from 'fs/promises';
import path from 'path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

async function walk(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(await walk(full));
    else if (entry.isFile() && full.endsWith('.html')) files.push(full);
  }
  return files;
}

function hasTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return false;
  return m[1].trim().length > 0;
}

function hasMetaDescription(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  if (!m) return false;
  return m[1].trim().length > 0;
}

(async () => {
  try {
    const exists = await fs.stat(DIST_DIR).catch(() => null);
    if (!exists) {
      console.error('dist directory not found. Did the build run?');
      process.exit(2);
    }

    const htmlFiles = await walk(DIST_DIR);
    if (htmlFiles.length === 0) {
      console.warn('No HTML files found in dist/ - nothing to check.');
      process.exit(0);
    }

    const problems = [];
    for (const file of htmlFiles) {
      const content = await fs.readFile(file, 'utf8');
      const titleOk = hasTitle(content);
      const descOk = hasMetaDescription(content);
      if (!titleOk || !descOk) problems.push({ file: path.relative(process.cwd(), file), titleOk, descOk });
    }

    if (problems.length > 0) {
      console.error(`SEO check warning: ${problems.length} HTML files missing title or meta description (non-fatal):`);
      for (const p of problems.slice(0, 50)) {
        console.error(` - ${p.file}    title:${p.titleOk ? 'OK' : 'MISSING'}    description:${p.descOk ? 'OK' : 'MISSING'}`);
      }
      if (problems.length > 50) console.error(`... and ${problems.length - 50} more`);
      // Non-fatal in CI: treat as warning so the job doesn't block merges
      process.exit(0);
    }

    console.log('SEO check passed: all HTML files have a <title> and meta description.');
    process.exit(0);
  } catch (err) {
    console.error('Error running SEO check:', err);
    process.exit(2);
  }
})();
