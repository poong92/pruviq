#!/usr/bin/env npx tsx
/**
 * JEPO Simulator Harness Runner
 * 골든 케이스 검증 — CI 또는 수동 실행
 *
 * Usage:
 *   npx tsx tests/harness/run-golden.ts
 *   BASE_URL=http://localhost:8080 npx tsx tests/harness/run-golden.ts
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "https://api.pruviq.com";
const TIMEOUT_MS = 30_000;

// QA Rules SSoT — metric thresholds are owned here, not duplicated
const QA_RULES_PATH = join(
  new URL(".", import.meta.url).pathname,
  "qa-rules.json",
);
const QA_RULES = (() => {
  try {
    return JSON.parse(readFileSync(QA_RULES_PATH, "utf-8"));
  } catch {
    return null;
  }
})();

// 알려진 버그 임계값을 qa-rules.json에서 읽어 즉시 진단 레이블 추가
function diagnoseRangeViolation(field: string, val: number): string | null {
  if (!QA_RULES?.known_bugs) return null;
  const bugs = QA_RULES.known_bugs as Array<{
    id: string;
    symptom: string;
    severity: string;
  }>;
  for (const bug of bugs) {
    const s = bug.symptom.toLowerCase();
    if (s.includes(field.replace("_", " ")) || s.includes(field)) {
      const match = s.match(
        /(calmar|pf|mdd|sortino|profit_factor).*?([><=!]+)\s*([\d.]+)/i,
      );
      if (match) {
        const threshold = parseFloat(match[3]);
        const op = match[2];
        if (
          (op.includes(">") && val > threshold) ||
          (op.includes("==") && val === threshold) ||
          (op.includes("<") && val < threshold)
        ) {
          return `[${bug.id}] ${bug.symptom}`;
        }
      }
    }
  }
  return null;
}

interface RangeCheck {
  min?: number;
  max?: number;
  note?: string;
}

interface GoldenCase {
  name: string;
  description: string;
  request: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
  };
  expect: {
    status?: number;
    required_fields?: string[];
    ranges?: Record<string, RangeCheck>;
    values?: Record<string, unknown>;
    structural?: Record<string, unknown>;
    ranges_per_entry?: Record<string, RangeCheck>;
  };
}

interface GoldenFile {
  cases: GoldenCase[];
}

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";

function pass(msg: string) {
  console.log(`  ${GREEN}✅ PASS${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`  ${RED}❌ FAIL${RESET} ${msg}`);
  return 1;
}
function warn(msg: string) {
  console.log(`  ${YELLOW}⚠  WARN${RESET} ${msg}`);
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runCase(c: GoldenCase): Promise<number> {
  const url = `${BASE_URL}${c.request.path}`;
  let failures = 0;

  console.log(`\n${BOLD}[${c.name}]${RESET} ${c.description}`);

  let res: Response;
  let data: unknown;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: c.request.method,
        headers: { "Content-Type": "application/json" },
        body: c.request.body ? JSON.stringify(c.request.body) : undefined,
      },
      TIMEOUT_MS,
    );
    data = await res.json();
  } catch (e) {
    return fail(`Network error: ${e}`);
  }

  // HTTP status
  const expectedStatus = c.expect.status ?? 200;
  if (res.status !== expectedStatus) {
    failures += fail(`HTTP ${res.status} (expected ${expectedStatus})`);
  } else {
    pass(`HTTP ${res.status}`);
  }

  if (typeof data !== "object" || data === null) {
    return fail("Response is not an object") + failures;
  }
  const d = data as Record<string, unknown>;

  // Required fields
  for (const field of c.expect.required_fields ?? []) {
    if (!(field in d)) {
      failures += fail(`Missing field: ${field}`);
    } else {
      pass(`Field exists: ${field}`);
    }
  }

  // Exact value checks
  for (const [k, expected] of Object.entries(c.expect.values ?? {})) {
    if (d[k] !== expected) {
      failures += fail(
        `${k} = ${JSON.stringify(d[k])} (expected ${JSON.stringify(expected)})`,
      );
    } else {
      pass(`${k} = ${JSON.stringify(expected)}`);
    }
  }

  // Range checks (+ known-bug 진단 레이블)
  for (const [field, range] of Object.entries(c.expect.ranges ?? {})) {
    const val = d[field];
    if (typeof val !== "number") {
      failures += fail(`${field} is not a number: ${JSON.stringify(val)}`);
      continue;
    }
    if (range.min !== undefined && val < range.min) {
      const diagnosis = diagnoseRangeViolation(field, val);
      failures += fail(
        `${field} = ${val} < min ${range.min}${range.note ? ` (${range.note})` : ""}${diagnosis ? ` ⚠ ${diagnosis}` : ""}`,
      );
    } else if (range.max !== undefined && val > range.max) {
      const diagnosis = diagnoseRangeViolation(field, val);
      failures += fail(
        `${field} = ${val} > max ${range.max}${range.note ? ` (${range.note})` : ""}${diagnosis ? ` ⚠ ${diagnosis}` : ""}`,
      );
    } else {
      pass(`${field} = ${val} in [${range.min ?? "−∞"}, ${range.max ?? "+∞"}]`);
    }
  }

  // Structural checks
  const structural = c.expect.structural ?? {};
  if (structural.equity_curve_min_points !== undefined) {
    const ec = d["equity_curve"];
    const count = Array.isArray(ec) ? ec.length : 0;
    if (count < (structural.equity_curve_min_points as number)) {
      failures += fail(
        `equity_curve has ${count} points (min ${structural.equity_curve_min_points})`,
      );
    } else {
      pass(`equity_curve has ${count} points`);
    }
  }
  if (structural.coin_results_min_count !== undefined) {
    const cr = d["coin_results"];
    const count = Array.isArray(cr) ? cr.length : 0;
    if (count < (structural.coin_results_min_count as number)) {
      failures += fail(
        `coin_results has ${count} entries (min ${structural.coin_results_min_count})`,
      );
    } else {
      pass(`coin_results has ${count} entries`);
    }
  }
  if (structural.top3_count !== undefined) {
    const top3 = d["top3"];
    if (!Array.isArray(top3) || top3.length !== structural.top3_count) {
      failures += fail(
        `top3 length = ${Array.isArray(top3) ? top3.length : "N/A"} (expected ${structural.top3_count})`,
      );
    } else {
      pass(`top3 has ${structural.top3_count} entries`);
    }
  }
  if (structural.worst3_count !== undefined) {
    const worst3 = d["worst3"];
    if (!Array.isArray(worst3) || worst3.length !== structural.worst3_count) {
      failures += fail(
        `worst3 length = ${Array.isArray(worst3) ? worst3.length : "N/A"} (expected ${structural.worst3_count})`,
      );
    } else {
      pass(`worst3 has ${structural.worst3_count} entries`);
    }
  }
  if (structural.date_max_age_days !== undefined) {
    const dateStr = d["date"] as string;
    if (dateStr) {
      const age = (Date.now() - new Date(dateStr).getTime()) / 86400000;
      if (age > (structural.date_max_age_days as number)) {
        failures += fail(
          `date ${dateStr} is ${age.toFixed(1)} days old (max ${structural.date_max_age_days})`,
        );
      } else {
        pass(`date ${dateStr} is fresh (${age.toFixed(1)} days old)`);
      }
    }
  }

  // top3_required_fields: 각 entry가 필수 필드를 갖는지 검증
  if (structural.top3_required_fields !== undefined) {
    const top3 = d["top3"];
    if (Array.isArray(top3)) {
      for (const entry of top3 as Record<string, unknown>[]) {
        for (const reqField of structural.top3_required_fields as string[]) {
          if (!(reqField in entry)) {
            failures += fail(
              `top3 entry "${entry["name_en"]}" missing required field: ${reqField}`,
            );
          }
        }
      }
      if (top3.length > 0)
        pass(
          `top3 entries have all required fields (${(structural.top3_required_fields as string[]).join(", ")})`,
        );
    }
  }

  // equity_curve_last_value_matches_total_return
  if (structural.equity_curve_last_value_matches_total_return === true) {
    const ec = d["equity_curve"];
    const totalReturn = d["total_return_pct"] as number | undefined;
    if (Array.isArray(ec) && ec.length > 0 && totalReturn !== undefined) {
      const lastVal = ec[ec.length - 1] as number;
      // equity_curve는 100 기준 상대값 또는 누적수익률일 수 있음 — 10% 이내 근사 허용
      const diff = Math.abs(lastVal - totalReturn);
      if (diff > Math.abs(totalReturn) * 0.1 + 5) {
        warn(
          `equity_curve last=${lastVal.toFixed(2)} vs total_return_pct=${totalReturn.toFixed(2)} (diff ${diff.toFixed(2)} — check normalization)`,
        );
      } else {
        pass(
          `equity_curve last value ≈ total_return_pct (diff=${diff.toFixed(2)})`,
        );
      }
    }
  }

  // Per-entry range checks (for arrays)
  const perEntry = c.expect.ranges_per_entry ?? {};
  if (Object.keys(perEntry).length > 0) {
    const entries = [
      ...(Array.isArray(d["top3"]) ? d["top3"] : []),
      ...(Array.isArray(d["worst3"]) ? d["worst3"] : []),
    ] as Record<string, unknown>[];
    for (const entry of entries) {
      for (const [field, range] of Object.entries(perEntry)) {
        const val = entry[field];
        if (typeof val !== "number") continue;
        if (range.min !== undefined && val < range.min) {
          failures += fail(
            `entry ${JSON.stringify(entry["name_en"])} ${field} = ${val} < ${range.min}`,
          );
        } else if (range.max !== undefined && val > range.max) {
          failures += fail(
            `entry ${JSON.stringify(entry["name_en"])} ${field} = ${val} > ${range.max}`,
          );
        }
      }
    }
    if (entries.length > 0)
      pass(`Per-entry range checks passed (${entries.length} entries)`);
  }

  return failures;
}

async function main() {
  const goldenPath = join(
    new URL(".", import.meta.url).pathname,
    "simulator-golden.json",
  );
  const golden: GoldenFile = JSON.parse(readFileSync(goldenPath, "utf-8"));

  console.log(`${BOLD}JEPO Simulator Harness${RESET}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Cases: ${golden.cases.length}`);
  console.log("─".repeat(60));

  let totalFailures = 0;
  const results: { name: string; failures: number }[] = [];

  for (const c of golden.cases) {
    const failures = await runCase(c);
    totalFailures += failures;
    results.push({ name: c.name, failures });
  }

  console.log("\n" + "─".repeat(60));
  console.log(`${BOLD}SUMMARY${RESET}`);
  for (const r of results) {
    const icon = r.failures === 0 ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`;
    console.log(`  ${icon} ${r.name} (${r.failures} failures)`);
  }

  const passed = results.filter((r) => r.failures === 0).length;
  const failed = results.filter((r) => r.failures > 0).length;
  console.log(
    `\n${passed}/${results.length} cases passed, ${totalFailures} total failures`,
  );

  // JSON 결과 출력 — CI 및 QA score 연동용
  const outputDir = "test-results/harness";
  try {
    mkdirSync(outputDir, { recursive: true });
    const jsonResult = {
      ran_at: new Date().toISOString(),
      base_url: BASE_URL,
      total_cases: results.length,
      passed,
      failed,
      total_failures: totalFailures,
      overall: totalFailures === 0 ? "pass" : "fail",
      cases: results,
    };
    writeFileSync(
      join(outputDir, "golden-result.json"),
      JSON.stringify(jsonResult, null, 2),
    );
    console.log(`Result saved: ${outputDir}/golden-result.json`);
  } catch (e) {
    console.warn(`Could not write result JSON: ${e}`);
  }

  if (totalFailures > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Harness error:", e);
  process.exit(1);
});
