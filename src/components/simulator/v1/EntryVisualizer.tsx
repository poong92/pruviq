// Entry condition diagrams — one per strategy. Pure SVG, no deps.
//
// Each visualizer shows WHAT triggers the trade (not backtest curve).
// Price line (mock, schematic — not real data), indicator overlay, entry
// marker with arrow. Purpose: teach the strategy at a glance, build trust.
//
// Conventions:
//   viewBox 240×140
//   long entries = emerald arrow, short entries = rose arrow
//   dashed lines = indicator bands/thresholds
//   dotted vertical = entry bar

import type { PresetDirection } from "../../../config/simulator-presets";
import { DIRECTION_TOKENS } from "../../../config/simulator-tokens";

interface Props {
  presetId: string;
  direction: PresetDirection;
  label: string;
  compact?: boolean;
  lang?: "en" | "ko";
}

// Bilingual glossary for SVG diagram labels. KO variants so /ko/simulate/
// preset cards don't leak English phrases like BREAKOUT / OVERSOLD.
const LBL = {
  breakout: { en: "BREAKOUT", ko: "돌파" },
  squeeze_expansion: { en: "squeeze → expansion", ko: "수축 → 확장" },
  oversold_up: { en: "OVERSOLD → ↑", ko: "과매도 → ↑" },
  macd_cross_zero: { en: "MACD ↑ 0", ko: "MACD ↑ 0" },
  overbought_down: { en: "OVERBOUGHT → ↓", ko: "과매수 → ↓" },
  golden_cross: { en: "GOLDEN CROSS", ko: "골든 크로스" },
  trend: { en: "TREND", ko: "추세" },
  above_cloud: { en: "ABOVE CLOUD", ko: "구름 위" },
  below_cloud: { en: "BELOW CLOUD", ko: "구름 아래" },
  sar_flip: { en: "SAR FLIP", ko: "SAR 반전" },
  wr_oversold: { en: "%R OVERSOLD", ko: "%R 과매도" },
  wr_overbought: { en: "%R OVERBOUGHT", ko: "%R 과매수" },
  double_oversold: { en: "DOUBLE OVERSOLD", ko: "이중 과매도" },
  double_overbought: { en: "DOUBLE OVERBOUGHT", ko: "이중 과매수" },
  band_bounce_up: { en: "BAND BOUNCE ↑", ko: "밴드 반등 ↑" },
  band_reject_down: { en: "BAND REJECT ↓", ko: "밴드 거절 ↓" },
  st_flip: { en: "ST FLIP", ko: "ST 반전" },
} as const;

function L(key: keyof typeof LBL, lang: "en" | "ko"): string {
  return LBL[key][lang];
}

const VIEW_W = 240;
const VIEW_H = 140;

export default function EntryVisualizer({
  presetId,
  direction,
  label,
  compact,
  lang = "en",
}: Props) {
  const height = compact ? 100 : VIEW_H;
  return (
    <figure
      aria-label={`Entry diagram: ${label}`}
      class="relative rounded-lg bg-(--color-bg)/80 ring-1 ring-(--color-border)"
      data-testid={`entry-viz-${presetId}`}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height={height}
        role="img"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="arrow-long"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
          </marker>
          <marker
            id="arrow-short"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
        </defs>
        {renderStrategy(presetId, direction, lang)}
      </svg>
      <figcaption class="sr-only">{label}</figcaption>
    </figure>
  );
}

// ── Strategy-specific renderers ─────────────────────────────────────────

