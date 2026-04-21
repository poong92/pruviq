// Fetches /simulate with current config and renders a metrics summary.
// Phase 1: summary only (WR, totalReturn, PF, MDD, totalTrades).
// No equity-curve chart in Phase 1 (owner decision: chart removed).

import { useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../../../config/api";
import type { SimConfig } from "../../../hooks/useSimConfig";
import { useTranslations, type Lang } from "../../../i18n/index";

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

export default function ResultsPanel({ config, lang }: Props) {
  const t = useTranslations(lang);
  const [state, setState] = useState<LoadState>({ kind: "idle" });

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
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: String(err.message || err) });
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
  ]);

  if (!config.presetId || state.kind === "idle") {
    return (
      <div
        data-testid="sim-v1-results-empty"
        class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500"
      >
        {t("simV2.empty.pick_first")}
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div
        data-testid="sim-v1-results-loading"
        class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
      >
        <span class="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
        <span class="ml-3">{t("simV2.empty.loading")}</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="sim-v1-results-error"
        class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-300"
      >
        {t("simV2.empty.error")}
        <span class="ml-2 font-mono text-xs text-rose-400/70">
          ({state.message})
        </span>
      </div>
    );
  }

  const d = state.data;
  const returnPositive = d.total_return_pct >= 0;
  return (
    <div
      data-testid="sim-v1-results-ok"
      class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5"
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
          label={lang === "ko" ? "최대 낙폭 (MDD)" : "Max drawdown"}
          value={`${abbrev(d.max_drawdown_pct, 1)}%`}
          tone="bad"
          testId="sim-v1-metric-mdd"
        />
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-3 font-mono text-[11px] text-zinc-400">
        <div class="flex flex-wrap gap-4">
          <span>
            {lang === "ko" ? "거래" : "Trades"}:{" "}
            <span class="text-zinc-200">{d.total_trades.toLocaleString()}</span>
          </span>
          <span>
            {lang === "ko" ? "코인" : "Coins"}:{" "}
            <span class="text-zinc-200">{d.coins_used}</span>
          </span>
          <span>
            {lang === "ko" ? "기간" : "Range"}:{" "}
            <span class="text-zinc-200">{d.data_range}</span>
          </span>
          <span>
            Sharpe:{" "}
            <span class="text-zinc-200">{abbrev(d.sharpe_ratio, 2)}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => downloadCSV(d, config.presetId ?? "preset")}
          data-testid="sim-v1-csv-download"
          class="inline-flex min-h-[32px] items-center gap-1 rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
        >
          {lang === "ko" ? "CSV 다운로드" : "Download CSV"} ↓
        </button>
      </div>
    </div>
  );
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
      <div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div class={`font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
