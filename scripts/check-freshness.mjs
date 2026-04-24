#!/usr/bin/env node
// Layer 4 — Data Freshness Monitor
//
// For each hourly-refreshed data source, compare `.generated` timestamp (or
// mtime for API responses) against a per-source max-age budget.
//
// Output: newline-delimited JSON events on stdout. Exit 0 always; the GitHub
// workflow parses events and opens/closes issues.
//
// Usage:
//   BASE_URL=https://pruviq.com node scripts/check-freshness.mjs
//   BASE_URL=https://pruviq.com node scripts/check-freshness.mjs --verbose
//
// Each event:
//   {"source": "news.json", "status": "fresh"|"stale", "age_s": 123,
//    "budget_s": 1800, "generated": "2026-..."}

import process from "node:process";

const BASE = process.env.BASE_URL || "https://pruviq.com";
const VERBOSE = process.argv.includes("--verbose");

// Per-file budgets (seconds). Crypto news tighter than macro news because
// crypto sources refresh more frequently.
const BUDGETS = [
  { path: "/data/news.json", budget_s: 30 * 60, invariant: "news-any" },
  { path: "/data/market.json", budget_s: 15 * 60, invariant: null },
  { path: "/data/coins-stats.json", budget_s: 15 * 60, invariant: null },
  { path: "/data/macro.json", budget_s: 2 * 60 * 60, invariant: null },
  { path: "/data/rankings-daily.json", budget_s: 26 * 60 * 60, invariant: null },
];

async function checkOne({ path, budget_s, invariant }) {
  const url = `${BASE}${path}`;
  const res = await fetch(url).catch((e) => ({ ok: false, _err: String(e) }));
  if (!res.ok) {
    return {
      source: path,
      status: "error",
      error: res._err || `http_${res.status}`,
      budget_s,
    };
  }
  const data = await res.json().catch(() => null);
  // Some files use `generated_at` instead of `generated` (rankings-daily)
  const generated = data?.generated || data?.generated_at;
  if (!generated) {
    return { source: path, status: "no_timestamp", budget_s };
  }
  const ageMs = Date.now() - new Date(generated).getTime();
  const age_s = Math.floor(ageMs / 1000);
  const status = age_s > budget_s ? "stale" : "fresh";

  // Secondary invariant checks (e.g., news must have both categories)
  let invariant_fail = null;
  if (invariant === "news-any" && Array.isArray(data.items)) {
    const macros = data.items.filter((i) => i.category === "macro").length;
    const cryptos = data.items.filter((i) => i.category === "crypto").length;
    if (macros === 0) invariant_fail = "zero-macro-items";
    else if (cryptos === 0) invariant_fail = "zero-crypto-items";
  }

  return {
    source: path,
    status: invariant_fail ? "invariant_fail" : status,
    age_s,
    budget_s,
    generated,
    invariant_fail,
  };
}

async function main() {
  const results = await Promise.all(BUDGETS.map(checkOne));
  let exit = 0;
  for (const r of results) {
    process.stdout.write(JSON.stringify(r) + "\n");
    if (r.status === "stale" || r.status === "invariant_fail" || r.status === "error") {
      exit = 0; // still exit 0 — let workflow parse + decide
    }
    if (VERBOSE && r.age_s != null) {
      process.stderr.write(
        `  ${r.source}: ${r.status} age=${r.age_s}s budget=${r.budget_s}s\n`,
      );
    }
  }
  process.exit(exit);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e}\n`);
  process.exit(2);
});
