/**
 * EquitySparkline.tsx — Pure-SVG equity curve primitive (W2-1).
 *
 * Lightweight signature-styled sparkline for inline equity previews.
 * NOT a replacement for lightweight-charts (those 5 sites have crosshair
 * tooltips, BTC overlay, etc.). This primitive is for compact contexts:
 *   - Strategy result thumbnails on /strategies index
 *   - Card previews
 *   - Trust panel comparisons (extracts the inline pattern from
 *     TrustGapPanel.tsx into a reusable component)
 *
 * Visual signature (vs. the existing flat sparkline):
 *   - Gradient stroke fading from start (subtle accent) to end (full --color-up/down)
 *   - Endpoint glow circle (1px outline against bg)
 *   - Optional drawdown ribbon underlay (peak-to-current band)
 *   - Optional zero baseline (dashed)
 *   - Optional 0→100% draw animation on mount (350ms ease-out via stroke-dashoffset)
 *
 * Tokens-only — adapts to light/dark theme via existing global.css definitions.
 * a11y: <figure> + role="img" + aria-label. Title/desc inside SVG for AT.
 */
import { useEffect, useRef, useState } from "preact/hooks";

export type EquityVariant = "auto" | "neutral" | "success" | "danger";

interface Props {
  /** Equity values over time (just the y-values; x is index). */
  data: readonly number[];
  /** Required for a11y. */
  ariaLabel: string;
  /** Default 320 */
  width?: number;
  /** Default 70 */
  height?: number;
  /** "auto" picks success/danger from final value. Default "auto". */
  variant?: EquityVariant;
  /** Show animated endpoint glow circle. Default true. */
  showEndpoint?: boolean;
  /** Show peak-to-current drawdown ribbon underlay. Default false. */
  showDrawdown?: boolean;
  /** Show dashed zero baseline. Default true. */
  showZero?: boolean;
  /** Animate stroke draw-in on mount. Default true. Honors prefers-reduced-motion. */
  animate?: boolean;
  /** Tailwind/utility classes on the wrapper figure. */
  class?: string;
  "data-testid"?: string;
}

function pickVariant(
  variant: EquityVariant,
  finalValue: number,
): "neutral" | "success" | "danger" {
  if (variant === "neutral") return "neutral";
  if (variant === "success") return "success";
  if (variant === "danger") return "danger";
  return finalValue >= 0 ? "success" : "danger";
}

