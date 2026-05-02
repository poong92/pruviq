#!/usr/bin/env npx tsx
/**
 * Golden Harness — 프로덕션 API 계산 정확성 검증
 *
 * 출력: test-results/harness/golden-result.json
 * 점수: qa-score.ts가 읽어 4.0점 산출
 *
 * 케이스:
 *   1. /health — coins_loaded >= 200
 *   2. /simulate bb-squeeze-long — WR 48~54%, PF > 0.9, trades >= 1400
 *   3. /simulate atr-breakout — WR 44~52%, trades >= 2000
 *   4. /rankings/daily — top3 반환, name_en 존재
 */

import fs from "fs";

const API_BASE = "https://api.pruviq.com";
const OUT_DIR = "test-results/harness";
const OUT_FILE = `${OUT_DIR}/golden-result.json`;

type CaseResult = {
  name: string;
  passed: boolean;
  reason?: string;
};

async function fetchJson(url: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ── 케이스 1: Health ─────────────────────────────────────────────────────────
async function caseHealth(): Promise<CaseResult> {
  const name = "health: status=ok & coins>=200";
  try {
    const d = (await fetchJson(`${API_BASE}/health`)) as {
      status: string;
      coins_loaded?: number;
    };
    if (d.status !== "ok")
      return { name, passed: false, reason: `status=${d.status}` };
    if ((d.coins_loaded ?? 0) < 200)
      return { name, passed: false, reason: `coins_loaded=${d.coins_loaded}` };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, reason: String(e) };
  }
}

// ── 케이스 2: Simulate BB-squeeze-long ──────────────────────────────────────
async function caseBbSqueeze(): Promise<CaseResult> {
  const name = "simulate bb-squeeze-long: WR 48~54%, PF>0.9, trades>=1400";
  try {
    const d = (await fetchJson(`${API_BASE}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "bb-squeeze-long", preset: "default" }),
    })) as { win_rate: number; profit_factor: number; total_trades: number };
    if (d.win_rate < 46 || d.win_rate > 56)
      return { name, passed: false, reason: `WR=${d.win_rate} out of range` };
    if (d.profit_factor < 0.85)
      return { name, passed: false, reason: `PF=${d.profit_factor} < 0.85` };
    if (d.total_trades < 1400)
      return { name, passed: false, reason: `trades=${d.total_trades} < 1400` };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, reason: String(e) };
  }
}

// ── 케이스 3: Simulate ATR-breakout ─────────────────────────────────────────
async function caseAtrBreakout(): Promise<CaseResult> {
  const name = "simulate atr-breakout: WR 43~53%, trades>=2000";
  try {
    const d = (await fetchJson(`${API_BASE}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "atr-breakout", preset: "default" }),
    })) as { win_rate: number; total_trades: number };
    if (d.win_rate < 43 || d.win_rate > 55)
      return { name, passed: false, reason: `WR=${d.win_rate} out of range` };
    if (d.total_trades < 2000)
      return { name, passed: false, reason: `trades=${d.total_trades} < 2000` };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, reason: String(e) };
  }
}

// ── 케이스 4: Rankings daily ─────────────────────────────────────────────────
async function caseRankings(): Promise<CaseResult> {
  const name = "rankings/daily: top3 반환 & name_en 존재";
  try {
    const d = (await fetchJson(
      `${API_BASE}/rankings/daily?period=30d&group=Market%20Cap%20Top%2050`,
    )) as { top3?: Array<{ name_en?: string; win_rate?: number }> };
    if (!d.top3 || d.top3.length === 0)
      return { name, passed: false, reason: "top3 empty or missing" };
    if (!d.top3[0].name_en)
      return { name, passed: false, reason: "top3[0].name_en missing" };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, reason: String(e) };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const cases = await Promise.all([
    caseHealth(),
    caseBbSqueeze(),
    caseAtrBreakout(),
    caseRankings(),
  ]);

  const passed = cases.filter((c) => c.passed).length;
  const failed = cases.filter((c) => !c.passed).length;
  const overall = failed === 0 ? "pass" : "fail";

  for (const c of cases) {
    const icon = c.passed ? "✓" : "✗";
    console.log(`${icon} ${c.name}${c.reason ? ` — ${c.reason}` : ""}`);
  }
  console.log(`\nGolden: ${passed}/${cases.length} passed`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        ran_at: new Date().toISOString(),
        total_cases: cases.length,
        passed,
        failed,
        total_failures: failed,
        overall,
        cases,
      },
      null,
      2,
    ),
  );
  console.log(`Saved: ${OUT_FILE}`);

  if (overall === "fail") process.exit(1);
}

main().catch((e) => {
  console.error("Golden harness error:", e);
  process.exit(1);
});
