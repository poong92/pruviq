/**
 * SimulatorPreview.tsx — Animated simulator preview for homepage
 * Replaces static screenshot with a live-feeling demo.
 */
import { useEffect, useState } from "preact/hooks";
import { COINS_ANALYZED } from "../config/site-stats";

const STATS = [
  { label: "Win Rate", value: 61.2, suffix: "%", color: "var(--color-up)" },
  { label: "Profit Factor", value: 2.14, suffix: "", color: "var(--color-up)" },
  {
    label: "Total Return",
    value: 570.3,
    suffix: "%",
    color: "var(--color-up)",
    prefix: "+",
  },
  {
    label: "Max Drawdown",
    value: 18.7,
    suffix: "%",
    color: "var(--color-red)",
  },
  { label: "Trades", value: 847, suffix: "", color: "var(--color-text)" },
  { label: "Sharpe", value: 1.82, suffix: "", color: "var(--color-up)" },
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
      // Ease out cubic
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

export default function SimulatorPreview() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div class="p-4 md:p-6 font-mono text-xs" style={{ minHeight: "280px" }}>
      {/* Strategy header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            BB Squeeze SHORT
          </span>
          <span class="text-[--color-text-muted] text-[10px]">
            {COINS_ANALYZED} coins · 2yr
          </span>
        </div>
        <span class="text-[--color-text-muted] text-[10px]">
          1H · Binance Futures
        </span>
      </div>

      {/* Big number hero */}
      <div
        class={`text-center mb-4 transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div
          class="text-3xl md:text-4xl font-bold"
          style={{ color: "var(--color-up)" }}
        >
          {visible ? (
            <AnimatedNumber target={570.3} prefix="+" duration={2000} />
          ) : (
            "0.0"
          )}
          %
        </div>
        <div class="text-[--color-text-muted] text-sm mt-1">
          $1,000 →{" "}
          {visible ? (
            <span style={{ color: "var(--color-up)" }}>
              $<AnimatedNumber target={6693} decimals={0} duration={2000} />
            </span>
          ) : (
            "$1,000"
          )}
        </div>
      </div>

      {/* Animated equity curve (CSS) */}
      <div class="relative h-16 mb-4 overflow-hidden rounded bg-[--color-bg]/50">
        <svg
          viewBox="0 0 400 60"
          class="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="eq-grad" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stop-color="var(--color-up)"
                stop-opacity="0.3"
              />
              <stop
                offset="100%"
                stop-color="var(--color-up)"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>
          <path
            d="M0,55 L20,52 L40,48 L60,50 L80,42 L100,38 L120,40 L140,32 L160,28 L180,30 L200,22 L220,18 L240,20 L260,14 L280,16 L300,10 L320,12 L340,8 L360,6 L380,4 L400,3"
            fill="url(#eq-grad)"
            stroke="none"
          >
            {visible && (
              <animate
                attributeName="d"
                from="M0,55 L20,55 L40,55 L60,55 L80,55 L100,55 L120,55 L140,55 L160,55 L180,55 L200,55 L220,55 L240,55 L260,55 L280,55 L300,55 L320,55 L340,55 L360,55 L380,55 L400,55"
                to="M0,55 L20,52 L40,48 L60,50 L80,42 L100,38 L120,40 L140,32 L160,28 L180,30 L200,22 L220,18 L240,20 L260,14 L280,16 L300,10 L320,12 L340,8 L360,6 L380,4 L400,3"
                dur="1.5s"
                fill="freeze"
              />
            )}
          </path>
          <path
            d="M0,55 L20,52 L40,48 L60,50 L80,42 L100,38 L120,40 L140,32 L160,28 L180,30 L200,22 L220,18 L240,20 L260,14 L280,16 L300,10 L320,12 L340,8 L360,6 L380,4 L400,3"
            fill="none"
            stroke="var(--color-up)"
            stroke-width="2"
          >
            {visible && (
              <animate
                attributeName="d"
                from="M0,55 L20,55 L40,55 L60,55 L80,55 L100,55 L120,55 L140,55 L160,55 L180,55 L200,55 L220,55 L240,55 L260,55 L280,55 L300,55 L320,55 L340,55 L360,55 L380,55 L400,55"
                to="M0,55 L20,52 L40,48 L60,50 L80,42 L100,38 L120,40 L140,32 L160,28 L180,30 L200,22 L220,18 L240,20 L260,14 L280,16 L300,10 L320,12 L340,8 L360,6 L380,4 L400,3"
                dur="1.5s"
                fill="freeze"
              />
            )}
          </path>
        </svg>
      </div>

      {/* Stats grid */}
      <div
        class={`grid grid-cols-3 gap-2 transition-opacity duration-700 delay-500 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            class="text-center p-1.5 rounded bg-[--color-bg-tooltip] border border-[--color-border]"
          >
            <div class="text-[8px] text-[--color-text-muted] uppercase">
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
