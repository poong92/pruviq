import { useState, useCallback } from "preact/hooks";
import { winRateColor, profitFactorColor, signColor } from "../utils/format";
import { COLORS } from "./simulator-types";

// Inline tooltip abbreviation component (QW2)
const termDefs: Record<string, { en: string; ko: string }> = {
  SL: {
    en: "Stop Loss: Exit when loss reaches X%",
    ko: "손절: 손실이 X%에 달하면 포지션 청산",
  },
  TP: {
    en: "Take Profit: Exit when gain reaches X%",
    ko: "익절: 수익이 X%에 달하면 포지션 청산",
  },
  PF: {
    en: "Profit Factor: Gross profit / Gross loss (>1.5 is good)",
    ko: "수익 팩터: 총 이익 / 총 손실 (1.5 이상 양호)",
  },
  MDD: {
    en: "Max Drawdown: Largest peak-to-trough decline",
    ko: "최대 드로다운: 최고점 대비 최대 하락폭",
  },
  WR: {
    en: "Win Rate: % of trades that were profitable",
    ko: "승률: 수익 거래 비율 (%)",
  },
  Sharpe: {
    en: "Sharpe Ratio: Risk-adjusted return (>1.0 is good)",
    ko: "샤프 비율: 위험 조정 수익률 (1.0 이상 양호)",
  },
  Sortino: {
    en: "Sortino Ratio: Like Sharpe but penalizes only downside",
    ko: "소르티노 비율: 하방 변동성만 반영한 샤프 비율",
  },
  Calmar: {
    en: "Calmar Ratio: Annual return / Max Drawdown",
    ko: "칼마 비율: 연간 수익률 / 최대 드로다운",
  },
  OOS: {
    en: "Out-of-Sample: Testing on unseen data",
    ko: "아웃오브샘플: 학습에 사용되지 않은 데이터로 검증",
  },
  PnL: {
    en: "Profit and Loss: Total profit or loss",
    ko: "손익: 총 수익 또는 손실",
  },
};

function Term({ abbr, lang }: { abbr: string; lang?: "en" | "ko" }) {
  const def = termDefs[abbr];
  if (!def) return <span>{abbr}</span>;
  const title = lang === "ko" ? def.ko : def.en;
  return (
    <abbr
      title={title}
      style={{
        textDecoration: "underline dotted",
        cursor: "help",
        textDecorationColor: "var(--color-text-muted)",
      }}
    >
      {abbr}
    </abbr>
  );
}

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
}

