#!/usr/bin/env node
// Layer 8 — Flake classifier
//
// Reads a Playwright JSON report and classifies each test as:
//   - "pass"   : all attempts green
//   - "flake"  : had ≥1 fail, then passed on retry (passed-after-retry)
//   - "fail"   : all attempts red
//
// Appends flake entries as NDJSON to reports/flake-log.ndjson (gitignored in
// CI artifacts; weekly flake-report workflow aggregates + summarises).
//
// Exit 0 always — informational, not blocking.
//
// Usage:
//   npx playwright test --reporter=json > reports/pw.json
//   node scripts/classify-flake.mjs reports/pw.json

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const inputPath = process.argv[2] || "reports/pw.json";
const logPath = "reports/flake-log.ndjson";

const raw = JSON.parse(readFileSync(inputPath, "utf-8"));

function walk(suite, out = []) {
  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const t of spec.tests ?? []) {
        out.push({ spec, test: t });
      }
    }
  }
  for (const sub of suite.suites ?? []) walk(sub, out);
  return out;
}

const allSuites = raw.suites ?? [];
const records = allSuites.flatMap((s) => walk(s));

const now = new Date().toISOString();
const branch = process.env.GITHUB_REF_NAME || "local";
const runId = process.env.GITHUB_RUN_ID || "local";

mkdirSync(dirname(resolve(logPath)), { recursive: true });

let pass = 0,
  flake = 0,
  fail = 0;

for (const { spec, test } of records) {
  const results = test.results ?? [];
  if (results.length === 0) continue;

  const statuses = results.map((r) => r.status); // e.g., ["failed","passed"]
  const finalStatus = statuses[statuses.length - 1];

  if (finalStatus === "passed" && statuses.slice(0, -1).includes("failed")) {
    flake++;
    const entry = {
      timestamp: now,
      branch,
      run_id: runId,
      file: spec.file,
      test: spec.title,
      attempts: statuses,
    };
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } else if (finalStatus === "passed") {
    pass++;
  } else {
    fail++;
  }
}

process.stdout.write(
  JSON.stringify({ pass, flake, fail, total: pass + flake + fail }) + "\n",
);
