/**
 * simulator-types.ts - Shared types for Simulator components
 */

export { getCssVar } from '../utils/format';

export interface OhlcvBar {
  t: number; o: number; h: number; l: number; c: number; v: number;
  bb_upper: number | null; bb_lower: number | null; bb_mid: number | null;
  ema20: number | null; ema50: number | null; vol_ratio: number | null;
}

export interface IndicatorInfo {
  id: string; name: string; fields: string[]; default_params: Record<string, number>;
}

export interface Condition {
  id: string; field: string; op: string; value?: number | boolean;
  field2?: string; shift: number;
}

export interface TradeItem {
  symbol: string; direction: string; entry_time: string; exit_time: string;
  entry_price: number; exit_price: number; pnl_pct: number;
  exit_reason: string; bars_held: number;
}

export interface YearlyStat {
  year: number; trades: number; wins: number; win_rate: number;
  total_return_pct: number; profit_factor: number;
}

export interface BacktestResult {
  name: string; direction: string; total_trades: number; wins: number; losses: number;
  win_rate: number; profit_factor: number; total_return_pct: number;
  max_drawdown_pct: number; avg_win_pct: number; avg_loss_pct: number;
  max_consecutive_losses: number; tp_count: number; sl_count: number; timeout_count: number;
  equity_curve: { time: string; value: number }[];
  yearly_stats?: YearlyStat[];
  indicators_used: string[]; conditions_count: number; coins_used: number;
  data_range: string; is_valid: boolean; validation_errors: string[];
  compute_time_ms: number; _isDemo?: boolean;
  export_hash?: string;
  trades?: TradeItem[];
}

export interface PresetItem {
  id: string; name: string; direction: string;
  indicators: string[]; conditions_count: number; sl_pct: number; tp_pct: number;
}

export interface CoinOption { symbol: string; name?: string; }

// ─── Helpers ───
let _condId = 0;
export function nextCondId() { return `c_${++_condId}`; }

export const OPS = [
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '==', label: '==' },
];

export const booleanFields = new Set([
  'is_squeeze', 'uptrend', 'downtrend', 'bullish', 'bearish', 'doji',
  'hv_squeeze', 'rsi_oversold', 'rsi_overbought', 'macd_crossover',
  'stoch_oversold', 'stoch_overbought', 'strong_trend', 'breakout_up', 'breakout_down',
]);

// Color constants (professional blue theme)
export const COLORS = {
  accent: '#3b82f6',
  accentDim: '#2563eb',
  accentGlow: 'rgba(59,130,246,0.3)',
  accentGlowStrong: 'rgba(59,130,246,0.4)',
  accentBg: 'rgba(59,130,246,0.15)',
  green: '#10b981',
  greenGlow: 'rgba(16,185,129,0.4)',
  greenBg: 'rgba(16,185,129,0.15)',
  greenFill: 'rgba(16,185,129,0.2)',
  red: '#ef4444',
  redGlow: 'rgba(239,68,68,0.3)',
  redGlowStrong: 'rgba(239,68,68,0.4)',
  redBg: 'rgba(239,68,68,0.15)',
  redFill: 'rgba(239,68,68,0.2)',
  dark: '#0a0a0a',
  disabled: '#1a1a1a',
  disabledText: '#888',
} as const;
