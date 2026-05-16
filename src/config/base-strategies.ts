/**
 * SSoT: The 18 verified base strategy IDs.
 * Used by StrategyBuilder, OnboardingWizard, and any future UI that lists strategies.
 * Source of truth mirrors backend/src/strategies/registry.py
 */
export const BASE_STRATEGIES = [
  "bb-squeeze-short",
  "bb-squeeze-long",
  "momentum-long",
  "atr-breakout",
  "hv-squeeze",
  "rsi-divergence",
  "macd-cross",
  "donchian-breakout",
  "mean-reversion",
  "supertrend",
  "keltner-squeeze",
  "keltner-squeeze-long",
  "stochastic-rsi",
  "ma-cross",
  "adx-trend",
  "ichimoku",
  "heikin-ashi",
  "volume-profile",
] as const;

export type BaseStrategyId = (typeof BASE_STRATEGIES)[number];