function renderStrategy(
  presetId: string,
  direction: PresetDirection,
  lang: "en" | "ko",
) {
  // Both-direction BB squeeze (bidirectional) reuses the long diagram:
  // the entry marker is the breakout, not the direction.
  const id = presetId.replace(/^both-/, "");
  switch (id) {
    case "bb-squeeze-short":
      return <BBSqueeze dir="short" lang={lang} />;
    case "bb-squeeze-long":
    case "bb-squeeze":
      return <BBSqueeze dir="long" lang={lang} />;
    // 2026-04-22: new real-registry presets (PR fix/simulator-real-data).
    case "atr-breakout":
      return (
        <TurtleBreakout
          dir={direction === "long" ? "long" : "short"}
          lang={lang}
        />
      );
    case "keltner-squeeze":
      return (
        <BBSqueeze dir={direction === "long" ? "long" : "short"} lang={lang} />
      );
    case "ma-cross":
      return (
        <EMACrossover
          dir={direction === "short" ? "short" : "long"}
          lang={lang}
        />
      );
    case "rsi-reversal-long":
    case "rsi-reversal":
      return <RSIReversal dir="long" lang={lang} />;
    case "macd-momentum-long":
    case "macd-momentum":
      return <MACDMomentum dir="long" lang={lang} />;
    case "macd-crossover-short":
      return <MACDMomentum dir="short" lang={lang} />;
    case "stochastic-overbought-short":
      return <StochasticOverbought dir="short" lang={lang} />;
    case "stoch-rsi-overbought-short":
      return <StochasticOverbought dir="short" lang={lang} />;
    case "ema-crossover-long":
    case "ema-crossover":
      return <EMACrossover dir="long" lang={lang} />;
    case "ema-crossover-short":
      return <EMACrossover dir="short" lang={lang} />;
    case "turtle-breakout-long":
      return <TurtleBreakout dir="long" lang={lang} />;
    case "turtle-breakout-short":
      return <TurtleBreakout dir="short" lang={lang} />;
    case "adx-trend-long":
    case "adx-trend":
      return <ADXTrend dir="long" lang={lang} />;
    case "adx-trend-short":
      return <ADXTrend dir="short" lang={lang} />;
    case "ichimoku-cloud-long":
    case "ichimoku":
      return <Ichimoku dir="long" lang={lang} />;
    case "ichimoku-cloud-short":
      return <Ichimoku dir="short" lang={lang} />;
    case "psar-reversal-long":
      return <PsarReversal dir="long" lang={lang} />;
    case "psar-reversal-short":
      return <PsarReversal dir="short" lang={lang} />;
    case "williams-r-oversold-long":
      return <WilliamsR dir="long" lang={lang} />;
    case "williams-r-overbought-short":
      return <WilliamsR dir="short" lang={lang} />;
    case "rsi-bb-overbought-short":
      return <RSIBB dir="short" lang={lang} />;
    case "rsi-bb-oversold-long":
      return <RSIBB dir="long" lang={lang} />;
    case "hv-squeeze-breakout-long":
      return <BBSqueeze dir="long" lang={lang} />;
    case "hv-squeeze-breakout-short":
      return <BBSqueeze dir="short" lang={lang} />;
    case "grid-mean-reversion-long":
    case "dca-oversold-long":
      return <RSIReversal dir="long" lang={lang} />;
    case "bb-band-bounce-long":
      return <BBBounce dir="long" lang={lang} />;
    case "rsi-divergence-long":
      return <RSIReversal dir="long" lang={lang} />;
    case "supertrend-long":
      return <Supertrend dir="long" lang={lang} />;
    case "macd-zero-cross":
      return <MACDMomentum dir="long" lang={lang} />;
    case "stoch-rsi-reversal-both":
      return <StochasticOverbought dir="short" lang={lang} />;
    case "stoch-rsi-overbought":
      return <StochasticOverbought dir="short" lang={lang} />;
    default:
      return <GenericViz direction={direction} lang={lang} />;
  }
}

// Base axes + subtle grid shared by all diagrams.
function AxisBase() {
  return (
    <>
      <rect width={VIEW_W} height={VIEW_H} fill="transparent" />
      {[30, 60, 90, 120].map((y) => (
        <line
          key={y}
          x1={0}
          y1={y}
          x2={VIEW_W}
          y2={y}
          stroke="#27272a"
          stroke-width="0.5"
        />
      ))}
    </>
  );
}

