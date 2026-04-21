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
          ? `표본 부족 (${d.total_trades}건). 통계적 신뢰 제한적.`
          : `Low sample (${d.total_trades} trades). Limited confidence.`,
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
          ? `견고한 수익 곡선 — PF ${d.profit_factor.toFixed(2)}, ${d.total_trades.toLocaleString()}건 표본.`
          : `Solid profit curve — PF ${d.profit_factor.toFixed(2)} across ${d.total_trades.toLocaleString()} trades.`,
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
    const strategy_id = config.presetId
      .replace(/-(long|short)$/, "")
      .replace(/^both-/, "");
    const body: Record<string, unknown> = {
      strategy_id,
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
        <div class="mt-4 border-t border-zinc-800 pt-3 text-center text-xs text-zinc-400">
          {t("simV2.empty.pick_first")}
        </div>
      </SkeletonFrame>
    );
  }

  if (state.kind === "loading") {
    return (
      <SkeletonFrame testId="sim-v1-results-loading" aria-busy="true">
        <MetricGridSkeleton shimmer />
        <div class="mt-4 flex items-center justify-center gap-2 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
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
        class="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-rose-200">
              {t("simV2.empty.error")}
            </p>
            <details class="mt-1 text-xs text-rose-300">
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
            class="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
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
      class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm"
    >
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label={lang === "ko" ? "총 수익률" : "Total return"}
          value={signed(d.total_return_pct)}
          tone={returnPositive ? "good" : "bad"}
          testId="sim-v1-metric-return"
        />
        <Metric
          label={lang === "ko" ? "승률" : "Win rate"}
          value={`${abbrev(d.win_rate, 1)}%`}
          tone="neutral"
          testId="sim-v1-metric-winrate"
        />
        <Metric
          label={lang === "ko" ? "수익 팩터" : "Profit factor"}
          value={abbrev(d.profit_factor, 2)}
          tone={d.profit_factor >= 1 ? "good" : "bad"}
          testId="sim-v1-metric-pf"
        />
        <Metric
          label={lang === "ko" ? "최대 낙폭" : "Max drawdown"}
          value={`${abbrev(d.max_drawdown_pct, 1)}%`}
          tone="bad"
          testId="sim-v1-metric-mdd"
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

      <div class="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-3 font-mono text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap sm:gap-4">
          <span>
            {lang === "ko" ? "거래" : "Trades"}:{" "}
            <span class="text-zinc-200 tabular-nums">
              {d.total_trades.toLocaleString()}
            </span>
          </span>
          <span>
            {lang === "ko" ? "코인" : "Coins"}:{" "}
            <span class="text-zinc-200 tabular-nums">{d.coins_used}</span>
          </span>
          <span class="col-span-2 sm:col-auto">
            {lang === "ko" ? "기간" : "Range"}:{" "}
            <span class="text-zinc-200">{d.data_range}</span>
          </span>
          <span>
            Sharpe:{" "}
            <span class="text-zinc-200 tabular-nums">
              {abbrev(d.sharpe_ratio, 2)}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            emit("sim.csv_download", { preset: config.presetId });
            downloadCSV(d, config.presetId ?? "preset");
          }}
          data-testid="sim-v1-csv-download"
          class="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-[--color-accent] hover:text-[--color-accent-bright]"
        >
          {lang === "ko" ? "CSV 다운로드" : "Download CSV"} ↓
        </button>
      </div>
    </div>
  );
}

function verdictTone(tone: "good" | "bad" | "neutral"): string {
  if (tone === "good")
    return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
  if (tone === "bad") return "border-rose-500/30 bg-rose-500/5 text-rose-200";
  return "border-amber-500/20 bg-amber-500/5 text-amber-100";
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
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  testId: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div data-testid={testId}>
      <div class="mb-1 text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div class={`font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
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
      class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
    >
      {children}
    </div>
  );
}

function MetricGridSkeleton({ shimmer }: { shimmer?: boolean }) {
  const base =
    "h-10 rounded " +
    (shimmer ? "animate-pulse bg-zinc-800" : "bg-zinc-800/60");
  return (
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div
            class={`mb-2 h-3 w-16 rounded ${
              shimmer ? "animate-pulse bg-zinc-800" : "bg-zinc-800/60"
            }`}
          />
          <div class={base} />
        </div>
      ))}
    </div>
  );
}
