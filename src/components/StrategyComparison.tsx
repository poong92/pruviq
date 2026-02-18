import { useState, useEffect, useRef } from 'preact/hooks';
import DiscreteSlider from './DiscreteSlider';
import { winRateColor, profitFactorColor, signColor } from '../utils/format';

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface EquityPoint {
  time: string;
  value: number;
}

interface ResultData {
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  total_trades: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  equity_curve: EquityPoint[];
}

interface StrategyInfo {
  name: string;
  direction: string;
  status: string;
  defaults: { sl: number; tp: number };
  results: Record<string, ResultData>;
}

interface ComparisonData {
  generated: string;
  coins: number;
  data_range: string;
  grid: { sl_values: number[]; tp_values: number[] };
  strategies: Record<string, StrategyInfo>;
}

interface Props {
  lang?: 'en' | 'ko';
}

const API_URL = import.meta.env.PUBLIC_PRUVIQ_API_URL || '';

const labels = {
  en: {
    tag: 'STRATEGY COMPARISON',
    title: 'Compare All Strategies',
    desc: (coins: number, range: string) => `Adjust SL/TP to compare all strategies under identical conditions. ${coins} coins, ${range}, realistic fees.`,
    sl: 'STOP LOSS',
    tp: 'TAKE PROFIT',
    loading: 'Loading comparison data...',
    error: 'Failed to load comparison data.',
    noData: 'No data',
    disclaimer: '* All strategies simulated with identical fees (0.04% + 0.02% slippage). Past performance does not guarantee future results.',
    name: 'Strategy',
    direction: 'Dir',
    winRate: 'Win Rate',
    pf: 'PF',
    totalReturn: 'Return',
    maxDD: 'MDD',
    trades: 'Trades',
    view: 'View',
    ctaTitle: 'Ready to Trade?',
    ctaDesc: 'Save up to 20% on trading fees with PRUVIQ referral links.',
    ctaFees: 'Compare Exchange Fees',
    ctaCommunity: 'Join Community',
  },
  ko: {
    tag: '전략 비교',
    title: '모든 전략 비교',
    desc: (coins: number, range: string) => `SL/TP를 조정하여 동일한 조건에서 모든 전략을 비교하세요. ${coins}개 코인, ${range}, 수수료 포함.`,
    sl: '손절 (STOP LOSS)',
    tp: '익절 (TAKE PROFIT)',
    loading: '비교 데이터 로딩 중...',
    error: '비교 데이터 로딩 실패.',
    noData: '데이터 없음',
    disclaimer: '* 모든 전략은 동일한 수수료(0.04% + 0.02% 슬리피지)로 시뮬레이션됩니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
    name: '전략',
    direction: '방향',
    winRate: '승률',
    pf: 'PF',
    totalReturn: '수익률',
    maxDD: 'MDD',
    trades: '거래',
    view: '보기',
    ctaTitle: '실제 거래를 시작하려면?',
    ctaDesc: 'PRUVIQ 제휴 링크로 거래소 수수료 최대 20% 할인.',
    ctaFees: '거래소 수수료 비교',
    ctaCommunity: '커뮤니티 참여',
  },
};

const statusColors: Record<string, string> = {
  verified: 'var(--color-accent)',
  testing: 'var(--color-yellow)',
  killed: 'var(--color-red)',
  shelved: 'var(--color-text-muted)',
};

const statusLabelsEN: Record<string, string> = {
  verified: 'VERIFIED',
  testing: 'TESTING',
  killed: 'KILLED',
  shelved: 'SHELVED',
};

const statusLabelsKO: Record<string, string> = {
  verified: '검증됨',
  testing: '테스트 중',
  killed: '중단됨',
  shelved: '보류',
};

const STRATEGY_ORDER = ['bb-squeeze-short', 'bb-squeeze-long', 'momentum-long', 'atr-breakout', 'hv-squeeze'];