function EntryMarker({
  x,
  y,
  dir,
  labelX,
  labelY,
  labelText,
}: {
  x: number;
  y: number;
  dir: "long" | "short";
  labelX: number;
  labelY: number;
  labelText: string;
}) {
  const color = dir === "long" ? "#10b981" : "#ef4444";
  const arrowY = dir === "long" ? y + 20 : y - 20;
  return (
    <>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={VIEW_H}
        stroke={color}
        stroke-width="0.5"
        stroke-dasharray="2,3"
        opacity="0.4"
      />
      <circle cx={x} cy={y} r="4" fill={color} />
      <circle cx={x} cy={y} r="8" fill="none" stroke={color} opacity="0.4" />
      <line
        x1={x}
        y1={dir === "long" ? y + 6 : y - 6}
        x2={x}
        y2={arrowY}
        stroke={color}
        stroke-width="1.5"
        marker-end={`url(#arrow-${dir})`}
      />
      <text
        x={labelX}
        y={labelY}
        fill={color}
        font-size="9"
        font-family="monospace"
        font-weight="600"
      >
        {labelText}
      </text>
    </>
  );
}

// ── Bollinger Band Squeeze ──────────────────────────────────────────────

function BBSqueeze({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const midline = "M0,70 L40,70 L80,70 L120,70 L160,70 L200,70 L240,70";
  // bands tight in middle (squeeze), widening at the right (breakout)
  const upperBand = "M0,40 Q60,55 120,60 Q160,62 200,30 L240,20";
  const lowerBand = "M0,100 Q60,85 120,80 Q160,78 200,110 L240,120";
  const price =
    dir === "long"
      ? "M0,75 L30,73 L60,72 L90,71 L120,70 L150,68 L170,55 L185,35 L210,25 L240,20"
      : "M0,75 L30,72 L60,70 L90,71 L120,71 L150,73 L170,88 L185,110 L210,118 L240,120";

  const entryX = 170;
  const entryY = dir === "long" ? 55 : 88;

  return (
    <g>
      <AxisBase />
      <path
        d={upperBand}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.6"
      />
      <path
        d={lowerBand}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.6"
      />
      <path
        d={midline}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.4"
        stroke-dasharray="1,2"
        opacity="0.4"
      />
      <path
        d={price}
        fill="none"
        stroke="#e4e4e7"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={dir === "long" ? entryX - 30 : entryX - 30}
        labelY={dir === "long" ? entryY + 38 : entryY - 26}
        labelText={`${L("breakout", lang)} ${dir === "long" ? "↑" : "↓"}`}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        BB (2σ)
      </text>
      <text
        x={10}
        y={134}
        fill="#60a5fa"
        font-size="8"
        font-family="monospace"
        opacity="0.7"
      >
        squeeze → expansion
      </text>
    </g>
  );
}

// ── RSI Reversal ────────────────────────────────────────────────────────

function RSIReversal({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  // Split: top half = price, bottom half = RSI scale 0-100
  // For long: RSI dips below 30 then crosses back up → long
  const price =
    "M0,50 L30,55 L60,62 L90,68 L120,70 L150,65 L170,58 L200,48 L240,38";
  const rsi =
    "M0,100 L30,108 L60,115 L90,120 L120,118 L150,110 L170,100 L200,92 L240,85";

  const entryX = 170;
  const entryY = 58;

  return (
    <g>
      <AxisBase />
      {/* Price */}
      <path
        d={price}
        fill="none"
        stroke="#e4e4e7"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      {/* RSI oversold band (below 30) */}
      <rect
        x={0}
        y={115}
        width={VIEW_W}
        height={10}
        fill="#10b981"
        opacity="0.1"
      />
      <line
        x1={0}
        y1={115}
        x2={VIEW_W}
        y2={115}
        stroke="#10b981"
        stroke-width="0.4"
        stroke-dasharray="2,2"
        opacity="0.6"
      />
      <text x={4} y={113} fill="#10b981" font-size="7" font-family="monospace">
        RSI 30
      </text>
      {/* RSI line */}
      <path
        d={rsi}
        fill="none"
        stroke="#f59e0b"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 40}
        labelY={entryY + 35}
        labelText={L("oversold_up", lang)}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · RSI
      </text>
    </g>
  );
}

// ── MACD Momentum Long ──────────────────────────────────────────────────

function MACDMomentum({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const price =
    "M0,80 L30,82 L60,80 L90,78 L120,73 L150,65 L170,55 L200,42 L240,30";
  const entryX = 150;
  const entryY = 65;

  // MACD histogram bars below
  const bars = [
    { x: 10, h: -5 },
    { x: 30, h: -6 },
    { x: 50, h: -4 },
    { x: 70, h: -2 },
    { x: 90, h: 2 },
    { x: 110, h: 5 },
    { x: 130, h: 8 },
    { x: 150, h: 11 },
    { x: 170, h: 13 },
    { x: 190, h: 15 },
    { x: 210, h: 14 },
  ];

  return (
    <g>
      <AxisBase />
      <path
        d={price}
        fill="none"
        stroke="#e4e4e7"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      {/* MACD histogram zone */}
      <line
        x1={0}
        y1={120}
        x2={VIEW_W}
        y2={120}
        stroke="#52525b"
        stroke-width="0.4"
      />
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={b.h > 0 ? 120 - b.h : 120}
          width={12}
          height={Math.abs(b.h)}
          fill={b.h > 0 ? "#10b981" : "#ef4444"}
          opacity="0.8"
        />
      ))}
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 35}
        labelY={entryY - 18}
        labelText={L("macd_cross_zero", lang)}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · MACD
      </text>
    </g>
  );
}

