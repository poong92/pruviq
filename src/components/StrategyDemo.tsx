import { useState, useEffect, useRef } from 'preact/hooks';
import { getCssVar } from '../utils/format';
import DiscreteSlider from './DiscreteSlider';
import ResultsCard from './ResultsCard';
import { API_BASE_URL as API_URL, STATIC_DATA, fetchWithFallback } from '../config/api';


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

interface DemoData {
  generated: string;
  coins: number;
  data_range: string;
  strategy: string;
  grid: { sl_values: number[]; tp_values: number[] };
  results: Record<string, ResultData>;
}

interface Props {
  lang?: 'en' | 'ko';
  strategy?: string;
  direction?: string;
  defaultSl?: number;
  defaultTp?: number;
}

const labels = {
  en: {
    tag: 'INTERACTIVE SIMULATION',
    title: 'Try It Yourself',
    desc: (coins: number, range: string) => `Adjust stop-loss and take-profit to see how they affect performance. Simulated on ${coins} coins over ${range} with realistic fees.`,
    sl: 'STOP LOSS',
    tp: 'TAKE PROFIT',
    chart: 'CUMULATIVE RETURN (%)',
    loading: 'Loading simulation data...',
    error: 'Failed to load demo data.',
    noData: 'No data for this combination.',
    disclaimer: '* Simulation includes 0.04% futures fees + 0.02% slippage per trade. Past performance does not guarantee future results.',
    ctaTitle: 'Run this strategy live?',
    ctaDesc: 'You\'ll need an exchange account. Sign up through PRUVIQ to save on fees.',
    ctaExchange: 'Sign Up on Binance (10% off)',
    ctaFees: 'Compare All Exchanges',
    ctaCommunity: 'Join Community',
  },
  ko: {
    tag: '인터랙티브 시뮬레이션',
    title: '직접 체험하기',
    desc: (coins: number, range: string) => `손절과 익절을 조정하여 성과 변화를 확인하세요. ${coins}개 코인, ${range} 데이터, 수수료 포함 시뮬레이션.`,
    sl: '손절 (STOP LOSS)',
    tp: '익절 (TAKE PROFIT)',
    chart: '누적 수익률 (%)',
    loading: '시뮬레이션 데이터 로딩 중...',
    error: '데모 데이터 로딩 실패.',
    noData: '이 조합에 대한 데이터가 없습니다.',
    disclaimer: '* 시뮬레이션은 0.04% 선물 수수료 + 0.02% 슬리피지를 포함합니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
    ctaTitle: '이 전략을 실제로 실행하려면?',
    ctaDesc: '거래소 계정이 필요합니다. PRUVIQ를 통해 가입하면 수수료를 절약할 수 있습니다.',
    ctaExchange: '바이낸스 가입 (10% 할인)',
    ctaFees: '전체 거래소 비교',
    ctaCommunity: '커뮤니티 참여',
  },
};

function DemoSkeleton() {
  return (
    <div class="fade-in border-t border-[--color-border] pt-10 mt-10">
      <div class="mb-6">
        <div class="skeleton h-3 w-40 mb-2" />
        <div class="skeleton h-7 w-48 mb-2" />
        <div class="skeleton h-4 w-96 max-w-full" />
      </div>
      <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl mb-6">
        <div class="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div class="skeleton h-12 w-full rounded" />
          <div class="skeleton h-12 w-full rounded" />
        </div>
      </div>
      <div class="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="skeleton h-16 rounded-lg" />
            <div class="skeleton h-16 rounded-lg" />
            <div class="skeleton h-16 rounded-lg" />
            <div class="skeleton h-16 rounded-lg" />
          </div>
          <div class="skeleton h-1.5 w-full rounded-full" />
        </div>
        <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden">
          <div class="px-4 pt-3">
            <div class="skeleton h-3 w-36" />
          </div>
          <div class="skeleton w-full h-[300px]" />
        </div>
      </div>
    </div>
  );
}