export default function EquitySparkline({
  data,
  ariaLabel,
  width = 320,
  height = 70,
  variant = "auto",
  showEndpoint = true,
  showDrawdown = false,
  showZero = true,
  animate = true,
  class: className = "",
  ...rest
}: Props) {
  const PAD_Y = 6;
  const pathRef = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(!animate);

  if (!data || data.length === 0) {
    return (
      <figure
        class={`relative ${className}`.trim()}
        aria-label={ariaLabel}
        {...rest}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            style={{ stroke: "var(--color-text-tertiary)" }}
            stroke-width="0.5"
            stroke-dasharray="2 3"
          />
        </svg>
      </figure>
    );
  }

  const finalValue = data[data.length - 1] ?? 0;
  const v = pickVariant(variant, finalValue);

  // Domain
  const minE = Math.min(0, ...data);
  const maxE = Math.max(0, ...data);
  const range = maxE - minE || 1;
  const xStep = width / Math.max(1, data.length - 1);
  const toY = (e: number) =>
    height - PAD_Y - ((e - minE) / range) * (height - 2 * PAD_Y);
  const zeroY = toY(0);

  // Path
  const linePath = data
    .map(
      (e, i) =>
        `${i === 0 ? "M" : "L"}${(i * xStep).toFixed(1)},${toY(e).toFixed(1)}`,
    )
    .join(" ");

  // Drawdown ribbon — peak-to-current band when current < peak
  let drawdownPath: string | null = null;
  if (showDrawdown) {
    let peak = data[0];
    const peakSeries = data.map((e) => {
      if (e > peak) peak = e;
      return peak;
    });
    const peakLine = peakSeries
      .map((e, i) => `L${(i * xStep).toFixed(1)},${toY(e).toFixed(1)}`)
      .join(" ");
    const dataLineRev = [...data]
      .reverse()
      .map((e, idx) => {
        const i = data.length - 1 - idx;
        return `L${(i * xStep).toFixed(1)},${toY(e).toFixed(1)}`;
      })
      .join(" ");
    drawdownPath = `M${peakLine.slice(1)} ${dataLineRev} Z`;
  }

  // Animation: stroke-dashoffset 0 on mount
  useEffect(() => {
    if (!animate) return;
    const reduce =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    if (reduce) {
      setDrawn(true);
      return;
    }
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setDrawn(true));
    } else {
      setDrawn(true);
    }
  }, [animate]);

  // For draw animation: get path length once, use stroke-dasharray/offset.
  // jsdom doesn't implement getTotalLength so we guard for the test environment.
  const [pathLen, setPathLen] = useState<number | null>(null);
  useEffect(() => {
    if (!animate || !pathRef.current) return;
    if (typeof pathRef.current.getTotalLength !== "function") return;
    try {
      setPathLen(pathRef.current.getTotalLength());
    } catch {
      // Path not measurable in this environment — skip draw animation.
    }
  }, [animate, linePath]);

  const strokeVar =
    v === "neutral"
      ? "--color-accent"
      : v === "success"
        ? "--color-up"
        : "--color-down";
  const fillVar =
    v === "neutral"
      ? "--color-accent"
      : v === "success"
        ? "--color-up-fill"
        : "--color-down-fill";

  // Area fill below the curve
  const areaPath = `${linePath} L${((data.length - 1) * xStep).toFixed(1)},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;

  const drawProgress =
    pathLen !== null
      ? { strokeDasharray: `${pathLen}`, strokeDashoffset: drawn ? 0 : pathLen }
      : undefined;

  return (
    <figure
      class={`relative ${className}`.trim()}
      aria-label={ariaLabel}
      {...rest}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id={`equity-grad-${v}`} x1="0" x2="1" y1="0" y2="0">
            <stop
              offset="0%"
              stop-color="var(--color-text-tertiary)"
              stop-opacity="0.4"
            />
            <stop
              offset="100%"
              stop-color={`var(${strokeVar})`}
              stop-opacity="1"
            />
          </linearGradient>
        </defs>

        {showZero && (
          <line
            x1={0}
            y1={zeroY}
            x2={width}
            y2={zeroY}
            style={{ stroke: "var(--color-text-tertiary)" }}
            stroke-width="0.5"
            stroke-dasharray="2 3"
          />
        )}

        {drawdownPath && (
          <path
            d={drawdownPath}
            style={{ fill: "var(--color-down-fill)" }}
            opacity="0.5"
          />
        )}

        <path
          d={areaPath}
          style={{ fill: `var(${fillVar})` }}
          opacity={v === "neutral" ? "0.10" : "1"}
        />

        <path
          ref={pathRef}
          d={linePath}
          fill="none"
          stroke={`url(#equity-grad-${v})`}
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          style={{
            transition: pathLen
              ? "stroke-dashoffset 350ms cubic-bezier(0.25, 0.1, 0.25, 1)"
              : undefined,
            ...drawProgress,
          }}
        />

        {showEndpoint && (
          <>
            {/* Soft halo behind dot */}
            <circle
              cx={(data.length - 1) * xStep}
              cy={toY(finalValue)}
              r={6}
              style={{ fill: `var(${strokeVar})` }}
              opacity="0.18"
            />
            <circle
              cx={(data.length - 1) * xStep}
              cy={toY(finalValue)}
              r={2.5}
              style={{
                fill: `var(${strokeVar})`,
                stroke: "var(--color-bg)",
              }}
              stroke-width="1"
            />
          </>
        )}
      </svg>
    </figure>
  );
}