// ── Stochastic Overbought ───────────────────────────────────────────────

function StochasticOverbought({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const price =
    "M0,30 L30,32 L60,30 L90,35 L120,42 L150,55 L170,65 L200,82 L240,95";
  const stoch =
    "M0,50 L30,45 L60,42 L90,50 L120,55 L150,80 L170,90 L200,100 L240,110";

  return (
    <g>
      <AxisBase />
      {/* Overbought zone (Stoch > 80) */}
      <rect
        x={0}
        y={95}
        width={VIEW_W}
        height={10}
        fill="#ef4444"
        opacity="0.1"
      />
      <line
        x1={0}
        y1={95}
        x2={VIEW_W}
        y2={95}
        stroke="#ef4444"
        stroke-width="0.4"
        stroke-dasharray="2,2"
        opacity="0.6"
      />
      <text x={4} y={108} fill="#ef4444" font-size="7" font-family="monospace">
        STOCH 80
      </text>
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <path d={stoch} fill="none" stroke="#a78bfa" stroke-width="1.2" />
      <EntryMarker
        x={150}
        y={55}
        dir={dir}
        labelX={150 - 50}
        labelY={55 - 15}
        labelText={L("overbought_down", lang)}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · Stoch
      </text>
    </g>
  );
}

// ── EMA Crossover ───────────────────────────────────────────────────────

function EMACrossover({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const price =
    "M0,80 L30,78 L60,75 L90,72 L120,68 L150,60 L180,52 L210,44 L240,38";
  const emaFast =
    "M0,85 L30,80 L60,75 L90,70 L120,65 L150,58 L180,48 L210,40 L240,35";
  const emaSlow =
    "M0,75 L30,76 L60,76 L90,74 L120,70 L150,64 L180,58 L210,52 L240,48";
  const entryX = 150;
  const entryY = 60;

  return (
    <g>
      <AxisBase />
      <path
        d={emaSlow}
        fill="none"
        stroke="#60a5fa"
        stroke-width="1.1"
        opacity="0.7"
      />
      <path d={emaFast} fill="none" stroke="#f59e0b" stroke-width="1.1" />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 30}
        labelY={entryY + 30}
        labelText={L("golden_cross", lang)}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        EMA20 × EMA50
      </text>
      <g font-size="8" font-family="monospace">
        <text x={180} y={14} fill="#f59e0b">
          EMA20
        </text>
        <text x={180} y={24} fill="#60a5fa">
          EMA50
        </text>
      </g>
    </g>
  );
}

// ── Turtle Breakout ─────────────────────────────────────────────────────

function TurtleBreakout({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const highLine = 40;
  const lowLine = 110;
  const price =
    "M0,85 L30,80 L60,75 L90,70 L120,60 L140,50 L150,45 L170,32 L200,28 L240,25";
  const entryX = 150;
  const entryY = 45;

  return (
    <g>
      <AxisBase />
      {/* 20-day high/low channel */}
      <line
        x1={0}
        y1={highLine}
        x2={VIEW_W}
        y2={highLine}
        stroke="#10b981"
        stroke-width="0.6"
        stroke-dasharray="3,3"
      />
      <line
        x1={0}
        y1={lowLine}
        x2={VIEW_W}
        y2={lowLine}
        stroke="#ef4444"
        stroke-width="0.6"
        stroke-dasharray="3,3"
        opacity="0.5"
      />
      <text
        x={4}
        y={highLine - 3}
        fill="#10b981"
        font-size="7"
        font-family="monospace"
      >
        20-day HIGH
      </text>
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 35}
        labelY={entryY + 28}
        labelText={`${L("breakout", lang)} ↑`}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Donchian 20
      </text>
    </g>
  );
}

// ── ADX Trend ───────────────────────────────────────────────────────────

function ADXTrend({ dir, lang }: { dir: "long" | "short"; lang: "en" | "ko" }) {
  const price =
    dir === "long"
      ? "M0,90 L30,85 L60,75 L90,68 L120,58 L150,48 L180,38 L210,30 L240,22"
      : "M0,30 L30,35 L60,45 L90,55 L120,68 L150,80 L180,95 L210,108 L240,120";
  const adx = "M0,120 L40,115 L80,105 L120,90 L160,72 L200,55 L240,45";
  const entryX = 160;
  const entryY = dir === "long" ? 48 : 80;
  return (
    <g>
      <AxisBase />
      <rect
        x={0}
        y={60}
        width={VIEW_W}
        height={2}
        fill="#a1a1aa"
        opacity="0.4"
      />
      <text
        x={4}
        y={58}
        fill="#a1a1aa"
        font-size="7"
        font-family="monospace"
        opacity="0.7"
      >
        ADX 25
      </text>
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <path
        d={adx}
        fill="none"
        stroke="#a78bfa"
        stroke-width="1.2"
        stroke-dasharray="2,2"
      />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 30}
        labelY={dir === "long" ? entryY + 30 : entryY - 20}
        labelText={`${L("trend", lang)} ${dir === "long" ? "↑" : "↓"}`}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · ADX
      </text>
    </g>
  );
}

