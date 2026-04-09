/**
 * ConditionRow.tsx - Single entry condition row
 */
import { useState } from "preact/hooks";
import type { Condition } from "./simulator-types";
import { OPS, booleanFields } from "./simulator-types";

interface Props {
  condition: Condition;
  availableFields: string[];
  onUpdate: (id: string, key: string, val: string | number | boolean) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
  lookAheadWarning?: string;
  prevLabel?: string;
  currLabel?: string;
}

export default function ConditionRow({
  condition: c,
  availableFields,
  onUpdate,
  onRemove,
  removeLabel,
  lookAheadWarning = "Using current (incomplete) candle data may cause look-ahead bias in live trading",
  prevLabel = "Prev",
  currLabel = "Curr",
}: Props) {
  const fieldDescriptions: Record<string, string> = {
    is_squeeze: "Bollinger Band Squeeze detected",
    bb_width_change: "BB width expansion rate (%)",
    vol_ratio: "Volume ratio vs average",
    bearish: "Bearish candle pattern",
    bullish: "Bullish candle pattern",
    ema_fast: "Fast EMA value",
    ema_slow: "Slow EMA value",
    rsi: "RSI (Relative Strength Index)",
    macd_hist: "MACD Histogram",
    stoch_k: "Stochastic %K",
    stoch_d: "Stochastic %D",
    adx: "ADX (Average Directional Index)",
    atr: "ATR (Average True Range)",
    hv: "Historical Volatility",
    price_change: "Price change (%)",
    close: "Close price",
    open: "Open price",
    high: "High price",
    low: "Low price",
    volume: "Trading volume",
    bb_upper: "Bollinger Band upper",
    bb_lower: "Bollinger Band lower",
    bb_mid: "Bollinger Band middle",
    ema20: "EMA 20-period",
    ema50: "EMA 50-period",
    uptrend: "Uptrend detected",
    downtrend: "Downtrend detected",
    doji: "Doji candle pattern",
  };

  const fieldLabels: Record<string, string> = {
    is_squeeze: "BB Squeeze (is_squeeze)",
    bb_width_change: "BB Width \u0394% (bb_width_change)",
    vol_ratio: "Volume Ratio (vol_ratio)",
    bearish: "Bearish Pattern (bearish)",
    bullish: "Bullish Pattern (bullish)",
    ema_fast: "EMA Fast (ema_fast)",
    ema_slow: "EMA Slow (ema_slow)",
    rsi: "RSI (rsi)",
    macd_hist: "MACD Histogram (macd_hist)",
    stoch_k: "Stochastic %K (stoch_k)",
    stoch_d: "Stochastic %D (stoch_d)",
    adx: "ADX (adx)",
    atr: "ATR (atr)",
    hv: "Hist. Volatility (hv)",
    price_change: "Price Change % (price_change)",
    close: "Close (close)",
    open: "Open (open)",
    high: "High (high)",
    low: "Low (low)",
    volume: "Volume (volume)",
    bb_upper: "BB Upper (bb_upper)",
    bb_lower: "BB Lower (bb_lower)",
    bb_mid: "BB Mid (bb_mid)",
    ema20: "EMA 20 (ema20)",
    ema50: "EMA 50 (ema50)",
    uptrend: "Uptrend (uptrend)",
    downtrend: "Downtrend (downtrend)",
    doji: "Doji (doji)",
  };

  const [showInfo, setShowInfo] = useState(false);

  return (
    <div class="text-xs">
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
        {/* Field */}
        <select
          value={c.field}
          onChange={(e: Event) => {
            const newField = (e.target as HTMLSelectElement).value;
            onUpdate(c.id, "field", newField);
            if (booleanFields.has(newField)) {
              onUpdate(c.id, "op", "==");
              onUpdate(c.id, "value", true);
            }
            setShowInfo(false);
          }}
          class="flex-1 min-w-0 px-1.5 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
          title={fieldDescriptions[c.field] || c.field}
          aria-label="Indicator field"
        >
          {availableFields.map((f) => (
            <option key={f} value={f} title={fieldDescriptions[f] || f}>
              {fieldLabels[f] || f}
            </option>
          ))}
        </select>
        {/* Info toggle */}
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          class="w-[44px] h-[44px] sm:w-7 sm:h-7 shrink-0 rounded-full border border-[--color-border] text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent] flex items-center justify-center text-xs sm:text-[10px] font-mono transition-colors"
          title={fieldDescriptions[c.field] || c.field}
          aria-label={`Info about ${c.field}`}
        >
          i
        </button>
        {/* Op */}
        <select
          value={c.op}
          onChange={(e: Event) =>
            onUpdate(c.id, "op", (e.target as HTMLSelectElement).value)
          }
          class="w-14 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
          aria-label="Comparison operator"
        >
          {OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {/* Value */}
        {booleanFields.has(c.field) ? (
          <select
            value={String(c.value)}
            onChange={(e: Event) =>
              onUpdate(
                c.id,
                "value",
                (e.target as HTMLSelectElement).value === "true",
              )
            }
            class="w-16 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
            aria-label="Boolean value"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type="number"
            step="any"
            value={c.value as number}
            onChange={(e: Event) =>
              onUpdate(
                c.id,
                "value",
                parseFloat((e.target as HTMLInputElement).value),
              )
            }
            class="w-20 px-1.5 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
            aria-label="Comparison value"
          />
        )}
        {/* Shift */}
        <select
          value={c.shift}
          onChange={(e: Event) =>
            onUpdate(
              c.id,
              "shift",
              parseInt((e.target as HTMLSelectElement).value),
            )
          }
          class={`w-14 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border rounded font-mono text-xs outline-none focus:border-[--color-accent] ${
            c.shift === 0
              ? "border-[--color-yellow] text-[--color-yellow] font-bold"
              : "border-[--color-border] text-[--color-text]"
          }`}
          title={
            c.shift === 1
              ? "Previous candle (confirmed/safe for live trading)"
              : "Current candle (incomplete in live) — look-ahead bias risk!"
          }
          aria-label={
            c.shift === 1
              ? "Candle: previous (confirmed)"
              : "Candle: current (look-ahead bias risk)"
          }
        >
          <option value="1">{prevLabel}</option>
          <option value="0">{currLabel}</option>
        </select>
        {c.shift === 0 && (
          <span
            class="text-[--color-yellow] text-[9px] font-mono shrink-0"
            title={lookAheadWarning}
            role="img"
            aria-label={lookAheadWarning}
          >
            !
          </span>
        )}
        {/* Remove */}
        <button
          onClick={() => onRemove(c.id)}
          class="text-[--color-text-muted] hover:text-[--color-red] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          x
        </button>
      </div>
      {/* Info panel */}
      {showInfo && fieldDescriptions[c.field] && (
        <div class="mt-1 ml-1 px-2 py-1.5 rounded bg-[--color-bg-tooltip] border border-[--color-border] text-[10px] text-[--color-text-muted] font-mono">
          {fieldDescriptions[c.field]}
        </div>
      )}
    </div>
  );
}
