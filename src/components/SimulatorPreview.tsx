/**
 * SimulatorPreview.tsx — Interactive simulator preview for homepage hero
 * Animated equity curve with hover trade signals + animated stats.
 */
import { useEffect, useState, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { COINS_ANALYZED } from "../config/site-stats";

// 2026-04-25: hero now mirrors `simulator-presets.ts` ATR Breakout SHORT
// (the QUICK_START_DEFAULT_PRESET_ID) verbatim — same SSoT used by /strategies
// grid + /simulate Quick Start. Previous mock (WR 68.6 · PF 2.22 · Sharpe
// 1.82) was internally inconsistent: total return only +25.6% while metrics
// implied a much stronger strategy → broke "We DID honest" brand voice.
// MDD shown red as-is; Sharpe and WR shown muted because <1.0 / <50% are
// honest signals for SHORT strategies.
const STATS = [
  { label: "Win Rate", value: 41.4, suffix: "%", color: "var(--color-text)" },
  { label: "Profit Factor", value: 1.31, suffix: "", color: "var(--color-up)" },
  {
    label: "Total Return",
    value: 157.7,
    suffix: "%",
    color: "var(--color-up)",
    prefix: "+",
  },
  {
    label: "Max Drawdown",
    value: 45.6,
    suffix: "%",
    color: "var(--color-red)",
  },
  { label: "Trades", value: 655, suffix: "", color: "var(--color-text)" },
  { label: "Sharpe", value: 0.98, suffix: "", color: "var(--color-text)" },
];

// More realistic equity curve with drawdowns
const EQUITY_POINTS = [
  55, 53, 50, 52, 46, 42, 44, 38, 35, 37, 32, 28, 30, 25, 22, 26, 20, 18, 22,
  16, 14, 18, 12, 10, 14, 8, 10, 6, 8, 5, 7, 4, 6, 3, 5, 2, 4, 2, 3, 2,
];

// Trade markers on the curve
const TRADES = [
  { x: 80, y: 42, type: "short", coin: "BTC", pnl: "+3.2%" },
  { x: 160, y: 28, type: "short", coin: "ETH", pnl: "+5.1%" },
  { x: 240, y: 20, type: "short", coin: "SOL", pnl: "+4.8%" },
  { x: 320, y: 12, type: "short", coin: "DOGE", pnl: "+2.9%" },
];

function AnimatedNumber({
  target,
  decimals = 1,
  duration = 1500,
  prefix = "",
}: {
  target: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
}) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return (
    <>
      {prefix}
      {current.toFixed(decimals)}
    </>
  );
}

function buildPath(pts: number[], width: number): string {
  const step = width / (pts.length - 1);
  return pts
    .map((y, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y}`)
    .join(" ");
}

export default function SimulatorPreview() {
  const [visible, setVisible] = useState(false);
  const [hoveredTrade, setHoveredTrade] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const curvePath = buildPath(EQUITY_POINTS, 400);
  const flatPath = EQUITY_POINTS.map(
    (_, i) =>
      `${i === 0 ? "M" : "L"}${((i * 400) / (EQUITY_POINTS.length - 1)).toFixed(1)},55`,
  ).join(" ");

  return (
    <div class="p-4 md:p-6 font-mono text-xs" style={{ minHeight: "320px" }}>
      {/* Strategy header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-bg)",
            }}
          >
            ATR Breakout SHORT
          </span>
          <span class="text-[--color-text-muted] text-[10px]">
            {COINS_ANALYZED} coins · 2yr · verified · schematic
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[--color-up] animate-pulse"></span>
          <span class="text-[--color-text-muted] text-[10px]">
            1H · OKX USDT-SWAP
          </span>
        </div>
      </div>

      {/* Big number hero */}
      <div
        class={`text-center mb-5 transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div
          class="text-4xl md:text-5xl font-extrabold"
          style={{ color: "var(--color-up)" }}
        >
          {visible ? (
            <AnimatedNumber target={157.7} prefix="+" duration={2000} />
          ) : (
            "0.0"
          )}
          %
        </div>
        <div class="text-[--color-text-muted] text-sm mt-1.5">
          $1,000 →{" "}
          {visible ? (
            <span style={{ color: "var(--color-up)" }}>
              $<AnimatedNumber target={2577} decimals={0} duration={2000} />
            </span>
          ) : (
            "$1,000"
          )}
        </div>
      </div>

      {/* Interactive equity curve */}
      <div class="relative h-20 mb-5 overflow-visible rounded-lg bg-[--color-bg]/30 border border-(--color-border)">
        <svg
          ref={svgRef as RefObject<SVGSVGElement>}
          viewBox="0 0 400 60"
          class="w-full h-full"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredTrade(null)}
        >
          <defs>
            <linearGradient id="eq-grad" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stop-color="var(--color-up)"
                stop-opacity="0.25"
              />
              <stop
                offset="100%"
                stop-color="var(--color-up)"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>
          {/* Fill area */}
          <path
            d={`${curvePath} L400,60 L0,60 Z`}
            fill="url(#eq-grad)"
            stroke="none"
          >
            {visible && (
              <animate
                attributeName="d"
                from={`${flatPath} L400,60 L0,60 Z`}
                to={`${curvePath} L400,60 L0,60 Z`}
                dur="1.8s"
                fill="freeze"
              />
            )}
          </path>
          {/* Line */}
          <path
            d={curvePath}
            fill="none"
            stroke="var(--color-up)"
            stroke-width="2"
            stroke-linecap="round"
          >
            {visible && (
              <animate
                attributeName="d"
                from={flatPath}
                to={curvePath}
                dur="1.8s"
                fill="freeze"
              />
            )}
          </path>
          {/* Trade markers */}
          {visible &&
            TRADES.map((t, i) => (
              <g
                key={i}
                onMouseEnter={() => setHoveredTrade(i)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={t.x} cy={t.y} r="6" fill="transparent" />
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={hoveredTrade === i ? 4 : 2.5}
                  fill={
                    t.type === "short"
                      ? "var(--color-accent)"
                      : "var(--color-up)"
                  }
                  stroke="var(--color-bg)"
                  stroke-width="1"
                  style={{ transition: "r 0.2s" }}
                />
              </g>
            ))}
        </svg>
        {/* Trade tooltip */}
        {hoveredTrade !== null && (
          <div
            class="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-[10px] border border-[--color-accent]/30"
            style={{
              left: `${(TRADES[hoveredTrade].x / 400) * 100}%`,
              top: `${(TRADES[hoveredTrade].y / 60) * 100 - 15}%`,
              transform: "translateX(-50%) translateY(-100%)",
              background: "rgba(20,20,24,0.95)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <span class="text-[--color-accent] font-bold">
              {TRADES[hoveredTrade].coin}
            </span>
            <span class="text-[--color-text-muted] mx-1">SHORT</span>
            <span class="text-[--color-up] font-bold">
              {TRADES[hoveredTrade].pnl}
            </span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div
        class={`grid grid-cols-3 gap-2 transition-opacity duration-700 delay-500 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            class="text-center p-2 rounded-lg bg-[--color-bg-tooltip] border border-(--color-border)"
          >
            <div class="text-[8px] text-[--color-text-muted] uppercase tracking-wider">
              {s.label}
            </div>
            <div class="text-sm font-bold mt-0.5" style={{ color: s.color }}>
              {visible ? (
                <AnimatedNumber
                  target={s.value}
                  decimals={s.value % 1 === 0 ? 0 : s.suffix === "%" ? 1 : 2}
                  prefix={s.prefix || ""}
                  duration={1800}
                />
              ) : (
                "0"
              )}
              {s.suffix}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
