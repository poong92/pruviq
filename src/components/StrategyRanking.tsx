import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { RankingCard } from "./RankingCard";
import type { RankingEntry } from "./RankingCard";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "https://api.pruviq.com";

interface RankingData {
  date: string;
  generated_at: string;
  period: string;
  group: string;
  top3: RankingEntry[];
  worst3: RankingEntry[];
  weekly_best3: RankingEntry[];
  summary: { wr_50plus: number; total: number };
  low_sample_count: number | null;
  available_periods: string[];
  available_groups: string[];
}

type Lang = "en" | "ko";

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

const PERIOD_LABELS: Record<string, Record<Lang, string>> = {
  "7d": { en: "7 Days", ko: "7일" },
  "30d": { en: "30 Days", ko: "30일" },
  "365d": { en: "365 Days", ko: "365일" },
};

const GROUP_LABELS: Record<string, Record<Lang, string>> = {
  top30: { en: "Top 30", ko: "Top 30" },
  top50: { en: "Top 50", ko: "Top 50" },
  top100: { en: "Top 100", ko: "Top 100" },
  btc: { en: "BTC Only", ko: "BTC 전용" },
};

const rankingLabels = {
  en: {
    loadFail: "Failed to load data",
    best3Title: "Best 3 Strategies",
    best3Sub: "Top 3 by Profit Factor (PF)",
    worst3Title: "Worst 3 Strategies",
    worst3Sub: "Bottom 3 by PF — combinations to avoid",
    weeklyTitle: "This Week's Best 3",
    weeklySub: "7-day average PF ranking",
    wr50Label: "Strategies with WR 50%+:",
    totalUnit: "total",
    simCta: "Test in Simulator",
    lowSampleWarning: (n: number) =>
      `${n} strategies have low sample counts (< 100 trades) — treat results with caution.`,
    periodLabel: "Period",
    groupLabel: "Group",
    loading: "Loading...",
  },
  ko: {
    loadFail: "데이터 로드 실패",
    best3Title: "상위 3개 전략",
    best3Sub: "PF(수익팩터) 기준 상위 3개",
    worst3Title: "하위 3개 전략",
    worst3Sub: "PF 기준 하위 3개 — 피해야 할 조합",
    weeklyTitle: "이번 주 상위 3개",
    weeklySub: "최근 7일 평균 PF 기준",
    wr50Label: "WR 50%+ 전략:",
    totalUnit: "개",
    simCta: "시뮬레이터에서 직접 확인",
    lowSampleWarning: (n: number) =>
      `일부 전략은 샘플 수가 부족합니다 (< 100건): ${n}개`,
    periodLabel: "기간",
    groupLabel: "그룹",
    loading: "로딩 중...",
  },
};

function getInitialParam(key: string, fallback: string): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) ?? fallback;
  }
  return fallback;
}

function updateUrlParams(period: string, group: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("period", period);
  url.searchParams.set("group", group);
  window.history.replaceState({}, "", url.toString());
}

