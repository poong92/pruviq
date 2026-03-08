import { winRateColor, profitFactorColor, signColor } from '../utils/format';
import { COLORS } from './simulator-types';

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
}

interface ResultsCardProps {
  data: ResultsData;
  isDefault: boolean;
  lang?: 'en' | 'ko';
  isDemo?: boolean;
}

const labels = {
  en: {
    live: 'CURRENT LIVE SETTINGS',
    winRate: 'Win Rate',
    pf: 'Profit Factor',
    totalReturn: 'Total Return',
    maxDD: 'Max Drawdown',
    trades: 'trades simulated',
    avgWin: 'Avg Win',
    avgLoss: 'Avg Loss',
    maxConsec: 'Max Consec. Losses',
    rr: 'R:R Ratio',
    sharpe: 'Sharpe',
    sortino: 'Sortino',
    calmar: 'Calmar',
    riskMetrics: 'Risk-Adjusted',
    demoNote: 'DEMO · Pre-computed results for BB Squeeze SHORT',
    breakeven: 'Break-even WR',
    margin: 'Margin',
    tradingFee: 'Trading Fee',
    fundingFee: 'Funding Fee',
    totalCost: 'Total Cost',
    feeSaveTip: 'Save up to 20% on fees',
    portfolio: 'Portfolio',
    initialCapital: 'Initial Capital',
    totalPnlUsd: 'Total PnL',
    portfolioReturn: 'Portfolio Return',
    maxDdUsd: 'Max DD',
    expectancy: 'Expectancy',
    recoveryFactor: 'Recovery Factor',
    payoffRatio: 'Payoff Ratio',
    btcBenchmark: 'vs BTC Hold',
    advancedMetrics: 'Advanced Metrics',
    walkForward: 'Walk-Forward',
    avgHold: 'Avg Hold',
    medHold: 'Med Hold',
    bars: 'bars',
    tradeDuration: 'Trade Duration',
  },
  ko: {
    live: '현재 라이브 설정',
    winRate: '승률',
    pf: '수익 팩터',
    totalReturn: '총 수익률',
    maxDD: '최대 드로다운',
    trades: '건 시뮬레이션됨',
    avgWin: '평균 수익',
    avgLoss: '평균 손실',
    maxConsec: '최대 연속 손실',
    rr: 'R:R 비율',
    sharpe: '샤프',
    sortino: '소르티노',
    calmar: '칼마',
    riskMetrics: '리스크 조정',
    demoNote: 'DEMO · BB Squeeze SHORT 사전 계산 결과',
    breakeven: '손익분기 승률',
    margin: '여유',
    tradingFee: '거래 수수료',
    fundingFee: '펀딩 수수료',
    totalCost: '총 비용',
    feeSaveTip: '수수료 최대 20% 절감',
    portfolio: '포트폴리오',
    initialCapital: '초기 자본',
    totalPnlUsd: '총 손익',
    portfolioReturn: '포트폴리오 수익률',
    maxDdUsd: '최대 낙폭',
    expectancy: '기대값',
    recoveryFactor: '회복 팩터',
    payoffRatio: '보상 비율',
    btcBenchmark: 'BTC 보유 대비',
    advancedMetrics: '고급 지표',
    walkForward: '워크포워드',
    avgHold: '평균 보유',
    medHold: '중간값 보유',
    bars: '봉',
    tradeDuration: '보유 기간',
  },
};

