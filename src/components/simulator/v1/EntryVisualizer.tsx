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
}

const VIEW_W = 240;
const VIEW_H = 140;

export default function EntryVisualizer({
  presetId,
  direction,
  label,
  compact,
}: Props) {
  const height = compact ? 100 : VIEW_H;
  return (
    <figure
      aria-label={`Entry diagram: ${label}`}
      class="relative rounded-lg bg-zinc-950/80 ring-1 ring-zinc-800"
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
        {renderStrategy(presetId, direction)}
      </svg>
      <figcaption class="sr-only">{label}</figcaption>
    </figure>
  );
}

// ── Strategy-specific renderers ─────────────────────────────────────────

function renderStrategy(presetId: string, direction: PresetDirection) {
  switch (presetId) {
    case "bb-squeeze-short":
      return <BBSqueeze dir="short" />;
    case "bb-squeeze-long":
      return <BBSqueeze dir="long" />;
    case "rsi-reversal-long":
      return <RSIReversal dir="long" />;
    case "macd-momentum-long":
      return <MACDMomentum dir="long" />;
    case "stochastic-overbought-short":
      return <StochasticOverbought dir="short" />;
    case "ema-crossover-long":
      return <EMACrossover dir="long" />;
    case "turtle-breakout-long":
      return <TurtleBreakout dir="long" />;
    default:
      return <GenericViz direction={direction} />;
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

function BBSqueeze({ dir }: { dir: "long" | "short" }) {
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
        labelText={dir === "long" ? "BREAKOUT ↑" : "BREAKOUT ↓"}
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

function RSIReversal({ dir }: { dir: "long" | "short" }) {
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
        labelText="OVERSOLD → ↑"
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · RSI
      </text>
    </g>
  );
}

// ── MACD Momentum Long ──────────────────────────────────────────────────

function MACDMomentum({ dir }: { dir: "long" | "short" }) {
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
        labelText="MACD ↑ 0"
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · MACD
      </text>
    </g>
  );
}

// ── Stochastic Overbought ───────────────────────────────────────────────

function StochasticOverbought({ dir }: { dir: "long" | "short" }) {
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
        labelText="OVERBOUGHT → ↓"
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Price · Stoch
      </text>
    </g>
  );
}

// ── EMA Crossover ───────────────────────────────────────────────────────

function EMACrossover({ dir }: { dir: "long" | "short" }) {
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
        labelText="GOLDEN CROSS"
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

function TurtleBreakout({ dir }: { dir: "long" | "short" }) {
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
        labelText="BREAKOUT ↑"
      />
      <text x={10} y={14} fill="#a1a1aa" font-size="9" font-family="monospace">
        Donchian 20
      </text>
    </g>
  );
}

// ── Fallback ────────────────────────────────────────────────────────────

function GenericViz({ direction }: { direction: PresetDirection }) {
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