export default function StrategyDemo({
  lang = 'en',
  strategy = 'bb-squeeze-short',
  direction = 'short',
  defaultSl = 10,
  defaultTp = 8,
}: Props) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<DemoData | null>(null);
  const [sl, setSl] = useState(defaultSl);
  const [tp, setTp] = useState(defaultTp);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // Load strategy-specific demo JSON
  const demoUrl = `/data/demo-${strategy}.json`;

  useEffect(() => {
    fetch(demoUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load demo data');
        return res.json();
      })
      .then((json: DemoData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        // Fallback to legacy demo-results.json for bb-squeeze-short
        if (strategy === 'bb-squeeze-short') {
          fetch('/data/demo-results.json')
            .then((res) => res.ok ? res.json() : Promise.reject('no fallback'))
            .then((json: DemoData) => { setData(json); setLoading(false); })
            .catch(() => { setError(err.message); setLoading(false); });
        } else {
          setError(err.message);
          setLoading(false);
        }
      });
  }, [demoUrl]);

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;
    let disposed = false;

    import('lightweight-charts').then(({ createChart, AreaSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: getCssVar('--color-bg-card') },
          textColor: getCssVar('--color-text-muted'),
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: getCssVar('--color-bg-hover') },
          horzLines: { color: getCssVar('--color-bg-hover') },
        },
        rightPriceScale: { borderColor: getCssVar('--color-border') },
        timeScale: { borderColor: getCssVar('--color-border'), timeVisible: false },
        crosshair: {
          vertLine: { color: getCssVar('--color-chart-crosshair'), width: 1, style: 2 },
          horzLine: { color: getCssVar('--color-chart-crosshair'), width: 1, style: 2 },
        },
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: getCssVar('--color-accent'),
        topColor: getCssVar('--color-up-fill'),
        bottomColor: 'rgba(16, 185, 129, 0.0)',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => `${price > 0 ? '+' : ''}${price.toFixed(1)}%`,
        },
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
      });
      ro.observe(chartContainerRef.current);
      roRef.current = ro;

      const key = `sl${sl}_tp${tp}`;
      const result = data.results[key];
      if (result?.equity_curve?.length) {
        series.setData(result.equity_curve);
        chart.timeScale().fitContent();
      }
    });

    return () => {
      disposed = true;
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data]);

  const fetchFromApi = async (slVal: number, tpVal: number): Promise<ResultData | null> => {
    try {
      // Extract base strategy name for API (e.g., "bb-squeeze-short" -> "bb-squeeze")
      const apiStrategy = strategy.replace(/-short$|-long$/, '');
      const res = await fetch(`${API_URL}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: apiStrategy, direction, sl_pct: slVal, tp_pct: tpVal, top_n: 50 }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  useEffect(() => {
    if (!data || !seriesRef.current) return;

    const key = `sl${sl}_tp${tp}`;
    const cached = data.results[key];

    const updateChart = (result: ResultData) => {
      if (!result?.equity_curve?.length || !seriesRef.current) return;
      const isPositive = result.equity_curve[result.equity_curve.length - 1]?.value >= 0;
      const color = isPositive ? getCssVar('--color-accent') : getCssVar('--color-red');
      seriesRef.current.applyOptions({
        lineColor: color,
        topColor: isPositive ? getCssVar('--color-up-fill') : getCssVar('--color-down-fill'),
        bottomColor: isPositive ? 'rgba(16, 185, 129, 0.0)' : 'rgba(255, 68, 68, 0.0)',
      });
      seriesRef.current.setData(result.equity_curve);
      chartRef.current?.timeScale().fitContent();
    };

    if (cached) {
      updateChart(cached);
    } else {
      fetchFromApi(sl, tp).then((apiResult) => {
        if (apiResult) {
          setData((prev) => prev ? { ...prev, results: { ...prev.results, [key]: apiResult } } : prev);
          updateChart(apiResult);
        }
      });
    }
  }, [sl, tp, data]);

  if (loading) return <DemoSkeleton />;

  if (error || !data) {
    return (
      <div class="py-8 text-center">
        <p class="font-mono text-sm text-[--color-red] mb-3">{t.error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetch(demoUrl).then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); }).then((json: DemoData) => { setData(json); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); }); }}
          class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
        >
          {lang === 'ko' ? '다시 시도' : 'Retry'}
        </button>
      </div>
    );
  }

  const key = `sl${sl}_tp${tp}`;
  const result = data.results[key];
  const isDefault = sl === defaultSl && tp === defaultTp;

  return (
    <div id="demo" class="border-t border-[--color-border] pt-10 mt-10 fade-in">
      {/* Header */}
      <div class="mb-6">
        <div class="font-mono text-xs text-[--color-accent] tracking-widest mb-2 uppercase">{t.tag}</div>
        <h2 class="text-2xl font-bold mb-2">{t.title}</h2>
        <p class="text-[--color-text-muted] text-sm leading-relaxed">{t.desc(data.coins, data.data_range)}</p>
      </div>

      {/* Main content */}
      <div class="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {/* Sliders */}
        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          <div class="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <DiscreteSlider label={t.sl} values={data.grid.sl_values} value={sl} defaultValue={defaultSl} onChange={setSl} />
            <DiscreteSlider label={t.tp} values={data.grid.tp_values} value={tp} defaultValue={defaultTp} onChange={setTp} />
          </div>
        </div>

        {/* Results + Chart */}
        <div class="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
            {result ? (
              <ResultsCard data={result} isDefault={isDefault} lang={lang} />
            ) : (
              <div class="font-mono text-sm text-[--color-text-muted]">{t.noData}</div>
            )}
          </div>

          <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden">
            <div class="px-4 pt-3 font-mono text-[0.6875rem] text-[--color-text-muted] tracking-widest uppercase">{t.chart}</div>
            <div ref={chartContainerRef} class="w-full h-[300px]" />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p class="font-mono text-[0.625rem] text-[--color-text-muted] mt-4 leading-relaxed">{t.disclaimer}</p>

      {/* CTA */}
      <div class="mt-8 p-6 bg-[--color-bg-card] border border-[--color-border] rounded-xl card-hover">
        <h3 class="text-lg font-bold mb-2">{t.ctaTitle}</h3>
        <p class="text-[--color-text-muted] text-sm mb-4">{t.ctaDesc}</p>
        <div class="flex gap-3 flex-wrap">
          <a href="https://accounts.binance.com/register?ref=PRUVIQ" target="_blank" rel="noopener"
             class="inline-block px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity" style="background:var(--color-accent);color:#fff">
            {t.ctaExchange} &rarr;
          </a>
          <a href={lang === 'ko' ? '/ko/fees' : '/fees'}
             class="inline-block border border-[--color-border] text-[--color-text] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:border-[--color-accent] transition-colors">
            {t.ctaFees}
          </a>
          <a href="https://t.me/PRUVIQ" target="_blank" rel="noopener" class="inline-block border border-[--color-border] text-[--color-text] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:border-[--color-accent] transition-colors">
            {t.ctaCommunity}
          </a>
        </div>
      </div>
    </div>
  );
}
