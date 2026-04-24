#!/usr/bin/env node
// Layer 1 — Interactive Inventory Discovery
//
// Crawls the built `dist/` directory and enumerates every interactive element
// on every page (data-testid / button / a[href] / form / input). Emits a
// normalised inventory to reports/interactive-inventory.json + a markdown
// summary so future PRs see testid diffs at review time.
//
// Usage:
//   npm run build && node scripts/discover-interactives.mjs
//   node scripts/discover-interactives.mjs --dist=dist
//
// Output:
//   reports/interactive-inventory.json — machine-readable per-route inventory
//   reports/interactive-inventory.md   — human summary (coverage %, gaps)

import {
  readdirSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

const DIST = resolve(ROOT, args.dist || "dist");
const OUT_JSON = resolve(ROOT, "reports/interactive-inventory.json");
const OUT_MD = resolve(ROOT, "reports/interactive-inventory.md");

// Pages we never need to audit (static assets, redirects)
const SKIP_PATTERNS = [
  /\/_astro\//,
  /\/data\//,
  /\.(xml|txt|json|css|js|map|png|jpg|svg|ico|webmanifest)$/,
];

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkHtml(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function routeOf(filePath) {
  let r = "/" + relative(DIST, filePath).replace(/\\/g, "/");
  if (r.endsWith("/index.html")) r = r.slice(0, -"index.html".length);
  if (r.endsWith(".html")) r = r.slice(0, -".html".length);
  return r;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function extract(html) {
  // Strip <script> blocks — they contain button text + hrefs that pollute
  // the inventory (e.g., Astro compiled JSON strings). The `\s*` before
  // `>` in the closing tag matches variants like `</script >` that
  // CodeQL's js/bad-tag-filter flagged otherwise.
  const noscript = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
    "",
  );

  const testids = uniq(
    Array.from(noscript.matchAll(/data-testid=["']([^"']+)["']/gi)).map(
      (m) => m[1],
    ),
  );
  const buttonCount = (noscript.match(/<button\b/gi) || []).length;
  const hrefs = uniq(
    Array.from(noscript.matchAll(/<a[^>]+href=["']([^"']+)["']/gi))
      .map((m) => m[1])
      .filter(
        (h) =>
          h &&
          !h.startsWith("#") &&
          !h.startsWith("mailto:") &&
          !h.startsWith("tel:"),
      ),
  );
  const inputCount = (noscript.match(/<input\b/gi) || []).length;
  const formCount = (noscript.match(/<form\b/gi) || []).length;
  const roleTabs = (noscript.match(/role=["']tab["']/gi) || []).length;

  return {
    testids,
    buttonCount,
    inputCount,
    formCount,
    roleTabs,
    anchorCount: hrefs.length,
    externalLinks: hrefs.filter((h) => /^https?:\/\//.test(h)).length,
    internalLinks: hrefs.filter((h) => h.startsWith("/")).length,
  };
}

function main() {
  try {
    statSync(DIST);
  } catch {
    console.error(`dist not found at ${DIST}. Run: npm run build first.`);
    process.exit(1);
  }

  const files = walkHtml(DIST).filter(
    (f) => !SKIP_PATTERNS.some((re) => re.test(f)),
  );

  const inventory = [];
  let totalPages = 0;
  let pagesWithTestId = 0;
  let totalTestIds = 0;
  let totalInteractives = 0;

  for (const file of files) {
    const route = routeOf(file);
    const html = readFileSync(file, "utf-8");
    const stats = extract(html);
    const interactiveCount =
      stats.testids.length +
      stats.buttonCount +
      stats.anchorCount +
      stats.inputCount +
      stats.formCount;

    inventory.push({
      route,
      file: relative(ROOT, file),
      ...stats,
      interactiveCount,
    });

    totalPages++;
    if (stats.testids.length > 0) pagesWithTestId++;
    totalTestIds += stats.testids.length;
    totalInteractives += interactiveCount;
  }

  // Sort: most interactive pages first
  inventory.sort((a, b) => b.interactiveCount - a.interactiveCount);

  const coverage = totalPages ? pagesWithTestId / totalPages : 0;
  const summary = {
    generated: new Date().toISOString(),
    total_pages: totalPages,
    pages_with_testid: pagesWithTestId,
    testid_coverage_pct: Math.round(coverage * 10000) / 100,
    total_testids: totalTestIds,
    total_interactives: totalInteractives,
    top_routes_by_interactives: inventory.slice(0, 10).map((r) => ({
      route: r.route,
      testids: r.testids.length,
      buttons: r.buttonCount,
      anchors: r.anchorCount,
    })),
    unique_testids: uniq(inventory.flatMap((p) => p.testids)).sort(),
  };

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify({ summary, inventory }, null, 2),
    "utf-8",
  );

  const md = [
    `# Interactive Inventory (Layer 1)`,
    ``,
    `Generated: ${summary.generated}`,
    ``,
    `- **Pages:** ${summary.total_pages}`,
    `- **Pages with ≥1 data-testid:** ${summary.pages_with_testid} (${summary.testid_coverage_pct}%)`,
    `- **Total data-testids:** ${summary.total_testids}`,
    `- **Unique data-testids:** ${summary.unique_testids.length}`,
    `- **Total interactive elements:** ${summary.total_interactives}`,
    ``,
    `## Top 10 routes by interactive count`,
    ``,
    `| Route | testids | buttons | anchors |`,
    `|-------|---------|---------|---------|`,
    ...summary.top_routes_by_interactives.map(
      (r) => `| ${r.route} | ${r.testids} | ${r.buttons} | ${r.anchors} |`,
    ),
    ``,
    `## Unique data-testid names (${summary.unique_testids.length})`,
    ``,
    summary.unique_testids.map((t) => `- \`${t}\``).join("\n"),
    ``,
  ].join("\n");

  writeFileSync(OUT_MD, md, "utf-8");

  console.log(
    `Inventory: ${totalPages} pages, ${totalTestIds} testids (${summary.testid_coverage_pct}% coverage), ${totalInteractives} interactives`,
  );
  console.log(`→ ${relative(ROOT, OUT_JSON)}`);
  console.log(`→ ${relative(ROOT, OUT_MD)}`);
}

main();
