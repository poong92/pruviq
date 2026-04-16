import { useState } from "preact/hooks";
import { winRateColor, profitFactorColor, signColor } from "../utils/format";
import { COLORS } from "./simulator-types";
import Term from "./ui/Term";
import CollapsibleSection from "./ui/CollapsibleSection";

interface ResultsData {
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  total_trades: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  avg_win_pct?: number;
  avg_loss_pct?: number;
  max_consecutive_losses?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  total_fees_pct?: number;
  total_funding_pct?: number;
  per_coin_usd?: number;
  leverage?: number;
  initial_capital_usd?: number;
  total_return_usd?: number;
  total_return_pct_portfolio?: number;
  max_drawdown_usd?: number;
  direction?: string;
  // 9.5 upgrade fields
  expectancy?: number;
  recovery_factor?: number;
  payoff_ratio?: number;
  btc_hold_return_pct?: number;
  eth_hold_return_pct?: number;
  var_95?: number;
  cvar_95?: number;
  strategy_grade?: string;
  grade_details?: string;
  warnings?: string[];
  edge_p_value?: number;
  walk_forward_consistency?: number;
  walk_forward_details?: string;
  avg_bars_held?: number;
  median_bars_held?: number;
  deflated_sharpe?: number;
  dsr_haircut_pct?: number;
  mc_p_value?: number;
  mc_percentile?: number;
  jensens_alpha?: number;
  compounding?: boolean;
  regime_performance?: {
    bull: {
      trades: number;
      win_rate: number;
      total_return: number;
      profit_factor: number;
      avg_pnl: number;
    };
    bear: {
      trades: number;
      win_rate: number;
      total_return: number;
      profit_factor: number;
      avg_pnl: number;
    };
    sideways: {
      trades: number;
      win_rate: number;
      total_return: number;
      profit_factor: number;
      avg_pnl: number;
    };
  };
}

interface ResultsCardProps {
  data: ResultsData;
  isDefault: boolean;
  lang?: "en" | "ko";
  isDemo?: boolean;
  simMode?: "quick" | "standard" | "expert";
}