function MetricBox({ label, value, color, description }: { label: string; value: string; color: string; description?: string }) {
  return (
    <div class="p-3 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]" title={description}>
      <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1">{label}</div>
      <div class="font-mono text-lg md:text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

const metricDescriptions = {
  en: {
    winRate: 'Percentage of trades that were profitable',
    pf: 'Ratio of gross profit to gross loss. PF > 1.5 is good, > 2.0 is excellent',
    totalReturn: 'Cumulative percentage return over the test period',
    maxDD: 'Largest peak-to-trough decline during the test period',
    avgWin: 'Average percentage gain on winning trades',
    avgLoss: 'Average percentage loss on losing trades',
    rr: 'Risk-Reward ratio — average win divided by average loss',
    maxConsec: 'Longest streak of consecutive losing trades',
    sharpe: 'Risk-adjusted return (excess return / volatility). > 1.0 is good, > 2.0 is excellent',
    sortino: 'Like Sharpe but only penalizes downside volatility. > 1.5 is good, > 3.0 is excellent',
    calmar: 'Annual return divided by max drawdown. > 1.0 is good, > 3.0 is excellent',
    breakeven: 'Minimum win rate needed to break even, given the average win/loss sizes',
    margin: 'How far above the break-even win rate the actual win rate is',
    expectancy: 'Expected profit per trade (WR × AvgWin + (1-WR) × AvgLoss). Positive = edge exists',
    recoveryFactor: 'Total return / max drawdown. > 3.0 is excellent, > 1.5 is acceptable',
    payoffRatio: 'Average win / average loss. > 1.0 means wins are bigger than losses',
  },
  ko: {
    winRate: '수익을 낸 거래의 비율',
    pf: '총 수익 / 총 손실 비율. PF > 1.5 양호, > 2.0 우수',
    totalReturn: '테스트 기간 동안의 누적 수익률',
    maxDD: '테스트 기간 중 최대 고점 대비 하락 폭',
    avgWin: '수익 거래의 평균 수익률',
    avgLoss: '손실 거래의 평균 손실률',
    rr: '리스크-보상 비율 — 평균 수익 / 평균 손실',
    maxConsec: '가장 긴 연속 손실 거래 수',
    sharpe: '위험 조정 수익률 (초과수익 / 변동성). > 1.0 양호, > 2.0 우수',
    sortino: '샤프와 유사하나 하방 변동성만 반영. > 1.5 양호, > 3.0 우수',
    calmar: '연간 수익률 / 최대 드로다운. > 1.0 양호, > 3.0 우수',
    breakeven: '평균 손익 규모 기준 손익분기에 필요한 최소 승률',
    margin: '실제 승률이 손익분기 승률보다 얼마나 높은지',
    expectancy: '거래당 기대 수익 (승률 × 평균수익 + (1-승률) × 평균손실). 양수 = 우위 존재',
    recoveryFactor: '총 수익 / 최대 드로다운. > 3.0 우수, > 1.5 양호',
    payoffRatio: '평균 수익 / 평균 손실. > 1.0이면 수익이 손실보다 큼',
  },
} as const;

export default function ResultsCard({ data, isDefault, lang = 'en', isDemo = false }: ResultsCardProps) {
  const t = labels[lang] || labels.en;
  const desc = metricDescriptions[lang] || metricDescriptions.en;
  const total = data.tp_count + data.sl_count + data.timeout_count;
  const tpPct = total > 0 ? (data.tp_count / total) * 100 : 0;
  const slPct = total > 0 ? (data.sl_count / total) * 100 : 0;
  const toPct = total > 0 ? (data.timeout_count / total) * 100 : 0;

  const wrColor = winRateColor(data.win_rate);
  const pfColor = profitFactorColor(data.profit_factor);
  const retColor = signColor(data.total_return_pct);

  // Break-even win rate: |avgLoss| / (|avgWin| + |avgLoss|)
  const avgWin = Math.abs(data.avg_win_pct ?? 0);
  const avgLoss = Math.abs(data.avg_loss_pct ?? 0);
  const hasBreakeven = data.avg_win_pct !== undefined && data.avg_loss_pct !== undefined && avgLoss > 0 && avgWin > 0;
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
        <div class="font-mono text-[0.625rem] text-[--color-accent] tracking-widest mb-3 uppercase">{t.live}</div>
      )}

      {isDemo && (
        <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-yellow]/10 border border-[--color-yellow]/20">
          <span class="font-mono text-xs text-[--color-yellow]">{t.demoNote}</span>
        </div>
      )}

      {/* Direction badge */}
      {data.direction && (
        <div class="mb-2 flex items-center gap-2">
          <span class={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
            data.direction === 'short' ? 'text-[--color-red] border-[--color-red]/30 bg-[--color-red]/10' :
            data.direction === 'long' ? 'text-[--color-green] border-[--color-green]/30 bg-[--color-green]/10' :
            'border-[--color-accent]/30 bg-[--color-accent]/10'
          }`} style={data.direction === 'both' ? { color: COLORS.accent } : undefined}>
            {data.direction === 'both' ? 'SHORT + LONG' : data.direction.toUpperCase()}
          </span>
          <span class="text-[9px] text-[--color-text-muted] font-mono">
            {data.direction === 'short' ? (lang === 'ko' ? '하락 시 수익' : 'Profit from falling prices') :
             data.direction === 'long' ? (lang === 'ko' ? '상승 시 수익' : 'Profit from rising prices') :
             (lang === 'ko' ? '두 방향 동시 테스트' : 'Both directions tested')}
          </span>
        </div>
      )}

      {/* Strategy Grade */}
      {data.strategy_grade && (
        <div class="mb-3 flex items-center gap-2">
          <span class={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-lg font-black border-2 ${
            data.strategy_grade === 'A' ? 'text-[--color-green] border-[--color-green]/40 bg-[--color-green]/10' :
            data.strategy_grade === 'B' ? 'text-[--color-accent] border-[--color-accent]/40 bg-[--color-accent]/10' :
            data.strategy_grade === 'C' ? 'text-[--color-yellow] border-[--color-yellow]/40 bg-[--color-yellow]/10' :
            'text-[--color-red] border-[--color-red]/40 bg-[--color-red]/10'
          }`}>
            {data.strategy_grade}
          </span>
          <div class="flex flex-col">
            {data.grade_details && (
              <span class="font-mono text-[10px] text-[--color-text-muted]">{data.grade_details}</span>
            )}
            {data.edge_p_value !== undefined && data.edge_p_value < 1 && (
              <span class="font-mono text-[10px]" style={{ color: data.edge_p_value <= 0.05 ? 'var(--color-green)' : data.edge_p_value <= 0.1 ? 'var(--color-yellow)' : 'var(--color-red)' }}>
                {data.edge_p_value <= 0.01 ? (lang === 'ko' ? '통계적 유의: p<0.01' : 'Statistically significant: p<0.01') :
                 data.edge_p_value <= 0.05 ? (lang === 'ko' ? `통계적 유의: p=${data.edge_p_value.toFixed(3)}` : `Statistically significant: p=${data.edge_p_value.toFixed(3)}`) :
                 (lang === 'ko' ? `유의하지 않음: p=${data.edge_p_value.toFixed(3)}` : `Not significant: p=${data.edge_p_value.toFixed(3)}`)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Walk-Forward Consistency */}
      {data.walk_forward_consistency != null && data.walk_forward_consistency > 0 && (
        <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-mono text-[10px] text-[--color-text-muted] uppercase">{t.walkForward}</span>
            <span class={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              data.walk_forward_consistency >= 0.85 ? 'text-[--color-green] bg-[--color-green]/10' :
              data.walk_forward_consistency >= 0.7 ? 'text-[--color-accent] bg-[--color-accent]/10' :
              'text-[--color-red] bg-[--color-red]/10'
            }`}>
              {data.walk_forward_consistency.toFixed(2)}
            </span>
            <span class="font-mono text-[10px]" style={{ color: data.walk_forward_consistency >= 0.85 ? 'var(--color-green)' : data.walk_forward_consistency >= 0.7 ? 'var(--color-accent)' : 'var(--color-red)' }}>
              {data.walk_forward_consistency >= 0.85 ? (lang === 'ko' ? '안정적' : 'Stable') :
               data.walk_forward_consistency >= 0.7 ? (lang === 'ko' ? '보통' : 'Moderate') :
               (lang === 'ko' ? '과적합 위험' : 'Overfit risk')}
            </span>
          </div>
          {data.walk_forward_details && (
            <span class="font-mono text-[9px] text-[--color-text-muted] hidden md:inline">{data.walk_forward_details}</span>
          )}
        </div>
      )}

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div class="mb-3 space-y-1">
          {data.warnings.map((w, i) => (
            <div key={i} class="px-3 py-2 rounded-lg bg-[--color-yellow]/8 border border-[--color-yellow]/20 font-mono text-[11px] text-[--color-yellow]">
              {w}
            </div>
          ))}
        </div>
      )}

      <div class="grid grid-cols-2 gap-2 mb-3">
        <MetricBox label={t.winRate} value={`${data.win_rate}%`} color={wrColor} description={desc.winRate} />
        <MetricBox label={t.pf} value={`${data.profit_factor}`} color={pfColor} description={desc.pf} />
        <MetricBox label={t.totalReturn} value={`${data.total_return_pct > 0 ? '+' : ''}${data.total_return_pct}%`} color={retColor} description={desc.totalReturn} />
        <MetricBox label={t.maxDD} value={`${data.max_drawdown_pct}%`} color="var(--color-red)" description={desc.maxDD} />
      </div>

      {/* Benchmarks (BTC + ETH) */}
      {data.btc_hold_return_pct !== undefined && data.btc_hold_return_pct !== 0 && (
        <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
          <div class="font-mono text-[10px] text-[--color-text-muted] uppercase mb-1">{t.btcBenchmark}</div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            <span class="text-[--color-text-muted]">BTC: <span style={{ color: signColor(data.btc_hold_return_pct) }}>{data.btc_hold_return_pct > 0 ? '+' : ''}{data.btc_hold_return_pct.toFixed(1)}%</span></span>
            {data.eth_hold_return_pct !== undefined && data.eth_hold_return_pct !== 0 && (
              <span class="text-[--color-text-muted]">ETH: <span style={{ color: signColor(data.eth_hold_return_pct) }}>{data.eth_hold_return_pct > 0 ? '+' : ''}{data.eth_hold_return_pct.toFixed(1)}%</span></span>
            )}
            <span style={{ color: (data.total_return_pct - data.btc_hold_return_pct) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }} class="font-bold">
              {(data.total_return_pct - data.btc_hold_return_pct) >= 0 ? '+' : ''}{(data.total_return_pct - data.btc_hold_return_pct).toFixed(1)}%p {(data.total_return_pct - data.btc_hold_return_pct) >= 0 ? (lang === 'ko' ? '초과' : 'alpha') : (lang === 'ko' ? '부족' : 'underperform')}
            </span>
          </div>
        </div>
      )}

      {/* Portfolio metrics (USD) */}
      {data.initial_capital_usd != null && data.initial_capital_usd > 0 && (
        <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
          <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1.5">
            {t.portfolio} — ${data.per_coin_usd ?? 60} x {data.leverage ?? 5}x
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
            <div>
              <div class="text-[10px] text-[--color-text-muted]">{t.initialCapital}</div>
              <div class="font-bold">${(data.initial_capital_usd ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">{t.totalPnlUsd}</div>
              <div class="font-bold" style={{ color: signColor(data.total_return_usd ?? 0) }}>
                {(data.total_return_usd ?? 0) > 0 ? '+' : ''}${(data.total_return_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">{t.portfolioReturn}</div>
              <div class="font-bold" style={{ color: signColor(data.total_return_pct_portfolio ?? 0) }}>
                {(data.total_return_pct_portfolio ?? 0) > 0 ? '+' : ''}{(data.total_return_pct_portfolio ?? 0).toFixed(1)}%
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[--color-text-muted]">{t.maxDdUsd}</div>
              <div class="font-bold" style={{ color: 'var(--color-red)' }}>
                ${(data.max_drawdown_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Break-even win rate */}
      {hasBreakeven && (
        <div class="flex gap-3 text-[10px] font-mono text-[--color-text-muted] mb-3 px-1">
          <span title={desc.breakeven}>{t.breakeven}: {breakevenWR.toFixed(1)}%</span>
          <span style={{ color: wrMargin > 0 ? 'var(--color-accent)' : 'var(--color-red)' }} title={desc.margin}>
            {t.margin}: {wrMargin > 0 ? '+' : ''}{wrMargin.toFixed(1)}%p
          </span>
        </div>
      )}

      {(data.avg_win_pct !== undefined || data.avg_loss_pct !== undefined) && (
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
            value={data.avg_loss_pct && data.avg_loss_pct !== 0 ? `1:${(Math.abs(data.avg_win_pct ?? 0) / Math.abs(data.avg_loss_pct)).toFixed(2)}` : 'N/A'}
            color={((data.avg_win_pct ?? 0) / Math.abs(data.avg_loss_pct ?? 1)) >= 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
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

      {(data.sharpe_ratio !== undefined && data.sharpe_ratio !== 0) && (
        <div class="grid grid-cols-3 gap-2 mb-3">
          <MetricBox
            label={t.sharpe}
            value={`${(data.sharpe_ratio ?? 0).toFixed(2)}`}
            color={(data.sharpe_ratio ?? 0) > 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            description={desc.sharpe}
          />
          <MetricBox
            label={t.sortino}
            value={`${(data.sortino_ratio ?? 0).toFixed(2)}`}
            color={(data.sortino_ratio ?? 0) > 1.5 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            description={desc.sortino}
          />
          <MetricBox
            label={t.calmar}
            value={`${(data.calmar_ratio ?? 0).toFixed(2)}`}
            color={(data.calmar_ratio ?? 0) > 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            description={desc.calmar}
          />
        </div>
      )}

      {/* VaR / CVaR */}
      {data.var_95 !== undefined && data.var_95 !== 0 && (
        <div class="grid grid-cols-2 gap-2 mb-3">
          <MetricBox
            label="VaR 95%"
            value={`${data.var_95.toFixed(2)}%`}
            color="var(--color-red)"
            description={lang === 'ko' ? '일별 최대 예상 손실 (95% 신뢰도)' : 'Daily max expected loss (95% confidence)'}
          />
          <MetricBox
            label="CVaR 95%"
            value={`${(data.cvar_95 ?? 0).toFixed(2)}%`}
            color="var(--color-red)"
            description={lang === 'ko' ? '꼬리 리스크 평균 (VaR 초과 시 평균 손실)' : 'Expected Shortfall (avg loss beyond VaR)'}
          />
        </div>
      )}

      {/* Overfitting Detection: DSR, Monte Carlo, Jensen's Alpha */}
      {(data.deflated_sharpe !== undefined && data.deflated_sharpe !== 0) && (
        <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
          <div class="font-mono text-[10px] text-[--color-text-muted] uppercase mb-2">
            {lang === 'ko' ? '과적합 탐지' : 'Overfitting Detection'}
          </div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <MetricBox
              label={lang === 'ko' ? 'DSR 신뢰도' : 'DSR Confidence'}
              value={`${(data.deflated_sharpe * 100).toFixed(0)}%`}
              color={data.deflated_sharpe > 0.8 ? 'var(--color-green)' : data.deflated_sharpe > 0.5 ? 'var(--color-accent)' : 'var(--color-red)'}
              description={lang === 'ko' ? `Sharpe가 데이터마이닝 아닐 확률` : `Prob. Sharpe survives multi-test correction`}
            />
            <MetricBox
              label={lang === 'ko' ? 'MC 검증' : 'Monte Carlo'}
              value={`p=${(data.mc_p_value ?? 1).toFixed(3)}`}
              color={(data.mc_p_value ?? 1) < 0.05 ? 'var(--color-green)' : (data.mc_p_value ?? 1) < 0.10 ? 'var(--color-accent)' : 'var(--color-red)'}
              description={lang === 'ko' ? `상위 ${(100 - (data.mc_percentile ?? 50)).toFixed(0)}% (랜덤 셔플 대비)` : `Top ${(100 - (data.mc_percentile ?? 50)).toFixed(0)}% vs random shuffle`}
            />
          </div>
          {data.jensens_alpha !== undefined && data.jensens_alpha !== 0 && (
            <div class="flex items-center gap-2 font-mono text-xs">
              <span class="text-[--color-text-muted]">{lang === 'ko' ? '젠센 알파' : "Jensen's α"}:</span>
              <span style={{ color: data.jensens_alpha > 0 ? 'var(--color-green)' : 'var(--color-red)' }} class="font-bold">
                {data.jensens_alpha > 0 ? '+' : ''}{data.jensens_alpha.toFixed(2)}%
              </span>
              <span class="text-[9px] text-[--color-text-muted]">
                {lang === 'ko' ? '(BTC 대비 리스크 조정 초과수익)' : '(risk-adjusted excess vs BTC)'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Advanced metrics: Expectancy, Recovery Factor, Payoff Ratio */}
      {(data.expectancy !== undefined && data.expectancy !== 0) && (
        <div class="grid grid-cols-3 gap-2 mb-3">
          <MetricBox
            label={t.expectancy}
            value={`${data.expectancy > 0 ? '+' : ''}${data.expectancy.toFixed(3)}%`}
            color={data.expectancy > 0 ? 'var(--color-accent)' : 'var(--color-red)'}
            description={desc.expectancy}
          />
          <MetricBox
            label={t.recoveryFactor}
            value={`${(data.recovery_factor ?? 0).toFixed(2)}`}
            color={(data.recovery_factor ?? 0) >= 3 ? 'var(--color-accent)' : (data.recovery_factor ?? 0) >= 1.5 ? 'var(--color-text)' : 'var(--color-red)'}
            description={desc.recoveryFactor}
          />
          <MetricBox
            label={t.payoffRatio}
            value={`${(data.payoff_ratio ?? 0).toFixed(2)}`}
            color={(data.payoff_ratio ?? 0) >= 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            description={desc.payoffRatio}
          />
        </div>
      )}

      {/* Fee breakdown */}
      {hasFees && (
        <div class="mb-3 px-3 py-2.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider">{t.totalCost}</span>
            <a href="/fees" class="text-[10px] font-mono text-[--color-accent] hover:underline">
              {t.feeSaveTip} &rarr;
            </a>
          </div>
          <div class="flex gap-4 font-mono text-xs">
            <span class="text-[--color-text-muted]">{t.tradingFee}: <span class="text-[--color-red]">{tradingFee.toFixed(1)}%</span></span>
            {fundingFee > 0 && (
              <span class="text-[--color-text-muted]">{t.fundingFee}: <span class="text-[--color-red]">{fundingFee.toFixed(1)}%</span></span>
            )}
            <span class="text-[--color-text-muted]">{t.totalCost}: <span class="text-[--color-red] font-bold">{totalCost.toFixed(1)}%</span></span>
          </div>
          <div class="mt-1.5 h-1 rounded-full overflow-hidden bg-[--color-border]">
            <div class="h-full bg-[--color-red]/60 transition-[width] duration-300" style={{ width: `${Math.min(totalCost / Math.abs(data.total_return_pct || 1) * 100, 100)}%` }} />
          </div>
          <div class="mt-1 text-[10px] font-mono text-[--color-text-muted] opacity-60">
            {lang === 'ko'
              ? `수수료가 수익의 ${data.total_return_pct !== 0 ? Math.abs(totalCost / data.total_return_pct * 100).toFixed(0) : '—'}%를 차지합니다`
              : `Fees consume ${data.total_return_pct !== 0 ? Math.abs(totalCost / data.total_return_pct * 100).toFixed(0) : '—'}% of returns`}
          </div>
        </div>
      )}

      <div class="flex items-center justify-between font-mono text-xs text-[--color-text-muted] mb-3">
        <span>{data.total_trades.toLocaleString()} {t.trades}</span>
        {data.avg_bars_held != null && data.avg_bars_held > 0 && (
          <span class="text-[10px]">
            {t.avgHold}: {data.avg_bars_held}h · {t.medHold}: {data.median_bars_held ?? 0}h
          </span>
        )}
      </div>

      {/* Exit reason bar */}
      <div class="mb-1">
        <div class="flex h-1.5 rounded-full overflow-hidden bg-[--color-border]">
          <div class="bg-[--color-accent] transition-[width] duration-300" style={{ width: `${tpPct}%` }} />
          <div class="bg-[--color-red] transition-[width] duration-300" style={{ width: `${slPct}%` }} />
          <div class="bg-[--color-text-muted] transition-[width] duration-300" style={{ width: `${toPct}%` }} />
        </div>
      </div>

      <div class="flex gap-4 font-mono text-[0.625rem]">
        <span class="text-[--color-accent]">TP {tpPct.toFixed(0)}%</span>
        <span class="text-[--color-red]">SL {slPct.toFixed(0)}%</span>
        <span class="text-[--color-text-muted]">TO {toPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