// ── Ichimoku Cloud ──────────────────────────────────────────────────────

function Ichimoku({ dir, lang }: { dir: "long" | "short"; lang: "en" | "ko" }) {
  const price =
    dir === "long"
      ? "M0,95 L30,90 L60,82 L90,72 L120,62 L150,52 L180,42 L210,32 L240,25"
      : "M0,25 L30,32 L60,45 L90,58 L120,72 L180,90 L240,105";
  // Kumo cloud (shaded region)
  const cloudTop = "M0,60 L60,55 L120,50 L180,55 L240,60";
  const cloudBot = "M0,75 L60,72 L120,70 L180,72 L240,75";
  const entryX = 150;
  const entryY = dir === "long" ? 52 : 72;
  return (
    <g>
      <AxisBase />
      <path
        d={`${cloudTop} L240,75 L180,72 L120,70 L60,72 L0,75 Z`}
        fill="#a78bfa"
        opacity="0.15"
      />
      <path
        d={cloudTop}
        fill="none"
        stroke="#a78bfa"
        stroke-width="0.6"
        opacity="0.6"
      />
      <path
        d={cloudBot}
        fill="none"
        stroke="#a78bfa"
        stroke-width="0.6"
        opacity="0.6"
      />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 30}
        labelY={dir === "long" ? entryY + 30 : entryY - 20}
        labelText={
          dir === "long" ? L("above_cloud", lang) : L("below_cloud", lang)
        }
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Ichimoku Kumo
      </text>
    </g>
  );
}

