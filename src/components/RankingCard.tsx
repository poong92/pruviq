import { h } from "preact";

export interface RankingEntry {
  rank: number;
  name_ko: string;
  name_en: string;
  strategy: string;
  direction: string;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  timeframe: string;
  low_sample: boolean;
  total_return?: number;
  days_in_top?: number;
}

interface RankingCardProps {
  entry: RankingEntry;
  variant?: "best" | "worst" | "weekly";
  lang?: "en" | "ko";
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function rankBadge(rank: number): string {
  return RANK_MEDALS[rank - 1] ?? `#${rank}`;
}

function directionTag(direction: string) {
  const isLong = direction === "long";
  const isBoth = direction === "both";
  const label = isBoth ? "BOTH↕" : isLong ? "LONG↑" : "SHORT↓";
  const colorClass = isBoth
    ? "text-[--color-yellow] border-[--color-yellow]/40"
    : isLong
      ? "text-[--color-up] border-[--color-up]/40"
      : "text-[--color-red] border-[--color-red]/40";
  return (
    <span class={`font-mono text-xs px-2 py-0.5 rounded border ${colorClass}`}>
      {label}
    </span>
  );
}

function winRateColor(wr: number): string {
  if (wr >= 55) return "text-[--color-up]";
  if (wr >= 50) return "text-[--color-yellow]";
  return "text-[--color-red]";
}

function pfColor(pf: number): string {
  if (pf >= 1.5) return "text-[--color-up]";
  if (pf >= 1.0) return "text-[--color-yellow]";
  return "text-[--color-red]";
}

const STRINGS = {
  en: {
    winRate: "Win Rate",
    pf: "PF",
    trades: "Trades",
    daysInTop: "Days in Top",
    daysSuffix: "",
    lowSample: (n: number) => `Low sample (${n} trades < 100)`,
  },
  ko: {
    winRate: "승률",
    pf: "PF",
    trades: "거래 수",
    daysInTop: "집계 일수",
    daysSuffix: "일",
    lowSample: (n: number) => `샘플 부족 (${n}건 < 100건)`,
  },
};

export function RankingCard({
  entry,
  variant = "best",
  lang = "ko",
}: RankingCardProps) {
  const medal = rankBadge(entry.rank);
  const isWeekly = variant === "weekly";
  const s = STRINGS[lang];

  return (
    <div class="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] hover:border-[--color-accent]/40 transition-colors">
      {/* Header row */}
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl shrink-0" aria-label={`Rank ${entry.rank}`}>
            {medal}
          </span>
          <div class="min-w-0">
            <p class="font-semibold text-[--color-text] text-sm leading-tight truncate">
              {lang === "ko" ? entry.name_ko : entry.name_en}
            </p>
            <p class="text-[--color-text-muted] text-xs font-mono truncate">
              {lang === "ko" ? entry.name_en : entry.strategy}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {directionTag(entry.direction)}
          <span class="font-mono text-xs px-2 py-0.5 rounded border border-[--color-border] text-[--color-text-muted]">
            {entry.timeframe}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div class="grid grid-cols-3 gap-2 font-mono text-sm">
        <div>
          <p class="text-[--color-text-muted] text-xs mb-0.5">{s.winRate}</p>
          <p class={`font-bold text-base ${winRateColor(entry.win_rate)}`}>
            {entry.win_rate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p class="text-[--color-text-muted] text-xs mb-0.5">{s.pf}</p>
          <p class={`font-bold text-base ${pfColor(entry.profit_factor)}`}>
            {entry.profit_factor.toFixed(2)}
          </p>
        </div>
        <div>
          <p class="text-[--color-text-muted] text-xs mb-0.5">
            {isWeekly ? s.daysInTop : s.trades}
          </p>
          <p class="font-bold text-base text-[--color-text]">
            {isWeekly && entry.days_in_top != null
              ? `${entry.days_in_top}${s.daysSuffix}`
              : entry.total_trades}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {entry.low_sample && (
        <p class="mt-2 text-[--color-yellow] text-xs font-mono flex items-center gap-1">
          <span aria-hidden="true">⚠</span>
          {s.lowSample(entry.total_trades)}
        </p>
      )}
    </div>
  );
}
