/**
 * simulator-types.ts - Shared types for Simulator components
 */

export { getCssVar } from "../utils/format";

export interface OhlcvBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_mid: number | null;
  ema20: number | null;
  ema50: number | null;
  vol_ratio: number | null;
}

export interface IndicatorInfo {
  id: string;
  name: string;
  fields: string[];
  default_params: Record<string, number>;
}

export interface Condition {
  id: string;
  field: string;
  op: string;
  value?: number | boolean;
  field2?: string;
  shift: number;
}

export interface TradeItem {
  symbol: string;
  direction: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  pnl_usd: number;
  exit_reason: string;
  bars_held: number;
}

export interface MonthlyStat {
  month: string;
  trades: number;
  wins: number;
  win_rate: number;
  total_return_pct: number;
  profit_factor: number;
}

export interface YearlyStat {
  year: number;
  trades: number;
  wins: number;
  win_rate: number;
  total_return_pct: number;
  profit_factor: number;
}

export interface CoinResult {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  avg_pnl_pct: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
}

export interface BacktestResult {
  name: string;
  direction: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  max_consecutive_losses: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  sl_pct: number;
  tp_pct: number;
  max_bars: number;
  compounding?: boolean;
  equity_curve: { time: string; value: number }[];
  yearly_stats?: YearlyStat[];
  indicators_used: string[];
  conditions_count: number;
  coins_used: number;
  data_range: string;
  is_valid: boolean;
  validation_errors: string[];
  total_fees_pct?: number;
  total_funding_pct?: number;
  coin_results?: CoinResult[];
  compute_time_ms: number;
  _isDemo?: boolean;
  export_hash?: string;
  trades?: TradeItem[];
  per_coin_usd?: number;
  leverage?: number;
  initial_capital_usd?: number;
  total_return_usd?: number;
  total_return_pct_portfolio?: number;
  max_drawdown_usd?: number;
  // 9.5 upgrade fields
  expectancy?: number;
  recovery_factor?: number;
  payoff_ratio?: number;
  btc_hold_return_pct?: number;
  eth_hold_return_pct?: number;
  var_95?: number;
  cvar_95?: number;
  strategy_grade?: string;
  grade_details?: string;
  warnings?: string[];
  edge_p_value?: number;
  // 9.5 phase 3
  walk_forward_consistency?: number;
  walk_forward_details?: string;
  avg_bars_held?: number;
  median_bars_held?: number;
  monthly_stats?: MonthlyStat[];
  positions_skipped?: number;
  pnl_distribution?: number[];
  pnl_buckets?: string[];
  // risk-adjusted returns
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  // 9.5 phase 4 — overfitting detection + alpha
  deflated_sharpe?: number;
  dsr_haircut_pct?: number;
  mc_p_value?: number;
  mc_percentile?: number;
  jensens_alpha?: number;
  timeframe?: string;
  // market regime performance
  regime_performance?: {
    bull: RegimeMetrics;
    bear: RegimeMetrics;
    sideways: RegimeMetrics;
  };
}

export interface RegimeMetrics {
  trades: number;
  win_rate: number;
  total_return: number;
  profit_factor: number;
  avg_pnl: number;
}

export interface PresetItem {
  id: string;
  name: string;
  direction: string;
  indicators: string[];
  conditions_count: number;
  sl_pct: number;
  tp_pct: number;
  friendlyName_en?: string;
  friendlyName_ko?: string;
}

export interface CoinOption {
  symbol: string;
  name?: string;
}

// ─── Helpers ───
let _condId = 0;
export function nextCondId() {
  return `c_${++_condId}`;
}

export const OPS = [
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: "==", label: "==" },
  { value: "cross_above", label: "↑ cross" },
  { value: "cross_below", label: "↓ cross" },
];

export const booleanFields = new Set([
  "is_squeeze",
  "recent_squeeze",
  "bb_expanding",
  "bb_width_above_ma",
  "uptrend",
  "downtrend",
  "bullish",
  "bearish",
  "doji",
  "hv_squeeze",
  "rsi_oversold",
  "rsi_overbought",
  "macd_crossover",
  "stoch_oversold",
  "stoch_overbought",
  "strong_trend",
  "breakout_up",
  "breakout_down",
  "above_cloud",
  "below_cloud",
  "in_cloud",
  "tk_cross_bull",
  "tk_cross_bear",
  "cloud_green",
  "cloud_red",
  "psar_bull",
  "psar_bear",
  "psar_reversal_bull",
  "psar_reversal_bear",
  "wr_oversold",
  "wr_overbought",
  "wr_exit_oversold",
  "wr_exit_overbought",
]);

// Color constants — 2026-04-23: recalibrated for WCAG 2.1 AA contrast.
// The original Toss palette used bg=#3182f6 + white text (contrast 3.71)
// and bg=#f04251 + white text (contrast 3.75) — both failed WCAG AA
// minimum 4.5. Axe reported 11/60 scanned elements with low contrast.
//
// New approach: buttons use accent-brand hue but DARKER for bg, OR the
// established "accent border + dark fill + accent-bright text" pattern.
// `accent` darkened from #3182f6 → #0369a1 (sky-700) — contrast 5.7 with
// white. `red` darkened from #f04251 → #dc2626 (red-600) — contrast 5.25.
// `accentBright` added for on-dark-bg text (#5CC8ED matches the site's
// global --color-accent-bright CSS var).
export const COLORS = {
  accent: "#0369a1", // sky-700: 5.7:1 on white (was 3.71)
  accentDim: "#0284c7", // hover: sky-600
  accentBright: "#5CC8ED", // on-dark-bg text (matches --color-accent-bright)
  accentGlow: "rgba(44,181,232,0.2)",
  accentGlowStrong: "rgba(44,181,232,0.3)",
  accentBg: "rgba(44,181,232,0.12)",
  green: "#16a34a", // green-600: 4.86:1 (was #00c073 = 2.5)
  greenBright: "#4ADE80",
  greenGlow: "rgba(22,163,74,0.3)",
  greenBg: "rgba(22,163,74,0.12)",
  greenFill: "rgba(22,163,74,0.15)",
  red: "#dc2626", // red-600: 5.25:1 (was #f04251 = 3.75)
  redBright: "#F87171",
  redGlow: "rgba(220,38,38,0.2)",
  redGlowStrong: "rgba(220,38,38,0.3)",
  redBg: "rgba(220,38,38,0.12)",
  redFill: "rgba(220,38,38,0.15)",
  dark: "#17171c",
  disabled: "#252529",
  disabledText: "#A8A8B3", // was #56565f (3.9:1) → 5.5:1 on disabled bg
} as const;
