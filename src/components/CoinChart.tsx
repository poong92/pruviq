import { useState, useEffect, useRef } from 'preact/hooks';
import { formatPrice, formatVolume, formatVolumeRaw } from '../utils/format';
import DiscreteSlider from './DiscreteSlider';
import { API_BASE_URL as API_URL } from '../config/api';
import type { MouseEventParams, Time, SeriesMarker } from 'lightweight-charts';

// Helper function to get CSS variable values at runtime
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

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

interface TradeDetail {
  entry_time: number;
  entry_price: number;
  exit_time: number;
  exit_price: number;
  pnl_pct: number;
  exit_reason: string;
  bars_held: number;
}

interface SimResult {
  symbol: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  trades: TradeDetail[];
}

const SL_VALUES = [5, 7, 8, 10, 12];
const TP_VALUES = [4, 6, 8, 10, 12];
const DEFAULT_SL = 10;
const DEFAULT_TP = 8;
const labels = {
  en: {
    apply: 'Apply Strategy',
    resim: 'Re-simulate',
    bbBands: 'BB Bands',
    ema: 'EMA 20/50',
    volume: 'Volume',
    sl: 'STOP LOSS',
    tp: 'TAKE PROFIT',
    strategy: 'BB Squeeze SHORT',
    loading: 'Loading chart data...',
    simLoading: 'Simulating...',
    error: 'Failed to load data.',
    noTrades: 'Apply a strategy to see trade signals on the chart.',
    trades: 'Trade History',
    entry: 'Entry',
    exit: 'Exit',
    result: 'Result',
    pnl: 'PnL',
    bars: 'Bars',
    winRate: 'Win Rate',
    pf: 'Profit Factor',
    totalReturn: 'Total Return',
    maxDD: 'Max Drawdown',
    tradesLabel: 'trades',
    live: 'CURRENT LIVE SETTINGS',
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
    disclaimer: 'Simulation includes 0.04% fees + 0.02% slippage. Past performance does not guarantee future results.',
  },
  ko: {
    apply: '전략 적용',
    resim: '재시뮬레이션',
    bbBands: 'BB 밴드',
    ema: 'EMA 20/50',
    volume: '거래량',
    sl: '손절 (STOP LOSS)',
    tp: '익절 (TAKE PROFIT)',
    strategy: 'BB Squeeze SHORT',
    loading: '차트 데이터 로딩 중...',
    simLoading: '시뮬레이션 중...',
    error: '데이터 로딩 실패.',
    noTrades: '전략을 적용하면 차트에 매매 신호가 표시됩니다.',
    trades: '거래 내역',
    entry: '진입',
    exit: '청산',
    result: '결과',
    pnl: 'PnL',
    bars: '봉',
    winRate: '승률',
    pf: '수익 팩터',
    totalReturn: '총 수익률',
    maxDD: '최대 드로다운',
    tradesLabel: '건',
    live: '현재 라이브 설정',
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
    disclaimer: '시뮬레이션은 0.04% 수수료 + 0.02% 슬리피지를 포함합니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
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

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div class="p-2.5 rounded-md bg-[--color-bg-tooltip] border border-[--color-border]">
      <div class="font-mono text-[0.5625rem] text-[--color-text-muted] uppercase tracking-wider mb-0.5">{label}</div>
      <div class="font-mono text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function ToggleBtn({ active, activeColor, label, onClick }: { active: boolean; activeColor: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      class="px-2.5 py-1 rounded font-mono text-[0.6875rem] cursor-pointer transition-all min-h-[44px]"
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
      <div class="w-full h-[480px] relative">
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
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [sl, setSl] = useState(DEFAULT_SL);
  const [tp, setTp] = useState(DEFAULT_TP);
  const [showBB, setShowBB] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);
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
  const autoSimDoneRef = useRef(false);

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
        height: 480,
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
        watermark: {
          visible: true,
          text: `${SYMBOL.replace('USDT', '')}/USDT`,
          fontSize: 48,
          color: 'rgba(255,255,255,0.03)',
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
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
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

  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const url = `${API_URL}/simulate/coin`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: SYMBOL, sl_pct: sl, tp_pct: tp }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const result: SimResult = await res.json();
      setSimResult(result);

      if (candleSeriesRef.current && result.trades.length > 0) {
        const markers: SeriesMarker<Time>[] = [];
        for (const trade of result.trades) {
          markers.push({ time: trade.entry_time as any, position: 'aboveBar', shape: 'arrowDown', color: getCssVar('--color-down'), text: 'S' });
          const exitColor = trade.exit_reason === 'tp' ? getCssVar('--color-up') : trade.exit_reason === 'sl' ? getCssVar('--color-down') : getCssVar('--color-text-muted');
          const exitText = trade.exit_reason === 'tp' ? 'TP' : trade.exit_reason === 'sl' ? 'SL' : 'TO';
          markers.push({ time: trade.exit_time as any, position: 'belowBar', shape: 'arrowUp', color: exitColor, text: exitText });
        }
        markers.sort((a, b) => a.time - b.time);
        candleSeriesRef.current.setMarkers(markers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    if (ohlcv && !autoSimDoneRef.current && chartRef.current) {
      autoSimDoneRef.current = true;
      setTimeout(() => runSimulation(), 300);
    }
  }, [ohlcv, chartRef.current]);

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
    return <div class="py-8 text-center font-mono text-sm text-[--color-red]">{t.error}</div>;
  }

  const lastBar = ohlcv[ohlcv.length - 1];
  const prevBar = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : lastBar;
  const change = prevBar.c ? ((lastBar.c - prevBar.c) / prevBar.c * 100) : 0;
  const isDefault = sl === DEFAULT_SL && tp === DEFAULT_TP;

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
            {SYMBOL.replace('USDT', '')}<span class="text-[--color-text-muted] font-normal">/USDT</span>
          </h1>
          <span class="font-mono text-xl font-semibold">${formatChartPrice(lastBar.c)}</span>
          <span
            class={`font-mono text-[0.8125rem] font-semibold px-2 py-0.5 rounded ${change >= 0 ? 'text-[--color-up] bg-[rgba(0,255,136,0.1)]' : 'text-[--color-red] bg-[rgba(255,68,68,0.1)]'}`}
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
        <div class="absolute top-2 left-3 z-10 font-mono text-[0.6875rem] flex gap-2.5 flex-wrap pointer-events-none">
          <span class="text-[--color-text-muted]">{t.open} <span class="text-[--color-text]">{formatChartPrice(displayBar.o)}</span></span>
          <span class="text-[--color-text-muted]">{t.high} <span class="text-[--color-up]">{formatChartPrice(displayBar.h)}</span></span>
          <span class="text-[--color-text-muted]">{t.low} <span class="text-[--color-red]">{formatChartPrice(displayBar.l)}</span></span>
          <span class="text-[--color-text-muted]">{t.close} <span style={{ color: displayBar.c >= displayBar.o ? 'var(--color-up)' : 'var(--color-down)' }}>{formatChartPrice(displayBar.c)}</span></span>
          <span class="text-[--color-text-muted]">{t.vol} <span class="text-[--color-text-muted]">{formatVolumeRaw(displayBar.v)}</span></span>
          <span class={`font-semibold ${displayChange >= 0 ? 'text-[--color-up]' : 'text-[--color-red]'}`}>
            {displayChange > 0 ? '+' : ''}{displayChange.toFixed(2)}%
          </span>
        </div>

        {/* Indicator toggles */}
        <div class="absolute top-2 right-3 z-10 flex gap-1.5">
          <ToggleBtn active={showBB} activeColor="rgba(100,150,255,0.8)" label={t.bbBands} onClick={() => setShowBB(!showBB)} />
          <ToggleBtn active={showEMA} activeColor="var(--color-chart-ema20)" label={t.ema} onClick={() => setShowEMA(!showEMA)} />
          <ToggleBtn active={showVol} activeColor="rgba(0,255,136,0.6)" label={t.volume} onClick={() => setShowVol(!showVol)} />
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            aria-label="Reset chart zoom"
            class="px-2 py-1 rounded border border-[--color-border] bg-[--color-bg-tooltip] text-[--color-text-muted] font-mono text-[0.6875rem] cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
          >
            {t.resetZoom}
          </button>
        </div>

        <div ref={chartContainerRef} class="w-full h-[480px]" />

        {/* TradingView Attribution */}
        <div class="absolute bottom-1.5 right-3 z-10 font-mono text-[0.5625rem]">
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" class="text-[--color-text-muted] no-underline hover:text-[--color-text] transition-colors">
            Powered by TradingView
          </a>
        </div>
      </div>

      {/* Strategy Controls */}
      <div class="flex flex-wrap gap-3 items-center mb-4 px-4 py-3 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
        <span class="font-mono text-[0.625rem] text-[--color-accent] tracking-widest uppercase font-semibold">{t.strategy}</span>
        <div class="flex-1" />
        <button
          onClick={runSimulation}
          disabled={simLoading}
          class={`px-6 py-2 rounded-md border-none bg-[--color-accent] text-[--color-bg] font-mono text-[0.8125rem] font-semibold transition-opacity ${simLoading ? 'opacity-70 cursor-wait' : 'opacity-100 cursor-pointer hover:opacity-90'}`}
        >
          {simLoading ? (
            <span class="flex items-center gap-2">
              <span class="spinner w-3.5 h-3.5 border-2" />
              {t.simLoading}
            </span>
          ) : (simResult ? t.resim : t.apply)}
        </button>
      </div>

      {/* SL/TP Sliders + Results */}
      <div class="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          <DiscreteSlider label={t.sl} values={SL_VALUES} value={sl} defaultValue={DEFAULT_SL} onChange={setSl} />
          <DiscreteSlider label={t.tp} values={TP_VALUES} value={tp} defaultValue={DEFAULT_TP} onChange={setTp} />
        </div>

        <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
          {simResult ? (
            <div>
              {isDefault && (
                <div class="font-mono text-[0.625rem] text-[--color-accent] tracking-widest mb-3 uppercase">{t.live}</div>
              )}
              <div class="grid grid-cols-2 gap-2 mb-3">
                <MetricBox label={t.winRate} value={`${simResult.win_rate}%`} color={simResult.win_rate >= 55 ? getCssVar('--color-up') : simResult.win_rate >= 50 ? getCssVar('--color-yellow') : getCssVar('--color-down')} />
                <MetricBox label={t.pf} value={`${simResult.profit_factor}`} color={simResult.profit_factor >= 1.5 ? getCssVar('--color-up') : simResult.profit_factor >= 1.0 ? getCssVar('--color-yellow') : getCssVar('--color-down')} />
                <MetricBox label={t.totalReturn} value={`${simResult.total_return_pct > 0 ? '+' : ''}${simResult.total_return_pct}%`} color={simResult.total_return_pct >= 0 ? getCssVar('--color-up') : getCssVar('--color-down')} />
                <MetricBox label={t.maxDD} value={`${simResult.max_drawdown_pct}%`} color={getCssVar('--color-down')} />
              </div>
              <div class="font-mono text-xs text-[--color-text-muted] mb-2">
                {simResult.total_trades} {t.tradesLabel} &middot; TP:{simResult.tp_count} SL:{simResult.sl_count} TO:{simResult.timeout_count}
              </div>
              <div class="flex h-1 rounded-sm overflow-hidden bg-[--color-border]">
                {simResult.total_trades > 0 && (<>
                  <div class="bg-[--color-up]" style={{ width: `${(simResult.tp_count / simResult.total_trades) * 100}%` }} />
                  <div class="bg-[--color-red]" style={{ width: `${(simResult.sl_count / simResult.total_trades) * 100}%` }} />
                  <div class="bg-[--color-text-muted]" style={{ width: `${(simResult.timeout_count / simResult.total_trades) * 100}%` }} />
                </>)}
              </div>
            </div>
          ) : (
            <div class="font-mono text-[0.8125rem] text-[--color-text-muted] py-4">{t.noTrades}</div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p class="font-mono text-[0.5625rem] text-[--color-text-muted] mb-4 leading-relaxed">
        * {t.disclaimer}
      </p>

      {/* Trade History */}
      {simResult && simResult.trades.length > 0 && (
        <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTrades(!showTrades)}
            class={`w-full px-4 py-3 bg-transparent border-none text-[--color-text] font-mono text-[0.8125rem] font-semibold cursor-pointer text-left flex justify-between items-center hover:bg-[--color-bg-hover] transition-colors ${showTrades ? 'border-b border-[--color-border]' : ''}`}
          >
            <span>{showTrades ? '\u25BC' : '\u25B6'} {t.trades} ({simResult.trades.length})</span>
          </button>
          {showTrades && (
            <div class="overflow-x-auto">
              <table class="w-full border-collapse font-mono text-xs">
                <thead>
                  <tr class="border-b border-[--color-border]">
                    <th class="px-3 py-2 text-center text-[--color-text-muted] text-[0.625rem]">#</th>
                    <th class="px-3 py-2 text-left text-[--color-text-muted] text-[0.625rem]">{t.entry}</th>
                    <th class="px-3 py-2 text-left text-[--color-text-muted] text-[0.625rem]">{t.exit}</th>
                    <th class="px-3 py-2 text-center text-[--color-text-muted] text-[0.625rem]">{t.result}</th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.625rem]">{t.pnl}</th>
                    <th class="px-3 py-2 text-right text-[--color-text-muted] text-[0.625rem]">{t.bars}</th>
                  </tr>
                </thead>
                <tbody>
                  {simResult.trades.map((trade, i) => {
                    const color = trade.exit_reason === 'tp' ? getCssVar('--color-up') : trade.exit_reason === 'sl' ? getCssVar('--color-down') : getCssVar('--color-text-muted');
                    const label = trade.exit_reason.toUpperCase();
                    return (
                      <tr
                        key={i}
                        class="border-b border-[--color-border] cursor-pointer row-hover"
                        onClick={() => {
                          if (chartRef.current) {
                            chartRef.current.timeScale().setVisibleRange({
                              from: (trade.entry_time - 3600 * 24) as any,
                              to: (trade.exit_time + 3600 * 24) as any,
                            });
                          }
                        }}
                      >
                        <td class="px-3 py-2 text-center text-[--color-text-muted]">{i + 1}</td>
                        <td class="px-3 py-2">{formatTime(trade.entry_time, lang)}</td>
                        <td class="px-3 py-2">{formatTime(trade.exit_time, lang)}</td>
                        <td class="px-3 py-2 text-center font-semibold" style={{ color }}>{label}</td>
                        <td class="px-3 py-2 text-right" style={{ color: trade.pnl_pct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                          {trade.pnl_pct > 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                        </td>
                        <td class="px-3 py-2 text-right text-[--color-text-muted]">{trade.bars_held}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