const labels = {
  en: {
    live: "DEFAULT SETTINGS",
    winRate: "Win Rate",
    pf: "Profit Factor",
    totalReturn: "Total Return",
    maxDD: "Max Drawdown",
    trades: "trades simulated",
    avgWin: "Avg Win",
    avgLoss: "Avg Loss",
    maxConsec: "Max Consec. Losses",
    rr: "R:R Ratio",
    sharpe: "Sharpe",
    sortino: "Sortino",
    calmar: "Calmar",
    riskMetrics: "Risk-Adjusted",
    demoNote: "DEMO \u00B7 Pre-computed results for BB Squeeze SHORT",
    breakeven: "Break-even WR",
    margin: "Margin",
    tradingFee: "Trading Fee",
    fundingFee: "Funding Fee",
    totalCost: "Total Cost",
    feeSaveTip: "Save up to 20% on fees",
    portfolio: "Portfolio",
    initialCapital: "Initial Capital",
    totalPnlUsd: "Total PnL",
    portfolioReturn: "Portfolio Return",
    maxDdUsd: "Max DD",
    expectancy: "Expectancy",
    recoveryFactor: "Recovery Factor",
    payoffRatio: "Payoff Ratio",
    btcBenchmark: "vs BTC Hold",
    advancedMetrics: "Advanced Metrics",
    walkForward: "Walk-Forward",
    avgHold: "Avg Hold",
    medHold: "Med Hold",
    bars: "bars",
    tradeDuration: "Trade Duration",
    dirShort: "Profit from falling prices",
    dirLong: "Profit from rising prices",
    dirBoth: "Both directions tested",
    sigP001: "Statistically significant: p<0.01",
    sigP005: "Statistically significant",
    sigNot: "Not significant",
    wfStable: "Stable",
    wfModerate: "Moderate",
    wfOverfit: "Overfit risk",
    alpha: "alpha",
    underperform: "underperform",
    varDesc: "Daily max expected loss (95% confidence)",
    cvarDesc: "Expected Shortfall (avg loss beyond VaR)",
    overfitDetect: "Overfitting Detection",
    dsrConfidence: "DSR Confidence",
    dsrDesc: "Prob. Sharpe survives multi-test correction",
    mcLabel: "Monte Carlo",
    mcDescPrefix: "Top",
    mcDescSuffix: "vs random shuffle",
    jensensAlpha: "Jensen's \u03B1",
    jensensAlphaDesc: "(risk-adjusted excess vs BTC)",
    feeConsume: "Fees consume",
    feeConsumeOf: "% of returns",
    showDetails: "Show details",
    hideDetails: "Hide details",
    showAdvanced: "Show advanced metrics \u25BE",
    hideAdvanced: "Hide advanced metrics \u25B2",
    sectionTradeAnalysis: "Trade Analysis",
    sectionRiskMetrics: "Risk Metrics",
    sectionValidation: "Validation",
    gradePrefix: "Grade",
    mcBeats: (pct: number) => `Beats ${pct}% of random strategies`,
    referralCta: "Ready to trade this strategy? Save up to 20% on trading fees",
    survivorshipNote:
      "Results based on currently listed assets only. Delisted coins excluded (survivorship bias).",
  },
  ko: {
    live: "\uAE30\uBCF8 \uC124\uC815",
    winRate: "\uC2B9\uB960",
    pf: "\uC218\uC775 \uD329\uD130",
    totalReturn: "\uCD1D \uC218\uC775\uB960",
    maxDD: "\uCD5C\uB300 \uB4DC\uB85C\uB2E4\uC6B4",
    trades: "\uAC74 \uC2DC\uBBAC\uB808\uC774\uC158\uB428",
    avgWin: "\uD3C9\uADE0 \uC218\uC775",
    avgLoss: "\uD3C9\uADE0 \uC190\uC2E4",
    maxConsec: "\uCD5C\uB300 \uC5F0\uC18D \uC190\uC2E4",
    rr: "R:R \uBE44\uC728",
    sharpe: "\uC0E4\uD504",
    sortino: "\uC18C\uB974\uD2F0\uB178",
    calmar: "\uCE7C\uB9C8",
    riskMetrics: "\uB9AC\uC2A4\uD06C \uC870\uC815",
    demoNote:
      "DEMO \u00B7 BB Squeeze SHORT \uC0AC\uC804 \uACC4\uC0B0 \uACB0\uACFC",
    breakeven: "\uC190\uC775\uBD84\uAE30 \uC2B9\uB960",
    margin: "\uC5EC\uC720",
    tradingFee: "\uAC70\uB798 \uC218\uC218\uB8CC",
    fundingFee: "\uD380\uB529 \uC218\uC218\uB8CC",
    totalCost: "\uCD1D \uBE44\uC6A9",
    feeSaveTip: "\uC218\uC218\uB8CC \uCD5C\uB300 20% \uC808\uAC10",
    portfolio: "\uD3EC\uD2B8\uD3F4\uB9AC\uC624",
    initialCapital: "\uCD08\uAE30 \uC790\uBCF8",
    totalPnlUsd: "\uCD1D \uC190\uC775",
    portfolioReturn: "\uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC218\uC775\uB960",
    maxDdUsd: "\uCD5C\uB300 \uB099\uD3ED",
    expectancy: "\uAE30\uB300\uAC12",
    recoveryFactor: "\uD68C\uBCF5 \uD329\uD130",
    payoffRatio: "\uBCF4\uC0C1 \uBE44\uC728",
    btcBenchmark: "BTC \uBCF4\uC720 \uB300\uBE44",
    advancedMetrics: "\uACE0\uAE09 \uC9C0\uD45C",
    walkForward: "\uC6CC\uD06C\uD3EC\uC6CC\uB4DC",
    avgHold: "\uD3C9\uADE0 \uBCF4\uC720",
    medHold: "\uC911\uAC04\uAC12 \uBCF4\uC720",
    bars: "\uBD09",
    tradeDuration: "\uBCF4\uC720 \uAE30\uAC04",
    dirShort: "\uD558\uB77D \uC2DC \uC218\uC775",
    dirLong: "\uC0C1\uC2B9 \uC2DC \uC218\uC775",
    dirBoth: "\uB450 \uBC29\uD5A5 \uB3D9\uC2DC \uD14C\uC2A4\uD2B8",
    sigP001: "\uD1B5\uACC4\uC801 \uC720\uC758: p<0.01",
    sigP005: "\uD1B5\uACC4\uC801 \uC720\uC758",
    sigNot: "\uC720\uC758\uD558\uC9C0 \uC54A\uC74C",
    wfStable: "\uC548\uC815\uC801",
    wfModerate: "\uBCF4\uD1B5",
    wfOverfit: "\uACFC\uC801\uD569 \uC704\uD5D8",
    alpha: "\uCD08\uACFC",
    underperform: "\uBD80\uC871",
    varDesc:
      "\uC77C\uBCC4 \uCD5C\uB300 \uC608\uC0C1 \uC190\uC2E4 (95% \uC2E0\uB8B0\uB3C4)",
    cvarDesc:
      "\uAF2C\uB9AC \uB9AC\uC2A4\uD06C \uD3C9\uADE0 (VaR \uCD08\uACFC \uC2DC \uD3C9\uADE0 \uC190\uC2E4)",
    overfitDetect: "\uACFC\uC801\uD569 \uD0D0\uC9C0",
    dsrConfidence: "DSR \uC2E0\uB8B0\uB3C4",
    dsrDesc:
      "Sharpe\uAC00 \uB370\uC774\uD130\uB9C8\uC774\uB2DD \uC544\uB2D0 \uD655\uB960",
    mcLabel: "MC \uAC80\uC99D",
    mcDescPrefix: "\uC0C1\uC704",
    mcDescSuffix: "(\uB79C\uB364 \uC154\uD50C \uB300\uBE44)",
    jensensAlpha: "\uC824\uC13C \uC54C\uD30C",
    jensensAlphaDesc:
      "(BTC \uB300\uBE44 \uB9AC\uC2A4\uD06C \uC870\uC815 \uCD08\uACFC\uC218\uC775)",
    feeConsume: "\uC218\uC218\uB8CC\uAC00 \uC218\uC775\uC758",
    feeConsumeOf: "%\uB97C \uCC28\uC9C0\uD569\uB2C8\uB2E4",
    showDetails: "\uC0C1\uC138 \uBCF4\uAE30",
    hideDetails: "\uC811\uAE30",
    showAdvanced: "\uACE0\uAE09 \uC9C0\uD45C \uBCF4\uAE30 \u25BE",
    hideAdvanced: "\uC811\uAE30 \u25B2",
    sectionTradeAnalysis: "\uAC70\uB798 \uBD84\uC11D",
    sectionRiskMetrics: "\uB9AC\uC2A4\uD06C \uC9C0\uD45C",
    sectionValidation: "\uAC80\uC99D",
    gradePrefix: "\uB4F1\uAE09",
    mcBeats: (pct: number) =>
      `\uB79C\uB364 \uC804\uB7B5 \uC911 \uC0C1\uC704 ${(100 - pct).toFixed(0)}%`,
    referralCta:
      "\uC774 \uC804\uB7B5\uC73C\uB85C \uAC70\uB798 \uC900\uBE44\uB410\uB098\uC694? \uAC70\uB798 \uC218\uC218\uB8CC \uCD5C\uB300 20% \uC808\uC57D",
    survivorshipNote:
      "\uD604\uC7AC \uC0C1\uC7A5\uB41C \uC790\uC0B0\uB9CC \uD14C\uC2A4\uD2B8\uB429\uB2C8\uB2E4. \uC0C1\uD3D0 \uCF54\uC778 \uC81C\uC678 (\uC0DD\uC874 \uD3B8\uD5A5).",
  },
};

