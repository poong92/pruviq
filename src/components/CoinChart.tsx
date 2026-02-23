import { useState, useEffect, useRef } from 'preact/hooks';
import { formatPrice, formatVolume, formatVolumeRaw, getCssVar } from '../utils/format';
import { API_BASE_URL as API_URL } from '../config/api';
import type { MouseEventParams, Time } from 'lightweight-charts';


interface OhlcvBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_mid: number | null;
  ema20: number | null;
  ema50: number | null;
  vol_ratio: number | null;
}

const labels = {
  en: {
    bbBands: 'BB Bands',
    ema: 'EMA 20/50',
    volume: 'Volume',
    loading: 'Loading chart data...',
    error: 'Failed to load data.',
    h24high: '24h High',
    h24low: '24h Low',
    h24vol: '24h Volume',
    resetZoom: 'Reset',
    open: 'O',
    high: 'H',
    low: 'L',
    close: 'C',
    vol: 'Vol',
    change: 'Chg',
    dataRange: 'Data Range',
    ctaTitle: 'Build Your Own Strategy',
    ctaDesc: 'Customize conditions and test across all coins.',
    ctaSimulate: 'Strategy Builder',
    ctaFees: 'Save on Fees',
  },
  ko: {
    bbBands: 'BB 밴드',
    ema: 'EMA 20/50',
    volume: '거래량',
    loading: '차트 데이터 로딩 중...',
    error: '데이터 로딩 실패.',
    h24high: '24h 고가',
    h24low: '24h 저가',
    h24vol: '24h 거래량',
    resetZoom: '초기화',
    open: '시',
    high: '고',
    low: '저',
    close: '종',
    vol: '거래량',
    change: '변동',
    dataRange: '데이터 범위',
    ctaTitle: '나만의 전략 만들기',
    ctaDesc: '조건을 커스텀하고 모든 코인에서 테스트하세요.',
    ctaSimulate: '전략 빌더',
    ctaFees: '수수료 절약',
  },
};

function formatChartPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(7);
}

function formatTime(unix: number, lang: string = 'en'): string {
  const d = new Date(unix * 1000);
  if (lang === 'ko') {
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
  }
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
}

function formatDateRange(startUnix: number, endUnix: number): string {
  const s = new Date(startUnix * 1000);
  const e = new Date(endUnix * 1000);
  const fmt = (d: Date) => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  return `${fmt(s)} ~ ${fmt(e)}`;
}

