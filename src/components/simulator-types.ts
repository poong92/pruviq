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
  // 9.5 phase 4 — overfitting detection + alpha
  deflated_sharpe?: number;
  dsr_haircut_pct?: number;
  mc_p_value?: number;
  mc_percentile?: number;
  jensens_alpha?: number;
  timeframe?: string;
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
]);

// Color constants (Toss Securities style)
export const COLORS = {
  accent: "#3182f6",
  accentDim: "#1b6cf2",
  accentGlow: "rgba(49,130,246,0.2)",
  accentGlowStrong: "rgba(49,130,246,0.3)",
  accentBg: "rgba(49,130,246,0.12)",
  green: "#00c073",
  greenGlow: "rgba(0,192,115,0.3)",
  greenBg: "rgba(0,192,115,0.12)",
  greenFill: "rgba(0,192,115,0.15)",
  red: "#f04251",
  redGlow: "rgba(240,66,81,0.2)",
  redGlowStrong: "rgba(240,66,81,0.3)",
  redBg: "rgba(240,66,81,0.12)",
  redFill: "rgba(240,66,81,0.15)",
  dark: "#17171c",
  disabled: "#252529",
  disabledText: "#56565f",
} as const;
