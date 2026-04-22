// Backtest vs Live OKX trust panel.
//
// Phase 2.7 (2026-04-21): the "gap" column now renders a real backtest
// over the same period as live, computed client-side. Before this it
// showed live only. The gap (|backtest − live|) is the core trust
// signal — a tight gap proves the backtest is honest.
//
// Flow on mount:
//   1. Fetch /data/performance.json → live summary + period
//   2. POST /simulate with strategy_id + same date range
//   3. When both resolve, show 3-column grid: Backtest / Live / Gap
//   4. If backtest fails or exceeds 8s timeout → render live-only fallback
//      (degrades gracefully rather than blocking the page)

import { useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../../../config/api";
import { useTranslations, type Lang } from "../../../i18n/index";

interface Props {
  lang: Lang;
}

interface DailyPoint {
  date: string;
  pnl: number;
  trades: number;
  cum_pnl: number;
}

interface LiveSummary {
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
  daily?: DailyPoint[];
  generated: string;
}

interface BacktestResult {
  total_return_pct: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_pct: number;
  total_trades: number;
}

const BACKTEST_TIMEOUT_MS = 8000;

// Map the strategy label from performance.json → backend STRATEGY_REGISTRY id.
// If we ever add more live strategies, extend this map.
function strategyToId(label: string): {
  id: string;
  direction: string;
  sl: number;
  tp: number;
} {
  const lower = label.toLowerCase();
  if (lower.includes("bb squeeze short"))
    return { id: "bb-squeeze-short", direction: "short", sl: 10, tp: 8 };
  if (lower.includes("bb squeeze long"))
    return { id: "bb-squeeze-long", direction: "long", sl: 7, tp: 6 };
  // Unknown live strategy → still run bb-squeeze-short so we at least have
  // a gap number, but real fix is to add the label here.
  return { id: "bb-squeeze-short", direction: "short", sl: 10, tp: 8 };
}

async function fetchBacktest(
  live: LiveSummary,
  signal: AbortSignal,
): Promise<BacktestResult | null> {
  const { id, direction, sl, tp } = strategyToId(live.strategy);
  // 2026-04-22: field name is `strategy` (not `strategy_id`) — matches
  // backend Pydantic model. Previous mismatch caused silent fallback
  // to the default bb-squeeze — gap was technically correct but only by
  // accident.
  const body = {
    strategy: id,
    direction,
    sl_pct: sl,
    tp_pct: tp,
    top_n: 10,
    fee_pct: 0.0005,
    leverage: 5,
    start_date: live.period.from,
    end_date: live.period.to,
  };
  try {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as BacktestResult;
  } catch {
    return null;
  }
}

export default function TrustGapPanel({ lang }: Props) {
  const t = useTranslations(lang);
  const [data, setData] = useState<LiveSummary | null>(null);
  const [error, setError] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [backtestDone, setBacktestDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/performance.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: LiveSummary) => {
        if (cancelled) return;
        setData(json);

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          BACKTEST_TIMEOUT_MS,
        );
        fetchBacktest(json, controller.signal)
          .then((bt) => {
            if (cancelled) return;
            setBacktest(bt);
            setBacktestDone(true);
          })
          .finally(() => clearTimeout(timeout));
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const isKo = lang === "ko";

  if (error || !data) {
    return (
      <section
        class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
        data-testid="sim-v1-trust-gap"
      >
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {t("simV2.trust.gap_heading")}
        </h3>
        <p class="text-xs text-zinc-400">
          {error
            ? isKo
              ? "실 성과 데이터 일시적으로 불가"
              : "Live performance unavailable — retry soon"
            : isKo
              ? "로딩 중…"
              : "loading…"}
        </p>
      </section>
    );
  }

  const s = data.summary;
  const liveReturnPct = (s.total_pnl / s.starting_balance) * 100;
  const livePositive = liveReturnPct >= 0;
  const liveSigned = `${livePositive ? "+" : ""}${liveReturnPct.toFixed(1)}%`;

  const period = `${data.period.from} → ${data.period.to}`;
  const generated = data.generated.slice(0, 10);

  const hasBacktest = backtest != null;
  const backtestSigned = hasBacktest
    ? `${backtest!.total_return_pct >= 0 ? "+" : ""}${backtest!.total_return_pct.toFixed(1)}%`
    : "—";
  const gapPct = hasBacktest
    ? Math.abs(backtest!.total_return_pct - liveReturnPct)
    : null;
  const gapSigned = gapPct != null ? `${gapPct.toFixed(1)}%` : "—";
  const gapTone: "good" | "bad" | "neutral" =
    gapPct == null
      ? "neutral"
      : gapPct < 5
        ? "good"
        : gapPct < 15
          ? "neutral"
          : "bad";

  return (
    <section
      aria-label={t("simV2.trust.gap_heading")}
      class="rounded-xl border border-[--color-accent]/20 bg-gradient-to-br from-[--color-accent]/5 to-zinc-900/60 p-5"
      data-testid="sim-v1-trust-gap"
    >
      <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-[--color-accent-bright]">
          {t("simV2.trust.gap_heading")}
        </h3>
        <span class="font-mono text-xs text-zinc-400">
          {isKo ? "업데이트" : "updated"} {generated}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <Figure
          label={t("simV2.trust.gap_backtest")}
          value={backtestSigned}
          tone={
            !backtestDone
              ? "neutral"
              : hasBacktest && backtest!.total_return_pct >= 0
                ? "good"
                : "bad"
          }
          loading={!backtestDone}
          testId="sim-v1-gap-backtest"
        />
        <Figure
          label={t("simV2.trust.gap_live")}
          value={liveSigned}
          tone={livePositive ? "good" : "bad"}
          testId="sim-v1-live-return"
        />
        <Figure
          label={t("simV2.trust.gap_delta")}
          value={gapSigned}
          tone={gapTone}
          highlight
          loading={!backtestDone}
          testId="sim-v1-gap-delta"
        />
      </div>

      {/* 2026-04-22: equity sparkline — renders cumulative PnL from the
          live daily series. Makes the gap visceral: users see not just a
          59.6% number but the SHAPE of the divergence. */}
      {data.daily && data.daily.length > 1 && (
        <div class="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {isKo ? "실거래 자본 곡선" : "Live equity curve"}
            </span>
            <span class="font-mono text-[10px] text-zinc-500">
              {data.daily.length} {isKo ? "일" : "days"}
            </span>
          </div>
          <EquitySparkline
            daily={data.daily}
            startingBalance={s.starting_balance}
          />
        </div>
      )}

      <div class="mt-4 grid grid-cols-1 gap-1 border-t border-[--color-accent]/10 pt-3 font-mono text-xs text-zinc-400 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <span>
          {isKo ? "전략" : "Strategy"}: {data.strategy}
        </span>
        <span>
          {isKo ? "기간" : "Period"}: {period}
        </span>
        <span>
          {isKo ? "승률" : "Win rate"}: {s.win_rate.toFixed(1)}% · PF{" "}
          {s.profit_factor.toFixed(2)} · MDD {s.max_drawdown_pct.toFixed(1)}%
        </span>
      </div>

      <p class="mt-3 text-xs leading-relaxed text-zinc-400">
        {t("simV2.trust.gap_note")}
      </p>
    </section>
  );
}

// Pure-SVG equity sparkline. ~15 lines of rendering, zero deps. Draws
// cumulative PnL trajectory with a zero-line reference so drawdowns are
// immediately visible.
function EquitySparkline({
  daily,
  startingBalance,
}: {
  daily: DailyPoint[];
  startingBalance: number;
}) {
  const W = 320;
  const H = 70;
  const PAD_Y = 6;
  // Build equity series from cum_pnl (falling back to accumulator if missing)
  const equities: number[] = [];
  let acc = 0;
  for (const d of daily) {
    const cum = typeof d.cum_pnl === "number" ? d.cum_pnl : (acc += d.pnl ?? 0);
    equities.push(cum);
  }
  const minE = Math.min(0, ...equities);
  const maxE = Math.max(0, ...equities);
  const range = maxE - minE || 1;
  const xStep = W / Math.max(1, equities.length - 1);
  const toY = (e: number) => H - PAD_Y - ((e - minE) / range) * (H - 2 * PAD_Y);
  const zeroY = toY(0);
  const finalE = equities[equities.length - 1] ?? 0;
  const finalPositive = finalE >= 0;
  const strokeColor = finalPositive ? "#10b981" : "#f43f5e";
  const fillColor = finalPositive ? "#10b98122" : "#f4365622";

  const path = equities
    .map(
      (e, i) =>
        `${i === 0 ? "M" : "L"}${(i * xStep).toFixed(1)},${toY(e).toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${path} L${((equities.length - 1) * xStep).toFixed(1)},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;
  const finalPct = startingBalance > 0 ? (finalE / startingBalance) * 100 : 0;

  return (
    <figure
      class="relative"
      aria-label="Live cumulative P&L"
      data-testid="sim-v1-equity-sparkline"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-hidden="true"
      >
        {/* zero line */}
        <line
          x1={0}
          y1={zeroY}
          x2={W}
          y2={zeroY}
          stroke="#52525b"
          stroke-width="0.5"
          stroke-dasharray="2 3"
        />
        <path d={areaPath} fill={fillColor} />
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        {/* final dot */}
        <circle
          cx={(equities.length - 1) * xStep}
          cy={toY(finalE)}
          r={2.5}
          fill={strokeColor}
          stroke="#09090b"
          stroke-width="1"
        />
      </svg>
      <figcaption class="mt-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
        <span>
          {daily[0]?.date?.slice(5)} → {daily[daily.length - 1]?.date?.slice(5)}
        </span>
        <span class={finalPositive ? "text-emerald-400" : "text-rose-400"}>
          {finalPositive ? "+" : ""}
          {finalPct.toFixed(1)}%
        </span>
      </figcaption>
    </figure>
  );
}

function Figure({
  label,
  value,
  tone,
  highlight,
  loading,
  testId,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  highlight?: boolean;
  loading?: boolean;
  testId?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div
      data-testid={testId}
      class={`rounded-lg p-3 ${highlight ? "bg-[--color-accent]/10 ring-1 ring-[--color-accent]/30" : ""}`}
    >
      <div class="mb-1 text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div
        class={`font-mono text-xl font-semibold tabular-nums ${loading ? "animate-pulse text-zinc-600" : toneClass}`}
      >
        {loading ? "—" : value}
      </div>
    </div>
  );
}
