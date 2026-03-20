import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { RankingCard } from "./RankingCard";
import type { RankingEntry } from "./RankingCard";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "https://api.pruviq.com";

interface WeeklyData {
  date: string;
  top3: RankingEntry[];
  worst3: RankingEntry[];
  weekly_best3: RankingEntry[];
  summary: { wr_50plus: number; total: number };
}

interface Props {
  lang: string;
}

const labels = {
  en: {
    weeklyBest: "This Week's Best 3",
    weeklyBestSub: "7-day Profit Factor ranking across 569+ coins",
    worstTitle: "Worst 3 This Week",
    worstSub: "Avoid these — bottom 3 by 7-day PF",
    loading: "Loading weekly rankings...",
    error: "Failed to load weekly data",
    simCta: "Test in Simulator",
    rankingLink: "See daily rankings →",
    noData: "Weekly data not available yet.",
    noDataWeekly:
      "No strategy has enough weekly trades yet. Check daily rankings.",
    weeklyNote: "Updated daily · 7-day rolling window",
    pfTip:
      "Profit Factor = avg win ÷ avg loss. 1.0 = breakeven, 2.0+ = strong.",
  },
  ko: {
    weeklyBest: "이번 주 Best 3",
    weeklyBestSub: "569+ 코인 기준 7일 PF 랭킹",
    worstTitle: "이번 주 Worst 3",
    worstSub: "피해야 할 조합 — 7일 PF 하위 3개",
    loading: "주간 랭킹 로딩 중...",
    error: "주간 데이터 로드 실패",
    simCta: "시뮬레이터에서 확인",
    rankingLink: "일일 랭킹 보기 →",
    noData: "주간 데이터가 아직 없습니다.",
    noDataWeekly: "이번 주 거래 샘플이 부족합니다. 일일 랭킹을 확인하세요.",
    weeklyNote: "매일 업데이트 · 7일 롤링",
    pfTip: "PF(수익팩터) = 평균 수익 ÷ 평균 손실. 1.0 = 손익분기, 2.0+ = 우수.",
  },
};

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

export default function WeeklyLeaderboard({ lang }: Props) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const l = (labels as Record<string, typeof labels.en>)[lang] ?? labels.en;
  const simulatePath = lang === "ko" ? "/ko/simulate" : "/simulate";
  const rankingPath =
    lang === "ko"
      ? "/ko/strategies/ranking?period=7d"
      : "/strategies/ranking?period=7d";

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/rankings/daily?period=7d&group=top50`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json() as Promise<WeeklyData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(l.error);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Filter out 0-trade sentinel entries (PF=99.99 cap artifacts)
  const hasValidTrades = (e: RankingEntry) => e.total_trades > 0;
  const rawWeekly =
    data?.weekly_best3 && data.weekly_best3.length > 0
      ? data.weekly_best3
      : (data?.top3 ?? []);
  const weeklyEntries = rawWeekly.filter(hasValidTrades);
  // worst3: require at least 5 trades to avoid statistical noise
  const worstEntries = (data?.worst3 ?? []).filter((e) => e.total_trades >= 5);

  return (
    <div class="space-y-8">
      {/* Best 3 this week */}
      <section>
        <div class="mb-4">
          <h2 class="text-lg font-bold text-[--color-text]">{l.weeklyBest}</h2>
          <p class="text-xs text-[--color-text-muted] font-mono mt-0.5">
            {l.weeklyBestSub}
          </p>
        </div>
        {error ? (
          <div class="border border-[--color-red]/30 rounded-lg p-4 text-[--color-red] text-sm font-mono">
            {error}
          </div>
        ) : (
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? (
              [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            ) : weeklyEntries.length > 0 ? (
              weeklyEntries.map((entry) => (
                <RankingCard
                  key={`w-${entry.rank}`}
                  entry={entry}
                  variant="weekly"
                  lang={lang as "en" | "ko"}
                />
              ))
            ) : (
              <div class="col-span-3 text-center py-8 text-[--color-text-muted] text-sm font-mono">
                {l.noDataWeekly}
                <br />
                <a
                  href={rankingPath}
                  class="mt-2 inline-block text-[--color-accent] hover:underline text-xs"
                >
                  {l.rankingLink}
                </a>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Worst 3 this week — only entries with ≥5 trades */}
      {!loading && !error && worstEntries.length > 0 && (
        <section>
          <div class="mb-4">
            <h2 class="text-lg font-bold text-[--color-text]">
              {l.worstTitle}
            </h2>
            <p class="text-xs text-[--color-text-muted] font-mono mt-0.5">
              {l.worstSub}
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {worstEntries.map((entry) => (
              <RankingCard
                key={`ww-${entry.rank}`}
                entry={entry}
                variant="worst"
                lang={lang as "en" | "ko"}
              />
            ))}
          </div>
        </section>
      )}

      {/* Summary bar */}
      {!loading && !error && data && (
        <div class="border border-[--color-border] rounded-lg px-5 py-4 bg-[--color-bg-card] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p class="font-mono text-xs text-[--color-text-muted] mb-1">
              {l.weeklyNote}
            </p>
            <p
              class="font-mono text-sm text-[--color-text-muted] cursor-help"
              title={l.pfTip}
            >
              WR 50%+ strategies:{" "}
              <span class="text-[--color-accent] font-bold">
                {data.summary.wr_50plus}
              </span>
              <span class="opacity-60"> / {data.summary.total}</span>
            </p>
          </div>
          <div class="flex gap-3 flex-wrap">
            <a
              href={rankingPath}
              class="shrink-0 inline-flex items-center gap-1.5 border border-[--color-border] text-[--color-text-muted] px-4 py-2 rounded font-semibold text-xs hover:border-[--color-accent] hover:text-[--color-accent] transition-colors"
            >
              {l.rankingLink}
            </a>
            <a
              href={simulatePath}
              class="shrink-0 inline-flex items-center gap-2 bg-[--color-accent] text-[--color-bg] px-5 py-2 rounded font-semibold text-sm hover:bg-[--color-accent-dim] transition-colors"
            >
              {l.simCta} &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
