import { useState, useEffect, useRef } from 'preact/hooks';
import DiscreteSlider from './DiscreteSlider';
import ResultsCard from './ResultsCard';

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

const DEFAULT_SL = 10;
const DEFAULT_TP = 8;
const API_URL = import.meta.env.PUBLIC_PRUVIQ_API_URL || '';

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
    disclaimer: '* Default parameter (SL=10%, TP=8%) is the current verified live setting. Simulation includes 0.04% futures fees + 0.02% slippage per trade. Past performance does not guarantee future results.',
    ctaTitle: 'Ready to Trade?',
    ctaDesc: 'Save up to 20% on trading fees with PRUVIQ referral links. Lifetime discount.',
    ctaFees: 'Compare Exchange Fees',
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
    disclaimer: '* 기본 파라미터 (SL=10%, TP=8%)는 현재 검증된 라이브 설정입니다. 시뮬레이션은 0.04% 선물 수수료 + 0.02% 슬리피지를 포함합니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
    ctaTitle: '실제 거래를 시작하려면?',
    ctaDesc: 'PRUVIQ 제휴 링크로 거래소 수수료 최대 20% 할인. 평생 적용.',
    ctaFees: '거래소 수수료 비교',
    ctaCommunity: '커뮤니티 참여',
  },
};

export default function StrategyDemo({ lang = 'en' }: { lang?: 'en' | 'ko' }) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<DemoData | null>(null);
  const [sl, setSl] = useState(DEFAULT_SL);
  const [tp, setTp] = useState(DEFAULT_TP);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  // Load data once
  useEffect(() => {
    fetch('/data/demo-results.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load demo data');
        return res.json();
      })
      .then((json: DemoData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!data || !chartContainerRef.current) return;

    let disposed = false;

    import('lightweight-charts').then(({ createChart }) => {
      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: '#111111' },
          textColor: '#888888',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        rightPriceScale: {
          borderColor: '#222222',
        },
        timeScale: {
          borderColor: '#222222',
          timeVisible: false,
        },
        crosshair: {
          vertLine: { color: '#00ff8844', width: 1, style: 2 },
          horzLine: { color: '#00ff8844', width: 1, style: 2 },
        },
      });

      const series = chart.addAreaSeries({
        lineColor: '#00ff88',
        topColor: 'rgba(0, 255, 136, 0.2)',
        bottomColor: 'rgba(0, 255, 136, 0.0)',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => `${price > 0 ? '+' : ''}${price.toFixed(1)}%`,
        },
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Responsive resize
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      });
      ro.observe(chartContainerRef.current);

      // Initial data
      const key = `sl${sl}_tp${tp}`;
      const result = data.results[key];
      if (result?.equity_curve?.length) {
        series.setData(result.equity_curve);
        chart.timeScale().fitContent();
      }

      return () => {
        ro.disconnect();
      };
    });

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data]);

  // Fetch from live API when combo not in static grid
  const fetchFromApi = async (slVal: number, tpVal: number): Promise<ResultData | null> => {
    if (!API_URL) return null;
    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'bb-squeeze', direction: 'short',
          sl_pct: slVal, tp_pct: tpVal, top_n: 50,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  // Update chart when SL/TP changes
  useEffect(() => {
    if (!data || !seriesRef.current) return;

    const key = `sl${sl}_tp${tp}`;
    const cached = data.results[key];

    const updateChart = (result: ResultData) => {
      if (!result?.equity_curve?.length || !seriesRef.current) return;
      const isPositive = result.equity_curve[result.equity_curve.length - 1]?.value >= 0;
      const color = isPositive ? '#00ff88' : '#ff4444';
      seriesRef.current.applyOptions({
        lineColor: color,
        topColor: isPositive ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 68, 0.2)',
        bottomColor: isPositive ? 'rgba(0, 255, 136, 0.0)' : 'rgba(255, 68, 68, 0.0)',
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

  if (loading) {
    return (
      <div style={{
        padding: '3rem 0',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
      }}>
        {t.loading}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-red)',
        fontSize: '0.875rem',
      }}>
        {t.error}
      </div>
    );
  }

  const key = `sl${sl}_tp${tp}`;
  const result = data.results[key];
  const isDefault = sl === DEFAULT_SL && tp === DEFAULT_TP;

  return (
    <div id="demo" style={{
      borderTop: '1px solid var(--color-border)',
      paddingTop: '2.5rem',
      marginTop: '2.5rem',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-accent)',
          letterSpacing: '0.1em',
          marginBottom: '0.5rem',
          textTransform: 'uppercase' as const,
        }}>
          {t.tag}
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {t.title}
        </h2>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}>
          {t.desc(data.coins, data.data_range)}
        </p>
      </div>

      {/* Main content: sliders + results on left/top, chart on right/bottom */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '1.5rem',
      }}>
        {/* Sliders */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.75rem',
        }}>
          <DiscreteSlider
            label={t.sl}
            values={data.grid.sl_values}
            value={sl}
            defaultValue={DEFAULT_SL}
            onChange={setSl}
          />
          <DiscreteSlider
            label={t.tp}
            values={data.grid.tp_values}
            value={tp}
            defaultValue={DEFAULT_TP}
            onChange={setTp}
          />
        </div>

        {/* Results + Chart side by side on larger screens */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {/* Results Card */}
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.75rem',
          }}>
            {result ? (
              <ResultsCard data={result} isDefault={isDefault} lang={lang} />
            ) : (
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
              }}>
                {t.noData}
              </div>
            )}
          </div>

          {/* Chart */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.75rem 1rem 0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.625rem',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
            }}>
              {t.chart}
            </div>
            <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.625rem',
        color: 'var(--color-text-muted)',
        marginTop: '1rem',
        lineHeight: 1.6,
      }}>
        {t.disclaimer}
      </p>

      {/* CTA after demo */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {t.ctaTitle}
        </h3>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          marginBottom: '1rem',
        }}>
          {t.ctaDesc}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href={lang === 'ko' ? '/ko/fees' : '/fees'} style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}>
            {t.ctaFees} &rarr;
          </a>
          <a href="https://t.me/PRUVIQ" target="_blank" rel="noopener" style={{
            display: 'inline-block',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}>
            {t.ctaCommunity}
          </a>
        </div>
      </div>
    </div>
  );
}