function MetricBox({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: string;
  color: string;
  description?: string;
}) {
  return (
    <div
      class="p-3 rounded-lg bg-[--color-bg-card] relative"
      style="box-shadow: var(--shadow-card);"
    >
      <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1 flex items-center gap-1">
        {label}
        {description && (
          <span class="relative group/tip inline-flex">
            <span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[--color-text-muted]/30 text-[8px] text-[--color-text-muted] cursor-help shrink-0 group-hover/tip:border-[--color-accent] group-hover/tip:text-[--color-accent] transition-colors">
              ?
            </span>
            <span class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 px-2.5 py-1.5 rounded bg-[--color-bg-card] border border-[--color-border] text-[9px] text-[--color-text-muted] normal-case tracking-normal leading-snug opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              {description}
            </span>
          </span>
        )}
      </div>
      <div class="font-mono text-lg md:text-xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

const metricDescriptions = {
  en: {
    winRate:
      "Percentage of profitable trades. Context matters \u2014 high WR with low R:R can still lose.",
    pf: "Gross profit / gross loss. >1.5 is good, >2.0 is excellent.",
    totalReturn: "Cumulative percentage return over the test period",
    maxDD:
      "Largest peak-to-trough decline. Lower is better. Shows worst-case scenario.",
    avgWin: "Average percentage gain on winning trades",
    avgLoss: "Average percentage loss on losing trades",
    rr: "Risk-Reward ratio \u2014 average win divided by average loss",
    maxConsec: "Longest streak of consecutive losing trades",
    sharpe:
      "Risk-adjusted return. Higher is better. >1 is good, >2 is excellent.",
    sortino:
      "Like Sharpe but only penalizes downside volatility. Higher is better.",
    calmar:
      "Annual return / max drawdown. Higher means better risk-adjusted performance.",
    breakeven:
      "Minimum win rate needed to break even, given the average win/loss sizes",
    margin: "How far above the break-even win rate the actual win rate is",
    expectancy:
      "Expected profit per trade (WR \u00D7 AvgWin + (1-WR) \u00D7 AvgLoss). Positive = edge exists",
    recoveryFactor:
      "Total return / max drawdown. > 3.0 is excellent, > 1.5 is acceptable",
    payoffRatio:
      "Average win / average loss. > 1.0 means wins are bigger than losses",
  },
  ko: {
    winRate:
      "\uC218\uC775 \uAC70\uB798 \uBE44\uC728. \uB9E5\uB77D\uC774 \uC911\uC694 \u2014 \uB192\uC740 \uC2B9\uB960\uC774\uB77C\uB3C4 R:R\uC774 \uB0AE\uC73C\uBA74 \uC190\uC2E4 \uAC00\uB2A5.",
    pf: "\uCD1D \uC774\uC775 / \uCD1D \uC190\uC2E4. 1.5 \uC774\uC0C1 \uC591\uD638, 2.0 \uC774\uC0C1 \uC6B0\uC218.",
    totalReturn:
      "\uD14C\uC2A4\uD2B8 \uAE30\uAC04 \uB3D9\uC548\uC758 \uB204\uC801 \uC218\uC775\uB960",
    maxDD:
      "\uCD5C\uACE0\uC810 \uB300\uBE44 \uCD5C\uB300 \uD558\uB77D\uD3ED. \uB0AE\uC744\uC218\uB85D \uC88B\uC74C. \uCD5C\uC545\uC758 \uC2DC\uB098\uB9AC\uC624.",
    avgWin: "\uC218\uC775 \uAC70\uB798\uC758 \uD3C9\uADE0 \uC218\uC775\uB960",
    avgLoss: "\uC190\uC2E4 \uAC70\uB798\uC758 \uD3C9\uADE0 \uC190\uC2E4\uB960",
    rr: "\uB9AC\uC2A4\uD06C-\uBCF4\uC0C1 \uBE44\uC728 \u2014 \uD3C9\uADE0 \uC218\uC775 / \uD3C9\uADE0 \uC190\uC2E4",
    maxConsec:
      "\uAC00\uC7A5 \uAE34 \uC5F0\uC18D \uC190\uC2E4 \uAC70\uB798 \uC218",
    sharpe:
      "\uC704\uD5D8 \uC870\uC815 \uC218\uC775\uB960. \uB192\uC744\uC218\uB85D \uC88B\uC74C. 1 \uC774\uC0C1 \uC591\uD638, 2 \uC774\uC0C1 \uC6B0\uC218.",
    sortino:
      "\uD558\uBC29 \uBCC0\uB3D9\uC131\uB9CC \uBC18\uC601\uD55C \uC0E4\uD504 \uBE44\uC728. \uB192\uC744\uC218\uB85D \uC88B\uC74C.",
    calmar:
      "\uC5F0\uAC04 \uC218\uC775\uB960 / \uCD5C\uB300 \uB099\uD3ED. \uB192\uC744\uC218\uB85D \uC704\uD5D8 \uB300\uBE44 \uC218\uC775\uC774 \uC88B\uC74C.",
    breakeven:
      "\uD3C9\uADE0 \uC190\uC775 \uADDC\uBAA8 \uAE30\uC900 \uC190\uC775\uBD84\uAE30\uC5D0 \uD544\uC694\uD55C \uCD5C\uC18C \uC2B9\uB960",
    margin:
      "\uC2E4\uC81C \uC2B9\uB960\uC774 \uC190\uC775\uBD84\uAE30 \uC2B9\uB960\uBCF4\uB2E4 \uC5BC\uB9C8\uB098 \uB192\uC740\uC9C0",
    expectancy:
      "\uAC70\uB798\uB2F9 \uAE30\uB300 \uC218\uC775 (\uC2B9\uB960 \u00D7 \uD3C9\uADE0\uC218\uC775 + (1-\uC2B9\uB960) \u00D7 \uD3C9\uADE0\uC190\uC2E4). \uC591\uC218 = \uC6B0\uC704 \uC874\uC7AC",
    recoveryFactor:
      "\uCD1D \uC218\uC775 / \uCD5C\uB300 \uB4DC\uB85C\uB2E4\uC6B4. > 3.0 \uC6B0\uC218, > 1.5 \uC591\uD638",
    payoffRatio:
      "\uD3C9\uADE0 \uC218\uC775 / \uD3C9\uADE0 \uC190\uC2E4. > 1.0\uC774\uBA74 \uC218\uC775\uC774 \uC190\uC2E4\uBCF4\uB2E4 \uD07C",
  },
} as const;

export default function ResultsCard({
  data,
  isDefault,
  lang = "en",
  isDemo = false,
  simMode = "expert",
}: ResultsCardProps) {
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  // 3-tier metric visibility: quick → standard → expert
  const isQuick = simMode === "quick" && !showAllMetrics;
  const isStandard = simMode === "standard" && !showAllMetrics;
  const hideExpert = isStandard;
  const t = labels[lang] || labels.en;
  const desc = metricDescriptions[lang] || metricDescriptions.en;
  const total = data.tp_count + data.sl_count + data.timeout_count;
  const tpPct = total > 0 ? (data.tp_count / total) * 100 : 0;
  const slPct = total > 0 ? (data.sl_count / total) * 100 : 0;
  const toPct = total > 0 ? (data.timeout_count / total) * 100 : 0;

  // Break-even win rate: |avgLoss| / (|avgWin| + |avgLoss|)
  const avgWin = Math.abs(data.avg_win_pct ?? 0);
  const avgLoss = Math.abs(data.avg_loss_pct ?? 0);
  const hasBreakeven =
    data.avg_win_pct !== undefined &&
    data.avg_loss_pct !== undefined &&
    avgLoss > 0 &&
    avgWin > 0;
  const breakevenWR = hasBreakeven ? (avgLoss / (avgWin + avgLoss)) * 100 : 0;
  const wrMargin = data.win_rate - breakevenWR;

  // Fee breakdown
  const tradingFee = data.total_fees_pct ?? 0;
  const fundingFee = data.total_funding_pct ?? 0;
  const totalCost = tradingFee + fundingFee;
  const hasFees = tradingFee > 0 || fundingFee > 0;

  return (
    <div>
      {isDefault && (
        <div class="font-mono text-[0.625rem] text-[--color-accent] tracking-widest mb-3 uppercase">
          {t.live}
        </div>
      )}

      {isDemo && (
        <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-yellow]/10 border border-[--color-yellow]/20">
          <span class="font-mono text-xs text-[--color-yellow]">
            {t.demoNote}
          </span>
        </div>
      )}

      {/* Direction badge */}
      {data.direction && (
        <div class="mb-2 flex items-center gap-2">
          <span
            class={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              data.direction === "short"
                ? "text-[--color-red] border-[--color-red]/30 bg-[--color-red]/10"
                : data.direction === "long"
                  ? "text-[--color-green] border-[--color-green]/30 bg-[--color-green]/10"
                  : "border-[--color-accent]/30 bg-[--color-accent]/10"
            }`}
            style={
              data.direction === "both" ? { color: COLORS.accent } : undefined
            }
          >
            {data.direction === "both"
              ? "SHORT + LONG"
              : data.direction.toUpperCase()}
          </span>
          <span class="text-[9px] text-[--color-text-muted] font-mono">
            {data.direction === "short"
              ? t.dirShort
              : data.direction === "long"
                ? t.dirLong
                : t.dirBoth}
          </span>
        </div>
      )}

      {/* Strategy Grade */}
      {data.strategy_grade && (
        <div
          class={`mb-3 flex items-center gap-3 px-3 py-2 rounded-lg border ${
            data.strategy_grade === "A"
              ? "border-[--color-green]/30 bg-[--color-green]/5"
              : data.strategy_grade === "B"
                ? "border-[--color-accent]/30 bg-[--color-accent]/5"
                : data.strategy_grade === "C"
                  ? "border-[--color-yellow]/30 bg-[--color-yellow]/5"
                  : "border-[--color-red]/30 bg-[--color-red]/5"
          }`}
        >
          <span
            class={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-mono text-xl font-black border-2 shadow-sm shrink-0 ${
              data.strategy_grade === "A"
                ? "text-[--color-green] border-[--color-green]/40 bg-[--color-green]/10"
                : data.strategy_grade === "B"
                  ? "text-[--color-accent] border-[--color-accent]/40 bg-[--color-accent]/10"
                  : data.strategy_grade === "C"
                    ? "text-[--color-yellow] border-[--color-yellow]/40 bg-[--color-yellow]/10"
                    : "text-[--color-red] border-[--color-red]/40 bg-[--color-red]/10"
            }`}
          >
            {data.strategy_grade}
          </span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span
              class={`font-mono text-xs font-bold ${
                data.strategy_grade === "A"
                  ? "text-[--color-green]"
                  : data.strategy_grade === "B"
                    ? "text-[--color-accent]"
                    : data.strategy_grade === "C"
                      ? "text-[--color-yellow]"
                      : "text-[--color-red]"
              }`}
            >
              {`${t.gradePrefix} ${data.strategy_grade}`}
            </span>
            {data.grade_details && (
              <span class="font-mono text-[10px] text-[--color-text-muted]">
                {data.grade_details}
              </span>
            )}
            {data.edge_p_value !== undefined && data.edge_p_value < 1 && (
              <span
                class="font-mono text-[10px]"
                style={{
                  color:
                    data.edge_p_value <= 0.05
                      ? "var(--color-green)"
                      : data.edge_p_value <= 0.1
                        ? "var(--color-yellow)"
                        : "var(--color-red)",
                }}
              >
                {data.edge_p_value <= 0.01
                  ? t.sigP001
                  : data.edge_p_value <= 0.05
                    ? `${t.sigP005}: p=${data.edge_p_value.toFixed(3)}`
                    : `${t.sigNot}: p=${data.edge_p_value.toFixed(3)}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Walk-Forward Consistency */}
      {data.walk_forward_consistency != null &&
        data.walk_forward_consistency > 0 && (
          <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border] flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10px] text-[--color-text-muted] uppercase">
                {t.walkForward}
              </span>
              <span
                class={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  data.walk_forward_consistency >= 0.85
                    ? "text-[--color-green] bg-[--color-green]/10"
                    : data.walk_forward_consistency >= 0.7
                      ? "text-[--color-accent] bg-[--color-accent]/10"
                      : "text-[--color-red] bg-[--color-red]/10"
                }`}
              >
                {data.walk_forward_consistency.toFixed(2)}
              </span>
              <span
                class="font-mono text-[10px]"
                style={{
                  color:
                    data.walk_forward_consistency >= 0.85
                      ? "var(--color-green)"
                      : data.walk_forward_consistency >= 0.7
                        ? "var(--color-accent)"
                        : "var(--color-red)",
                }}
              >
                {data.walk_forward_consistency >= 0.85
                  ? t.wfStable
                  : data.walk_forward_consistency >= 0.7
                    ? t.wfModerate
                    : t.wfOverfit}
              </span>
            </div>
            {data.walk_forward_details && (
              <span class="font-mono text-[9px] text-[--color-text-muted] hidden md:inline">
                {data.walk_forward_details}
              </span>
            )}
          </div>
        )}

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div class="mb-3 space-y-1">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              class="px-3 py-2 rounded-lg bg-[--color-yellow]/8 border border-[--color-yellow]/20 font-mono text-[11px] text-[--color-yellow]"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ── Always visible: BTC Benchmark (compact inline) ── */}
      {data.btc_hold_return_pct !== undefined &&
        data.btc_hold_return_pct !== 0 && (
          <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
              <span class="text-[10px] text-[--color-text-muted] uppercase">
                {t.btcBenchmark}:
              </span>
              <span class="text-[--color-text-muted]">
                BTC:{" "}
                <span style={{ color: signColor(data.btc_hold_return_pct) }}>
                  {data.btc_hold_return_pct > 0 ? "+" : ""}
                  {data.btc_hold_return_pct.toFixed(1)}%
                </span>
              </span>
              {data.eth_hold_return_pct !== undefined &&
                data.eth_hold_return_pct !== 0 && (
                  <span class="text-[--color-text-muted]">
                    ETH:{" "}
                    <span
                      style={{ color: signColor(data.eth_hold_return_pct) }}
                    >
                      {data.eth_hold_return_pct > 0 ? "+" : ""}
                      {data.eth_hold_return_pct.toFixed(1)}%
                    </span>
                  </span>
                )}
              <span
                style={{
                  color:
                    data.total_return_pct - data.btc_hold_return_pct >= 0
                      ? "var(--color-green)"
                      : "var(--color-red)",
                }}
                class="font-bold"
              >
                {data.total_return_pct - data.btc_hold_return_pct >= 0
                  ? "+"
                  : ""}
                {(data.total_return_pct - data.btc_hold_return_pct).toFixed(1)}
                %p{" "}
                {data.total_return_pct - data.btc_hold_return_pct >= 0
                  ? t.alpha
                  : t.underperform}
              </span>
            </div>
          </div>
        )}

      {/* ── Always visible: Portfolio USD (compact) ── */}
      {data.initial_capital_usd != null && data.initial_capital_usd > 0 && (
        <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
          <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1.5">
            {t.portfolio} — ${data.per_coin_usd ?? 60} x {data.leverage ?? 5}x
            {data.compounding && (
              <span class="ml-1.5 text-[--color-accent] font-bold normal-case">
                COMPOUND
              </span>
            )}
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
            <div>
              <div class="text-[10px] text-[--color-text-muted]">
                {t.initialCapital}
              </div>
              <div class="font-bold">
                ${(data.initial_capital_usd ?? 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">
                {t.totalPnlUsd}
              </div>
              <div
                class="font-bold"
                style={{ color: signColor(data.total_return_usd ?? 0) }}
              >
                {(data.total_return_usd ?? 0) > 0 ? "+" : ""}$
                {(data.total_return_usd ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">
                {t.portfolioReturn}
              </div>
              <div
                class="font-bold"
                style={{
                  color: signColor(data.total_return_pct_portfolio ?? 0),
                }}
              >
                {(data.total_return_pct_portfolio ?? 0) > 0 ? "+" : ""}
                {(data.total_return_pct_portfolio ?? 0).toFixed(1)}%
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">
                {t.maxDdUsd}
              </div>
              <div class="font-bold" style={{ color: "var(--color-red)" }}>
                $
                {(data.max_drawdown_usd ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Always visible: Trade summary (compact) ── */}
      <div class="flex items-center justify-between font-mono text-xs text-[--color-text-muted] mb-1">
        <span>
          {data.total_trades.toLocaleString()} {t.trades}
        </span>
        {data.avg_bars_held != null && data.avg_bars_held > 0 && (
          <span class="text-[10px]">
            {t.avgHold}: {data.avg_bars_held}h · {t.medHold}:{" "}
            {data.median_bars_held ?? 0}h
          </span>
        )}
      </div>

      {/* Exit reason bar */}
      <div class="mb-1">
        <div class="flex h-1.5 rounded-full overflow-hidden bg-[--color-border]">
          <div
            class="bg-[--color-accent] transition-[width] duration-300"
            style={{ width: `${tpPct}%` }}
          />
          <div
            class="bg-[--color-red] transition-[width] duration-300"
            style={{ width: `${slPct}%` }}
          />
          <div
            class="bg-[--color-text-muted] transition-[width] duration-300"
            style={{ width: `${toPct}%` }}
          />
        </div>
      </div>

      <div class="flex gap-4 font-mono text-[0.625rem] mb-3">
        <span class="text-[--color-accent]">
          <Term abbr="TP" lang={lang} /> {tpPct.toFixed(0)}%
        </span>
        <span class="text-[--color-red]">
          <Term abbr="SL" lang={lang} /> {slPct.toFixed(0)}%
        </span>
        <span class="text-[--color-text-muted]">TO {toPct.toFixed(0)}%</span>
      </div>

      {/* Quick / Standard mode: "Show advanced metrics" toggle */}
      {(simMode === "quick" || simMode === "standard") && !showAllMetrics && (
        <button
          onClick={() => setShowAllMetrics(true)}
          class="w-full py-2 mb-3 rounded-lg border border-[--color-border] font-mono text-xs text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent] transition-colors"
        >
          {t.showAdvanced}
        </button>
      )}

      {/* ══════════════════════════════════════════════════════
           Collapsible Section 1: Trade Analysis
           ══════════════════════════════════════════════════════ */}
      {!isQuick &&
        (data.avg_win_pct !== undefined || data.avg_loss_pct !== undefined) && (
          <CollapsibleSection
            title={t.sectionTradeAnalysis}
            defaultOpen={true}
            badge={
              hasBreakeven
                ? `${t.margin} ${wrMargin > 0 ? "+" : ""}${wrMargin.toFixed(1)}%p`
                : undefined
            }
            badgeColor={
              wrMargin > 0 ? "var(--color-green)" : "var(--color-red)"
            }
          >
            {/* Break-even win rate */}
            {hasBreakeven && (
              <div class="flex gap-3 text-[10px] font-mono text-[--color-text-muted] mb-2">
                <span title={desc.breakeven}>
                  {t.breakeven}: {breakevenWR.toFixed(1)}%
                </span>
              </div>
            )}

            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricBox
                label={t.avgWin}
                value={`+${(data.avg_win_pct ?? 0).toFixed(2)}%`}
                color="var(--color-accent)"
                description={desc.avgWin}
              />
              <MetricBox
                label={t.avgLoss}
                value={`${(data.avg_loss_pct ?? 0).toFixed(2)}%`}
                color="var(--color-red)"
                description={desc.avgLoss}
              />
              <MetricBox
                label={t.rr}
                value={
                  data.avg_loss_pct && data.avg_loss_pct !== 0
                    ? `1:${(Math.abs(data.avg_win_pct ?? 0) / Math.abs(data.avg_loss_pct)).toFixed(2)}`
                    : "N/A"
                }
                color={
                  (data.avg_win_pct ?? 0) / Math.abs(data.avg_loss_pct ?? 1) >=
                  1
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)"
                }
                description={desc.rr}
              />
              <MetricBox
                label={t.maxConsec}
                value={`${data.max_consecutive_losses ?? 0}`}
                color="var(--color-text-muted)"
                description={desc.maxConsec}
              />
            </div>

            {/* Fee breakdown */}
            {hasFees && (
              <div class="mt-2 pt-2 border-t border-[--color-border]">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider">
                    {t.totalCost}
                  </span>
                  <a
                    href="/fees"
                    class="text-[10px] font-mono text-[--color-accent] hover:underline"
                  >
                    {t.feeSaveTip} &rarr;
                  </a>
                </div>
                <div class="flex gap-4 font-mono text-xs">
                  <span class="text-[--color-text-muted]">
                    {t.tradingFee}:{" "}
                    <span class="text-[--color-red]">
                      {tradingFee.toFixed(1)}%
                    </span>
                  </span>
                  {fundingFee > 0 && (
                    <span class="text-[--color-text-muted]">
                      {t.fundingFee}:{" "}
                      <span class="text-[--color-red]">
                        {fundingFee.toFixed(1)}%
                      </span>
                    </span>
                  )}
                  <span class="text-[--color-text-muted]">
                    {t.totalCost}:{" "}
                    <span class="text-[--color-red] font-bold">
                      {totalCost.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div class="mt-1.5 h-1 rounded-full overflow-hidden bg-[--color-border]">
                  <div
                    class="h-full bg-[--color-red]/60 transition-[width] duration-300"
                    style={{
                      width: `${Math.min((totalCost / Math.abs(data.total_return_pct || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div class="mt-1 text-[10px] font-mono text-[--color-text-muted] opacity-60">
                  {`${t.feeConsume} ${data.total_return_pct !== 0 ? Math.abs((totalCost / data.total_return_pct) * 100).toFixed(0) : "\u2014"}${t.feeConsumeOf}`}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

      {/* ══════════════════════════════════════════════════════
           Collapsible Section 2: Risk Metrics
           ══════════════════════════════════════════════════════ */}
      {!isQuick &&
        data.sharpe_ratio !== undefined &&
        data.sharpe_ratio !== 0 && (
          <CollapsibleSection
            title={t.sectionRiskMetrics}
            defaultOpen={false}
            badge={`Sharpe ${(data.sharpe_ratio ?? 0).toFixed(2)}`}
            badgeColor={
              (data.sharpe_ratio ?? 0) > 1
                ? "var(--color-green)"
                : "var(--color-text-muted)"
            }
          >
            <div class="grid grid-cols-3 gap-2 mb-2">
              <MetricBox
                label={t.sharpe}
                value={`${(data.sharpe_ratio ?? 0).toFixed(2)}`}
                color={
                  (data.sharpe_ratio ?? 0) > 1
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)"
                }
                description={desc.sharpe}
              />
              <MetricBox
                label={t.sortino}
                value={`${(data.sortino_ratio ?? 0).toFixed(2)}`}
                color={
                  (data.sortino_ratio ?? 0) > 1.5
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)"
                }
                description={desc.sortino}
              />
              <MetricBox
                label={t.calmar}
                value={`${(data.calmar_ratio ?? 0).toFixed(2)}`}
                color={
                  (data.calmar_ratio ?? 0) > 1
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)"
                }
                description={desc.calmar}
              />
            </div>

            {/* VaR / CVaR */}
            {data.var_95 !== undefined && data.var_95 !== 0 && (
              <div class="grid grid-cols-2 gap-2 mb-2">
                <MetricBox
                  label="VaR 95%"
                  value={`${data.var_95.toFixed(2)}%`}
                  color="var(--color-red)"
                  description={t.varDesc}
                />
                <MetricBox
                  label="CVaR 95%"
                  value={`${(data.cvar_95 ?? 0).toFixed(2)}%`}
                  color="var(--color-red)"
                  description={t.cvarDesc}
                />
              </div>
            )}

            {/* Expectancy, Recovery Factor, Payoff Ratio */}
            {data.expectancy !== undefined && data.expectancy !== 0 && (
              <div class="grid grid-cols-3 gap-2">
                <MetricBox
                  label={t.expectancy}
                  value={`${data.expectancy > 0 ? "+" : ""}${data.expectancy.toFixed(3)}%`}
                  color={
                    data.expectancy > 0
                      ? "var(--color-accent)"
                      : "var(--color-red)"
                  }
                  description={desc.expectancy}
                />
                <MetricBox
                  label={t.recoveryFactor}
                  value={`${(data.recovery_factor ?? 0).toFixed(2)}`}
                  color={
                    (data.recovery_factor ?? 0) >= 3
                      ? "var(--color-accent)"
                      : (data.recovery_factor ?? 0) >= 1.5
                        ? "var(--color-text)"
                        : "var(--color-red)"
                  }
                  description={desc.recoveryFactor}
                />
                <MetricBox
                  label={t.payoffRatio}
                  value={`${(data.payoff_ratio ?? 0).toFixed(2)}`}
                  color={
                    (data.payoff_ratio ?? 0) >= 1
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)"
                  }
                  description={desc.payoffRatio}
                />
              </div>
            )}
          </CollapsibleSection>
        )}

      {/* ══════════════════════════════════════════════════════
           Collapsible Section 2b: Market Regime Performance
           ══════════════════════════════════════════════════════ */}
      {!isQuick && data.regime_performance && (
        <CollapsibleSection
          title={
            t.sectionRegime ??
            (lang === "ko" ? "시장 환경별 성과" : "Market Regime Performance")
          }
          defaultOpen={false}
          badge={
            data.regime_performance.bear.trades > 0
              ? `Bear ${data.regime_performance.bear.win_rate.toFixed(0)}% WR`
              : undefined
          }
          badgeColor={
            data.regime_performance.bear.win_rate >= 50
              ? "var(--color-green)"
              : "var(--color-red)"
          }
        >
          <div class="text-[10px] font-mono text-[--color-text-muted] mb-2 opacity-70">
            {lang === "ko"
              ? "BTC SMA20/50 기준 시장 국면 분류 · 전략의 환경별 강점 파악"
              : "Market phase by BTC SMA20/SMA50 · Identifies where your strategy thrives"}
          </div>
          <div class="grid grid-cols-3 gap-2">
            {(["bull", "bear", "sideways"] as const).map((regime) => {
              const rm = data.regime_performance![regime];
              const label =
                regime === "bull"
                  ? lang === "ko"
                    ? "🟢 상승장"
                    : "🟢 Bull"
                  : regime === "bear"
                    ? lang === "ko"
                      ? "🔴 하락장"
                      : "🔴 Bear"
                    : lang === "ko"
                      ? "⚪ 횡보장"
                      : "⚪ Sideways";
              const wr = rm.win_rate;
              const ret = rm.total_return;
              const wrColor =
                wr >= 60
                  ? "var(--color-green)"
                  : wr >= 45
                    ? "var(--color-text)"
                    : "var(--color-red)";
              return (
                <div
                  key={regime}
                  class="rounded-lg border border-[--color-border] p-2 text-center"
                  style={{
                    background:
                      regime === "bull"
                        ? "rgba(0,192,115,0.05)"
                        : regime === "bear"
                          ? "rgba(240,66,81,0.05)"
                          : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div class="text-[10px] font-mono text-[--color-text-muted] mb-1">
                    {label}
                  </div>
                  {rm.trades === 0 ? (
                    <div class="text-[10px] text-[--color-text-muted] opacity-50">
                      {lang === "ko" ? "거래 없음" : "No trades"}
                    </div>
                  ) : (
                    <>
                      <div
                        class="text-sm font-bold font-mono"
                        style={{ color: wrColor }}
                      >
                        {wr.toFixed(0)}%
                      </div>
                      <div class="text-[9px] text-[--color-text-muted] font-mono">
                        {lang === "ko" ? "승률" : "WR"}
                      </div>
                      <div
                        class="text-[10px] font-mono mt-1"
                        style={{
                          color:
                            ret >= 0
                              ? "var(--color-green)"
                              : "var(--color-red)",
                        }}
                      >
                        {ret >= 0 ? "+" : ""}
                        {ret.toFixed(1)}%
                      </div>
                      <div class="text-[9px] text-[--color-text-muted] font-mono">
                        {rm.trades}
                        {lang === "ko" ? "건" : " trades"}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════
           Collapsible Section 3: Validation (expert only)
           ══════════════════════════════════════════════════════ */}
      {!isQuick &&
        !hideExpert &&
        data.deflated_sharpe !== undefined &&
        data.deflated_sharpe !== 0 && (
          <CollapsibleSection
            title={t.sectionValidation}
            defaultOpen={false}
            badge={
              data.mc_percentile != null
                ? `MC ${data.mc_percentile}%`
                : undefined
            }
            badgeColor={
              (data.mc_percentile ?? 0) >= 90
                ? "var(--color-green)"
                : (data.mc_percentile ?? 0) >= 75
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)"
            }
          >
            <div class="font-mono text-[10px] text-[--color-text-muted] uppercase mb-2">
              {t.overfitDetect}
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <MetricBox
                label={t.dsrConfidence}
                value={`${(data.deflated_sharpe * 100).toFixed(0)}%`}
                color={
                  data.deflated_sharpe > 0.8
                    ? "var(--color-green)"
                    : data.deflated_sharpe > 0.5
                      ? "var(--color-accent)"
                      : "var(--color-red)"
                }
                description={t.dsrDesc}
              />
              <MetricBox
                label={t.mcLabel}
                value={`p=${(data.mc_p_value ?? 1).toFixed(3)}`}
                color={
                  (data.mc_p_value ?? 1) < 0.05
                    ? "var(--color-green)"
                    : (data.mc_p_value ?? 1) < 0.1
                      ? "var(--color-accent)"
                      : "var(--color-red)"
                }
                description={`${t.mcDescPrefix} ${(100 - (data.mc_percentile ?? 50)).toFixed(0)}% ${t.mcDescSuffix}`}
              />
            </div>
            {/* Monte Carlo percentile gauge */}
            {data.mc_percentile != null && (
              <div class="mt-2 mb-1">
                <div class="flex items-center justify-between font-mono text-[10px] text-[--color-text-muted] mb-1">
                  <span>{t.mcBeats(data.mc_percentile)}</span>
                  <span
                    style={{
                      color:
                        data.mc_percentile >= 90
                          ? "var(--color-green)"
                          : data.mc_percentile >= 75
                            ? "var(--color-accent)"
                            : "var(--color-text-muted)",
                    }}
                    class="font-bold"
                  >
                    {data.mc_percentile}%
                  </span>
                </div>
                <div
                  class="h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--color-border)" }}
                >
                  <div
                    class="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${data.mc_percentile}%`,
                      background:
                        data.mc_percentile >= 90
                          ? "var(--color-green)"
                          : data.mc_percentile >= 75
                            ? "var(--color-accent)"
                            : "var(--color-text-muted)",
                    }}
                  />
                </div>
              </div>
            )}
            {data.jensens_alpha !== undefined && data.jensens_alpha !== 0 && (
              <div class="flex items-center gap-2 font-mono text-xs">
                <span class="text-[--color-text-muted]">{t.jensensAlpha}:</span>
                <span
                  style={{
                    color:
                      data.jensens_alpha > 0
                        ? "var(--color-green)"
                        : "var(--color-red)",
                  }}
                  class="font-bold"
                >
                  {data.jensens_alpha > 0 ? "+" : ""}
                  {data.jensens_alpha.toFixed(2)}%
                </span>
                <span class="text-[9px] text-[--color-text-muted]">
                  {t.jensensAlphaDesc}
                </span>
              </div>
            )}
          </CollapsibleSection>
        )}

      {/* Quick / Standard mode: collapse toggle when expanded */}
      {(simMode === "quick" || simMode === "standard") && showAllMetrics && (
        <button
          onClick={() => setShowAllMetrics(false)}
          class="w-full py-2 mb-3 rounded-lg border border-[--color-border] font-mono text-xs text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent] transition-colors"
        >
          {t.hideAdvanced}
        </button>
      )}

      {/* Referral CTA banner */}
      <a
        href="/fees"
        class="mt-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-[--color-yellow]/40 bg-[--color-yellow]/5 hover:border-[--color-yellow]/70 hover:bg-[--color-yellow]/10 transition-colors no-underline group"
      >
        <span class="font-mono text-[11px] text-[--color-yellow] group-hover:text-[--color-yellow]">
          {t.referralCta}
        </span>
        <span class="font-mono text-[11px] text-[--color-yellow] shrink-0">
          &rarr;
        </span>
      </a>

      <p
        class="text-[9px] mt-2"
        style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
      >
        {t.survivorshipNote}
      </p>
      <p
        class="text-[9px] mt-1"
        style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
      >
        {lang === "ko"
          ? "과거 시뮬레이션 결과는 미래 수익을 보장하지 않습니다. 실제 거래 전 충분한 검토가 필요합니다."
          : "Past simulation results do not guarantee future returns. This is not financial advice."}
      </p>
    </div>
  );
}
