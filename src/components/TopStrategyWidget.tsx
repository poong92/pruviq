/**
 * TopStrategyWidget — Hero live data panel
 * Fetches today's #1 strategy from rankings API and displays it
 * as a premium data card. Used in homepage hero.
 */
import { useState, useEffect } from "preact/hooks";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "https://api.pruviq.com";

interface RankingEntry {
  rank: number;
  name_en: string;
  name_ko: string;
  direction: string;
  timeframe: string;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  low_sample: boolean;
}

interface RankingData {
  date: string;
  top3: RankingEntry[];
}

type Lang = "en" | "ko";

const L = {
  en: {
    tag: "TODAY'S #1 STRATEGY",
    wr: "WIN RATE",
    pf: "PROFIT FACTOR",
    trades: "TRADES",
    live: "LIVE",
    cta: "Test it yourself →",
    disclaimer: "Simulated results · Not financial advice",
    loading: "Loading strategy data...",
    error: "Unable to load data",
    period: "30-day",
  },
  ko: {
    tag: "오늘의 1위 전략",
    wr: "승률",
    pf: "수익 팩터",
    trades: "거래 수",
    live: "실시간",
    cta: "직접 테스트 →",
    disclaimer: "시뮬레이션 결과 · 투자 권유 아님",
    loading: "전략 데이터 로딩 중...",
    error: "데이터를 불러올 수 없습니다",
    period: "30일",
  },
};

function directionLabel(dir: string) {
  if (dir === "long") return { label: "LONG↑", color: "var(--color-up)" };
  if (dir === "short") return { label: "SHORT↓", color: "var(--color-down)" };
  return { label: "BOTH↕", color: "var(--color-yellow)" };
}

export function TopStrategyWidget({ lang = "en" }: { lang?: Lang }) {
  const [top, setTop] = useState<RankingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = L[lang];

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_BASE}/rankings/daily?period=30d&group=top50`, {
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json() as Promise<RankingData>;
      })
      .then((d) => {
        if (d.top3 && d.top3.length > 0) setTop(d.top3[0]);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  const simulatePath = lang === "ko" ? "/ko/simulate" : "/simulate";

  if (loading) {
    return (
      <div
        class="rounded-xl p-5 border border-[--color-border] bg-[--color-bg-card]"
        style="box-shadow: var(--shadow-card);"
        aria-busy="true"
        aria-label={t.loading}
      >
        {/* Header skeleton */}
        <div class="flex items-center justify-between mb-4">
          <div class="h-3 w-32 rounded skeleton" />
          <div class="h-5 w-12 rounded-full skeleton" />
        </div>
        {/* Name skeleton */}
        <div class="h-6 w-48 rounded skeleton mb-1" />
        <div class="h-4 w-24 rounded skeleton mb-5" />
        {/* Stats grid skeleton */}
        <div class="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              class="rounded-lg p-3 border border-[--color-border] bg-[--color-bg]"
            >
              <div class="h-2 w-14 rounded skeleton mb-2" />
              <div class="h-6 w-16 rounded skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !top) {
    return null; // Fail silently — hero still works without widget
  }

  const { label: dirLabel, color: dirColor } = directionLabel(top.direction);
  const name = lang === "ko" ? top.name_ko : top.name_en;

  return (
    <div
      class="rounded-xl border border-[--color-border-accent] bg-[--color-bg-card] overflow-hidden"
      style="box-shadow: var(--shadow-accent-glow);"
    >
      {/* Header bar */}
      <div class="flex items-center justify-between px-5 py-3 border-b border-[--color-border] bg-[--color-bg]">
        <span class="font-mono text-[10px] tracking-widest text-[--color-accent] uppercase">
          {t.tag}
        </span>
        <span class="inline-flex items-center gap-1.5 font-mono text-[10px] text-[--color-up]">
          <span
            class="w-1.5 h-1.5 rounded-full bg-[--color-up]"
            style="animation: live-pulse 2s ease-in-out infinite;"
          />
          {t.live}
        </span>
      </div>

      {/* Content */}
      <div class="px-5 py-4">
        {/* Strategy name + meta */}
        <div class="mb-4">
          <h3
            class="font-bold text-xl text-[--color-text] mb-1"
            style="letter-spacing: -0.02em;"
          >
            {name}
          </h3>
          <div class="flex items-center gap-2">
            <span
              class="font-mono text-xs px-2 py-0.5 rounded border"
              style={{ color: dirColor, borderColor: dirColor + "40" }}
            >
              {dirLabel}
            </span>
            <span class="font-mono text-xs text-[--color-text-muted]">
              {top.timeframe}
            </span>
            <span class="font-mono text-xs text-[--color-text-muted]">
              · {t.period}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div class="grid grid-cols-3 gap-2 mb-4">
          {/* Win Rate */}
          <div class="rounded-lg p-3 bg-[--color-bg] border border-[--color-border]">
            <p class="font-mono text-[9px] tracking-wider text-[--color-text-muted] uppercase mb-1">
              {t.wr}
            </p>
            <p
              class="font-mono text-lg font-bold"
              style={{
                color:
                  top.win_rate >= 55
                    ? "var(--color-up)"
                    : top.win_rate >= 50
                      ? "var(--color-yellow)"
                      : "var(--color-down)",
              }}
            >
              {top.win_rate.toFixed(1)}%
            </p>
          </div>
          {/* Profit Factor */}
          <div class="rounded-lg p-3 bg-[--color-bg] border border-[--color-border]">
            <p class="font-mono text-[9px] tracking-wider text-[--color-text-muted] uppercase mb-1">
              {t.pf}
            </p>
            <p
              class="font-mono text-lg font-bold"
              style={{
                color:
                  top.profit_factor >= 1.5
                    ? "var(--color-up)"
                    : top.profit_factor >= 1.0
                      ? "var(--color-yellow)"
                      : "var(--color-down)",
              }}
            >
              {top.profit_factor >= 50 ? "99+" : top.profit_factor.toFixed(2)}
            </p>
          </div>
          {/* Trades */}
          <div class="rounded-lg p-3 bg-[--color-bg] border border-[--color-border]">
            <p class="font-mono text-[9px] tracking-wider text-[--color-text-muted] uppercase mb-1">
              {t.trades}
            </p>
            <p class="font-mono text-lg font-bold text-[--color-text]">
              {top.total_trades.toLocaleString()}
            </p>
          </div>
        </div>

        {/* CTA */}
        <a
          href={simulatePath}
          class="block w-full text-center py-2.5 rounded-lg font-semibold text-sm transition-colors"
          style="background: var(--color-accent); color: #000; box-shadow: var(--shadow-accent-glow);"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "var(--color-accent-dim)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "var(--color-accent)";
          }}
        >
          {t.cta}
        </a>
      </div>

      {/* Disclaimer footer */}
      <div class="px-5 py-2 border-t border-[--color-border] bg-[--color-bg]">
        <p class="font-mono text-[9px] text-[--color-text-disabled] text-center">
          {t.disclaimer}
        </p>
      </div>
    </div>
  );
}
