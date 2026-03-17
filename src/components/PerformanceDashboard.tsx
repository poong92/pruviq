import { useState, useEffect, useRef } from "preact/hooks";
import {
  formatPrice,
  formatUsd,
  formatDate,
  formatDateFull,
  formatReasonLabel,
  winRateColor,
  profitFactorColor,
  signColor,
  getCssVar,
  formatPF,
} from "../utils/format";
import type { IChartApi, AreaData, Time } from "lightweight-charts";

interface DailyEntry {
  date: string;
  pnl: number;
  trades: number;
  cum_pnl: number;
  wins: number;
  losses: number;
}

interface RecentTrade {
  symbol: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  pnl_usd: number;
  reason: string;
  closed_at: string;
}

interface RawPerformanceData {
  generated: string;
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
    avg_trade_pnl: number;
    best_day_pnl: number;
    worst_day_pnl: number;
    tp_count: number;
    sl_count: number;
    timeout_count: number;
    other_count: number;
  };
  daily: DailyEntry[];
  recent_trades: RecentTrade[];
}

const labels = {
  en: {
    tag: "BACKTEST RESULTS",
    title: "Strategy Performance.",
    desc: "BB Squeeze SHORT backtest results across {coins}+ coins, 2+ years of data. Including the losses.",
    trades: "Total Trades",
    winRate: "Win Rate",
    pnl: "Total PnL",
    pf: "Profit Factor",
    mdd: "Max Drawdown",
    bestDay: "Best Day",
    worstDay: "Worst Day",
    avgTrade: "Avg Trade",
    dailyChart: "CUMULATIVE PnL",
    dailyStats: "DAILY STATS",
    exitBreakdown: "EXIT BREAKDOWN",
    recentTrades: "RECENT TRADES",
    tp: "Take Profit",
    sl: "Stop Loss",
    to: "Timeout",
    other: "Other",
    loading: "Loading performance data...",
    error: "Failed to load performance data.",
    disclaimer:
      "Past performance does not guarantee future results. Backtest results include fees and slippage. Not financial advice.",
    updated: "Last updated",
    noResults: "Performance data not available.",
    strategy: "Strategy",
    period: "Period",
    symbol: "Symbol",
    exitPrice: "Exit Price",
    pnlPct: "PnL %",
    pnlUsd: "PnL $",
    result: "Result",
    date: "Date",
    balance: "Balance",
    startBal: "Starting",
    curBal: "Current",
    tableCaption: "Recent backtest trades",
  },
  ko: {
    tag: "백테스트 결과",
    title: "전략 성과.",
    desc: "BB Squeeze SHORT 백테스트 결과 — {coins}개+ 코인, 2년+ 데이터. 손실 포함.",
    trades: "총 거래",
    winRate: "승률",
    pnl: "총 손익",
    pf: "수익 팩터",
    mdd: "최대 낙폭",
    bestDay: "최고 수익일",
    worstDay: "최대 손실일",
    avgTrade: "평균 거래",
    dailyChart: "누적 손익",
    dailyStats: "일일 통계",
    exitBreakdown: "청산 유형",
    recentTrades: "최근 거래",
    tp: "이익 실현",
    sl: "손절",
    to: "타임아웃",
    other: "기타",
    loading: "성과 데이터 로딩 중...",
    error: "성과 데이터 로딩 실패.",
    disclaimer:
      "과거 성과가 미래 수익을 보장하지 않습니다. 백테스트 결과에 수수료·슬리피지 포함. 투자 조언이 아닙니다.",
    updated: "최종 업데이트",
    noResults: "성과 데이터를 사용할 수 없습니다.",
    strategy: "전략",
    period: "기간",
    symbol: "종목",
    exitPrice: "청산가",
    pnlPct: "PnL %",
    pnlUsd: "PnL $",
    result: "결과",
    date: "날짜",
    balance: "잔고",
    startBal: "시작",
    curBal: "현재",
    tableCaption: "최근 백테스트 거래",
  },
};

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div class="p-3 md:p-4 rounded-lg bg-[--color-bg-card] border border-[--color-border] text-center min-w-0">
      <div class="font-mono text-[0.6875rem] text-[--color-text-muted] uppercase tracking-wider mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </div>
      <div
        class="font-mono text-sm sm:text-base md:text-lg font-bold truncate"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function SkeletonMetrics() {
  return (
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          class="p-3 md:p-4 rounded-lg bg-[--color-bg-card] border border-[--color-border] text-center"
        >
          <div class="skeleton h-2.5 w-16 mx-auto mb-3" />
          <div class="skeleton h-5 w-20 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export default function PerformanceDashboard({
  lang = "en",
}: {
  lang?: "en" | "ko";
}) {
  const t = labels[lang] || labels.en;

  const [coinsCount, setCoinsCount] = useState("569");
  const [data, setData] = useState<RawPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    fetch("/data/site-stats.json")
      .then((r) => r.json())
      .then((d: { coins_analyzed?: number }) => {
        if (d.coins_analyzed) setCoinsCount(String(d.coins_analyzed));
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  useEffect(() => {
    fetch("/data/performance.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json: RawPerformanceData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    const cumulativeData = data.daily
      .filter((d) => d.trades > 0 || d.cum_pnl !== 0)
      .map((d) => ({ time: d.date, value: parseFloat(d.cum_pnl.toFixed(2)) }));

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      const chartHeight =
        chartContainerRef.current.clientHeight ||
        (window.innerWidth < 768 ? 250 : 350);
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartHeight,
        layout: {
          background: { color: getCssVar("--color-bg") },
          textColor: getCssVar("--color-text-muted"),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: getCssVar("--color-border") },
          horzLines: { color: getCssVar("--color-border") },
        },
        rightPriceScale: {
          borderColor: getCssVar("--color-border"),
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: getCssVar("--color-border"),
          rightOffset: 3,
          barSpacing: 12,
        },
        crosshair: {
          mode: 0,
          vertLine: {
            color: getCssVar("--color-accent") + "33",
            width: 1,
            style: 2,
            labelBackgroundColor: getCssVar("--color-bg-card"),
          },
          horzLine: {
            color: getCssVar("--color-accent") + "33",
            width: 1,
            style: 2,
            labelBackgroundColor: getCssVar("--color-bg-card"),
          },
        },
      });

      const finalValue =
        cumulativeData.length > 0
          ? cumulativeData[cumulativeData.length - 1].value
          : 0;
      const lineColor =
        finalValue >= 0
          ? getCssVar("--color-accent")
          : getCssVar("--color-red");
      const topColor =
        finalValue >= 0
          ? getCssVar("--color-accent-glow")
          : "rgba(255, 68, 68, 0.3)";
      const bottomColor =
        finalValue >= 0 ? "rgba(0, 192, 115, 0.0)" : "rgba(240, 66, 81, 0.0)";

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor,
        topColor,
        bottomColor,
        lineWidth: 2,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `$${price.toFixed(0)}`,
        },
        crosshairMarkerRadius: 5,
        crosshairMarkerBackgroundColor: lineColor,
        crosshairMarkerBorderColor: getCssVar("--color-bg"),
        crosshairMarkerBorderWidth: 2,
      });

      areaSeries.setData(cumulativeData as AreaData<Time>[]);
      areaSeries.createPriceLine({
        price: 0,
        color: getCssVar("--color-text-muted"),
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "",
      });

      chart.timeScale().fitContent();
      chartRef.current = chart;

      if (chartContainerRef.current) {
        ro = new ResizeObserver((entries) => {
          for (const entry of entries)
            chart.applyOptions({ width: entry.contentRect.width });
        });
        ro.observe(chartContainerRef.current);
      }
    });

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div class="fade-in">
        <div class="mb-8">
          <div class="skeleton h-3 w-32 mb-3" />
          <div class="skeleton h-8 w-72 mb-3" />
          <div class="skeleton h-4 w-96 max-w-full mb-4" />
          <div class="flex gap-6">
            <div class="skeleton h-3 w-40" />
            <div class="skeleton h-3 w-56" />
          </div>
        </div>
        <SkeletonMetrics />
        <div class="bg-[--color-bg] border border-[--color-border] rounded-xl overflow-hidden mb-6">
          <div class="px-4 py-3 border-b border-[--color-border] flex justify-between items-center">
            <div class="skeleton h-3 w-28" />
            <div class="skeleton h-4 w-16" />
          </div>
          <div class="skeleton w-full h-[250px] md:h-[320px]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div class="py-12 text-center font-mono text-sm text-[--color-text-muted] bg-[--color-bg-card] border border-[--color-border] rounded-xl">
        <div class="text-2xl mb-4 opacity-30">!</div>
        {t.error}
      </div>
    );
  }

  const s = data.summary;
  const totalExits = s.tp_count + s.sl_count + s.timeout_count + s.other_count;
  const tpPct = totalExits > 0 ? (s.tp_count / totalExits) * 100 : 0;
  const slPct = totalExits > 0 ? (s.sl_count / totalExits) * 100 : 0;
  const toPct = totalExits > 0 ? (s.timeout_count / totalExits) * 100 : 0;
  const otherPct = totalExits > 0 ? (s.other_count / totalExits) * 100 : 0;

  const pnlColor = signColor(s.total_pnl);
  const pfColor = profitFactorColor(s.profit_factor);
  const wrColor = winRateColor(s.win_rate);

  return (
    <div class="fade-in" data-perf-loaded>
      {/* Header */}
      <div class="mb-8">
        <div class="font-mono text-[0.6875rem] text-[--color-accent] tracking-[0.15em] uppercase mb-3">
          {t.tag}
        </div>
        <h1
          class="font-bold leading-tight mb-3"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}
        >
          {t.title}
        </h1>
        <p class="text-[--color-text-muted] text-base leading-relaxed max-w-[600px] mb-4">
          {t.desc.replace("{coins}", coinsCount)}
        </p>
        <div class="font-mono text-xs text-[--color-text-muted] flex gap-6 flex-wrap">
          <span>
            {t.strategy}:{" "}
            <span class="text-[--color-text]">{data.strategy}</span>
          </span>
          <span>
            {t.period}:{" "}
            <span class="text-[--color-text]">
              {formatDateFull(data.period.from)} &mdash;{" "}
              {formatDateFull(data.period.to)}
            </span>
          </span>
          {data.generated && (
            <span>
              {t.updated}:{" "}
              <span class="text-[--color-text]">
                {formatDateFull(data.generated.split("T")[0])}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricCard
          label={t.trades}
          value={s.total_trades.toLocaleString()}
          color="var(--color-text)"
        />
        <MetricCard
          label={t.winRate}
          value={`${s.win_rate}%`}
          color={wrColor}
        />
        <MetricCard
          label={t.pnl}
          value={formatUsd(s.total_pnl)}
          color={pnlColor}
        />
        <MetricCard
          label={t.pf}
          value={formatPF(s.profit_factor)}
          color={pfColor}
        />
        <MetricCard
          label={t.mdd}
          value={`${s.max_drawdown_pct.toFixed(1)}%`}
          color="var(--color-red)"
        />
      </div>

      {/* Cumulative PnL Chart */}
      <div class="bg-[--color-bg] border border-[--color-border] rounded-xl overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-[--color-border] flex justify-between items-center">
          <span class="font-mono text-[0.6875rem] text-[--color-accent] tracking-widest uppercase font-semibold">
            {t.dailyChart}
          </span>
          <span
            class="font-mono text-xs font-semibold"
            style={{ color: pnlColor }}
          >
            {formatUsd(s.total_pnl)}
          </span>
        </div>
        <div ref={chartContainerRef} class="w-full h-[250px] md:h-[350px]" />
        <div class="px-3 py-1.5 text-right font-mono text-[0.5625rem]">
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[--color-text-muted] no-underline hover:text-[--color-text] transition-colors"
          >
            Powered by TradingView
          </a>
        </div>
      </div>

      {/* Daily Stats + Exit Breakdown */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Daily Stats */}
        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          <div class="font-mono text-[0.6875rem] text-[--color-text-muted] tracking-widest uppercase mb-4">
            {t.dailyStats}
          </div>
          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <span class="font-mono text-[0.8125rem] text-[--color-text-muted]">
                {t.bestDay}
              </span>
              <span class="font-mono text-base font-bold text-[--color-accent]">
                {formatUsd(s.best_day_pnl)}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="font-mono text-[0.8125rem] text-[--color-text-muted]">
                {t.worstDay}
              </span>
              <span class="font-mono text-base font-bold text-[--color-red]">
                {formatUsd(s.worst_day_pnl)}
              </span>
            </div>
            <div class="h-px bg-[--color-border]" />
            <div class="flex justify-between items-center">
              <span class="font-mono text-[0.8125rem] text-[--color-text-muted]">
                {t.avgTrade}
              </span>
              <span
                class="font-mono text-base font-bold"
                style={{
                  color:
                    s.avg_trade_pnl >= 0
                      ? "var(--color-accent)"
                      : "var(--color-red)",
                }}
              >
                {formatUsd(s.avg_trade_pnl)}
              </span>
            </div>
            <div class="h-px bg-[--color-border]" />
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
              <span class="font-mono text-[0.8125rem] text-[--color-text-muted]">
                {t.balance}
              </span>
              <span class="font-mono text-xs sm:text-[0.8125rem] text-[--color-text-muted] truncate">
                ${s.starting_balance.toLocaleString()} &rarr;{" "}
                <span
                  class="font-semibold"
                  style={{
                    color:
                      s.current_balance >= s.starting_balance
                        ? "var(--color-accent)"
                        : "var(--color-red)",
                  }}
                >
                  ${s.current_balance.toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Exit Breakdown */}
        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          <div class="font-mono text-[0.6875rem] text-[--color-text-muted] tracking-widest uppercase mb-4">
            {t.exitBreakdown}
          </div>
          <div class="flex flex-col gap-3">
            {/* TP */}
            <div>
              <div class="flex justify-between mb-1">
                <span class="font-mono text-xs text-[--color-accent]">
                  {t.tp} ({s.tp_count})
                </span>
                <span class="font-mono text-xs text-[--color-accent] font-semibold">
                  {tpPct.toFixed(1)}%
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-[--color-border] overflow-hidden">
                <div
                  class="h-full bg-[--color-accent] rounded-full transition-[width] duration-500"
                  style={{ width: `${tpPct}%` }}
                />
              </div>
            </div>
            {/* SL */}
            <div>
              <div class="flex justify-between mb-1">
                <span class="font-mono text-xs text-[--color-red]">
                  {t.sl} ({s.sl_count})
                </span>
                <span class="font-mono text-xs text-[--color-red] font-semibold">
                  {slPct.toFixed(1)}%
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-[--color-border] overflow-hidden">
                <div
                  class="h-full bg-[--color-red] rounded-full transition-[width] duration-500"
                  style={{ width: `${slPct}%` }}
                />
              </div>
            </div>
            {/* TO */}
            <div>
              <div class="flex justify-between mb-1">
                <span class="font-mono text-xs text-[--color-text-muted]">
                  {t.to} ({s.timeout_count})
                </span>
                <span class="font-mono text-xs text-[--color-text-muted] font-semibold">
                  {toPct.toFixed(1)}%
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-[--color-border] overflow-hidden">
                <div
                  class="h-full bg-[--color-text-muted] rounded-full transition-[width] duration-500"
                  style={{ width: `${toPct}%` }}
                />
              </div>
            </div>
            {/* Other */}
            {s.other_count > 0 && (
              <div>
                <div class="flex justify-between mb-1">
                  <span class="font-mono text-xs text-[--color-yellow]">
                    {t.other} ({s.other_count})
                  </span>
                  <span class="font-mono text-xs text-[--color-yellow] font-semibold">
                    {otherPct.toFixed(1)}%
                  </span>
                </div>
                <div class="h-1.5 rounded-full bg-[--color-border] overflow-hidden">
                  <div
                    class="h-full bg-[--color-yellow] rounded-full transition-[width] duration-500"
                    style={{ width: `${otherPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* Combined bar */}
          <div class="flex flex-wrap h-1 rounded-sm overflow-hidden mt-3">
            <div class="bg-[--color-accent]" style={{ width: `${tpPct}%` }} />
            <div class="bg-[--color-red]" style={{ width: `${slPct}%` }} />
            <div
              class="bg-[--color-text-muted]"
              style={{ width: `${toPct}%` }}
            />
            {s.other_count > 0 && (
              <div
                class="bg-[--color-yellow]"
                style={{ width: `${otherPct}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      {data.recent_trades && data.recent_trades.length > 0 && (
        <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden mb-6">
          <button
            onClick={() => setShowTrades(!showTrades)}
            class={`w-full px-4 py-3 min-h-[44px] bg-transparent border-none text-[--color-text] font-mono text-[0.8125rem] font-semibold cursor-pointer text-left flex justify-between items-center hover:bg-[--color-bg-hover] transition-colors ${showTrades ? "border-b border-[--color-border]" : ""}`}
          >
            <span>
              {showTrades ? "\u25BC" : "\u25B6"} {t.recentTrades} (
              {data.recent_trades.length})
            </span>
          </button>
          {showTrades && (
            <div class="overflow-x-auto">
              <table class="w-full border-collapse font-mono text-xs">
                <caption class="sr-only">{t.tableCaption}</caption>
                <thead>
                  <tr class="border-b border-[--color-border]">
                    <th class="px-3 py-2 text-left text-[--color-text-muted] text-[0.6875rem] font-semibold">
                      {t.symbol}
                    </th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.6875rem] font-semibold hidden md:table-cell">
                      {t.exitPrice}
                    </th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.6875rem] font-semibold">
                      {t.pnlPct}
                    </th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.6875rem] font-semibold hidden sm:table-cell">
                      {t.pnlUsd}
                    </th>
                    <th class="px-3 py-2 text-center text-[--color-text-muted] text-[0.6875rem] font-semibold">
                      {t.result}
                    </th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.6875rem] font-semibold hidden md:table-cell">
                      {t.date}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_trades.map((trade, i) => {
                    const resultColor =
                      trade.reason === "TP"
                        ? "var(--color-accent)"
                        : trade.reason === "SL"
                          ? "var(--color-red)"
                          : "var(--color-text-muted)";
                    const tradePnlColor =
                      trade.pnl_pct >= 0
                        ? "var(--color-accent)"
                        : "var(--color-red)";
                    return (
                      <tr
                        key={i}
                        class="border-b border-[--color-border] row-hover"
                      >
                        <td class="px-3 py-2 font-semibold text-[--color-text]">
                          {trade.symbol.replace("USDT", "")}
                        </td>
                        <td class="px-3 py-2 text-right text-[--color-text-muted] hidden md:table-cell">
                          ${formatPrice(trade.exit_price)}
                        </td>
                        <td
                          class="px-3 py-2 text-right font-semibold"
                          style={{ color: tradePnlColor }}
                        >
                          {trade.pnl_pct > 0 ? "+" : ""}
                          {trade.pnl_pct.toFixed(2)}%
                        </td>
                        <td
                          class="px-3 py-2 text-right hidden sm:table-cell"
                          style={{ color: tradePnlColor }}
                        >
                          {formatUsd(trade.pnl_usd)}
                        </td>
                        <td
                          class="px-3 py-2 text-center font-semibold"
                          style={{ color: resultColor }}
                        >
                          {formatReasonLabel(trade.reason)}
                        </td>
                        <td class="px-3 py-2 text-right text-[--color-text-muted] hidden md:table-cell">
                          {formatDate(trade.closed_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p class="font-mono text-[0.6875rem] text-[--color-text-muted] leading-relaxed px-4 py-3 bg-[--color-bg-subtle] border border-[--color-border] rounded-lg">
        * {t.disclaimer}
      </p>
    </div>
  );
}
