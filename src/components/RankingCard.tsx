import { h } from "preact";
import { buildSimulatorUrl } from "../config/simulation-context";
import { getStrategyDescription } from "../config/strategy-descriptions";

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

/**
 * Synthetic sparkline — generates a plausible equity curve from total_return.
 * Uses strategy name as a simple hash seed so the same card always renders
 * the same curve (no flickering on re-render). Visual hint only, not real data.
 */
function Sparkline({
  totalReturn,
  seed,
}: {
  totalReturn: number;
  seed: string;
}) {
  // Simple hash from seed string for deterministic noise
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const pseudoRandom = (i: number) => {
    const x = Math.sin((h + i) * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  };

  const steps = 16;
  const data: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const trend = totalReturn * progress;
    const noise = (pseudoRandom(i) - 0.5) * Math.abs(totalReturn) * 0.3;
    data.push(trend + noise);
  }
  // Ensure final point = totalReturn
  data[steps] = totalReturn;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const hh = 20;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${hh - ((v - min) / range) * hh}`,
    )
    .join(" ");

  const strokeColor = totalReturn >= 0 ? "var(--color-up)" : "var(--color-red)";

  return (
    <svg width={w} height={hh} class="opacity-60" aria-hidden="true" role="img">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  );
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
      class={`rounded-lg p-4 bg-[--color-bg-card] card-hover ${lowSampleBest ? "border border-[--color-yellow]/50 hover:border-[--color-yellow]" : variant === "worst" ? "border border-[--color-down]/30 opacity-70" : "border border-[--color-up]/30"}`}
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
            {(() => {
              const desc = getStrategyDescription(entry.strategy, lang);
              return desc ? (
                <p class="text-[--color-text-muted] text-[10px] mt-0.5 truncate opacity-70">
                  {desc}
                </p>
              ) : null;
            })()}
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

      {/* Mini equity sparkline — synthetic curve from total_return */}
      {entry.total_return != null && (
        <div class="mb-2">
          <Sparkline
            totalReturn={entry.total_return}
            seed={entry.strategy + entry.direction + entry.timeframe}
          />
        </div>
      )}

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
      <div class="grid grid-cols-3 gap-2 font-mono text-sm ranking-metric-reveal">
        <div>
          <p
            class="text-[--color-text-muted] text-xs mb-0.5 cursor-help"
            title={
              lang === "ko"
                ? "승률 = 수익 거래 비율. 55%+ 양호."
                : "Win Rate = % of profitable trades. 55%+ is good."
            }
          >
            {lbl.wr} <span class="opacity-50 text-[0.6rem]">?</span>
          </p>
          <p class={`font-bold text-base ${winRateColor(entry.win_rate)}`}>
            {entry.win_rate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p
            class="text-[--color-text-muted] text-xs mb-0.5 cursor-help"
            title={
              lang === "ko"
                ? "수익팩터 = 평균 수익 ÷ 평균 손실. 1.0 = 본전, 1.5+ = 양호, 2.0+ = 강함. 샘플 부족 시 99.99로 제한."
                : "Profit Factor = avg win ÷ avg loss. 1.0 = breakeven, 1.5+ = good, 2.0+ = strong. Capped at 99.99 for low-sample results."
            }
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
