import { h } from "preact";
import { buildSimulatorUrl } from "../config/simulation-context";

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
  sl_pct?: number;
  tp_pct?: number;
}

interface RankingCardProps {
  entry: RankingEntry;
  variant?: "best" | "worst" | "weekly";
  lang?: "en" | "ko";
  period?: string; // "30d" | "365d" | "7d" — used to set start_date in simulator link
}

const cardLabels = {
  en: {
    wr: "Win Rate",
    trades: "Trades",
    days: "Days in Top",
    daysUnit: "days",
    lowSample: (n: number) => `Low sample (${n} trades < 100)`,
    pfCapped: "Profit Factor capped at 99.99 (limited trade data)",
  },
  ko: {
    wr: "승률",
    trades: "거래 수",
    days: "집계 일수",
    daysUnit: "일",
    lowSample: (n: number) => `샘플 부족 (${n}건 < 100건)`,
    pfCapped: "PF 99.99로 제한됨 (거래 샘플 부족)",
  },
};

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

export function RankingCard({
  entry,
  variant = "best",
  lang = "en",
  period = "30d",
}: RankingCardProps) {
  const medal = rankBadge(entry.rank);
  const isWeekly = variant === "weekly";
  const lbl = cardLabels[lang] ?? cardLabels.en;
  const lowSampleBest = entry.low_sample && variant === "best";

  // Calculate start date from period for simulator link
  const periodDays = parseInt(period) || 30;
  const startDate = new Date(Date.now() - periodDays * 86400000)
    .toISOString()
    .slice(0, 10);

  return (
    <div
      class={`rounded-lg p-4 bg-[--color-bg-card] card-hover ${lowSampleBest ? "border border-[--color-yellow]/50 hover:border-[--color-yellow]" : "border border-[--color-border]"}`}
      style="box-shadow: var(--shadow-card);"
    >
      {/* Header row */}
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl shrink-0" aria-label={`Rank ${entry.rank}`}>
            {medal}
          </span>
          <div class="min-w-0">
            <p
              class="font-semibold text-[--color-text] text-sm leading-tight truncate"
              title={lang === "ko" ? entry.name_ko : entry.name_en}
            >
              {lang === "ko" ? entry.name_ko : entry.name_en}
            </p>
            <p class="text-[--color-text-muted] text-xs font-mono truncate">
              {lang === "ko"
                ? entry.name_en
                : entry.timeframe + " · " + entry.direction}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {directionTag(entry.direction)}
          {/* Show timeframe badge only in KO mode (EN shows timeframe in subtitle already) */}
          {!isWeekly && lang === "ko" && (
            <span class="font-mono text-xs px-2 py-0.5 rounded border border-[--color-border] text-[--color-text-muted]">
              {entry.timeframe}
            </span>
          )}
        </div>
      </div>

      {/* Low sample warning badge */}
      {entry.low_sample && (
        <div class="mb-3">
          <span class="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border border-[--color-yellow]/40 text-[--color-yellow] bg-[--color-yellow]/5">
            ⚠️ {lbl.lowSample(entry.total_trades)}
          </span>
        </div>
      )}

      {/* Dollar translation */}
      {entry.total_return != null && (
        <div class="mb-2 font-mono text-xs text-[--color-text-muted]">
          $1,000 →{" "}
          <span
            style={{
              color:
                entry.total_return >= 0
                  ? "var(--color-up)"
                  : "var(--color-red)",
            }}
          >
            $
            {Math.round(1000 * (1 + entry.total_return / 100)).toLocaleString()}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div class="grid grid-cols-3 gap-2 font-mono text-sm">
        <div>
          <p class="text-[--color-text-muted] text-xs mb-0.5">{lbl.wr}</p>
          <p class={`font-bold text-base ${winRateColor(entry.win_rate)}`}>
            {entry.win_rate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p
            class="text-[--color-text-muted] text-xs mb-0.5 cursor-help"
            title="Profit Factor = avg win ÷ avg loss. 1.0 = breakeven, 1.5+ = good, 2.0+ = strong. Capped at 99.99 for low-sample results."
          >
            PF <span class="opacity-50 text-[0.6rem]">?</span>
          </p>
          {entry.profit_factor >= 50 ? (
            <p
              class={`font-bold text-base ${pfColor(entry.profit_factor)} cursor-help underline decoration-dotted`}
              title={lbl.pfCapped}
            >
              {entry.profit_factor.toFixed(2)}
              <span class="ml-0.5 text-[0.6rem] font-normal text-[--color-text-muted]">
                (cap)
              </span>
            </p>
          ) : (
            <p class={`font-bold text-base ${pfColor(entry.profit_factor)}`}>
              {entry.profit_factor.toFixed(2)}
            </p>
          )}
        </div>
        <div>
          <p class="text-[--color-text-muted] text-xs mb-0.5">
            {isWeekly ? lbl.days : lbl.trades}
          </p>
          <p class="font-bold text-base text-[--color-text]">
            {isWeekly && entry.days_in_top != null
              ? `${entry.days_in_top}${lbl.daysUnit}`
              : entry.total_trades}
          </p>
        </div>
      </div>

      {/* Simulate button — uses centralized URL builder for consistency */}
      <a
        href={buildSimulatorUrl(
          {
            strategy: entry.strategy,
            direction: entry.direction as "short" | "long" | "both",
            sl: entry.sl_pct,
            tp: entry.tp_pct,
            startDate,
            timeframe: entry.timeframe !== "1H" ? entry.timeframe : undefined,
            source: "ranking",
            sourcePeriod: period,
          },
          lang,
        )}
        class="mt-3 block text-center text-xs font-mono px-3 py-1.5 rounded border border-[--color-accent]/30 text-[--color-accent] hover:bg-[--color-accent]/10 transition-colors"
      >
        {lang === "ko" ? "시뮬레이션 →" : "Simulate →"}
      </a>
    </div>
  );
}
