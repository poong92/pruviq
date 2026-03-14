import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { RankingCard } from "./RankingCard";
import type { RankingEntry } from "./RankingCard";

const STRINGS = {
  en: {
    loadError: "Failed to load ranking data.",
    loadErrorTitle: "Failed to load data",
    best3Title: "Best 3 Strategies",
    best3Sub: "Top 3 by Profit Factor",
    worst3Title: "Worst 3 Strategies",
    worst3Sub: "Bottom 3 by PF — combinations to avoid",
    weeklyTitle: "This Week's Best 3",
    weeklySub: "Ranked by 7-day average PF",
    summaryLabel: "Win Rate 50%+ strategies:",
    summaryTotal: (n: number) => `/ ${n}`,
    simulatorCta: "Try in Simulator →",
    simulatorHref: "/simulate",
  },
  ko: {
    loadError: "랭킹 데이터를 불러오지 못했습니다.",
    loadErrorTitle: "데이터 로드 실패",
    best3Title: "Best 3 전략",
    best3Sub: "PF(수익팩터) 기준 상위 3개",
    worst3Title: "Worst 3 전략",
    worst3Sub: "PF 기준 하위 3개 — 피해야 할 조합",
    weeklyTitle: "이번 주 Best 3",
    weeklySub: "최근 7일 평균 PF 기준",
    summaryLabel: "WR 50%+ 전략:",
    summaryTotal: (n: number) => `/ ${n}개`,
    simulatorCta: "시뮬레이터에서 직접 확인 →",
    simulatorHref: "/ko/simulate",
  },
};

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "https://api.pruviq.com";

interface RankingData {
  date: string;
  generated_at: string;
  top3: RankingEntry[];
  worst3: RankingEntry[];
  weekly_best3: RankingEntry[];
  summary: { wr_50plus: number; total: number };
  warning: string | null;
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div class="mb-4">
      <h2 class="text-lg font-bold text-[--color-text]">{title}</h2>
      {subtitle && (
        <p class="text-xs text-[--color-text-muted] font-mono mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div class="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] animate-pulse">
      <div class="flex items-start gap-2 mb-3">
        <div class="w-7 h-7 rounded bg-[--color-border]" />
        <div class="flex-1 space-y-1.5">
          <div class="h-3.5 rounded bg-[--color-border] w-3/4" />
          <div class="h-3 rounded bg-[--color-border] w-1/2" />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} class="space-y-1">
            <div class="h-2.5 rounded bg-[--color-border] w-10" />
            <div class="h-5 rounded bg-[--color-border] w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StrategyRanking({ lang = "ko" }: { lang?: "en" | "ko" }) {
  const [data, setData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const s = STRINGS[lang];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/rankings/daily`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        return res.json() as Promise<RankingData>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message ?? s.loadError);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div class="border border-[--color-red]/30 rounded-lg p-5 bg-[--color-down-fill] text-[--color-red] text-sm font-mono">
        <p class="font-bold mb-1">{s.loadErrorTitle}</p>
        <p class="text-xs opacity-80">{error}</p>
      </div>
    );
  }

  return (
    <div class="space-y-10">
      {/* Warning banner */}
      {data?.warning && (
        <div class="border border-[--color-yellow]/30 rounded-lg px-4 py-3 bg-[--color-yellow]/5 text-[--color-yellow] text-xs font-mono flex items-start gap-2">
          <span aria-hidden="true" class="shrink-0">
            ⚠
          </span>
          <span>{data.warning}</span>
        </div>
      )}

      {/* Top 3 */}
      <section>
        <SectionHeader title={s.best3Title} subtitle={s.best3Sub} />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : data?.top3.map((entry) => (
                <RankingCard
                  key={`top-${entry.rank}`}
                  entry={entry}
                  variant="best"
                  lang={lang}
                />
              ))}
        </div>
      </section>

      {/* Worst 3 */}
      <section>
        <SectionHeader title={s.worst3Title} subtitle={s.worst3Sub} />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : data?.worst3.map((entry) => (
                <RankingCard
                  key={`worst-${entry.rank}`}
                  entry={entry}
                  variant="worst"
                  lang={lang}
                />
              ))}
        </div>
      </section>

      {/* Weekly Best 3 */}
      {(loading || (data?.weekly_best3 && data.weekly_best3.length > 0)) && (
        <section>
          <SectionHeader title={s.weeklyTitle} subtitle={s.weeklySub} />
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading
              ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
              : data?.weekly_best3.map((entry) => (
                  <RankingCard
                    key={`weekly-${entry.rank}`}
                    entry={entry}
                    variant="weekly"
                    lang={lang}
                  />
                ))}
          </div>
        </section>
      )}

      {/* Summary bar */}
      {!loading && data && (
        <div class="border border-[--color-border] rounded-lg px-5 py-4 bg-[--color-bg-card] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p class="font-mono text-sm text-[--color-text]">
            {s.summaryLabel}{" "}
            <span class="text-[--color-accent] font-bold">
              {data.summary.wr_50plus}
            </span>
            <span class="text-[--color-text-muted]">
              {" "}
              {s.summaryTotal(data.summary.total)}
            </span>
          </p>
          <a
            href={s.simulatorHref}
            class="shrink-0 inline-flex items-center gap-2 bg-[--color-accent] text-[--color-bg] px-5 py-2 rounded font-semibold text-sm hover:bg-[--color-accent-dim] transition-colors"
          >
            {s.simulatorCta}
          </a>
        </div>
      )}
    </div>
  );
}
