// Fetches /simulate with current config and renders a metrics summary.
//
// Design polish 2.5:
// - Empty / loading / error / ok all share the same 4-metric grid shape
//   so the layout never jumps (CLS = 0 between states)
// - Loading = shimmer skeleton, not a single pulsing dot
// - Error = user-friendly Korean/English message; raw HTTP hidden in
//   <details>; retry button attached
// - Ok = adds a plain-language verdict derived from PF/return/MDD/trades
//   so retail users know if the numbers are actually good.
//
// No equity-curve chart (owner decision §19 item 1).

import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../../../config/api";
import type { SimConfig } from "../../../hooks/useSimConfig";
import { useTranslations, type Lang } from "../../../i18n/index";
import { emit } from "../../../lib/events";
import { findPreset } from "../../../config/simulator-presets";
import ShareResultButton from "../../ui/ShareResultButton";
import { formatLocalizedCount } from "../../../utils/format";

interface Props {
  config: SimConfig;
  lang: Lang;
}

interface SimResult {
  win_rate: number;
  total_return_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  total_trades: number;
  sharpe_ratio: number;
  coins_used: number;
  data_range: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: SimResult }
  | { kind: "error"; message: string };

function abbrev(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function signed(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

// Plain-language verdict from a SimResult. Gives a retail user a quick
// read on whether the numbers are good — they don't have to know that
// "PF 1.03" is marginal. Not a recommendation to trade; purely an
// interpretation of the backtest.
function buildVerdict(
  d: SimResult,
  lang: Lang,
): { text: string; tone: "good" | "bad" | "neutral" } {
  const profitable = d.total_return_pct > 0;
  const pfStrong = d.profit_factor >= 1.3;
  const pfMarginal = d.profit_factor >= 1 && d.profit_factor < 1.3;
  const mddSevere = d.max_drawdown_pct >= 30;
  const tradesLow = d.total_trades < 50;
  // 2026-04-22 QA P2: thresholds tightened.
  // - N<500 = statistically under-powered for crypto 4h backtests
  // - Sharpe < 0.5 with profitable = marginal noise, not a real edge
  const tradesUnderpowered = d.total_trades >= 50 && d.total_trades < 500;
  const sharpeNoisy = d.sharpe_ratio < 0.5;

  if (!profitable || d.profit_factor < 1) {
    return {
      tone: "bad",
      text:
        lang === "ko"
          ? "손실 전략 — PF 1 미만. 파라미터 조정 필요."
          : "Unprofitable backtest — PF below 1. Tune parameters.",
    };
  }
  if (tradesLow) {
    return {
      tone: "neutral",
      text:
        lang === "ko"
          ? `표본 극소 (${d.total_trades}건). 통계적 신뢰 거의 없음.`
          : `Very low sample (${d.total_trades} trades). Almost no confidence.`,
    };
  }
  if (tradesUnderpowered) {
    return {
      tone: "neutral",
      text:
        lang === "ko"
          ? `표본 부족 (${d.total_trades}건, 500 미만). 워크포워드 검증 필요.`
          : `Underpowered sample (${d.total_trades} trades, <500). Needs walk-forward validation.`,
    };
  }
  if (sharpeNoisy) {
    return {
      tone: "neutral",
      text:
        lang === "ko"
          ? `Sharpe ${d.sharpe_ratio.toFixed(2)} — 수익은 있지만 노이즈 수준. 실거래 권장 불가.`
          : `Sharpe ${d.sharpe_ratio.toFixed(2)} — profitable but within noise. Not yet live-grade.`,
    };
  }
  if (pfMarginal) {
    return {
      tone: "neutral",
      text:
        lang === "ko"
          ? `수익 있음 — PF ${d.profit_factor.toFixed(2)}는 마진이 얇음.`
          : `Profitable but marginal — PF ${d.profit_factor.toFixed(2)} has thin edge.`,
    };
  }
  if (mddSevere) {
    return {
      tone: "neutral",
      text:
        lang === "ko"
          ? `고수익·고낙폭 (${d.max_drawdown_pct.toFixed(0)}% MDD). 리스크 관리 주의.`
          : `High return with ${d.max_drawdown_pct.toFixed(0)}% MDD — heavy drawdown risk.`,
    };
  }
  if (pfStrong) {
    return {
      tone: "good",
      text:
        lang === "ko"
          ? `견고한 수익 곡선 — PF ${d.profit_factor.toFixed(2)}, ${formatLocalizedCount(d.total_trades, "ko")}건 표본.`
          : `Solid profit curve — PF ${d.profit_factor.toFixed(2)} across ${formatLocalizedCount(d.total_trades, "en")} trades.`,
    };
  }
  return {
    tone: "neutral",
    text:
      lang === "ko"
        ? "수익 구간에 위치. 추가 검증 권장."
        : "In profit territory. Recommend additional validation.",
  };
}

export default function ResultsPanel({ config, lang }: Props) {
  const t = useTranslations(lang);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!config.presetId) return;
    // 2026-04-22: backend Pydantic field is `strategy` (not `strategy_id`).
    // Previously the mismatch caused every request to silently fall back to
    // the default ("bb-squeeze") — 7 presets returned only 2 results.
    // Also, SIMULATOR_PRESETS now use backend registry IDs directly
    // (e.g. "ichimoku", "atr-breakout"), so no suffix stripping needed.
    const body: Record<string, unknown> = {
      strategy: config.presetId,
      direction: config.direction,
      sl_pct: config.sl,
      tp_pct: config.tp,
      top_n: config.topN,
      fee_pct: config.feePct / 100,
      leverage: config.leverage,
    };
    if (config.startDate) body.start_date = config.startDate;
    if (config.endDate) body.end_date = config.endDate;

    setState({ kind: "loading" });
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SimResult) => {
        setState({ kind: "ok", data });
        emit("sim.run_succeeded", {
          preset: config.presetId,
          pf: data.profit_factor,
          ret: data.total_return_pct,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = String(err.message || err);
        setState({ kind: "error", message });
        emit("sim.run_failed", { preset: config.presetId, error: message });
      });
    return () => controller.abort();
  }, [
    config.presetId,
    config.direction,
    config.sl,
    config.tp,
    config.topN,
    config.leverage,
    config.feePct,
    config.startDate,
    config.endDate,
    retryKey,
  ]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  if (!config.presetId || state.kind === "idle") {
    return (
      <SkeletonFrame testId="sim-v1-results-empty">
        <MetricGridSkeleton />
        <div class="mt-4 border-t border-(--color-border) pt-3 text-center text-xs text-(--color-text-muted)">
          {t("simV2.empty.pick_first")}
        </div>
      </SkeletonFrame>
    );
  }

  if (state.kind === "loading") {
    return (
      <SkeletonFrame testId="sim-v1-results-loading" aria-busy="true">
        <MetricGridSkeleton shimmer />
        <div class="mt-4 flex items-center justify-center gap-2 border-t border-(--color-border) pt-3 text-xs text-(--color-text-muted)">
          <span class="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-[--color-accent]" />
          {t("simV2.empty.loading")}
        </div>
      </SkeletonFrame>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="sim-v1-results-error"
        class="rounded-xl border border-(--color-down)/30 bg-(--color-down)/10 p-5"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-(--color-down)">
              {t("simV2.empty.error")}
            </p>
            <details class="mt-1 text-xs text-(--color-down)">
              <summary class="cursor-pointer font-mono text-xs">
                {lang === "ko" ? "기술 상세" : "technical details"}
              </summary>
              <code class="mt-1 block whitespace-pre-wrap font-mono">
                {state.message}
              </code>
            </details>
          </div>
          <button
            type="button"
            onClick={retry}
            data-testid="sim-v1-results-retry"
            class="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-(--color-down)/40 bg-(--color-down)/15 px-4 py-2 text-sm font-medium text-(--color-down) hover:bg-(--color-down)/20"
          >
            {lang === "ko" ? "다시 시도" : "Retry"} ↻
          </button>
        </div>
      </div>
    );
  }

  const d = state.data;
  const returnPositive = d.total_return_pct >= 0;
  const verdict = buildVerdict(d, lang);
  return (
    <div
      data-testid="sim-v1-results-ok"
      class="rounded-xl border border-(--color-border) bg-(--color-bg-card)/60 p-5 shadow-sm"
    >
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label={lang === "ko" ? "총 수익률" : "Total return"}
          value={signed(d.total_return_pct)}
          tone={returnPositive ? "good" : "bad"}
          testId="sim-v1-metric-return"
          tooltip={
            lang === "ko"
              ? "전략 기간 전체의 순 수익률 (수수료·슬리피지 포함)"
              : "Cumulative net return over the full backtest period (after fees & slippage)"
          }
        />
        <Metric
          label={lang === "ko" ? "승률" : "Win rate"}
          value={`${abbrev(d.win_rate, 1)}%`}
          tone="neutral"
          testId="sim-v1-metric-winrate"
          tooltip={
            lang === "ko"
              ? "승률 자체는 좋은 지표가 아닙니다. 40% 승률이라도 PF > 1이면 수익성 있음"
              : "Win rate alone is misleading — 40% WR with PF > 1 is still profitable"
          }
        />
        <Metric
          label={lang === "ko" ? "수익 팩터" : "Profit factor"}
          value={abbrev(d.profit_factor, 2)}
          tone={d.profit_factor >= 1 ? "good" : "bad"}
          testId="sim-v1-metric-pf"
          tooltip={
            lang === "ko"
              ? "총 수익 ÷ 총 손실. 1.0 = 본전, 1.3+ = 견고, 2.0+ = 예외적"
              : "Gross profit ÷ gross loss. 1.0 = break-even, 1.3+ = solid, 2.0+ = exceptional"
          }
        />
        <Metric
          label={lang === "ko" ? "최대 낙폭" : "Max drawdown"}
          value={`${abbrev(d.max_drawdown_pct, 1)}%`}
          tone="bad"
          testId="sim-v1-metric-mdd"
          tooltip={
            lang === "ko"
              ? "기간 중 자본 고점 대비 최대 손실 비율. 낮을수록 좋음"
              : "Largest peak-to-trough equity loss during the period. Lower = better"
          }
        />
      </div>

      <div
        data-testid="sim-v1-verdict"
        class={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${verdictTone(verdict.tone)}`}
      >
        <span aria-hidden="true" class="mt-0.5 text-base leading-none">
          {verdict.tone === "good" ? "✓" : verdict.tone === "bad" ? "✕" : "!"}
        </span>
        <span class="leading-snug">{verdict.text}</span>
      </div>

      <div class="mt-4 flex flex-col gap-3 border-t border-(--color-border) pt-3 font-mono text-xs text-(--color-text-muted) sm:flex-row sm:items-center sm:justify-between">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap sm:gap-4">
          <span>
            {lang === "ko" ? "거래" : "Trades"}:{" "}
            <span class="text-(--color-text) tabular-nums">
              {formatLocalizedCount(d.total_trades, lang)}
            </span>
          </span>
          <span>
            {lang === "ko" ? "코인" : "Coins"}:{" "}
            <span class="text-(--color-text) tabular-nums">{d.coins_used}</span>
          </span>
          <span class="col-span-2 sm:col-auto">
            {lang === "ko" ? "기간" : "Range"}:{" "}
            <span class="text-(--color-text)">{d.data_range}</span>
          </span>
          <span>
            Sharpe:{" "}
            <span class="text-(--color-text) tabular-nums">
              {abbrev(d.sharpe_ratio, 2)}
            </span>
          </span>
        </div>
        <div class="flex items-center gap-2">
          <ShareResultButton
            presetId={config.presetId}
            strategyName={
              (config.presetId
                ? findPreset(config.presetId)?.labels[lang]
                : null) ??
              config.presetId ??
              "PRUVIQ"
            }
            profitFactor={d.profit_factor}
            winRate={d.win_rate}
            totalTrades={d.total_trades}
            totalReturnPct={d.total_return_pct}
            lang={lang}
            class="px-3 py-2 text-xs min-h-[40px]"
          />
          <button
            type="button"
            onClick={() => {
              emit("sim.csv_download", { preset: config.presetId });
              downloadCSV(d, config.presetId ?? "preset");
            }}
            data-testid="sim-v1-csv-download"
            class="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-(--color-border-hover) px-3 py-2 text-xs text-(--color-text-secondary) hover:border-[--color-accent] hover:text-[--color-accent-bright]"
          >
            {lang === "ko" ? "CSV 다운로드" : "Download CSV"} ↓
          </button>
        </div>
      </div>
    </div>
  );
}

function verdictTone(tone: "good" | "bad" | "neutral"): string {
  if (tone === "good")
    return "border-(--color-up)/30 bg-(--color-up)/10 text-(--color-up)";
  if (tone === "bad")
    return "border-(--color-down)/30 bg-(--color-down)/10 text-(--color-down)";
  return "border-(--color-verified)/20 bg-(--color-verified-subtle) text-(--color-verified)";
}

// Convert the SimResult to a two-column CSV (metric, value) + download.
function downloadCSV(d: SimResult, presetId: string) {
  const rows: [string, string | number][] = [
    ["preset", presetId],
    ["win_rate_pct", d.win_rate],
    ["total_return_pct", d.total_return_pct],
    ["profit_factor", d.profit_factor],
    ["max_drawdown_pct", d.max_drawdown_pct],
    ["total_trades", d.total_trades],
    ["sharpe_ratio", d.sharpe_ratio],
    ["coins_used", d.coins_used],
    ["data_range", d.data_range],
    ["exported_at", new Date().toISOString()],
  ];
  const csv = rows
    .map(([k, v]) => `${k},${typeof v === "string" ? `"${v}"` : v}`)
    .join("\n");
  const blob = new Blob([`metric,value\n${csv}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pruviq-${presetId}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Metric({
  label,
  value,
  tone,
  testId,
  tooltip,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  testId: string;
  tooltip?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-(--color-up)"
      : tone === "bad"
        ? "text-(--color-down)"
        : "text-(--color-text)";
  // 2026-04-22 (a11y final): abandoned the hidden-until-interacted tooltip
  // pattern entirely. The prior <details>/<summary> disclosure fixed the
  // keyboard/touch reachability issue but introduced popover-dismissal,
  // viewport-overflow, and announcement-duplication problems.
  // The cleanest solution: show the explanation inline, always. Zero
  // interaction required, perfect for AT users + mouse + touch + keyboard,
  // no JS, no viewport math, no state. Costs ~10px vertical per metric;
  // worth it to remove the last a11y gap.
  return (
    <div data-testid={testId}>
      <div class="mb-1 text-xs uppercase tracking-wide text-(--color-text-muted)">
        {label}
      </div>
      <div class={`font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {tooltip && (
        <p class="mt-1 text-[11px] normal-case leading-snug text-(--color-text-tertiary)">
          {tooltip}
        </p>
      )}
    </div>
  );
}

function SkeletonFrame({
  children,
  testId,
  "aria-busy": busy,
}: {
  children: preact.ComponentChildren;
  testId: string;
  "aria-busy"?: "true";
}) {
  return (
    <div
      data-testid={testId}
      aria-busy={busy}
      class="rounded-xl border border-(--color-border) bg-(--color-bg-card)/40 p-5"
    >
      {children}
    </div>
  );
}

function MetricGridSkeleton({ shimmer }: { shimmer?: boolean }) {
  const base =
    "h-10 rounded " +
    (shimmer
      ? "animate-pulse bg-(--color-bg-elevated)"
      : "bg-(--color-bg-elevated)/60");
  return (
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div
            class={`mb-2 h-3 w-16 rounded ${
              shimmer
                ? "animate-pulse bg-(--color-bg-elevated)"
                : "bg-(--color-bg-elevated)/60"
            }`}
          />
          <div class={base} />
        </div>
      ))}
    </div>
  );
}
