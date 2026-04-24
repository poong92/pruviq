// Backtest vs Live OKX trust panel.
//
// Phase 2.7 (2026-04-21): the "gap" column now renders a real backtest
// over the same period as live, computed client-side. Before this it
// showed live only. The gap (|backtest − live|) is the core trust
// signal — a tight gap proves the backtest is honest.
//
// Flow on mount:
//   1. Fetch /data/performance.json → live summary + period
//   2. POST /simulate with `strategy` + same date range
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

// 2026-04-24: Live tracking paused while auto-trading OKX integration
// is being re-hardened. Without active live trades, the previous 3-column
// backtest-vs-live grid was showing a 59.6% gap from the last run
// (BB Squeeze SHORT, 2026-01 to 03) as if it were current — misleading
// new visitors. Flip this back to `false` once auto-trading resumes and
// ≥30 days of fresh live data accumulate. The previous in-depth gap
// analysis is preserved at /blog/bb-squeeze-2026q1-postmortem.
const LIVE_TRACKING_PAUSED = true;

export default function TrustGapPanel({ lang }: Props) {
  const t = useTranslations(lang);
  const [data, setData] = useState<LiveSummary | null>(null);
  const [error, setError] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [backtestDone, setBacktestDone] = useState(false);

  useEffect(() => {
    if (LIVE_TRACKING_PAUSED) return; // skip fetch while paused
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

  // 2026-04-24: paused panel — replaces the 3-column gap grid entirely.
  // Gives context + links to the postmortem + points users to verified
  // Quick-Start presets. Avoids stale negative live data staring at
  // every new visitor.
  if (LIVE_TRACKING_PAUSED) {
    const postmortemHref = isKo
      ? "/ko/blog/bb-squeeze-2026q1-postmortem"
      : "/blog/bb-squeeze-2026q1-postmortem";
    return (
      <section
        aria-label={t("simV2.trust.gap_heading")}
        class="rounded-xl border border-[--color-accent]/20 bg-gradient-to-br from-[--color-accent]/5 to-zinc-900/60 p-5"
        data-testid="sim-v1-trust-gap"
      >
        <div class="mb-3 flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-amber-500/10 border border-amber-500/30"
            aria-label="Coming Soon"
          >
            ⏸ {isKo ? "라이브 검증 중단" : "Live tracking paused"}
          </span>
        </div>
        <h3 class="mb-1.5 text-sm font-semibold uppercase tracking-wide text-[--color-accent-bright]">
          {t("simV2.trust.gap_heading")}
        </h3>
        <p class="text-xs text-zinc-300 leading-relaxed mb-3">
          {isKo
            ? "오토트레이딩 재안정화 중 — 단일 전략 실거래 추적을 일시 중단했습니다. 재개 + 30일 데이터 누적 시 백테스트 vs 실거래 갭이 여기 다시 표시됩니다. 그 동안은 백테스트 검증만 안내합니다."
            : "Live tracking is paused while auto-trading is re-hardened. Backtest-vs-live gap will return here once ≥30 days of fresh live data accumulate. Until then we guide you with backtest-verified presets only."}
        </p>
        <div class="flex flex-wrap gap-2">
          <a
            href={postmortemHref}
            class="inline-flex items-center rounded border border-[--color-border] bg-[--color-bg-card] px-3 py-1.5 text-xs text-zinc-200 hover:border-[--color-accent] hover:text-[--color-accent-bright] min-h-[32px]"
          >
            {isKo
              ? "이전 실거래 결과 — BB Squeeze 59.6% 갭 포스트모템 →"
              : "Previous live run — BB Squeeze 59.6% gap postmortem →"}
          </a>
        </div>
      </section>
    );
  }

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

      {/* 2026-04-24: "Gap 59% — so what?" closure. Previous panel showed
          the number + brand-promise copy but didn't tell users what to do
          with it. Large gap with losing live PF is actionable information:
          surface the diagnosis + recommended alternative instead of
          leaving users in a dead-end "we're honest" loop. */}
      {gapPct != null && gapPct >= 15 && (
        <div
          class="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
          data-testid="sim-v1-gap-action"
        >
          <p class="text-xs font-semibold text-amber-200 mb-1.5">
            {isKo
              ? `⚠ 이 전략은 현재 추천 불가`
              : "⚠ This strategy is currently off the recommended list"}
          </p>
          <p class="text-xs leading-relaxed text-zinc-300 mb-2">
            {isKo
              ? `${data.strategy} 는 ${period} 실거래에서 PF ${s.profit_factor.toFixed(2)} (손실 구간). 2년 백테스트가 이 기간의 변동성 레짐을 과소평가했습니다. 라이브 재개는 30일 이상 PF ≥ 1.0 회복 후 재검토.`
              : `${data.strategy} ran at PF ${s.profit_factor.toFixed(2)} (losing) in ${period}. The 2yr backtest underweighted this volatility regime. We'll reconsider live deployment only after ≥30 days at PF ≥ 1.0.`}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <a
              href="/simulate/?preset=atr-breakout"
              class="inline-flex items-center gap-1 rounded bg-[--color-accent] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[--color-accent-bright] min-h-[32px]"
            >
              {isKo
                ? "대신 ATR Breakout (PF 1.31) 시도"
                : "Try ATR Breakout (PF 1.31) instead"}{" "}
              →
            </a>
            <a
              href="/methodology"
              class="inline-flex items-center gap-1 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 min-h-[32px]"
            >
              {isKo ? "갭 측정 방식" : "How we measure gap"} →
            </a>
          </div>
        </div>
      )}
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
  // 2026-04-22 fix: fillColor hex previously had a typo (#f4365622) that
  // didn't match the stroke hue. Same base hue + 22 alpha for the fill.
  const fillColor = finalPositive ? "#10b98122" : "#f43f5e22";

  const path = equities
    .map(
      (e, i) =>
        `${i === 0 ? "M" : "L"}${(i * xStep).toFixed(1)},${toY(e).toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${path} L${((equities.length - 1) * xStep).toFixed(1)},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;
  const finalPct = startingBalance > 0 ? (finalE / startingBalance) * 100 : 0;

  // 2026-04-22 a11y fix: aria-label now includes the actual final % + day
  // count so screen-reader users get the meaningful data, not just a label.
  // Previously role="img" + aria-hidden="true" on <svg> were contradictory;
  // dropping aria-hidden so <title>/<desc> inside can announce, and
  // letting the figure's aria-label remain as the primary name.
  const srLabel = `Live cumulative P&L: ${
    finalPositive ? "+" : ""
  }${finalPct.toFixed(1)}% over ${daily.length} days`;
  return (
    <figure
      class="relative"
      aria-label={srLabel}
      data-testid="sim-v1-equity-sparkline"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={srLabel}
      >
        <title>{srLabel}</title>
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
