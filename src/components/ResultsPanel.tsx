/**
 * ResultsPanel.tsx - Backtest results display (summary, equity, trades)
 */
import { useEffect, useRef, useState } from "preact/hooks";
import ResultsCard from "./ResultsCard";
import OOSValidation from "./OOSValidation";
import ExchangeCTA from "./ExchangeCTA";
import EmailCapture from "./EmailCapture";
import { exchanges } from "../data/exchanges";
import {
  winRateColor,
  profitFactorColor,
  signColor,
  formatPF,
} from "../utils/format";
import type { BacktestResult, CoinResult } from "./simulator-types";
import { getCssVar, COLORS } from "./simulator-types";
import { API_BASE_URL as API_URL } from "../config/api";
import type { IChartApi } from "lightweight-charts";

interface HistoryEntry {
  label: string;
  result: BacktestResult;
}

type ResultTab = "summary" | "equity" | "trades" | "coins" | "validate";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- i18n dict has mixed value types (string, string[], Record<string,string>)
  t: Record<string, any>;
  result: BacktestResult | null;
  error: string | null;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  activePreset: string | null;
  lang: "en" | "ko";
  simMode?: "quick" | "standard" | "expert";
  // New QA props
  onModifyRerun?: () => void;
  onQuickAdjustRerun?: (sl: number, tp: number, coins: number) => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
  slPct?: number;
  tpPct?: number;
  topN?: number;
  isRunning?: boolean;
  history?: HistoryEntry[];
  showHistory?: boolean;
  setShowHistory?: (v: boolean) => void;
  onSelectHistory?: (idx: number) => void;
  onClearHistory?: () => void;
}

const tabActiveStyle = {
  color: COLORS.accent,
  borderColor: COLORS.accent,
  background: COLORS.accentBg,
};

