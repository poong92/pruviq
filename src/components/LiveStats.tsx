/**
 * LiveStats.tsx - Backtesting tool stats with animated numbers
 * Numbers fetched from /data/site-stats.json (SSoT).
 */
import { useState, useEffect } from "preact/hooks";
import { COINS_ANALYZED } from "../config/site-stats";

interface Props {
  lang?: "en" | "ko";
}

interface SiteStats {
  coins_analyzed: number;
  trading_days: number;
  simulations_run: number;
  strategies_tested: number;
}

const DEFAULTS: SiteStats = {
  coins_analyzed: COINS_ANALYZED,
  trading_days: 2898,
  simulations_run: 12847,
  strategies_tested: 88,
};

const L = {
  en: {
    trades: "Backtested Trades",
    coins: "Coins Tested",
    strategies: "Variations Tested",
    history: "Historical Data",
    yrs: "yrs",
  },
  ko: {
    trades: "백테스트 거래",
    coins: "테스트 코인",
    strategies: "테스트 조합",
    history: "과거 데이터",
    yrs: "년",
  },
};

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  // SSR: start with actual value so HTML shows real numbers, not 0
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 30;
    let step = 0;
    // Don't reset to 0 if already showing the correct value — prevents CLS flash
    if (display !== value) setDisplay(0);

    const timer = setInterval(() => {
      step++;
      const progress = 1 - Math.pow(1 - step / steps, 3);
      const current = Math.round(value * progress);
      setDisplay(current);
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function LiveStats({ lang = "en" }: Props) {
  const t = L[lang] ?? L.en;
  const [stats, setStats] = useState<SiteStats>(DEFAULTS);

  useEffect(() => {
    fetch("/data/site-stats.json")
      .then((r) => r.json())
      .then((d: Partial<SiteStats>) => {
        setStats({
          coins_analyzed: d.coins_analyzed ?? DEFAULTS.coins_analyzed,
          trading_days: d.trading_days ?? DEFAULTS.trading_days,
          simulations_run: d.simulations_run ?? DEFAULTS.simulations_run,
          strategies_tested: d.strategies_tested ?? DEFAULTS.strategies_tested,
        });
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  return (
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={stats.trading_days} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.trades}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={stats.coins_analyzed} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.coins}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={stats.strategies_tested} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.strategies}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={2} suffix="+" />
          <span class="text-xl ml-1">{t.yrs}</span>
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.history}</p>
      </div>
    </div>
  );
}