// ── Parabolic SAR Reversal ──────────────────────────────────────────────

function PsarReversal({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const price =
    dir === "long"
      ? "M0,75 L30,78 L60,72 L90,60 L120,48 L150,40 L180,32 L210,28 L240,22"
      : "M0,40 L30,35 L60,45 L90,60 L120,75 L150,88 L180,100 L210,112 L240,120";
  // PSAR dots alternating sides
  const psarPoints: Array<[number, number]> =
    dir === "long"
      ? [
          [20, 90],
          [40, 85],
          [60, 78],
          [80, 75],
          [100, 55],
          [120, 50],
          [150, 45],
          [180, 40],
          [210, 36],
        ]
      : [
          [20, 30],
          [40, 32],
          [60, 35],
          [80, 40],
          [100, 60],
          [120, 72],
          [150, 85],
          [180, 95],
          [210, 108],
        ];
  const entryX = 90;
  const entryY = dir === "long" ? 60 : 60;
  return (
    <g>
      <AxisBase />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      {psarPoints.map(([x, y]) => (
        <circle
          key={`${x},${y}`}
          cx={x}
          cy={y}
          r="2"
          fill={dir === "long" ? "#10b981" : "#ef4444"}
          opacity="0.8"
        />
      ))}
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 25}
        labelY={dir === "long" ? entryY + 28 : entryY - 18}
        labelText={`${L("sar_flip", lang)} ${dir === "long" ? "↑" : "↓"}`}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Parabolic SAR
      </text>
    </g>
  );
}

// ── Williams %R Oversold/Overbought ─────────────────────────────────────

function WilliamsR({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  // Price path (top half) and Williams %R (bottom, scale -100..0)
  const price =
    dir === "long"
      ? "M0,55 L30,60 L60,65 L90,68 L120,60 L150,50 L180,40 L210,30 L240,22"
      : "M0,22 L30,30 L60,40 L90,50 L120,58 L150,68 L180,80 L210,95 L240,105";
  const willr =
    dir === "long"
      ? "M0,118 L30,120 L60,118 L90,108 L120,100 L150,85 L180,75 L210,60 L240,50"
      : "M0,50 L30,55 L60,65 L90,75 L120,88 L150,100 L180,115 L210,120 L240,118";
  const entryX = 130;
  const entryY = dir === "long" ? 60 : 62;
  return (
    <g>
      <AxisBase />
      {/* Oversold band Williams %R < -80 ≈ y 115..125 */}
      <rect
        x={0}
        y={dir === "long" ? 115 : 30}
        width={VIEW_W}
        height={10}
        fill={dir === "long" ? "#10b981" : "#ef4444"}
        opacity="0.1"
      />
      <text
        x={4}
        y={dir === "long" ? 112 : 40}
        fill={dir === "long" ? "#10b981" : "#ef4444"}
        font-size="7"
        font-family="monospace"
      >
        %R {dir === "long" ? "−80" : "−20"}
      </text>
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <path d={willr} fill="none" stroke="#f59e0b" stroke-width="1.2" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 35}
        labelY={dir === "long" ? entryY + 30 : entryY - 18}
        labelText={
          dir === "long" ? L("wr_oversold", lang) : L("wr_overbought", lang)
        }
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · Williams
      </text>
    </g>
  );
}

// ── RSI + BB combo ──────────────────────────────────────────────────────

function RSIBB({ dir, lang }: { dir: "long" | "short"; lang: "en" | "ko" }) {
  const price =
    dir === "long"
      ? "M0,80 L30,85 L60,90 L90,95 L120,90 L150,78 L180,65 L210,52 L240,40"
      : "M0,40 L30,45 L60,52 L90,60 L120,68 L150,80 L180,95 L210,108 L240,115";
  const upperBB = "M0,35 L60,42 L120,38 L180,35 L240,30";
  const lowerBB = "M0,105 L60,98 L120,100 L180,108 L240,115";
  const entryX = 140;
  const entryY = dir === "long" ? 85 : 72;
  return (
    <g>
      <AxisBase />
      <path
        d={upperBB}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.5"
      />
      <path
        d={lowerBB}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.5"
      />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 40}
        labelY={dir === "long" ? entryY + 30 : entryY - 20}
        labelText={
          dir === "long"
            ? L("double_oversold", lang)
            : L("double_overbought", lang)
        }
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        BB + RSI
      </text>
    </g>
  );
}

