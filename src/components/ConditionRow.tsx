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
  lang?: "en" | "ko";
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
  lang = "en",
}: Props) {
  const fieldDescriptions: Record<"en" | "ko", Record<string, string>> = {
    en: {
      is_squeeze: "Bollinger Band Squeeze detected",
      recent_squeeze: "BB Squeeze in last 10 candles (rolling)",
      bb_expanding: "BB width expanding (curr > prev)",
      bb_width_above_ma: "BB width above its moving average",
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
    },
    ko: {
      is_squeeze: "볼린저 밴드 스퀴즈 감지됨",
      recent_squeeze: "최근 10캔들 내 BB 스퀴즈 발생 (롤링)",
      bb_expanding: "BB 폭 확장 중 (현재 > 이전)",
      bb_width_above_ma: "BB 폭이 이동평균 초과",
      bb_width_change: "BB 폭 변화율 (%)",
      vol_ratio: "평균 대비 거래량 비율",
      bearish: "약세 캔들 패턴",
      bullish: "강세 캔들 패턴",
      ema_fast: "빠른 EMA 값",
      ema_slow: "느린 EMA 값",
      rsi: "RSI (상대강도지수)",
      macd_hist: "MACD 히스토그램",
      stoch_k: "스토캐스틱 %K",
      stoch_d: "스토캐스틱 %D",
      adx: "ADX (평균방향성지수)",
      atr: "ATR (평균실제범위)",
      hv: "과거 변동성",
      price_change: "가격 변화율 (%)",
      close: "종가",
      open: "시가",
      high: "고가",
      low: "저가",
      volume: "거래량",
      bb_upper: "볼린저 밴드 상단",
      bb_lower: "볼린저 밴드 하단",
      bb_mid: "볼린저 밴드 중간",
      ema20: "EMA 20기간",
      ema50: "EMA 50기간",
      uptrend: "상승 추세 감지됨",
      downtrend: "하락 추세 감지됨",
      doji: "도지 캔들 패턴",
    },
  };

  const fieldLabels: Record<"en" | "ko", Record<string, string>> = {
    en: {
      is_squeeze: "BB Squeeze (is_squeeze)",
      recent_squeeze: "Recent Squeeze (recent_squeeze)",
      bb_expanding: "BB Expanding (bb_expanding)",
      bb_width_above_ma: "BB Width > MA (bb_width_above_ma)",
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
    },
    ko: {
      is_squeeze: "BB 스퀴즈 (is_squeeze)",
      recent_squeeze: "최근 스퀴즈 (recent_squeeze)",
      bb_expanding: "BB 확장 (bb_expanding)",
      bb_width_above_ma: "BB 폭 > MA (bb_width_above_ma)",
      bb_width_change: "BB 폭 변화율 (bb_width_change)",
      vol_ratio: "거래량 비율 (vol_ratio)",
      bearish: "약세 패턴 (bearish)",
      bullish: "강세 패턴 (bullish)",
      ema_fast: "EMA 빠름 (ema_fast)",
      ema_slow: "EMA 느림 (ema_slow)",
      rsi: "RSI (rsi)",
      macd_hist: "MACD 히스토그램 (macd_hist)",
      stoch_k: "스토캐스틱 %K (stoch_k)",
      stoch_d: "스토캐스틱 %D (stoch_d)",
      adx: "ADX (adx)",
      atr: "ATR (atr)",
      hv: "과거 변동성 (hv)",
      price_change: "가격 변화율 (price_change)",
      close: "종가 (close)",
      open: "시가 (open)",
      high: "고가 (high)",
      low: "저가 (low)",
      volume: "거래량 (volume)",
      bb_upper: "BB 상단 (bb_upper)",
      bb_lower: "BB 하단 (bb_lower)",
      bb_mid: "BB 중간 (bb_mid)",
      ema20: "EMA 20 (ema20)",
      ema50: "EMA 50 (ema50)",
      uptrend: "상승 추세 (uptrend)",
      downtrend: "하락 추세 (downtrend)",
      doji: "도지 패턴 (doji)",
    },
  };

  const desc = fieldDescriptions[lang] ?? fieldDescriptions.en;
  const labels = fieldLabels[lang] ?? fieldLabels.en;

  const [showInfo, setShowInfo] = useState(false);

  // 현재 필드가 availableFields에 없으면(프리셋 로드 등) 앞에 추가
  const displayFields = availableFields.includes(c.field)
    ? availableFields
    : [c.field, ...availableFields];

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
          }}
          class="flex-1 min-w-0 px-1.5 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
          title={desc[c.field] || c.field}
          aria-label="Indicator field"
        >
          {displayFields.map((f) => (
            <option key={f} value={f} title={desc[f] || f}>
              {labels[f] || f}
            </option>
          ))}
        </select>
        {/* Info toggle */}
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          class="w-[44px] h-[44px] sm:w-7 sm:h-7 shrink-0 rounded-full border border-[--color-border] text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent] flex items-center justify-center text-xs sm:text-[10px] font-mono transition-colors"
          title={desc[c.field] || c.field}
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
        {/* Value / Field2 */}
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
        ) : c.field2 !== undefined ? (
          <select
            value={c.field2}
            onChange={(e: Event) =>
              onUpdate(c.id, "field2", (e.target as HTMLSelectElement).value)
            }
            class="w-20 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
            aria-label="Comparison field"
          >
            {displayFields
              .filter((f) => !booleanFields.has(f))
              .map((f) => (
                <option key={f} value={f} title={desc[f] || f}>
                  {labels[f] || f}
                </option>
              ))}
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
      {showInfo && desc[c.field] && (
        <div class="mt-1 ml-1 px-2 py-1.5 rounded bg-[--color-bg-tooltip] border border-[--color-border] text-[10px] text-[--color-text-muted] font-mono">
          {desc[c.field]}
        </div>
      )}
    </div>
  );
}