export default function ResultsPanel({
  t,
  result,
  error,
  resultTab,
  setResultTab,
  activePreset,
  lang,
  simMode = "expert",
  onModifyRerun,
  onQuickAdjustRerun,
  onCopyLink,
  linkCopied,
  slPct = 10,
  tpPct = 8,
  topN = 50,
  isRunning = false,
  history = [],
  showHistory = false,
  setShowHistory,
  onSelectHistory,
  onClearHistory,
}: Props) {
  // Mode-dependent visible tabs
  const visibleTabs: ResultTab[] =
    simMode === "quick"
      ? ["summary"]
      : simMode === "standard"
        ? ["summary", "equity", "trades", "coins"]
        : ["summary", "equity", "trades", "coins", "validate"];
  const [coinSort, setCoinSort] = useState<{ key: string; asc: boolean }>({
    key: "total_return_pct",
    asc: false,
  });
  const equityChartRef = useRef<HTMLDivElement>(null);
  const equityInstanceRef = useRef<IChartApi | null>(null);
  const ddChartRef = useRef<HTMLDivElement>(null);
  const ddInstanceRef = useRef<IChartApi | null>(null);

  // Results guide banner
  const [showResultsGuide, setShowResultsGuide] = useState(true);

  // Quick Adjust local state
  const [qaSl, setQaSl] = useState(slPct);
  const [qaTp, setQaTp] = useState(tpPct);
  const [qaCoins, setQaCoins] = useState(topN);
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);

  // Copy Strategy Settings state
  const [settingsCopied, setSettingsCopied] = useState(false);

  const copyStrategySettings = () => {
    if (!result) return;
    const dir = result.direction?.toUpperCase() ?? "SHORT";
    const presetName = activePreset
      ? activePreset.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : `Custom ${dir}`;
    const tf = result.timeframe ?? "1H";
    const lines = [
      `Strategy: ${presetName}`,
      `Direction: ${dir} | SL: ${result.sl_pct ?? slPct}% | TP: ${result.tp_pct ?? tpPct}%`,
      `Coins: Top ${result.coins_used ?? topN} | Timeframe: ${tf}`,
      `Backtest via pruviq.com/simulate`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setSettingsCopied(true);
      setTimeout(() => setSettingsCopied(false), 2000);
    });
  };

  // Sync with parent state changes
  useEffect(() => {
    setQaSl(slPct);
  }, [slPct]);
  useEffect(() => {
    setQaTp(tpPct);
  }, [tpPct]);
  useEffect(() => {
    setQaCoins(topN);
  }, [topN]);

  // ─── Equity curve chart ───
  useEffect(() => {
    if (
      resultTab !== "equity" ||
      !result?.equity_curve?.length ||
      !equityChartRef.current
    )
      return;
    let disposed = false;
    let roRef: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (disposed || !equityChartRef.current) return;
      if (equityInstanceRef.current) {
        equityInstanceRef.current.remove();
        equityInstanceRef.current = null;
      }

      const chart = createChart(equityChartRef.current, {
        width: equityChartRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: getCssVar("--color-bg-card") },
          textColor: getCssVar("--color-text-muted"),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: getCssVar("--color-bg-hover") },
          horzLines: { color: getCssVar("--color-bg-hover") },
        },
      });

      const isPos =
        result.equity_curve[result.equity_curve.length - 1]?.value >= 0;
      const color = isPos ? COLORS.green : COLORS.red;

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: isPos ? COLORS.greenBg : COLORS.redBg,
        bottomColor: "transparent",
        lineWidth: 2,
        priceFormat: {
          type: "custom",
          formatter: (p: number) => `${p > 0 ? "+" : ""}${p.toFixed(1)}%`,
        },
      });
      series.setData(result.equity_curve);
      chart.timeScale().fitContent();
      equityInstanceRef.current = chart;

      const ro = new ResizeObserver((entries) => {
        for (const e of entries)
          chart.applyOptions({ width: e.contentRect.width });
      });
      ro.observe(equityChartRef.current);
      roRef = ro;
    });

    return () => {
      disposed = true;
      roRef?.disconnect();
      if (equityInstanceRef.current) {
        equityInstanceRef.current.remove();
        equityInstanceRef.current = null;
      }
    };
  }, [resultTab, result]);

  // ─── Drawdown chart ───
  useEffect(() => {
    if (
      resultTab !== "equity" ||
      !result?.equity_curve?.length ||
      !ddChartRef.current
    )
      return;
    let disposed = false;
    let roRef: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (disposed || !ddChartRef.current) return;
      if (ddInstanceRef.current) {
        ddInstanceRef.current.remove();
        ddInstanceRef.current = null;
      }

      // Calculate drawdown from equity curve
      let peak = -Infinity;
      const ddData = result.equity_curve.map((p) => {
        if (p.value > peak) peak = p.value;
        const dd = peak > 0 ? ((p.value - peak) / peak) * 100 : p.value - peak;
        return { time: p.time, value: Math.min(0, dd) };
      });

      const chart = createChart(ddChartRef.current, {
        width: ddChartRef.current.clientWidth,
        height: 120,
        layout: {
          background: { color: getCssVar("--color-bg-card") },
          textColor: getCssVar("--color-text-muted"),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: getCssVar("--color-bg-hover") },
          horzLines: { color: getCssVar("--color-bg-hover") },
        },
        rightPriceScale: { borderColor: getCssVar("--color-border") },
        timeScale: { visible: false },
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: COLORS.red,
        topColor: "transparent",
        bottomColor: COLORS.redBg,
        lineWidth: 1,
        priceFormat: {
          type: "custom",
          formatter: (p: number) => `${p.toFixed(1)}%`,
        },
      });
      series.setData(ddData);
      chart.timeScale().fitContent();
      ddInstanceRef.current = chart;

      const ro = new ResizeObserver((entries) => {
        for (const e of entries)
          chart.applyOptions({ width: e.contentRect.width });
      });
      ro.observe(ddChartRef.current);
      roRef = ro;
    });

    return () => {
      disposed = true;
      roRef?.disconnect();
      if (ddInstanceRef.current) {
        ddInstanceRef.current.remove();
        ddInstanceRef.current = null;
      }
    };
  }, [resultTab, result]);

  // ─── CSV download ───
  const downloadCsv = () => {
    if (!result) return;
    if (result.export_hash) {
      window.open(`${API_URL}/export/csv?hash=${result.export_hash}`, "_blank");
      return;
    }
    const rows = ["time,value"];
    (result.equity_curve || []).forEach((p) =>
      rows.push(`${p.time},${p.value}`),
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pruviq_backtest_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {error && (
        <div
          class="border border-[--color-red]/30 rounded-lg p-4 bg-[--color-red]/5 mb-3"
          role="alert"
          aria-live="assertive"
        >
          <span class="font-mono text-sm text-[--color-red]">
            {t.error}: {error}
          </span>
        </div>
      )}

      {result ? (
        <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
          {/* ── Results Action Bar — shown immediately when results load ── */}
          {(() => {
            const isProfitable = result.total_return_pct > 0;
            const availableExchanges = exchanges.filter(
              (e) => e.available && e.referralUrl !== "#",
            );
            const topExchange = availableExchanges.sort(
              (a, b) => b.discount - a.discount,
            )[0];
            const returnLabel = isProfitable
              ? `+${result.total_return_pct.toFixed(1)}%`
              : `${result.total_return_pct.toFixed(1)}%`;
            const bgColor = isProfitable
              ? "rgba(34,171,148,0.05)"
              : "rgba(255,255,255,0.02)";
            const borderColor = isProfitable
              ? "rgba(34,171,148,0.2)"
              : "var(--color-border)";

            return (
              <div
                class="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b text-xs"
                style={{ background: bgColor, borderColor }}
              >
                {/* Return badge */}
                <span
                  class="font-mono font-bold px-2 py-0.5 rounded text-xs"
                  style={{
                    color: isProfitable ? COLORS.green : COLORS.red,
                    background: isProfitable
                      ? `${COLORS.green}15`
                      : `${COLORS.red}15`,
                  }}
                >
                  {returnLabel} {lang === "ko" ? "수익" : "return"}
                </span>

                {/* Share button */}
                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    class="flex items-center gap-1 font-mono transition-colors"
                    style={{
                      color: linkCopied
                        ? COLORS.green
                        : "var(--color-text-muted)",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {linkCopied
                      ? lang === "ko"
                        ? "복사됨!"
                        : "Copied!"
                      : lang === "ko"
                        ? "결과 공유"
                        : "Share"}
                  </button>
                )}

                {/* Fees link */}
                <a
                  href={lang === "ko" ? "/ko/fees" : "/fees"}
                  class="font-mono transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.color = COLORS.accent)
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.color = "var(--color-text-muted)")
                  }
                >
                  {lang === "ko" ? "수수료 절약" : "Save on fees"}
                </a>

                {/* Exchange CTA — most prominent, pushed right */}
                {topExchange && (
                  <a
                    href={`${topExchange.referralUrl}`}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    class="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold transition-all"
                    style={{
                      background: COLORS.accent,
                      color: "#000",
                      fontSize: "0.6875rem",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {lang === "ko"
                      ? `${topExchange.name} ${topExchange.discountLabel} 할인으로 시작 →`
                      : `Trade on ${topExchange.name} — ${topExchange.discountLabel} off →`}
                  </a>
                )}
              </div>
            );
          })()}
          {/* Result tabs + CSV button */}
          <div class="flex flex-col sm:flex-row border-b border-[--color-border]">
            <div class="flex flex-1" role="tablist">
              {visibleTabs.map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={resultTab === tab}
                  onClick={() => setResultTab(tab)}
                  class={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors
                    ${resultTab === tab ? "font-bold border-b-2" : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]/20"}`}
                  style={resultTab === tab ? tabActiveStyle : undefined}
                >
                  {tab === "coins"
                    ? t.coinsTab || t.coins || "Coins"
                    : tab === "validate"
                      ? t.validate || "Validate"
                      : t[tab] || tab}
                </button>
              ))}
            </div>
            {simMode !== "quick" && (
              <div class="flex items-center justify-center gap-1 px-3 py-1.5 sm:py-0 border-t sm:border-t-0 border-[--color-border] flex-wrap">
                <button
                  onClick={downloadCsv}
                  class="px-3 py-1.5 text-xs font-mono bg-[--color-bg-tooltip] border border-[--color-border] rounded hover:border-[--color-accent] transition-colors hover:bg-[--color-bg-hover]"
                >
                  {t.exportCsv}
                </button>
                {onModifyRerun && (
                  <button
                    onClick={onModifyRerun}
                    class="px-3 py-1.5 text-xs font-mono bg-[--color-bg-tooltip] border border-[--color-border] rounded hover:border-[--color-accent] transition-colors hover:bg-[--color-bg-hover]"
                  >
                    {t.modifyRerun || "Modify & Re-run"}
                  </button>
                )}
                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    class="px-3 py-1.5 text-xs font-mono bg-[--color-bg-tooltip] border border-[--color-border] rounded hover:border-[--color-accent] transition-colors hover:bg-[--color-bg-hover]"
                    style={
                      linkCopied
                        ? { borderColor: COLORS.green, color: COLORS.green }
                        : undefined
                    }
                  >
                    {linkCopied
                      ? t.linkCopied || "Copied!"
                      : t.copyLink || "Copy Link"}
                  </button>
                )}
                <button
                  onClick={() => setShowQuickAdjust(!showQuickAdjust)}
                  class={`px-3 py-1.5 text-xs font-mono border rounded transition-colors ${showQuickAdjust ? "border-[--color-accent] text-[--color-accent] bg-[--color-accent]/10" : "bg-[--color-bg-tooltip] border-[--color-border] hover:border-[--color-accent] hover:bg-[--color-bg-hover]"}`}
                >
                  {t.quickAdjust || "Quick Adjust"}
                </button>
                {history.length > 1 && (
                  <button
                    onClick={() => setShowHistory?.(!showHistory)}
                    class={`px-3 py-1.5 text-xs font-mono border rounded transition-colors ${showHistory ? "border-[--color-accent] text-[--color-accent] bg-[--color-accent]/10" : "bg-[--color-bg-tooltip] border-[--color-border] hover:border-[--color-accent] hover:bg-[--color-bg-hover]"}`}
                  >
                    {t.history || "History"} ({history.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Adjust Panel */}
          {showQuickAdjust && (
            <div class="px-4 py-3 border-b border-[--color-border] bg-[--color-bg]/50">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="text-[10px] font-mono text-[--color-text-muted] uppercase flex justify-between">
                    <span>SL %</span>
                    <span class="text-[--color-text]">{qaSl}%</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={qaSl}
                    onInput={(e: Event) =>
                      setQaSl(parseFloat((e.target as HTMLInputElement).value))
                    }
                    class="slider-range mt-1"
                    aria-label={`Stop Loss ${qaSl}%`}
                    style={{
                      background: `linear-gradient(to right, ${COLORS.red} 0%, ${COLORS.red} ${((qaSl - 1) / 49) * 100}%, var(--color-border) ${((qaSl - 1) / 49) * 100}%, var(--color-border) 100%)`,
                    }}
                  />
                </div>
                <div>
                  <label class="text-[10px] font-mono text-[--color-text-muted] uppercase flex justify-between">
                    <span>TP %</span>
                    <span class="text-[--color-text]">{qaTp}%</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={qaTp}
                    onInput={(e: Event) =>
                      setQaTp(parseFloat((e.target as HTMLInputElement).value))
                    }
                    class="slider-range mt-1"
                    aria-label={`Take Profit ${qaTp}%`}
                    style={{
                      background: `linear-gradient(to right, ${COLORS.green} 0%, ${COLORS.green} ${((qaTp - 1) / 49) * 100}%, var(--color-border) ${((qaTp - 1) / 49) * 100}%, var(--color-border) 100%)`,
                    }}
                  />
                </div>
                <div>
                  <label class="text-[10px] font-mono text-[--color-text-muted] uppercase flex justify-between">
                    <span>{t.coins || "Coins"}</span>
                    <span class="text-[--color-text]">{qaCoins}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="569"
                    step="1"
                    value={qaCoins}
                    onInput={(e: Event) =>
                      setQaCoins(parseInt((e.target as HTMLInputElement).value))
                    }
                    class="slider-range mt-1"
                    aria-label={`Coins ${qaCoins}`}
                    style={{
                      background: `linear-gradient(to right, ${COLORS.accent} 0%, ${COLORS.accent} ${((qaCoins - 1) / 568) * 100}%, var(--color-border) ${((qaCoins - 1) / 568) * 100}%, var(--color-border) 100%)`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => onQuickAdjustRerun?.(qaSl, qaTp, qaCoins)}
                disabled={isRunning}
                class="mt-2 w-full py-2 rounded font-mono text-xs font-bold transition-colors hover:opacity-90"
                style={
                  isRunning
                    ? {
                        background: COLORS.disabled,
                        color: COLORS.disabledText,
                      }
                    : {
                        background: COLORS.accent,
                        color: "#fff",
                        boxShadow: `0 0 12px ${COLORS.accentGlow}`,
                      }
                }
              >
                {isRunning
                  ? "..."
                  : `${t.rerun || "Re-run"} (SL ${qaSl}% / TP ${qaTp}% / ${qaCoins} ${t.coins || "coins"})`}
              </button>
            </div>
          )}

          {/* History Comparison Panel */}
          {showHistory && history.length > 1 && (
            <div class="px-4 py-3 border-b border-[--color-border] bg-[--color-bg]/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-mono text-[--color-text-muted] uppercase">
                  {t.history || "History"}
                </span>
                <button
                  onClick={onClearHistory}
                  class="text-[10px] font-mono text-[--color-text-muted] hover:text-[--color-red] transition-colors"
                >
                  {t.clearHistory || "Clear"}
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-[10px] font-mono">
                  <caption class="sr-only">{t.history || "History"}</caption>
                  <thead>
                    <tr class="text-[--color-text-muted] border-b border-[--color-border]">
                      <th class="py-1 px-2 text-left">#</th>
                      <th class="py-1 px-2 text-left">
                        {t.config || "Config"}
                      </th>
                      <th class="py-1 px-2 text-right">
                        {t.trades || "Trades"}
                      </th>
                      <th class="py-1 px-2 text-right">{t.winRate || "WR%"}</th>
                      <th class="py-1 px-2 text-right">PF</th>
                      <th class="py-1 px-2 text-right">
                        {t.totalReturn || "Return"}
                      </th>
                      <th class="py-1 px-2 text-right">MDD</th>
                      <th class="py-1 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => {
                      const r = h.result;
                      const labels = [
                        t.run1 || "Run 1",
                        t.run2 || "Run 2",
                        t.run3 || "Run 3",
                      ];
                      return (
                        <tr
                          key={i}
                          class="border-b border-[--color-border]/30 hover:bg-[--color-bg-hover]/30"
                        >
                          <td class="py-1 px-2">{labels[i]}</td>
                          <td class="py-1 px-2 text-[--color-text-muted]">
                            {h.label}
                          </td>
                          <td class="py-1 px-2 text-right">{r.total_trades}</td>
                          <td
                            class="py-1 px-2 text-right"
                            style={{ color: winRateColor(r.win_rate) }}
                          >
                            {r.win_rate.toFixed(1)}%
                          </td>
                          <td
                            class="py-1 px-2 text-right"
                            style={{
                              color: profitFactorColor(r.profit_factor),
                            }}
                          >
                            {formatPF(r.profit_factor)}
                          </td>
                          <td
                            class="py-1 px-2 text-right"
                            style={{ color: signColor(r.total_return_pct) }}
                          >
                            {r.total_return_pct > 0 ? "+" : ""}
                            {r.total_return_pct.toFixed(1)}%
                          </td>
                          <td
                            class="py-1 px-2 text-right"
                            style={{ color: COLORS.red }}
                          >
                            {r.max_drawdown_pct.toFixed(1)}%
                          </td>
                          <td class="py-1 px-2">
                            <button
                              onClick={() => onSelectHistory?.(i)}
                              class="text-[--color-accent] hover:underline"
                            >
                              {t.compareWith || "View"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary tab */}
          {resultTab === "summary" && (
            <div class="p-3 md:p-4">
              {/* Strategy verdict banner */}
              {result &&
                (() => {
                  const pf = result.profit_factor;
                  const wr = result.win_rate;
                  const mdd = result.max_drawdown_pct;
                  let grade: string;
                  let gradeColor: string;
                  let reason: string;
                  if (pf >= 2.0 && wr >= 55 && mdd <= 20) {
                    grade = t.gradeStrong;
                    gradeColor = "#22c55e";
                    reason = t.reasonStrong(
                      formatPF(pf),
                      wr.toFixed(1),
                      mdd.toFixed(1),
                    );
                  } else if (pf >= 1.5 && wr >= 50 && mdd <= 30) {
                    grade = t.gradeGood;
                    gradeColor = "#86efac";
                    reason = t.reasonGood(
                      formatPF(pf),
                      wr.toFixed(1),
                      mdd.toFixed(1),
                    );
                  } else if (pf >= 1.2 && mdd <= 40) {
                    grade = t.gradeFair;
                    gradeColor = "#facc15";
                    const weak =
                      pf < 1.5
                        ? t.reasonFairPf(formatPF(pf))
                        : t.reasonFairWr(wr.toFixed(1));
                    reason = t.reasonFairSuffix(weak);
                  } else {
                    grade = t.gradeWeak;
                    gradeColor = "#f87171";
                    const mainIssue =
                      pf < 1.0
                        ? t.reasonWeakPf(formatPF(pf))
                        : mdd > 40
                          ? t.reasonWeakMdd(mdd.toFixed(1))
                          : t.reasonWeakWr(wr.toFixed(1));
                    reason = t.reasonWeakSuffix(mainIssue);
                  }
                  return (
                    <div
                      class="mb-3 px-3 py-2 rounded-lg border flex items-center gap-2 font-mono text-xs"
                      style={{
                        borderColor: gradeColor + "40",
                        background: gradeColor + "12",
                      }}
                    >
                      <span
                        class="font-bold shrink-0"
                        style={{ color: gradeColor }}
                      >
                        {t.strategyLabel}{" "}
                        <span style={{ color: gradeColor }}>{grade}</span>
                      </span>
                      <span class="text-[--color-text-muted]">—</span>
                      <span style={{ color: gradeColor + "cc" }}>{reason}</span>
                    </div>
                  );
                })()}
              {/* Results interpretation guide banner */}
              {showResultsGuide && (
                <div class="mb-3 px-3 py-2.5 rounded-lg border border-[--color-accent]/30 bg-[--color-accent]/5 flex items-start justify-between gap-2">
                  <div class="font-mono text-xs">
                    <span class="text-[--color-accent] font-bold">
                      {t.resultsGuide || "How to read results:"}
                    </span>
                    <span class="text-[--color-text-muted] ml-2">
                      {"\u2022"} {t.resultsGuideWr || "Win Rate > 50%: Good"}
                      {"  \u2022 "}
                      {t.resultsGuidePf || "Profit Factor > 1.5: Strong"}
                      {"  \u2022 "}
                      {t.resultsGuideMdd || "Max Drawdown < 20%: Low risk"}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowResultsGuide(false)}
                    class="text-[--color-text-muted] hover:text-[--color-text] transition-colors text-sm font-mono shrink-0 p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={t.closeGuideAria || "Close guide"}
                  >
                    &times;
                  </button>
                </div>
              )}
              <ResultsCard
                data={result}
                isDefault={activePreset === "bb-squeeze-short"}
                lang={lang}
                isDemo={result._isDemo}
                simMode={simMode}
              />
              <EmailCapture lang={lang} />
              {result.yearly_stats && result.yearly_stats.length > 0 && (
                <div class="mt-4">
                  <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-2">
                    {t.yearlyBreakdown || "Yearly Breakdown"}
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {result.yearly_stats.map((y) => (
                      <div
                        key={y.year}
                        class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]"
                      >
                        <div class="font-mono text-xs font-bold mb-1">
                          {y.year}
                        </div>
                        <div class="grid grid-cols-2 gap-x-2 text-[10px]">
                          <span class="text-[--color-text-muted]">WR</span>
                          <span
                            class="font-mono"
                            style={{ color: winRateColor(y.win_rate) }}
                          >
                            {y.win_rate.toFixed(1)}%
                          </span>
                          <span class="text-[--color-text-muted]">PF</span>
                          <span
                            class="font-mono"
                            style={{
                              color: profitFactorColor(y.profit_factor),
                            }}
                          >
                            {formatPF(y.profit_factor)}
                          </span>
                          <span class="text-[--color-text-muted]">Trades</span>
                          <span class="font-mono">{y.trades}</span>
                          <span class="text-[--color-text-muted]">Return</span>
                          <span
                            class="font-mono"
                            style={{ color: signColor(y.total_return_pct) }}
                          >
                            {y.total_return_pct > 0 ? "+" : ""}
                            {y.total_return_pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.monthly_stats && result.monthly_stats.length > 0 && (
                <div class="mt-4">
                  <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-2">
                    {t.monthlyReturns || "Monthly Returns"}
                  </div>
                  <div class="overflow-x-auto">
                    <div class="flex gap-1 min-w-max">
                      {result.monthly_stats.map((m) => {
                        const maxRet = Math.max(
                          ...result.monthly_stats!.map((x) =>
                            Math.abs(x.total_return_pct),
                          ),
                          1,
                        );
                        const barH = Math.min(
                          (Math.abs(m.total_return_pct) / maxRet) * 40,
                          40,
                        );
                        return (
                          <div
                            key={m.month}
                            class="flex flex-col items-center w-7"
                            title={`${m.month}: ${m.trades} trades, WR ${m.win_rate}%, PF ${m.profit_factor}`}
                          >
                            <div class="relative h-10 w-4 flex items-end justify-center">
                              <div
                                class="w-full rounded-sm"
                                style={{
                                  height: `${barH}px`,
                                  backgroundColor:
                                    m.total_return_pct >= 0
                                      ? "var(--color-green)"
                                      : "var(--color-red)",
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                            <span class="text-[7px] font-mono text-[--color-text-muted] mt-0.5 rotate-[-45deg] origin-top-left translate-x-[6px]">
                              {m.month.slice(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {result.pnl_distribution &&
                result.pnl_distribution.length > 0 &&
                result.pnl_buckets && (
                  <div class="mt-4">
                    <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-2">
                      {t.pnlDistribution || "PnL Distribution"}
                    </div>
                    <div class="flex items-end gap-px h-16">
                      {result.pnl_distribution.map((count, i) => {
                        const maxCount = Math.max(
                          ...result.pnl_distribution!,
                          1,
                        );
                        const h =
                          count > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
                        const isNeg = i < 10;
                        const isZero = i === 10;
                        return (
                          <div
                            key={i}
                            class="flex-1 rounded-t-sm transition-all"
                            style={{
                              height: `${h}%`,
                              backgroundColor: isZero
                                ? "var(--color-text-muted)"
                                : isNeg
                                  ? "var(--color-red)"
                                  : "var(--color-green)",
                              opacity: count > 0 ? 0.7 : 0.1,
                            }}
                            title={`${result.pnl_buckets![i]}: ${count} trades`}
                          />
                        );
                      })}
                    </div>
                    <div class="flex justify-between text-[8px] font-mono text-[--color-text-muted] mt-0.5">
                      <span>-10%</span>
                      <span>0%</span>
                      <span>+10%</span>
                    </div>
                  </div>
                )}
              <div class="mt-3 flex flex-wrap gap-3 text-[10px] text-[--color-text-muted] font-mono">
                <span>
                  {result.coins_used} {t.coinsUnit}
                </span>
                <span>{result.data_range}</span>
                <span>{result.compute_time_ms}ms</span>
                {result._isDemo && (
                  <span class="text-[--color-yellow]">DEMO</span>
                )}
                {result.positions_skipped != null &&
                  result.positions_skipped > 0 && (
                    <span class="text-[--color-yellow]">
                      {result.positions_skipped} skipped (max {100} concurrent)
                    </span>
                  )}
              </div>
              {/* Share & Fees CTA */}
              <div class="mt-4 pt-3 border-t border-[--color-border] flex flex-wrap items-center gap-3">
                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    class="flex items-center gap-1.5 px-4 py-2 text-xs font-mono rounded border transition-colors"
                    style={
                      linkCopied
                        ? {
                            borderColor: COLORS.green,
                            color: COLORS.green,
                            background: `${COLORS.green}10`,
                          }
                        : {
                            borderColor: COLORS.accent,
                            color: COLORS.accent,
                            background: `${COLORS.accent}10`,
                          }
                    }
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {linkCopied ? t.linkCopied : t.shareResults}
                  </button>
                )}
                {/* Fix 2: Copy Strategy Settings button */}
                <button
                  onClick={copyStrategySettings}
                  class="flex items-center gap-1.5 px-4 py-2 text-xs font-mono rounded border transition-colors"
                  style={
                    settingsCopied
                      ? {
                          borderColor: COLORS.green,
                          color: COLORS.green,
                          background: `${COLORS.green}10`,
                        }
                      : {
                          borderColor: "var(--color-border)",
                          color: "var(--color-text-muted)",
                        }
                  }
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {settingsCopied ? t.settingsCopied : t.copySettings}
                </button>
                <a
                  href="/fees"
                  class="flex items-center gap-1.5 px-4 py-2 text-xs font-mono rounded border border-[--color-border] text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent] transition-colors"
                >
                  {t.saveOnFees} &rarr;
                </a>
              </div>
              {/* ExchangeCTA — always shown: profitable = start trading, loss = save on fees */}
              <ExchangeCTA
                mode="inline"
                lang={lang}
                strategy={activePreset ?? undefined}
              />
            </div>
          )}

          {/* Equity tab */}
          {resultTab === "equity" && (
            <div class="p-3 md:p-4">
              <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1">
                {t.equityCurve || "Equity Curve"}
              </div>
              <div ref={equityChartRef} style={{ height: "300px" }} />
              <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mt-3 mb-1">
                {t.drawdown || "Drawdown"}
              </div>
              <div ref={ddChartRef} style={{ height: "120px" }} />
              {result && result.max_drawdown_pct !== undefined && (
                <div class="mt-2 font-mono text-xs text-[--color-text-muted]">
                  {t.maxDrawdown || "Max Drawdown"}:{" "}
                  <span style={{ color: COLORS.red }}>
                    {result.max_drawdown_pct.toFixed(1)}%
                  </span>
                  {result.max_drawdown_pct > 100 && (
                    <span class="ml-1.5 text-[10px] opacity-70">
                      ({t.cumulativePct})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trades tab */}
          {resultTab === "trades" && (
            <div class="p-2 overflow-x-auto -webkit-overflow-scrolling-touch">
              {result.trades && result.trades.length > 0 ? (
                <table class="w-full text-xs font-mono min-w-[500px] md:min-w-0">
                  <caption class="sr-only">
                    {t.tradeTableCaption || "Simulated trade details"}
                  </caption>
                  <thead>
                    <tr class="text-[--color-text-muted] border-b border-[--color-border]">
                      <th class="py-2 px-2 text-left">{t.symbol}</th>
                      <th class="py-2 px-2 text-left hidden sm:table-cell">
                        {t.entryTime}
                      </th>
                      <th class="py-2 px-2 text-left">{t.exitTime}</th>
                      <th class="py-2 px-2 text-right">{t.pnl}</th>
                      <th class="py-2 px-2 text-right">PnL $</th>
                      <th class="py-2 px-2 text-center">{t.reason}</th>
                      <th class="py-2 px-2 text-right">{t.held}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 200).map((tr, i) => (
                      <tr
                        key={i}
                        class="border-b border-[--color-border]/30 hover:bg-[--color-bg-hover]/30"
                      >
                        <td class="py-1.5 px-2">
                          {tr.symbol?.replace("USDT", "")}
                        </td>
                        <td class="py-1.5 px-2 text-[--color-text-muted] hidden sm:table-cell">
                          {tr.entry_time?.slice(0, 16)}
                        </td>
                        <td class="py-1.5 px-2 text-[--color-text-muted]">
                          {tr.exit_time?.slice(0, 16)}
                        </td>
                        <td
                          class="py-1.5 px-2 text-right"
                          style={{ color: signColor(tr.pnl_pct) }}
                        >
                          {tr.pnl_pct > 0 ? "+" : ""}
                          {tr.pnl_pct.toFixed(2)}%
                        </td>
                        <td
                          class="py-1.5 px-2 text-right"
                          style={{ color: signColor(tr.pnl_usd || 0) }}
                        >
                          {(tr.pnl_usd || 0) > 0 ? "+" : ""}$
                          {(tr.pnl_usd || 0).toFixed(2)}
                        </td>
                        <td class="py-1.5 px-2 text-center">
                          <span
                            class={`px-1.5 py-0.5 rounded text-[10px] ${
                              tr.exit_reason === "TP"
                                ? "bg-[--color-green]/10 text-[--color-green]"
                                : tr.exit_reason === "SL"
                                  ? "bg-[--color-red]/10 text-[--color-red]"
                                  : "bg-[--color-yellow]/10 text-[--color-yellow]"
                            }`}
                          >
                            {tr.exit_reason}
                          </span>
                        </td>
                        <td class="py-1.5 px-2 text-right text-[--color-text-muted]">
                          {tr.bars_held}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div class="text-center py-8 text-[--color-text-muted] text-sm">
                  {t.noTradeDetails ||
                    "Trade details not available for this backtest type."}
                </div>
              )}
            </div>
          )}

          {/* Validate tab */}
          {resultTab === "validate" && (
            <div class="p-3 md:p-4">
              <OOSValidation
                lang={lang}
                strategy={activePreset || "custom"}
                direction={result.direction}
                sl_pct={result.sl_pct}
                tp_pct={result.tp_pct}
                max_bars={result.max_bars}
                top_n={result.coins_used}
              />
            </div>
          )}

          {/* Coins tab */}
          {resultTab === "coins" &&
            (() => {
              const coins = result.coin_results || [];
              if (coins.length === 0) {
                return (
                  <div class="text-center py-8 text-[--color-text-muted] text-sm font-mono">
                    {t.noCoinData || "No per-coin data available."}
                  </div>
                );
              }
              const sorted = [...coins].sort((a: CoinResult, b: CoinResult) => {
                const av =
                  (a as unknown as Record<string, string | number>)[
                    coinSort.key
                  ] ?? 0;
                const bv =
                  (b as unknown as Record<string, string | number>)[
                    coinSort.key
                  ] ?? 0;
                if (typeof av === "string" || typeof bv === "string") {
                  return coinSort.asc
                    ? String(av).localeCompare(String(bv))
                    : String(bv).localeCompare(String(av));
                }
                return coinSort.asc
                  ? (av as number) - (bv as number)
                  : (bv as number) - (av as number);
              });
              const profitable = coins.filter(
                (c: CoinResult) => c.total_return_pct > 0,
              ).length;
              const losing = coins.filter(
                (c: CoinResult) => c.total_return_pct < 0,
              ).length;
              const neutral = coins.filter(
                (c: CoinResult) => c.total_return_pct === 0,
              ).length;
              const profitPct =
                coins.length > 0 ? (profitable / coins.length) * 100 : 0;
              const toggleSort = (key: string) => {
                setCoinSort((prev) =>
                  prev.key === key
                    ? { key, asc: !prev.asc }
                    : { key, asc: false },
                );
              };
              const arrow = (key: string) =>
                coinSort.key === key
                  ? coinSort.asc
                    ? " \u25B2"
                    : " \u25BC"
                  : "";

              return (
                <div class="p-2">
                  <div class="flex flex-wrap gap-3 mb-3 px-2 text-[10px] font-mono text-[--color-text-muted]">
                    <span style={{ color: COLORS.green }}>
                      {profitable} {t.profitableUnit}
                    </span>
                    <span style={{ color: COLORS.red }}>
                      {losing} {t.losingUnit}
                    </span>
                    {neutral > 0 && (
                      <span>
                        {neutral} {t.flatUnit}
                      </span>
                    )}
                    <span>
                      {profitPct.toFixed(0)}% {t.profitableCoinsUnit}
                    </span>
                  </div>
                  <div class="overflow-x-auto -webkit-overflow-scrolling-touch">
                    <table class="w-full text-xs font-mono min-w-[600px] md:min-w-0">
                      <caption class="sr-only">
                        Per-coin backtest results
                      </caption>
                      <thead>
                        <tr class="text-[--color-text-muted] border-b border-[--color-border]">
                          <th
                            class="py-2 px-2 text-left cursor-pointer select-none hover:text-[--color-text]"
                            onClick={() => toggleSort("symbol")}
                          >
                            {t.coinHeader}
                            {arrow("symbol")}
                          </th>
                          <th
                            class="py-2 px-2 text-right cursor-pointer select-none hover:text-[--color-text]"
                            onClick={() => toggleSort("trades")}
                          >
                            {t.tradesHeader}
                            {arrow("trades")}
                          </th>
                          <th
                            class="py-2 px-2 text-right cursor-pointer select-none hover:text-[--color-text]"
                            onClick={() => toggleSort("win_rate")}
                          >
                            {t.winRateHeader}
                            {arrow("win_rate")}
                          </th>
                          <th
                            class="py-2 px-2 text-right cursor-pointer select-none hover:text-[--color-text]"
                            onClick={() => toggleSort("profit_factor")}
                          >
                            PF{arrow("profit_factor")}
                          </th>
                          <th
                            class="py-2 px-2 text-right cursor-pointer select-none hover:text-[--color-text]"
                            onClick={() => toggleSort("total_return_pct")}
                          >
                            {t.returnHeader}
                            {arrow("total_return_pct")}
                          </th>
                          <th class="py-2 px-2 text-center hidden sm:table-cell">
                            TP/SL/TO
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((coin: CoinResult) => (
                          <tr
                            key={coin.symbol}
                            class="border-b border-[--color-border]/30 hover:bg-[--color-bg-hover]/30"
                          >
                            <td class="py-1.5 px-2 font-bold">
                              {coin.symbol.replace("USDT", "")}
                            </td>
                            <td class="py-1.5 px-2 text-right">
                              {coin.trades}
                            </td>
                            <td
                              class="py-1.5 px-2 text-right"
                              style={{ color: winRateColor(coin.win_rate) }}
                            >
                              {coin.win_rate.toFixed(1)}%
                            </td>
                            <td
                              class="py-1.5 px-2 text-right"
                              style={{
                                color: profitFactorColor(coin.profit_factor),
                              }}
                            >
                              {formatPF(coin.profit_factor)}
                            </td>
                            <td
                              class="py-1.5 px-2 text-right"
                              style={{
                                color: signColor(coin.total_return_pct),
                              }}
                            >
                              {coin.total_return_pct > 0 ? "+" : ""}
                              {coin.total_return_pct.toFixed(1)}%
                            </td>
                            <td class="py-1.5 px-2 text-center text-[10px] text-[--color-text-muted] hidden sm:table-cell">
                              <span style={{ color: COLORS.green }}>
                                {coin.tp_count}
                              </span>
                              {" / "}
                              <span style={{ color: COLORS.red }}>
                                {coin.sl_count}
                              </span>
                              {" / "}
                              <span>{coin.timeout_count}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
        </div>
      ) : (
        !error && (
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] p-8 text-center space-y-2">
            <div class="text-[--color-text-muted] text-sm font-mono">
              {t.noResults}
            </div>
            <div class="text-[--color-text-muted] text-xs font-mono opacity-60">
              {t.noResultsHint ?? ""}
            </div>
          </div>
        )
      )}
      {result && result.total_trades > 0 && (
        <div class="px-3 pb-3 md:px-4 md:pb-4">
          <ExchangeCTA
            mode="card"
            lang={lang}
            strategy={activePreset ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