function ToggleBtn({ active, activeColor, label, onClick }: { active: boolean; activeColor: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      class="px-2.5 py-1 rounded font-mono text-[0.5625rem] md:text-[0.6875rem] cursor-pointer transition-all min-h-[44px]"
      style={{
        border: `1px solid ${active ? activeColor : 'var(--color-border)'}`,
        backgroundColor: active ? `${activeColor}15` : 'transparent',
        color: active ? activeColor : 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  );
}

function ChartSkeleton() {
  return (
    <div class="bg-[--color-bg] border border-[--color-border] rounded-xl overflow-hidden mb-3">
      <div class="w-full h-[320px] md:h-[480px] relative">
        <div class="absolute top-4 left-4 flex gap-2">
          <div class="skeleton h-3 w-8" />
          <div class="skeleton h-3 w-12" />
          <div class="skeleton h-3 w-8" />
          <div class="skeleton h-3 w-12" />
        </div>
        <div class="absolute top-4 right-4 flex gap-2">
          <div class="skeleton h-6 w-16 rounded" />
          <div class="skeleton h-6 w-16 rounded" />
          <div class="skeleton h-6 w-14 rounded" />
        </div>
        <div class="flex items-end justify-center h-full px-8 pb-10 gap-1">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} class="skeleton" style={{ width: '6px', height: `${30 + Math.sin(i * 0.3) * 20 + Math.random() * 30}%`, opacity: 0.3 + (i / 40) * 0.4 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CoinChart({ symbol, lang = 'en' }: { symbol: string; lang?: 'en' | 'ko' }) {
  const t = labels[lang] || labels.en;
  const SYMBOL = symbol.toUpperCase();

  const [ohlcv, setOhlcv] = useState<OhlcvBar[] | null>(null);
  const [showBB, setShowBB] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crosshairData, setCrosshairData] = useState<OhlcvBar | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbMidRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const ema20Ref = useRef<any>(null);
  const ema50Ref = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ohlcvMapRef = useRef<Map<number, OhlcvBar>>(new Map());

  // Load OHLCV data
  useEffect(() => {
    const url = `${API_URL}/ohlcv/${SYMBOL}?limit=3000`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(json => {
        setOhlcv(json.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [SYMBOL]);

  // Initialize chart
  useEffect(() => {
    if (!ohlcv || !chartContainerRef.current) return;
    let disposed = false;

    const map = new Map<number, OhlcvBar>();
    for (const bar of ohlcv) map.set(bar.t, bar);
    ohlcvMapRef.current = map;

    import('lightweight-charts').then(({ createChart, CandlestickSeries, LineSeries, HistogramSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { color: getCssVar('--color-bg') },
          textColor: getCssVar('--color-text-muted'),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: getCssVar('--color-chart-grid') },
          horzLines: { color: getCssVar('--color-chart-grid') },
        },
        rightPriceScale: {
          borderColor: getCssVar('--color-bg-hover'),
          scaleMargins: { top: 0.05, bottom: 0.25 },
        },
        timeScale: {
          borderColor: getCssVar('--color-bg-hover'),
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 6,
        },
        crosshair: {
          mode: 0,
          vertLine: { color: `${getCssVar('--color-accent')}33`, width: 1, style: 2, labelBackgroundColor: getCssVar('--color-bg-card') },
          horzLine: { color: `${getCssVar('--color-accent')}33`, width: 1, style: 2, labelBackgroundColor: getCssVar('--color-bg-card') },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: getCssVar('--color-up'),
        downColor: getCssVar('--color-down'),
        wickUpColor: getCssVar('--color-up'),
        wickDownColor: getCssVar('--color-down'),
        borderVisible: false,
        priceFormat: { type: 'price', minMove: ohlcv[0]?.c < 0.01 ? 0.0000001 : ohlcv[0]?.c < 1 ? 0.00001 : 0.01 },
      });
      candleSeries.setData(ohlcv.map(b => ({ time: b.t as any, open: b.o, high: b.h, low: b.l, close: b.c })));
      candleSeriesRef.current = candleSeries;

      const bbUpper = chart.addSeries(LineSeries, { color: getCssVar('--color-chart-bb'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const bbMid = chart.addSeries(LineSeries, { color: 'rgba(100,150,255,0.25)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const bbLower = chart.addSeries(LineSeries, { color: getCssVar('--color-chart-bb'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

      bbUpper.setData(ohlcv.filter(b => b.bb_upper != null).map(b => ({ time: b.t as any, value: b.bb_upper! })));
      bbMid.setData(ohlcv.filter(b => b.bb_mid != null).map(b => ({ time: b.t as any, value: b.bb_mid! })));
      bbLower.setData(ohlcv.filter(b => b.bb_lower != null).map(b => ({ time: b.t as any, value: b.bb_lower! })));
      bbUpperRef.current = bbUpper;
      bbMidRef.current = bbMid;
      bbLowerRef.current = bbLower;

      const ema20 = chart.addSeries(LineSeries, { color: getCssVar('--color-chart-ema20'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false, crosshairMarkerVisible: false });
      const ema50 = chart.addSeries(LineSeries, { color: getCssVar('--color-chart-ema50'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false, crosshairMarkerVisible: false });
      ema20.setData(ohlcv.filter(b => b.ema20 != null).map(b => ({ time: b.t as any, value: b.ema20! })));
      ema50.setData(ohlcv.filter(b => b.ema50 != null).map(b => ({ time: b.t as any, value: b.ema50! })));
      ema20Ref.current = ema20;
      ema50Ref.current = ema50;

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeries.setData(ohlcv.map(b => ({
        time: b.t as any,
        value: b.v,
        color: b.c >= b.o ? getCssVar('--color-chart-vol-up') : getCssVar('--color-chart-vol-down'),
      })));
      volumeSeriesRef.current = volumeSeries;

      chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        if (!param || !param.time) { setCrosshairData(null); return; }
        const bar = ohlcvMapRef.current.get(param.time as number);
        if (bar) setCrosshairData(bar);
      });

      chartRef.current = chart;
      chart.timeScale().fitContent();

      const ro = new ResizeObserver(entries => {
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      ro.observe(chartContainerRef.current);
      return () => ro.disconnect();
    });

    return () => {
      disposed = true;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [ohlcv]);

  useEffect(() => {
    if (bbUpperRef.current) {
      bbUpperRef.current.applyOptions({ visible: showBB });
      bbMidRef.current?.applyOptions({ visible: showBB });
      bbLowerRef.current?.applyOptions({ visible: showBB });
    }
  }, [showBB]);

  useEffect(() => {
    if (ema20Ref.current) {
      ema20Ref.current.applyOptions({ visible: showEMA });
      ema50Ref.current?.applyOptions({ visible: showEMA });
    }
  }, [showEMA]);

  useEffect(() => {
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: showVol });
  }, [showVol]);

  if (loading) {
    return (
      <div class="fade-in">
        {/* Skeleton header */}
        <div class="mb-3">
          <div class="flex items-baseline gap-3 flex-wrap mb-2">
            <div class="skeleton h-7 w-40" />
            <div class="skeleton h-6 w-24" />
            <div class="skeleton h-5 w-16 rounded" />
          </div>
          <div class="flex gap-6 flex-wrap">
            <div class="skeleton h-3 w-28" />
            <div class="skeleton h-3 w-28" />
            <div class="skeleton h-3 w-20" />
          </div>
        </div>
        <ChartSkeleton />
      </div>
    );
  }
  if (error || !ohlcv) {
    return (
      <div class="py-8 text-center">
        <p class="font-mono text-sm text-[--color-red] mb-3">{t.error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetch(`${API_URL}/ohlcv/${SYMBOL}?limit=3000`).then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); }).then(json => { setOhlcv(json.data); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); }); }}
          class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
        >
          {lang === 'ko' ? '다시 시도' : 'Retry'}
        </button>
      </div>
    );
  }

  const lastBar = ohlcv[ohlcv.length - 1];
  const prevBar = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : lastBar;
  const change = prevBar.c ? ((lastBar.c - prevBar.c) / prevBar.c * 100) : 0;
  const last24 = ohlcv.slice(-24);
  const high24 = Math.max(...last24.map(b => b.h));
  const low24 = Math.min(...last24.map(b => b.l));
  const vol24 = last24.reduce((s, b) => s + b.v, 0);

  const displayBar = crosshairData || lastBar;
  const displayChange = crosshairData
    ? ((crosshairData.c - crosshairData.o) / crosshairData.o * 100)
    : change;

  return (
    <div class="fade-in">
      {/* Header */}
      <div class="mb-3">
        <div class="flex items-baseline gap-3 flex-wrap mb-2">
          <h1 class="text-[1.375rem] font-bold font-mono m-0">
            {SYMBOL.endsWith('USDT') ? SYMBOL.slice(0, -4) : SYMBOL}<span class="text-[--color-text-muted] font-normal">/USDT</span>
          </h1>
          <span class="font-mono text-xl font-semibold">${formatChartPrice(lastBar.c)}</span>
          <span
            class={`font-mono text-[0.8125rem] font-semibold px-2 py-0.5 rounded ${change >= 0 ? 'text-[--color-up] bg-[rgba(16,185,129,0.1)]' : 'text-[--color-red] bg-[rgba(255,68,68,0.1)]'}`}
          >
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
        </div>
        <div class="flex gap-6 flex-wrap font-mono text-[0.6875rem] text-[--color-text-muted]">
          <span>{t.h24high}: <span class="text-[--color-up]">${formatChartPrice(high24)}</span></span>
          <span>{t.h24low}: <span class="text-[--color-red]">${formatChartPrice(low24)}</span></span>
          <span>{t.h24vol}: <span class="text-[--color-text]">{formatVolumeRaw(vol24)}</span></span>
          <span>{t.dataRange}: {formatDateRange(ohlcv[0].t, lastBar.t)}</span>
        </div>
      </div>

      {/* Chart Container */}
      <div class="bg-[--color-bg] border border-[--color-border] rounded-xl overflow-hidden mb-3 relative">
        {/* OHLCV Overlay */}
        <div class="absolute top-2 left-3 z-10 font-mono text-[0.5625rem] md:text-[0.6875rem] flex gap-1.5 md:gap-2.5 flex-wrap pointer-events-none">
          <span class="text-[--color-text-muted]">{t.open} <span class="text-[--color-text]">{formatChartPrice(displayBar.o)}</span></span>
          <span class="text-[--color-text-muted]">{t.high} <span class="text-[--color-up]">{formatChartPrice(displayBar.h)}</span></span>
          <span class="text-[--color-text-muted]">{t.low} <span class="text-[--color-red]">{formatChartPrice(displayBar.l)}</span></span>
          <span class="text-[--color-text-muted]">{t.close} <span style={{ color: displayBar.c >= displayBar.o ? 'var(--color-up)' : 'var(--color-down)' }}>{formatChartPrice(displayBar.c)}</span></span>
          <span class="text-[--color-text-muted] hidden sm:inline">{t.vol} <span class="text-[--color-text-muted]">{formatVolumeRaw(displayBar.v)}</span></span>
          <span class={`font-semibold hidden sm:inline ${displayChange >= 0 ? 'text-[--color-up]' : 'text-[--color-red]'}`}>
            {displayChange > 0 ? '+' : ''}{displayChange.toFixed(2)}%
          </span>
        </div>

        {/* Indicator toggles */}
        <div class="absolute top-2 right-3 z-10 flex flex-wrap gap-1.5">
          <ToggleBtn active={showBB} activeColor="rgba(100,150,255,0.8)" label={t.bbBands} onClick={() => setShowBB(!showBB)} />
          <ToggleBtn active={showEMA} activeColor="var(--color-chart-ema20)" label={t.ema} onClick={() => setShowEMA(!showEMA)} />
          <ToggleBtn active={showVol} activeColor="rgba(59,130,246,0.6)" label={t.volume} onClick={() => setShowVol(!showVol)} />
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            aria-label="Reset chart zoom"
            class="px-2 py-1 rounded border border-[--color-border] bg-[--color-bg-tooltip] text-[--color-text-muted] font-mono text-[0.5625rem] md:text-[0.6875rem] cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
          >
            {t.resetZoom}
          </button>
        </div>

        <div ref={chartContainerRef} class="w-full h-[320px] md:h-[480px]" />

        {/* TradingView Attribution */}
        <div class="absolute bottom-1.5 right-3 z-10 font-mono text-[0.5625rem]">
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" class="text-[--color-text-muted] no-underline hover:text-[--color-text] transition-colors">
            Powered by TradingView
          </a>
        </div>
      </div>

      {/* CTA */}
      <div class="mt-6 p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-sm mb-1">{t.ctaTitle}</h3>
            <p class="text-[--color-text-muted] text-xs">{t.ctaDesc}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <a href={lang === 'ko' ? '/ko/simulate' : '/simulate'} class="px-4 py-2 rounded-lg font-semibold text-xs no-underline hover:opacity-90 transition-opacity whitespace-nowrap" style="background:var(--color-accent);color:#fff">
              {t.ctaSimulate} &rarr;
            </a>
            <a href={lang === 'ko' ? '/ko/fees' : '/fees'} class="border border-[--color-border] text-[--color-text] px-4 py-2 rounded-lg font-semibold text-xs no-underline hover:border-[--color-accent] transition-colors whitespace-nowrap">
              {t.ctaFees}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
