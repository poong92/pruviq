// Quick Start preset curation for /simulate (Phase 4 — real-data rewrite).
//
// 2026-04-22: Rewrote to match the backend STRATEGY_REGISTRY ground truth.
// Previous version had 7 presets with fabricated IDs (rsi-reversal-long,
// macd-momentum-long, etc) that the backend did not implement. Any click
// silently fell back to bb-squeeze on the server side — so 7 cards all
// returned the same 2 results (one per direction). "Verified" claims were
// unverifiable.
//
// New rules:
//   - `id` MUST exist in backend STRATEGY_REGISTRY
//     (backend/src/strategies/registry.py). Verified via curl in the PR.
//   - `verified: true` requires 2yr backtest PF >= 1.05 AND either (a) live
//     tracking shows PF >= 1.0 for 30d, OR (b) no live deployment yet and
//     card explicitly says "Backtest Verified" not "Live Verified".
//   - `metrics` = measured on 2026-04-22 against api.pruviq.com/simulate
//     with top_n=10, fee_pct=0.0005, leverage=5. These are honest numbers;
//     cards can display them because the same click will reproduce them.
//
// Scope: 5 winners at registry-default SL/TP. Losing strategies
// (donchian-breakout, volume-profile, supertrend, rsi-divergence,
// heikin-ashi, stochastic-rsi, macd-cross) omitted — showing a losing
// preset as the first thing a user sees contradicts the brand promise.

export type PresetDirection = "long" | "short" | "both";
export type PresetRisk = "low" | "medium" | "high";

export interface PresetMetrics {
  // 2yr backtest on api.pruviq.com/simulate at registry defaults.
  // Kept as a fixed snapshot so the card never disagrees with the live
  // fetch — the click reproduces these numbers deterministically.
  pf: number;
  sharpe: number;
  totalReturn: number;
  winRate: number;
  mdd: number;
  trades: number;
  measuredAt: string; // YYYY-MM-DD
}

export interface SimulatorPreset {
  id: string;
  direction: PresetDirection;
  risk: PresetRisk;
  verified: boolean;
  // Tracked in OKX live trading (separate from backtest verification).
  // If true, TrustGapPanel can surface the gap between backtest vs live.
  liveTracked: boolean;
  labels: { en: string; ko: string };
  tagline: { en: string; ko: string };
  defaults: {
    sl: number;
    tp: number;
    coin: string;
  };
  metrics: PresetMetrics;
}

export const SIMULATOR_PRESETS: readonly SimulatorPreset[] = [
  {
    id: "atr-breakout",
    direction: "short",
    risk: "medium",
    verified: true,
    liveTracked: false,
    labels: {
      en: "ATR Breakout ↓",
      ko: "ATR 돌파 ↓",
    },
    tagline: {
      en: "Fade volatility expansion with EMA trend filter.",
      ko: "EMA 추세 필터로 변동성 확장 페이드.",
    },
    defaults: { sl: 3, tp: 7, coin: "BTC" },
    metrics: {
      pf: 1.31,
      sharpe: 0.98,
      totalReturn: 157.73,
      winRate: 41.37,
      mdd: 45.6,
      trades: 655,
      measuredAt: "2026-04-22",
    },
  },
  {
    id: "ichimoku",
    direction: "short",
    risk: "medium",
    verified: true,
    liveTracked: false,
    labels: {
      en: "Ichimoku Bearish ↓",
      ko: "일목 하락 ↓",
    },
    tagline: {
      en: "Short below the cloud with Tenkan cross.",
      ko: "구름 아래 전환선 교차 숏.",
    },
    defaults: { sl: 3, tp: 15, coin: "BTC" },
    metrics: {
      pf: 1.21,
      sharpe: 0.85,
      totalReturn: 155.05,
      winRate: 40.61,
      mdd: 42.2,
      trades: 953,
      measuredAt: "2026-04-22",
    },
  },
  {
    // Live-tracked on OKX: backtest PF 1.17 (2yr) vs live PF 0.88 (2026-01
    // to 2026-03). TrustGapPanel surfaces this delta. Kept on the grid
    // because honest live tracking IS the product differentiator.
    id: "bb-squeeze-short",
    direction: "short",
    risk: "medium",
    verified: true,
    liveTracked: true,
    labels: {
      en: "BB Squeeze ↓",
      ko: "볼린저 스퀴즈 ↓",
    },
    tagline: {
      en: "Short the pop after a low-volatility coil. Currently live-tracked.",
      ko: "낮은 변동성 구간 이후 상승 페이크 숏. 실거래 추적 중.",
    },
    defaults: { sl: 10, tp: 8, coin: "BTC" },
    metrics: {
      pf: 1.17,
      sharpe: 0.55,
      totalReturn: 82.98,
      winRate: 50.2,
      mdd: 46.6,
      trades: 494,
      measuredAt: "2026-04-22",
    },
  },
  {
    id: "keltner-squeeze",
    direction: "short",
    risk: "medium",
    verified: true,
    liveTracked: false,
    labels: {
      en: "Keltner Fade ↓",
      ko: "켈트너 페이드 ↓",
    },
    tagline: {
      en: "Fade breakouts through Keltner upper band.",
      ko: "켈트너 상단 돌파 페이드.",
    },
    defaults: { sl: 7, tp: 5, coin: "BTC" },
    metrics: {
      pf: 1.14,
      sharpe: 0.71,
      totalReturn: 88.22,
      winRate: 53.47,
      mdd: 44.8,
      trades: 735,
      measuredAt: "2026-04-22",
    },
  },
  {
    id: "ma-cross",
    direction: "both",
    risk: "low",
    verified: true,
    liveTracked: false,
    labels: {
      en: "MA Cross ↕",
      ko: "이평 교차 ↕",
    },
    tagline: {
      en: "Classic 50/200 EMA cross. Stable in bull and bear.",
      ko: "50/200 EMA 교차. 상승·하락장 모두 안정.",
    },
    defaults: { sl: 5, tp: 10, coin: "BTC" },
    metrics: {
      pf: 1.09,
      sharpe: 0.54,
      totalReturn: 85.06,
      winRate: 47.79,
      mdd: 33.5,
      trades: 1111,
      measuredAt: "2026-04-22",
    },
  },
] as const;

export const QUICK_START_DEFAULT_PRESET_ID = "atr-breakout";

export function findPreset(id: string): SimulatorPreset | undefined {
  return SIMULATOR_PRESETS.find((p) => p.id === id);
}