interface ResultsCardProps {
  data: ResultsData;
  isDefault: boolean;
  lang?: "en" | "ko";
  isDemo?: boolean;
  simMode?: "quick" | "standard" | "expert";
  strategyName?: string;
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
    demoNote: "DEMO · Pre-computed results for BB Squeeze SHORT",
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
    gradePrefix: "Grade",
    mcBeats: (pct: number) => `Beats ${pct}% of random strategies`,
    referralCta: "Ready to trade this strategy? Save up to 20% on trading fees",
    shareResults: "Share results",
    copiedTooltip: "Copied!",
    survivorshipNote:
      "Results based on currently listed assets only. Delisted coins excluded (survivorship bias).",
  },
  ko: {
    live: "기본 설정",
    winRate: "승률",
    pf: "수익 팩터",
    totalReturn: "총 수익률",
    maxDD: "최대 드로다운",
    trades: "건 시뮬레이션됨",
    avgWin: "평균 수익",
    avgLoss: "평균 손실",
    maxConsec: "최대 연속 손실",
    rr: "R:R 비율",
    sharpe: "샤프",
    sortino: "소르티노",
    calmar: "칼마",
    riskMetrics: "리스크 조정",
    demoNote: "DEMO · BB Squeeze SHORT 사전 계산 결과",
    breakeven: "손익분기 승률",
    margin: "여유",
    tradingFee: "거래 수수료",
    fundingFee: "펀딩 수수료",
    totalCost: "총 비용",
    feeSaveTip: "수수료 최대 20% 절감",
    portfolio: "포트폴리오",
    initialCapital: "초기 자본",
    totalPnlUsd: "총 손익",
    portfolioReturn: "포트폴리오 수익률",
    maxDdUsd: "최대 낙폭",
    expectancy: "기대값",
    recoveryFactor: "회복 팩터",
    payoffRatio: "보상 비율",
    btcBenchmark: "BTC 보유 대비",
    advancedMetrics: "고급 지표",
    walkForward: "워크포워드",
    avgHold: "평균 보유",
    medHold: "중간값 보유",
    bars: "봉",
    tradeDuration: "보유 기간",
    dirShort: "하락 시 수익",
    dirLong: "상승 시 수익",
    dirBoth: "두 방향 동시 테스트",
    sigP001: "통계적 유의: p<0.01",
    sigP005: "통계적 유의",
    sigNot: "유의하지 않음",
    wfStable: "안정적",
    wfModerate: "보통",
    wfOverfit: "과적합 위험",
    alpha: "초과",
    underperform: "부족",
    varDesc: "일별 최대 예상 손실 (95% 신뢰도)",
    cvarDesc: "꼬리 리스크 평균 (VaR 초과 시 평균 손실)",
    overfitDetect: "과적합 탐지",
    dsrConfidence: "DSR 신뢰도",
    dsrDesc: "Sharpe가 데이터마이닝 아닐 확률",
    mcLabel: "MC 검증",
    mcDescPrefix: "상위",
    mcDescSuffix: "(랜덤 셔플 대비)",
    jensensAlpha: "젠센 알파",
    jensensAlphaDesc: "(BTC 대비 리스크 조정 초과수익)",
    feeConsume: "수수료가 수익의",
    feeConsumeOf: "%를 차지합니다",
    showDetails: "상세 보기",
    hideDetails: "접기",
    showAdvanced: "고급 지표 보기 \u25BE",
    hideAdvanced: "접기 \u25B2",
    gradePrefix: "등급",
    mcBeats: (pct: number) => `랜덤 전략 중 상위 ${(100 - pct).toFixed(0)}%`,
    referralCta: "이 전략으로 거래 준비됐나요? 거래 수수료 최대 20% 절약",
    shareResults: "결과 공유",
    copiedTooltip: "복사됨!",
    survivorshipNote:
      "현재 상장된 자산만 테스트됩니다. 상폐 코인 제외 (생존 편향).",
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
      "Percentage of profitable trades. Context matters — high WR with low R:R can still lose.",
    pf: "Gross profit / gross loss. >1.5 is good, >2.0 is excellent.",
    totalReturn: "Cumulative percentage return over the test period",
    maxDD:
      "Largest peak-to-trough decline. Lower is better. Shows worst-case scenario.",
    avgWin: "Average percentage gain on winning trades",
    avgLoss: "Average percentage loss on losing trades",
    rr: "Risk-Reward ratio — average win divided by average loss",
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
      "Expected profit per trade (WR × AvgWin + (1-WR) × AvgLoss). Positive = edge exists",
    recoveryFactor:
      "Total return / max drawdown. > 3.0 is excellent, > 1.5 is acceptable",
    payoffRatio:
      "Average win / average loss. > 1.0 means wins are bigger than losses",
  },
  ko: {
    winRate:
      "수익 거래 비율. 맥락이 중요 — 높은 승률이라도 R:R이 낮으면 손실 가능.",
    pf: "총 이익 / 총 손실. 1.5 이상 양호, 2.0 이상 우수.",
    totalReturn: "테스트 기간 동안의 누적 수익률",
    maxDD: "최고점 대비 최대 하락폭. 낮을수록 좋음. 최악의 시나리오.",
    avgWin: "수익 거래의 평균 수익률",
    avgLoss: "손실 거래의 평균 손실률",
    rr: "리스크-보상 비율 — 평균 수익 / 평균 손실",
    maxConsec: "가장 긴 연속 손실 거래 수",
    sharpe: "위험 조정 수익률. 높을수록 좋음. 1 이상 양호, 2 이상 우수.",
    sortino: "하방 변동성만 반영한 샤프 비율. 높을수록 좋음.",
    calmar: "연간 수익률 / 최대 낙폭. 높을수록 위험 대비 수익이 좋음.",
    breakeven: "평균 손익 규모 기준 손익분기에 필요한 최소 승률",
    margin: "실제 승률이 손익분기 승률보다 얼마나 높은지",
    expectancy:
      "거래당 기대 수익 (승률 × 평균수익 + (1-승률) × 평균손실). 양수 = 우위 존재",
    recoveryFactor: "총 수익 / 최대 드로다운. > 3.0 우수, > 1.5 양호",
    payoffRatio: "평균 수익 / 평균 손실. > 1.0이면 수익이 손실보다 큼",
  },
} as const;