function ComparisonSkeleton() {
  return (
    <div class="fade-in">
      <div class="mb-6">
        <div class="skeleton h-3 w-40 mb-2" />
        <div class="skeleton h-7 w-64 mb-2" />
        <div class="skeleton h-4 w-96 max-w-full" />
      </div>
      <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl mb-6">
        <div class="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div class="skeleton h-12 w-full rounded" />
          <div class="skeleton h-12 w-full rounded" />
        </div>
      </div>
      <div class="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} class="skeleton h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

interface SparklineProps {
  data: EquityPoint[];
  width?: number;
  height?: number;
}

function Sparkline({ data, width = 120, height = 40 }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 2;

    const isPositive = values[values.length - 1] >= 0;
    const color = isPositive ? getCssVar('--color-accent') : getCssVar('--color-red');

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((values[i] - min) / range) * (height - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [data, width, height]);

  if (!data?.length) return <div class="w-[120px] h-[40px]" />;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      class="block"
    />
  );
}

export default function StrategyComparison({ lang = 'en' }: Props) {
  const t = labels[lang] || labels.en;
  const statusLabels = lang === 'ko' ? statusLabelsKO : statusLabelsEN;
  const [data, setData] = useState<ComparisonData | null>(null);
  const [sl, setSl] = useState(10);
  const [tp, setTp] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/comparison-results.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((json: ComparisonData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <ComparisonSkeleton />;
  if (error || !data) {
    return <div class="py-8 text-center font-mono text-sm text-[--color-red]">{t.error}</div>;
  }

  const key = `sl${sl}_tp${tp}`;
  const strategyPrefix = lang === 'ko' ? '/ko/strategies' : '/strategies';

  return (
    <div class="fade-in">
      {/* Header */}
      <div class="mb-6">
        <div class="font-mono text-xs text-[--color-accent] tracking-widest mb-2 uppercase">{t.tag}</div>
        <h2 class="text-2xl font-bold mb-2">{t.title}</h2>
        <p class="text-[--color-text-muted] text-sm leading-relaxed">{t.desc(data.coins, data.data_range)}</p>
      </div>

      {/* Shared Sliders */}
      <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl mb-6">
        <div class="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <DiscreteSlider label={t.sl} values={data.grid.sl_values} value={sl} defaultValue={10} onChange={setSl} />
          <DiscreteSlider label={t.tp} values={data.grid.tp_values} value={tp} defaultValue={8} onChange={setTp} />
        </div>
      </div>

      {/* Strategy Cards (mobile) + Table (desktop) */}
      {/* Desktop Table */}
      <div class="hidden md:block overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
        <table class="w-full font-mono text-sm">
          <thead>
            <tr class="border-b border-[--color-border] text-[--color-text-muted] text-xs uppercase tracking-wider">
              <th class="px-4 py-3 text-left">{t.name}</th>
              <th class="px-3 py-3 text-center">{t.direction}</th>
              <th class="px-3 py-3 text-right">{t.winRate}</th>
              <th class="px-3 py-3 text-right">{t.pf}</th>
              <th class="px-3 py-3 text-right">{t.totalReturn}</th>
              <th class="px-3 py-3 text-right">{t.maxDD}</th>
              <th class="px-3 py-3 text-right">{t.trades}</th>
              <th class="px-3 py-3 text-center">Equity</th>
              <th class="px-3 py-3 text-center" />
            </tr>
          </thead>
          <tbody>
            {STRATEGY_ORDER.map((id) => {
              const strat = data.strategies[id];
              if (!strat) return null;
              const result = strat.results[key];
              const statusColor = statusColors[strat.status] || 'var(--color-text-muted)';

              return (
                <tr key={id} class="border-b border-[--color-border] last:border-0 hover:bg-[--color-bg-hover] transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-[0.625rem] px-1.5 py-0.5 rounded border" style={{ color: statusColor, borderColor: statusColor }}>
                        {statusLabels[strat.status]}
                      </span>
                      <span class="font-semibold text-[--color-text]">{strat.name}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-center text-xs text-[--color-text-muted]">{strat.direction.toUpperCase()}</td>
                  {result ? (
                    <>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: winRateColor(result.win_rate) }}>
                        {result.win_rate}%
                      </td>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: profitFactorColor(result.profit_factor) }}>
                        {result.profit_factor}
                      </td>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: signColor(result.total_return_pct) }}>
                        {result.total_return_pct > 0 ? '+' : ''}{result.total_return_pct}%
                      </td>
                      <td class="px-3 py-3 text-right text-[--color-red]">
                        {result.max_drawdown_pct}%
                      </td>
                      <td class="px-3 py-3 text-right text-[--color-text-muted]">
                        {result.total_trades.toLocaleString()}
                      </td>
                      <td class="px-3 py-3 flex justify-center">
                        <Sparkline data={result.equity_curve} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} class="px-3 py-3 text-center text-[--color-text-muted] text-xs">{t.noData}</td>
                  )}
                  <td class="px-3 py-3 text-center">
                    <a href={`${strategyPrefix}/${id}`}
                       class="text-[--color-accent] text-xs hover:underline">
                      {t.view} &rarr;
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div class="md:hidden space-y-3">
        {STRATEGY_ORDER.map((id) => {
          const strat = data.strategies[id];
          if (!strat) return null;
          const result = strat.results[key];
          const statusColor = statusColors[strat.status] || 'var(--color-text-muted)';

          return (
            <div key={id} class="border border-[--color-border] rounded-xl p-4 bg-[--color-bg-card]">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[0.625rem] px-1.5 py-0.5 rounded border"
                        style={{ color: statusColor, borderColor: statusColor }}>
                    {statusLabels[strat.status]}
                  </span>
                  <span class="font-mono text-xs text-[--color-text-muted]">{strat.direction.toUpperCase()}</span>
                </div>
                <a href={`${strategyPrefix}/${id}`}
                   class="text-[--color-accent] font-mono text-xs hover:underline">
                  {t.view} &rarr;
                </a>
              </div>

              <h3 class="font-bold text-sm mb-3">{strat.name}</h3>

              {result ? (
                <>
                  <div class="grid grid-cols-2 gap-2 font-mono text-xs mb-3">
                    <div class="p-2 rounded bg-[rgba(17,17,17,0.8)] border border-[--color-border]">
                      <div class="text-[0.625rem] text-[--color-text-muted] mb-0.5">{t.winRate}</div>
                      <div class="font-bold" style={{ color: winRateColor(result.win_rate) }}>{result.win_rate}%</div>
                    </div>
                    <div class="p-2 rounded bg-[rgba(17,17,17,0.8)] border border-[--color-border]">
                      <div class="text-[0.625rem] text-[--color-text-muted] mb-0.5">{t.pf}</div>
                      <div class="font-bold" style={{ color: profitFactorColor(result.profit_factor) }}>{result.profit_factor}</div>
                    </div>
                    <div class="p-2 rounded bg-[rgba(17,17,17,0.8)] border border-[--color-border]">
                      <div class="text-[0.625rem] text-[--color-text-muted] mb-0.5">{t.totalReturn}</div>
                      <div class="font-bold" style={{ color: signColor(result.total_return_pct) }}>
                        {result.total_return_pct > 0 ? '+' : ''}{result.total_return_pct}%
                      </div>
                    </div>
                    <div class="p-2 rounded bg-[rgba(17,17,17,0.8)] border border-[--color-border]">
                      <div class="text-[0.625rem] text-[--color-text-muted] mb-0.5">{t.maxDD}</div>
                      <div class="font-bold text-[--color-red]">{result.max_drawdown_pct}%</div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[0.625rem] text-[--color-text-muted]">
                      {result.total_trades.toLocaleString()} {t.trades}
                    </span>
                    <Sparkline data={result.equity_curve} width={80} height={28} />
                  </div>
                </>
              ) : (
                <div class="font-mono text-xs text-[--color-text-muted]">{t.noData}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p class="font-mono text-[0.625rem] text-[--color-text-muted] mt-4 leading-relaxed">{t.disclaimer}</p>

      {/* CTA */}
      <div class="mt-8 p-6 bg-[--color-bg-card] border border-[--color-border] rounded-xl card-hover">
        <h3 class="text-lg font-bold mb-2">{t.ctaTitle}</h3>
        <p class="text-[--color-text-muted] text-sm mb-4">{t.ctaDesc}</p>
        <div class="flex gap-3 flex-wrap">
          <a href={lang === 'ko' ? '/ko/fees' : '/fees'} class="inline-block bg-[--color-accent] text-[--color-bg] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity">
            {t.ctaFees} &rarr;
          </a>
          <a href="https://t.me/PRUVIQ" target="_blank" rel="noopener" class="inline-block border border-[--color-border] text-[--color-text] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:border-[--color-accent] transition-colors">
            {t.ctaCommunity}
          </a>
        </div>
      </div>
    </div>
  );
}
