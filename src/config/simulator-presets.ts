// Quick Start preset curation for /simulate redesign (Phase 1).
//
// Purpose: 7 hand-picked presets surfaced as the first visible UI on /simulate.
// Goal: solve "empty results → bounce" by letting first-time visitors click
// one card and get an immediate, trustworthy simulation.
//
// Boundaries:
// - `id` MUST match a preset id in public/data/builder-presets.json and the
//   backend /builder/presets catalog (single source of truth for strategy logic).
// - Performance metrics (WR, PF, MDD) are NOT stored here — they come from
//   /simulate at runtime so users see real, reproducible numbers. Any UI
//   showing "expected" numbers must fetch them, not read them from this file.
// - `verified: true` is reserved for strategies that have passed the full
//   out-of-sample + walk-forward check. Adding it is a claim — requires
//   backend confirmation before flipping the flag.

export type PresetDirection = "long" | "short" | "both";
export type PresetRisk = "low" | "medium" | "high";

export interface SimulatorPreset {
  id: string;
  direction: PresetDirection;
  risk: PresetRisk;
  verified: boolean;
  labels: { en: string; ko: string };
  tagline: { en: string; ko: string };
  defaults: {
    sl: number;
    tp: number;
    coin: string;
  };
}

export const SIMULATOR_PRESETS: readonly SimulatorPreset[] = [
  {
    // 2026-04-21: verified flag pulled — live OKX performance over
    // 2026-01 … 2026-03 window shows PF 0.88 (losing). Historical 2-year
    // backtest is still strong (PF 2.22) but labeling a currently-
    // underperforming strategy "Verified" contradicts the brand promise
    // "ours come with proof". Flipping to false until either: (a) live
    // recovers above PF 1.3 for ≥30d, or (b) we split the badge into
    // "Backtest Verified" vs "Live Verified" with different thresholds.
    id: "bb-squeeze-short",
    direction: "short",
    risk: "medium",
    verified: false,
    labels: {
      en: "Volatility Squeeze ↓",
      ko: "변동성 스퀴즈 ↓",
    },
    tagline: {
      en: "Short the pop after a low-volatility coil.",
      ko: "낮은 변동성 구간 이후 상승 페이크 숏.",
    },
    defaults: { sl: 10, tp: 8, coin: "BTC" },
  },
  {
    id: "bb-squeeze-long",
    direction: "long",
    risk: "medium",
    verified: false,
    labels: {
      en: "Volatility Squeeze ↑",
      ko: "변동성 스퀴즈 ↑",
    },
    tagline: {
      en: "Long the breakout after volatility compression.",
      ko: "변동성 수축 이후 상방 돌파 롱.",
    },
    defaults: { sl: 7, tp: 6, coin: "BTC" },
  },
  {
    id: "rsi-reversal-long",
    direction: "long",
    risk: "high",
    verified: false,
    labels: {
      en: "Oversold Bounce ↑",
      ko: "과매도 반등 ↑",
    },
    tagline: {
      en: "High risk/reward — RSI oversold reversal.",
      ko: "리스크 대비 리워드 큰 RSI 과매도 반전.",
    },
    defaults: { sl: 5, tp: 10, coin: "BTC" },
  },
  {
    id: "macd-momentum-long",
    direction: "long",
    risk: "medium",
    verified: false,
    labels: {
      en: "Momentum Surge ↑",
      ko: "모멘텀 상승 ↑",
    },
    tagline: {
      en: "Ride the MACD + ADX trend when momentum confirms.",
      ko: "MACD + ADX 모멘텀 확인 시 추세 합류.",
    },
    defaults: { sl: 7, tp: 10, coin: "BTC" },
  },
  {
    id: "stochastic-overbought-short",
    direction: "short",
    risk: "medium",
    verified: false,
    labels: {
      en: "Overbought Fade ↓",
      ko: "과매수 하락 ↓",
    },
    tagline: {
      en: "Fade overheated rallies off the upper band.",
      ko: "상단 밴드 터치 + 과매수 신호 페이드.",
    },
    defaults: { sl: 8, tp: 8, coin: "BTC" },
  },
  {
    id: "ema-crossover-long",
    direction: "long",
    risk: "low",
    verified: false,
    labels: {
      en: "Trend Cross ↑",
      ko: "추세 교차 ↑",
    },
    tagline: {
      en: "Classic EMA crossover with ADX trend filter.",
      ko: "ADX 추세 필터 포함 EMA 교차 클래식.",
    },
    defaults: { sl: 7, tp: 10, coin: "BTC" },
  },
  {
    id: "turtle-breakout-long",
    direction: "long",
    risk: "high",
    verified: false,
    labels: {
      en: "Turtle Breakout ↑",
      ko: "터틀 브레이크아웃 ↑",
    },
    tagline: {
      en: "20-day high breakout — classic trend-follower.",
      ko: "20일 신고가 돌파 — 고전 추세추종.",
    },
    defaults: { sl: 10, tp: 12, coin: "BTC" },
  },
] as const;

export const QUICK_START_DEFAULT_PRESET_ID = "bb-squeeze-short";

export function findPreset(id: string): SimulatorPreset | undefined {
  return SIMULATOR_PRESETS.find((p) => p.id === id);
}