export default function ResultsCard({
  data,
  isDefault,
  lang = "en",
  isDemo = false,
  simMode = "expert",
  strategyName,
}: ResultsCardProps) {
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // BEP-relative win rate color when breakeven is known
  const wrColor = winRateColor(
    data.win_rate,
    hasBreakeven ? breakevenWR : undefined,
  );
  const pfColor = profitFactorColor(data.profit_factor);
  const retColor = signColor(data.total_return_pct);

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

      <div class="grid grid-cols-2 gap-2 mb-3">
        <MetricBox
          label={t.winRate}
          value={`${data.win_rate}%`}
          color={wrColor}
          description={desc.winRate}
        />
        <MetricBox
          label={t.pf}
          value={data.profit_factor >= 999 ? "\u221E" : `${data.profit_factor}`}
          color={pfColor}
          description={desc.pf}
        />
        <MetricBox
          label={t.totalReturn}
          value={`${data.total_return_pct > 0 ? "+" : ""}${data.total_return_pct}%`}
          color={retColor}
          description={desc.totalReturn}
        />
        <MetricBox
          label={t.maxDD}
          value={`${data.max_drawdown_pct}%`}
          color="var(--color-red)"
          description={desc.maxDD}
        />
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

      {/* Detailed metrics — hidden in Quick mode until toggled */}
      {!isQuick &&
        data.btc_hold_return_pct !== undefined &&
        data.btc_hold_return_pct !== 0 && (
          <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
            <div class="font-mono text-[10px] text-[--color-text-muted] uppercase mb-1">
              {t.btcBenchmark}
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
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

      {/* Portfolio metrics (USD) */}
      {!isQuick &&
        data.initial_capital_usd != null &&
        data.initial_capital_usd > 0 && (
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

      {/* Break-even win rate */}
      {!isQuick && hasBreakeven && (
        <div class="flex gap-3 text-[10px] font-mono text-[--color-text-muted] mb-3 px-1">
          <span title={desc.breakeven}>
            {t.breakeven}: {breakevenWR.toFixed(1)}%
          </span>
          <span
            style={{
              color: wrMargin > 0 ? "var(--color-accent)" : "var(--color-red)",
            }}
            title={desc.margin}
          >
            {t.margin}: {wrMargin > 0 ? "+" : ""}
            {wrMargin.toFixed(1)}%p
          </span>
        </div>
      )}

      {!isQuick &&
        (data.avg_win_pct !== undefined || data.avg_loss_pct !== undefined) && (
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
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
                (data.avg_win_pct ?? 0) / Math.abs(data.avg_loss_pct ?? 1) >= 1
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
        )}

      {!isQuick &&
        data.sharpe_ratio !== undefined &&
        data.sharpe_ratio !== 0 && (
          <div class="grid grid-cols-3 gap-2 mb-3">
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
        )}

      {/* VaR / CVaR */}
      {!isQuick && data.var_95 !== undefined && data.var_95 !== 0 && (
        <div class="grid grid-cols-2 gap-2 mb-3">
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

      {/* Overfitting Detection: DSR, Monte Carlo, Jensen's Alpha — expert tier only */}
      {!isQuick &&
        !hideExpert &&
        data.deflated_sharpe !== undefined &&
        data.deflated_sharpe !== 0 && (
          <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
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
          </div>
        )}

      {/* Advanced metrics: Expectancy, Recovery Factor, Payoff Ratio */}
      {!isQuick && data.expectancy !== undefined && data.expectancy !== 0 && (
        <div class="grid grid-cols-3 gap-2 mb-3">
          <MetricBox
            label={t.expectancy}
            value={`${data.expectancy > 0 ? "+" : ""}${data.expectancy.toFixed(3)}%`}
            color={
              data.expectancy > 0 ? "var(--color-accent)" : "var(--color-red)"
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

      {/* Fee breakdown */}
      {!isQuick && hasFees && (
        <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
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
              <span class="text-[--color-red]">{tradingFee.toFixed(1)}%</span>
            </span>
            {fundingFee > 0 && (
              <span class="text-[--color-text-muted]">
                {t.fundingFee}:{" "}
                <span class="text-[--color-red]">{fundingFee.toFixed(1)}%</span>
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
            {`${t.feeConsume} ${data.total_return_pct !== 0 ? Math.abs((totalCost / data.total_return_pct) * 100).toFixed(0) : "—"}${t.feeConsumeOf}`}
          </div>
        </div>
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

      <div class="flex items-center justify-between font-mono text-xs text-[--color-text-muted] mb-3">
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

      <div class="flex gap-4 font-mono text-[0.625rem]">
        <span class="text-[--color-accent]">
          <Term abbr="TP" lang={lang} /> {tpPct.toFixed(0)}%
        </span>
        <span class="text-[--color-red]">
          <Term abbr="SL" lang={lang} /> {slPct.toFixed(0)}%
        </span>
        <span class="text-[--color-text-muted]">TO {toPct.toFixed(0)}%</span>
      </div>

      {/* Share results */}
      {(() => {
        const sName = strategyName || "My strategy";
        const shareText = `I backtested ${sName} on PRUVIQ: WR ${data.win_rate}%, PF ${data.profit_factor}, ${data.total_trades.toLocaleString()} trades. Try it free \u{1F50D}`;
        const shareUrl = "https://pruviq.com/simulate";
        const copyText = `PRUVIQ Backtest: ${sName} — WR ${data.win_rate}%, PF ${data.profit_factor}, ${data.total_trades.toLocaleString()} trades. Try it: ${shareUrl}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        const redditTitle = `${sName} backtest: WR ${data.win_rate}%, PF ${data.profit_factor} — PRUVIQ`;
        const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(redditTitle)}`;
        return (
          <div class="mt-3 mb-3">
            <div class="font-mono text-[10px] text-[--color-text-muted] uppercase tracking-wider mb-1.5">
              {t.shareResults}
            </div>
            <div class="flex items-center gap-2">
              {/* X / Twitter */}
              <button
                type="button"
                onClick={() =>
                  window.open(
                    twitterUrl,
                    "_blank",
                    "noopener,width=550,height=420",
                  )
                }
                class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent] hover:text-[--color-accent] text-[--color-text-muted] transition-colors"
                aria-label="Share on X"
                title="Share on X"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
              {/* Copy link */}
              <div class="relative">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(copyText).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent] hover:text-[--color-accent] text-[--color-text-muted] transition-colors"
                  aria-label="Copy share text"
                  title="Copy share text"
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
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
                {copied && (
                  <span class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[--color-accent] text-white text-[10px] font-mono whitespace-nowrap pointer-events-none">
                    {t.copiedTooltip}
                  </span>
                )}
              </div>
              {/* Reddit */}
              <button
                type="button"
                onClick={() =>
                  window.open(
                    redditUrl,
                    "_blank",
                    "noopener,width=550,height=420",
                  )
                }
                class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent] hover:text-[--color-accent] text-[--color-text-muted] transition-colors"
                aria-label="Share on Reddit"
                title="Share on Reddit"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.884-7.003 4.884-3.874 0-7.004-2.19-7.004-4.884 0-.18.015-.36.043-.529A1.745 1.745 0 014.028 12.2a1.754 1.754 0 012.96-1.272c1.194-.868 2.86-1.425 4.694-1.493l.89-4.182a.452.452 0 01.539-.359l2.898.611a1.25 1.25 0 011 .497zM9.524 15.8a.878.878 0 100-1.756.878.878 0 000 1.756zm4.95 0a.878.878 0 100-1.756.878.878 0 000 1.756zm-4.34 1.62c-.116-.116-.116-.3 0-.415a.294.294 0 01.415 0 2.93 2.93 0 002.026.748 2.93 2.93 0 002.026-.748.294.294 0 01.415 0c.116.115.116.3 0 .415A3.515 3.515 0 0112.575 18a3.515 3.515 0 01-2.44-.58z" />
                </svg>
              </button>
            </div>
          </div>
        );
      })()}

      {/* QW3: Referral CTA banner */}
      <a
        href="/fees"
        class="mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-[--color-yellow]/40 bg-[--color-yellow]/5 hover:border-[--color-yellow]/70 hover:bg-[--color-yellow]/10 transition-colors no-underline group"
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
    </div>
  );
}
