/**
 * LiveStats.tsx - Dynamic performance stats from live trading data
 * Fetches /data/performance.json and displays real metrics
 */
import { useState, useEffect } from 'preact/hooks';

interface PerformanceData {
  generated: string;
  strategy: string;
  period: { from: string; to: string };
  summary: {
    total_trades: number;
    win_rate: number;
    profit_factor: number;
    total_pnl: number;
    starting_balance: number;
    current_balance: number;
    max_drawdown_pct: number;
  };
  daily: { date: string; pnl: number; trades: number; cum_pnl: number }[];
}

interface Props {
  lang?: 'en' | 'ko';
}

const L = {
  en: {
    liveTrades: 'Live Trades',
    liveDays: 'Live Trading Days',
    winRate: 'Win Rate',
    strategies: 'Verified Strategies',
    lastUpdated: 'Last updated',
    live: 'LIVE',
  },
  ko: {
    liveTrades: '실거래 건수',
    liveDays: '실거래 운영일',
    winRate: '승률',
    strategies: '검증된 전략',
    lastUpdated: '최근 업데이트',
    live: 'LIVE',
  },
};

function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(value, Math.round(increment * step));
      setDisplay(current);
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
}

export default function LiveStats({ lang = 'en' }: Props) {
  const t = L[lang] || L.en;
  const [data, setData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    fetch('/data/performance.json')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data) {
    // Fallback static values
    return (
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: '1,650+', label: t.liveTrades },
          { val: '48+', label: t.liveDays },
          { val: '54%+', label: t.winRate },
          { val: '1', label: t.strategies },
        ].map(({ val, label }) => (
          <div key={label} class="text-center p-4">
            <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">{val}</p>
            <p class="text-[--color-text-muted] text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>
    );
  }

  const liveDays = data.daily ? data.daily.filter((d) => d.trades > 0).length : 40;
  const lastDate = data.daily?.length ? data.daily[data.daily.length - 1].date : '';

  return (
    <div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-4">
          <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
            <AnimatedNumber value={data.summary.total_trades} />
          </p>
          <p class="text-[--color-text-muted] text-sm mt-1">{t.liveTrades}</p>
        </div>
        <div class="text-center p-4">
          <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
            <AnimatedNumber value={liveDays} suffix="+" />
          </p>
          <p class="text-[--color-text-muted] text-sm mt-1">{t.liveDays}</p>
        </div>
        <div class="text-center p-4">
          <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
            <AnimatedNumber value={Math.round(data.summary.win_rate * 10) / 10} suffix="%" />
          </p>
          <p class="text-[--color-text-muted] text-sm mt-1">{t.winRate}</p>
        </div>
        <div class="text-center p-4">
          <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">1</p>
          <p class="text-[--color-text-muted] text-sm mt-1">{t.strategies}</p>
        </div>
      </div>
      {lastDate && (
        <div class="text-center mt-2">
          <span class="inline-flex items-center gap-1.5 text-[10px] font-mono text-[--color-text-muted]">
            <span class="w-1.5 h-1.5 rounded-full bg-[--color-accent] animate-pulse" />
            {t.live} &middot; {t.lastUpdated}: {lastDate}
          </span>
        </div>
      )}
    </div>
  );
}
