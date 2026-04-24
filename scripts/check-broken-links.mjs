#!/usr/bin/env node
// Broken-link crawler
//
// Walks every built HTML file in dist/, extracts every internal href,
// HEAD-checks against BASE_URL, reports non-2xx responses. Catches the
// class of bug Layer 1 runtime inventory just surfaced (3 strategy
// presets linking to pages that never existed on prod).
//
// Usage:
//   npm run build
//   BASE_URL=https://pruviq.com node scripts/check-broken-links.mjs
//
// Output:
//   stdout: NDJSON event per checked URL (informational)
//   stderr: summary + non-zero exit on any 404
//
// Exits:
//   0 — all links 2xx
//   1 — at least one 404 or >=400

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

const DIST = resolve(ROOT, args.dist || "dist");
const BASE = process.env.BASE_URL || args.base || "https://pruviq.com";
const LIMIT = Number(args.limit || 0);            // 0 = no cap
const CONCURRENCY = Number(args.concurrency || 10);
const REPORT_PATH = resolve(ROOT, "reports/broken-links.ndjson");

// Hrefs we intentionally skip (tracking params, externals we already test)
const SKIP_HREF = [
  /^#/,
  /^mailto:/,
  /^tel:/,
  /^javascript:/,
  /^https?:\/\/(?!pruviq\.com)/, // externals — not our problem
  /\.(png|jpg|jpeg|svg|ico|gif|webp|pdf|zip|woff2?)(\?|$)/i,
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

// Character-scan script stripper — regex variants were flagged by
// CodeQL js/incomplete-multi-character-sanitization. Same impl as in
// scripts/discover-interactives.mjs.
function stripScripts(html) {
  const lower = html.toLowerCase();
  let out = "";
  let i = 0;
  while (i < html.length) {
    const openIdx = lower.indexOf("<script", i);
    if (openIdx < 0) {
      out += html.slice(i);
      break;
    }
    const next = lower.charCodeAt(openIdx + 7);
    if (
      next !== 0x20 &&
      next !== 0x09 &&
      next !== 0x0a &&
      next !== 0x3e &&
      next !== 0x2f
    ) {
      out += html.slice(i, openIdx + 7);
      i = openIdx + 7;
      continue;
    }
    out += html.slice(i, openIdx);
    const openEnd = html.indexOf(">", openIdx);
    if (openEnd < 0) break;
    const closeIdx = lower.indexOf("</script", openEnd);
    if (closeIdx < 0) break;
    const closeEnd = html.indexOf(">", closeIdx);
    i = closeEnd < 0 ? html.length : closeEnd + 1;
  }
  return out;
}

function extractHrefs(html) {
  const noscript = stripScripts(html);
  return Array.from(noscript.matchAll(/<a[^>]+href=["']([^"']+)["']/gi))
    .map((m) => m[1])
    .filter((h) => h && !SKIP_HREF.some((re) => re.test(h)));
}

function normalise(href) {
  // Drop query + hash — we only care about the path existing.
  const cleaned = href.split("#")[0].split("?")[0];
  if (/^https?:\/\//.test(cleaned)) return cleaned;
  if (!cleaned.startsWith("/")) return null; // relative path — caller's problem
  return BASE.replace(/\/$/, "") + cleaned;
}

async function headCheck(url) {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    // Some origins return 405 for HEAD; retry with GET
    if (r.status === 405) {
      const g = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      return { url, status: g.status };
    }
    return { url, status: r.status };
  } catch (e) {
    return { url, status: 0, error: String(e).slice(0, 120) };
  }
}

async function mapConcurrent(items, limit, fn) {
  const out = [];
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const files = walkHtml(DIST);
  const urlToSources = new Map(); // absolute URL → Set of source html files

  for (const f of files) {
    const html = readFileSync(f, "utf-8");
    const hrefs = extractHrefs(html);
    for (const raw of hrefs) {
      const abs = normalise(raw);
      if (!abs) continue;
      if (!urlToSources.has(abs)) urlToSources.set(abs, new Set());
      urlToSources.get(abs).add(f.replace(ROOT + "/", ""));
    }
  }

  const urls = [...urlToSources.keys()].filter((u) => u.startsWith(BASE));
  const limited = LIMIT > 0 ? urls.slice(0, LIMIT) : urls;

  process.stderr.write(
    `Checking ${limited.length} unique internal URLs (base=${BASE}, concurrency=${CONCURRENCY})\n`,
  );

  const results = await mapConcurrent(limited, CONCURRENCY, headCheck);

  // Persist NDJSON
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const ndjson = results
    .map((r) => JSON.stringify({ ...r, sources: [...urlToSources.get(r.url)] }))
    .join("\n");
  writeFileSync(REPORT_PATH, ndjson + "\n", "utf-8");

  const broken = results.filter((r) => r.status >= 400 || r.status === 0);
  const ok = results.filter((r) => r.status >= 200 && r.status < 400);
  const redirects = results.filter((r) => r.status >= 300 && r.status < 400);

  process.stderr.write(
    `OK: ${ok.length} | redirects: ${redirects.length} | broken: ${broken.length}\n`,
  );

  if (broken.length > 0) {
    process.stderr.write(`\nBroken links:\n`);
    for (const b of broken.slice(0, 50)) {
      const src = [...(urlToSources.get(b.url) || [])].slice(0, 3);
      process.stderr.write(
        `  [${b.status || "ERR"}] ${b.url}\n    linked from: ${src.join(", ")}\n`,
      );
    }
    if (broken.length > 50)
      process.stderr.write(`  ...and ${broken.length - 50} more.\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e}\n`);
  process.exit(2);
});
