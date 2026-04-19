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
      // MACD
      macd: "MACD line value",
      macd_signal: "MACD signal line",
      macd_histogram: "MACD histogram (MACD - signal)",
      macd_crossover: "MACD crossed above signal line (boolean)",
      // Stochastic
      stoch_oversold: "Stochastic is oversold (boolean)",
      stoch_overbought: "Stochastic is overbought (boolean)",
      // ADX extended
      plus_di: "+DI (positive directional indicator)",
      minus_di: "-DI (negative directional indicator)",
      strong_trend: "ADX > 25 — strong trend (boolean)",
      // HV extended
      hv_squeeze: "HV squeeze active (boolean)",
      hv_percentile: "HV percentile (0-100)",
      // Price action
      close_vs_high_20: "Close vs 20-period high ratio",
      close_vs_low_20: "Close vs 20-period low ratio",
      breakout_up: "Breakout above 20-period high (boolean)",
      breakout_down: "Breakdown below 20-period low (boolean)",
      // Ichimoku
      tenkan: "Tenkan-sen (conversion line)",
      kijun: "Kijun-sen (base line)",
      senkou_a: "Senkou Span A (leading span)",
      senkou_b: "Senkou Span B (leading span)",
      above_cloud: "Price above Ichimoku cloud (boolean)",
      below_cloud: "Price below Ichimoku cloud (boolean)",
      in_cloud: "Price inside Ichimoku cloud (boolean)",
      tk_cross_bull: "Tenkan crossed above Kijun (bullish, boolean)",
      tk_cross_bear: "Tenkan crossed below Kijun (bearish, boolean)",
      cloud_green: "Cloud is green (senkou_a > senkou_b, boolean)",
      cloud_red: "Cloud is red (senkou_a < senkou_b, boolean)",
      // Parabolic SAR
      psar: "Parabolic SAR value",
      psar_bull: "PSAR in bullish mode (boolean)",
      psar_bear: "PSAR in bearish mode (boolean)",
      psar_reversal_bull: "PSAR just flipped bullish (boolean)",
      psar_reversal_bear: "PSAR just flipped bearish (boolean)",
      // Williams %R
      williams_r: "Williams %R value (−100 to 0)",
      wr_oversold: "Williams %R oversold (< −80, boolean)",
      wr_overbought: "Williams %R overbought (> −20, boolean)",
      wr_exit_oversold: "Williams %R exiting oversold zone (boolean)",
      wr_exit_overbought: "Williams %R exiting overbought zone (boolean)",
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
      // MACD
      macd: "MACD 라인 값",
      macd_signal: "MACD 시그널 라인",
      macd_histogram: "MACD 히스토그램 (MACD - 시그널)",
      macd_crossover: "MACD가 시그널선 위로 교차 (불리언)",
      // 스토캐스틱
      stoch_oversold: "스토캐스틱 과매도 (불리언)",
      stoch_overbought: "스토캐스틱 과매수 (불리언)",
      // ADX 확장
      plus_di: "+DI (양의 방향성 지수)",
      minus_di: "-DI (음의 방향성 지수)",
      strong_trend: "ADX > 25 — 강한 추세 (불리언)",
      // 과거 변동성 확장
      hv_squeeze: "HV 스퀴즈 활성 (불리언)",
      hv_percentile: "HV 백분위 (0-100)",
      // 가격 행동
      close_vs_high_20: "종가 대비 20기간 고가 비율",
      close_vs_low_20: "종가 대비 20기간 저가 비율",
      breakout_up: "20기간 고가 돌파 (불리언)",
      breakout_down: "20기간 저가 붕괴 (불리언)",
      // 일목균형표
      tenkan: "전환선 (단기)",
      kijun: "기준선 (장기)",
      senkou_a: "선행스팬 A",
      senkou_b: "선행스팬 B",
      above_cloud: "가격이 구름 위 (불리언)",
      below_cloud: "가격이 구름 아래 (불리언)",
      in_cloud: "가격이 구름 안 (불리언)",
      tk_cross_bull: "전환선이 기준선 위로 교차 (강세, 불리언)",
      tk_cross_bear: "전환선이 기준선 아래로 교차 (약세, 불리언)",
      cloud_green: "구름 초록 (선행A > 선행B, 불리언)",
      cloud_red: "구름 빨강 (선행A < 선행B, 불리언)",
      // 파라볼릭 SAR
      psar: "파라볼릭 SAR 값",
      psar_bull: "PSAR 강세 모드 (불리언)",
      psar_bear: "PSAR 약세 모드 (불리언)",
      psar_reversal_bull: "PSAR 강세 전환 (불리언)",
      psar_reversal_bear: "PSAR 약세 전환 (불리언)",
      // 윌리엄스 %R
      williams_r: "윌리엄스 %R 값 (−100 ~ 0)",
      wr_oversold: "과매도 구간 (< −80, 불리언)",
      wr_overbought: "과매수 구간 (> −20, 불리언)",
      wr_exit_oversold: "과매도 탈출 (불리언)",
      wr_exit_overbought: "과매수 탈출 (불리언)",
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
      macd: "MACD (macd)",
      macd_signal: "MACD Signal (macd_signal)",
      macd_histogram: "MACD Histogram (macd_histogram)",
      macd_crossover: "MACD Crossover (macd_crossover)",
      stoch_oversold: "Stoch Oversold (stoch_oversold)",
      stoch_overbought: "Stoch Overbought (stoch_overbought)",
      plus_di: "+DI (plus_di)",
      minus_di: "-DI (minus_di)",
      strong_trend: "Strong Trend (strong_trend)",
      hv_squeeze: "HV Squeeze (hv_squeeze)",
      hv_percentile: "HV Percentile (hv_percentile)",
      close_vs_high_20: "Close/High-20 (close_vs_high_20)",
      close_vs_low_20: "Close/Low-20 (close_vs_low_20)",
      breakout_up: "Breakout Up (breakout_up)",
      breakout_down: "Breakdown (breakout_down)",
      tenkan: "Tenkan (tenkan)",
      kijun: "Kijun (kijun)",
      senkou_a: "Senkou A (senkou_a)",
      senkou_b: "Senkou B (senkou_b)",
      above_cloud: "Above Cloud (above_cloud)",
      below_cloud: "Below Cloud (below_cloud)",
      in_cloud: "In Cloud (in_cloud)",
      tk_cross_bull: "TK Bull Cross (tk_cross_bull)",
      tk_cross_bear: "TK Bear Cross (tk_cross_bear)",
      cloud_green: "Cloud Green (cloud_green)",
      cloud_red: "Cloud Red (cloud_red)",
      psar: "PSAR (psar)",
      psar_bull: "PSAR Bull (psar_bull)",
      psar_bear: "PSAR Bear (psar_bear)",
      psar_reversal_bull: "PSAR ↑ Flip (psar_reversal_bull)",
      psar_reversal_bear: "PSAR ↓ Flip (psar_reversal_bear)",
      williams_r: "Williams %R (williams_r)",
      wr_oversold: "WR Oversold (wr_oversold)",
      wr_overbought: "WR Overbought (wr_overbought)",
      wr_exit_oversold: "WR Exit OS (wr_exit_oversold)",
      wr_exit_overbought: "WR Exit OB (wr_exit_overbought)",
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
      macd: "MACD (macd)",
      macd_signal: "MACD 시그널 (macd_signal)",
      macd_histogram: "MACD 히스토그램 (macd_histogram)",
      macd_crossover: "MACD 교차 (macd_crossover)",
      stoch_oversold: "스토캐스틱 과매도 (stoch_oversold)",
      stoch_overbought: "스토캐스틱 과매수 (stoch_overbought)",
      plus_di: "+DI (plus_di)",
      minus_di: "-DI (minus_di)",
      strong_trend: "강한 추세 (strong_trend)",
      hv_squeeze: "HV 스퀴즈 (hv_squeeze)",
      hv_percentile: "HV 백분위 (hv_percentile)",
      close_vs_high_20: "종가/20고가 (close_vs_high_20)",
      close_vs_low_20: "종가/20저가 (close_vs_low_20)",
      breakout_up: "상방 돌파 (breakout_up)",
      breakout_down: "하방 붕괴 (breakout_down)",
      tenkan: "전환선 (tenkan)",
      kijun: "기준선 (kijun)",
      senkou_a: "선행A (senkou_a)",
      senkou_b: "선행B (senkou_b)",
      above_cloud: "구름 위 (above_cloud)",
      below_cloud: "구름 아래 (below_cloud)",
      in_cloud: "구름 안 (in_cloud)",
      tk_cross_bull: "전환↑기준 교차 (tk_cross_bull)",
      tk_cross_bear: "전환↓기준 교차 (tk_cross_bear)",
      cloud_green: "구름 초록 (cloud_green)",
      cloud_red: "구름 빨강 (cloud_red)",
      psar: "파라볼릭SAR (psar)",
      psar_bull: "PSAR 강세 (psar_bull)",
      psar_bear: "PSAR 약세 (psar_bear)",
      psar_reversal_bull: "PSAR ↑ 전환 (psar_reversal_bull)",
      psar_reversal_bear: "PSAR ↓ 전환 (psar_reversal_bear)",
      williams_r: "윌리엄스%R (williams_r)",
      wr_oversold: "WR 과매도 (wr_oversold)",
      wr_overbought: "WR 과매수 (wr_overbought)",
      wr_exit_oversold: "WR 과매도 탈출 (wr_exit_oversold)",
      wr_exit_overbought: "WR 과매수 탈출 (wr_exit_overbought)",
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
    <div class="text-xs rounded border border-[--color-border] bg-[--color-bg-tooltip]/40 p-2">
      {/* Row 1 (mobile): Field + info + remove */}
      <div class="flex items-center gap-1.5 mb-1.5 sm:mb-0 sm:hidden">
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
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          class="w-[44px] h-[44px] shrink-0 rounded-full border border-[--color-border] text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent] flex items-center justify-center text-xs font-mono transition-colors"
          title={desc[c.field] || c.field}
          aria-label={`Info about ${c.field}`}
        >
          i
        </button>
        <button
          onClick={() => onRemove(c.id)}
          class="text-[--color-text-muted] hover:text-[--color-red] w-[44px] h-[44px] flex items-center justify-center shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          ×
        </button>
      </div>

      {/* Row 2 (mobile): Op + Value + Shift */}
      <div class="flex items-center gap-1.5 sm:hidden">
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
            class="flex-1 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
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
            class="flex-1 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
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
            class="flex-1 px-1.5 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
            aria-label="Comparison value"
          />
        )}
        <select
          value={c.shift}
          onChange={(e: Event) =>
            onUpdate(
              c.id,
              "shift",
              parseInt((e.target as HTMLSelectElement).value),
            )
          }
          class={`w-16 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border rounded font-mono text-xs outline-none focus:border-[--color-accent] ${
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
            class="text-[--color-yellow] text-[10px] font-mono shrink-0 font-bold"
            title={lookAheadWarning}
            role="img"
            aria-label={lookAheadWarning}
          >
            ⚠
          </span>
        )}
      </div>

      {/* Desktop: single row (sm+) */}
      <div class="hidden sm:flex items-center gap-2">
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
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          class="w-7 h-7 shrink-0 rounded-full border border-[--color-border] text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent] flex items-center justify-center text-[10px] font-mono transition-colors"
          title={desc[c.field] || c.field}
          aria-label={`Info about ${c.field}`}
        >
          i
        </button>
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
            class="w-24 px-1 py-2 min-h-[44px] bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
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
            ⚠
          </span>
        )}
        <button
          onClick={() => onRemove(c.id)}
          class="text-[--color-text-muted] hover:text-[--color-red] min-w-12 min-h-12 flex items-center justify-center shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          ×
        </button>
      </div>

      {/* Info panel */}
      {showInfo && desc[c.field] && (
        <div class="mt-1.5 px-2 py-1.5 rounded bg-[--color-bg-tooltip] border border-[--color-accent]/20 text-[10px] text-[--color-text-muted] font-mono">
          {desc[c.field]}
        </div>
      )}
    </div>
  );
}