// ── BB Band Bounce ──────────────────────────────────────────────────────

function BBBounce({ dir, lang }: { dir: "long" | "short"; lang: "en" | "ko" }) {
  const upper = "M0,35 L60,40 L120,38 L180,40 L240,35";
  const lower = "M0,105 L60,102 L120,100 L180,102 L240,105";
  const mid = "M0,70 L240,70";
  // Price touches lower band, bounces up
  const price =
    dir === "long"
      ? "M0,70 L30,82 L60,95 L90,102 L120,100 L150,88 L180,72 L210,55 L240,40"
      : "M0,70 L30,58 L60,45 L90,38 L120,40 L150,52 L180,68 L210,85 L240,102";
  const entryX = 110;
  const entryY = dir === "long" ? 100 : 40;
  return (
    <g>
      <AxisBase />
      <path
        d={upper}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.6"
      />
      <path
        d={lower}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.8"
        stroke-dasharray="3,2"
        opacity="0.6"
      />
      <path
        d={mid}
        fill="none"
        stroke="#60a5fa"
        stroke-width="0.4"
        stroke-dasharray="1,2"
        opacity="0.4"
      />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 25}
        labelY={dir === "long" ? entryY - 18 : entryY + 28}
        labelText={
          dir === "long"
            ? L("band_bounce_up", lang)
            : L("band_reject_down", lang)
        }
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        BB Band Bounce
      </text>
    </g>
  );
}

// ── Supertrend ──────────────────────────────────────────────────────────

function Supertrend({
  dir,
  lang,
}: {
  dir: "long" | "short";
  lang: "en" | "ko";
}) {
  const price =
    dir === "long"
      ? "M0,80 L30,75 L60,70 L90,65 L120,55 L150,45 L180,38 L210,30 L240,22"
      : "M0,30 L30,35 L60,45 L90,58 L120,70 L180,90 L240,108";
  // Supertrend line: follows price with bands flipping at entry
  const supertrendBefore = "M0,100 L30,95 L60,88 L90,82 L120,72 L150,62";
  const supertrendAfter = "M150,50 L180,42 L210,36 L240,28";
  const entryX = 150;
  const entryY = dir === "long" ? 55 : 75;
  return (
    <g>
      <AxisBase />
      <path
        d={supertrendBefore}
        fill="none"
        stroke={dir === "long" ? "#ef4444" : "#10b981"}
        stroke-width="1.2"
        opacity="0.6"
      />
      <path
        d={supertrendAfter}
        fill="none"
        stroke={dir === "long" ? "#10b981" : "#ef4444"}
        stroke-width="1.2"
        opacity="0.9"
      />
      <path d={price} fill="none" stroke="#e4e4e7" stroke-width="1.4" />
      <EntryMarker
        x={entryX}
        y={entryY}
        dir={dir}
        labelX={entryX - 30}
        labelY={dir === "long" ? entryY + 30 : entryY - 20}
        labelText={`${L("st_flip", lang)} ${dir === "long" ? "↑" : "↓"}`}
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Supertrend
      </text>
    </g>
  );
}

// ── Fallback ────────────────────────────────────────────────────────────

function GenericViz({
  direction,
  lang,
}: {
  direction: PresetDirection;
  lang: "en" | "ko";
}) {
  const hex = DIRECTION_TOKENS[direction].hex;
  return (
    <g>
      <AxisBase />
      <path
        d="M0,80 L60,75 L120,70 L180,55 L240,45"
        fill="none"
        stroke="#e4e4e7"
        stroke-width="1.4"
      />
      <circle cx={180} cy={55} r="5" fill={hex} />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Entry signal
      </text>
    </g>
  );
}