export function StrategyRanking({ lang = "en" }: { lang?: Lang }) {
  const [period, setPeriod] = useState<string>(() =>
    getInitialParam("period", "30d"),
  );
  const [group, setGroup] = useState<string>(() =>
    getInitialParam("group", "top50"),
  );
  const [data, setData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lbl = rankingLabels[lang] ?? rankingLabels.en;

  const fetchData = useCallback(
    (p: string, g: string) => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();

      fetch(
        `${API_BASE}/rankings/daily?period=${encodeURIComponent(p)}&group=${encodeURIComponent(g)}`,
        {
          signal: controller.signal,
        },
      )
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
          setError(err.message ?? lbl.loadFail);
          setLoading(false);
        });

      return () => controller.abort();
    },
    [lbl.loadFail],
  );

  useEffect(() => {
    const cleanup = fetchData(period, group);
    return cleanup;
  }, [period, group, fetchData]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    updateUrlParams(p, group);
  };

  const handleGroupChange = (g: string) => {
    setGroup(g);
    updateUrlParams(period, g);
  };

  // Only show periods/groups confirmed by API — no fallback phantom buttons
  // During loading: empty → skeleton placeholders rendered instead
  const availablePeriods = data?.available_periods ?? [];
  const availableGroups = data?.available_groups ?? [];

  // Auto-correct selected period/group if not in available list after load
  useEffect(() => {
    if (!data || loading) return;
    if (
      data.available_periods.length > 0 &&
      !data.available_periods.includes(period)
    ) {
      const next = data.available_periods[0];
      setPeriod(next);
      updateUrlParams(next, group);
    }
    if (
      data.available_groups.length > 0 &&
      !data.available_groups.includes(group)
    ) {
      const next = data.available_groups[0];
      setGroup(next);
      updateUrlParams(period, next);
    }
  }, [data, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div class="border border-[--color-red]/30 rounded-lg p-5 bg-[--color-down-fill] text-[--color-red] text-sm font-mono">
        <p class="font-bold mb-1">{lbl.loadFail}</p>
        <p class="text-xs opacity-80">{error}</p>
      </div>
    );
  }

  return (
    <div class="space-y-8">
      {/* ── Period + Group filters ── */}
      <div class="space-y-3">
        {/* Period tabs */}
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="text-xs font-mono text-[--color-text-muted] mr-1">
            {lbl.periodLabel}:
          </span>
          {loading
            ? [0, 1, 2].map((i) => (
                <div
                  key={i}
                  class="w-16 h-6 rounded bg-[--color-border] animate-pulse"
                />
              ))
            : availablePeriods.map((p) => {
                const label = PERIOD_LABELS[p]?.[lang] ?? p;
                const active = period === p;
                return (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    class={`px-3 py-1 rounded font-mono text-xs border transition-colors ${
                      active
                        ? "bg-[--color-accent] text-[--color-bg] border-[--color-accent] font-semibold"
                        : "border-[--color-border] text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
        </div>

        {/* Group filter */}
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="text-xs font-mono text-[--color-text-muted] mr-1">
            {lbl.groupLabel}:
          </span>
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  class="w-16 h-6 rounded bg-[--color-border] animate-pulse"
                />
              ))
            : availableGroups.map((g) => {
                const label = GROUP_LABELS[g]?.[lang] ?? g;
                const active = group === g;
                return (
                  <button
                    key={g}
                    onClick={() => handleGroupChange(g)}
                    class={`px-3 py-1 rounded font-mono text-xs border transition-colors ${
                      active
                        ? "bg-[--color-accent] text-[--color-bg] border-[--color-accent] font-semibold"
                        : "border-[--color-border] text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
        </div>
      </div>

      {/* Loading spinner overlay */}
      {loading && (
        <div class="flex items-center gap-2 text-[--color-text-muted] text-sm font-mono py-2">
          <span class="animate-spin inline-block w-4 h-4 border-2 border-[--color-accent] border-t-transparent rounded-full" />
          {lbl.loading}
        </div>
      )}

      {/* Top 3 */}
      <section>
        <SectionHeader title={lbl.best3Title} subtitle={lbl.best3Sub} />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : data?.top3.map((entry) => (
                <RankingCard
                  key={`top-${entry.rank}`}
                  entry={entry}
                  lang={lang}
                  variant="best"
                />
              ))}
        </div>
      </section>

      {/* Worst 3 — exclude 0-trade sentinel entries */}
      <section>
        <SectionHeader title={lbl.worst3Title} subtitle={lbl.worst3Sub} />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : (data?.worst3 ?? [])
                .filter((e) => e.total_trades > 0)
                .map((entry) => (
                  <RankingCard
                    key={`worst-${entry.rank}`}
                    entry={entry}
                    variant="worst"
                    lang={lang}
                  />
                ))}
        </div>
      </section>

      {/* Weekly Best 3 — only render when data confirmed (no skeleton flash) */}
      {!loading && data?.weekly_best3 && data.weekly_best3.length > 0 && (
        <section>
          <SectionHeader title={lbl.weeklyTitle} subtitle={lbl.weeklySub} />
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data?.weekly_best3.map((entry) => (
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
            {lbl.wr50Label}{" "}
            <span class="text-[--color-accent] font-bold">
              {data.summary.wr_50plus}
            </span>
            <span class="text-[--color-text-muted]">
              {" "}
              / {data.summary.total} {lbl.totalUnit}
            </span>
          </p>
          <a
            href={lang === "ko" ? "/ko/simulate" : "/simulate"}
            class="shrink-0 inline-flex items-center gap-2 bg-[--color-accent] text-[--color-bg] px-5 py-2 rounded font-semibold text-sm hover:bg-[--color-accent-dim] transition-colors"
          >
            {lbl.simCta} &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
