/**
 * SimulatorPage.tsx - PRUVIQ Strategy Simulator v1.0
 *
 * Layout: 70:30 split (chart left, conditions right)
 * Below: Backtest results with CSV/Excel download
 *
 * Reuses existing API endpoints and patterns from StrategyBuilder.tsx
 * while providing the new UX flow the user envisioned.
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import ResultsCard from './ResultsCard';
import { API_BASE_URL as API_URL, fetchWithFallback } from '../config/api';
import { formatPrice, formatVolume, winRateColor, profitFactorColor, signColor } from '../utils/format';

// ─── Types ───
interface OhlcvBar {
  t: number; o: number; h: number; l: number; c: number; v: number;
  bb_upper: number | null; bb_lower: number | null; bb_mid: number | null;
  ema20: number | null; ema50: number | null; vol_ratio: number | null;
}

interface IndicatorInfo {
  id: string; name: string; fields: string[]; default_params: Record<string, number>;
}

interface Condition {
  id: string; field: string; op: string; value?: number | boolean;
  field2?: string; shift: number;
}

interface TradeItem {
  symbol: string; direction: string; entry_time: string; exit_time: string;
  entry_price: number; exit_price: number; pnl_pct: number;
  exit_reason: string; bars_held: number;
}

interface YearlyStat {
  year: number; trades: number; wins: number; win_rate: number;
  total_return_pct: number; profit_factor: number;
}

interface BacktestResult {
  name: string; direction: string; total_trades: number; wins: number; losses: number;
  win_rate: number; profit_factor: number; total_return_pct: number;
  max_drawdown_pct: number; avg_win_pct: number; avg_loss_pct: number;
  max_consecutive_losses: number; tp_count: number; sl_count: number; timeout_count: number;
  equity_curve: { time: string; value: number }[];
  yearly_stats?: YearlyStat[];
  indicators_used: string[]; conditions_count: number; coins_used: number;
  data_range: string; is_valid: boolean; validation_errors: string[];
  compute_time_ms: number; _isDemo?: boolean;
  export_hash?: string;
  trades?: TradeItem[];
}

interface PresetItem {
  id: string; name: string; direction: string;
  indicators: string[]; conditions_count: number; sl_pct: number; tp_pct: number;
}

interface CoinOption { symbol: string; name?: string; }

// ─── Helpers ───
let _condId = 0;
function nextCondId() { return `c_${++_condId}`; }

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const OPS = [
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '==', label: '==' },
];

const booleanFields = new Set([
  'is_squeeze', 'uptrend', 'downtrend', 'bullish', 'bearish', 'doji',
  'hv_squeeze', 'rsi_oversold', 'rsi_overbought', 'macd_crossover',
  'stoch_oversold', 'stoch_overbought', 'strong_trend', 'breakout_up', 'breakout_down',
]);

// ─── i18n ───
const L = {
  en: {
    title: 'Strategy Simulator',
    previewChart: 'Preview Chart',
    conditions: 'Entry Conditions',
    addCondition: '+ Add Condition',
    parameters: 'Parameters',
    direction: 'Direction',
    sl: 'Stop Loss %', tp: 'Take Profit %', maxBars: 'Max Hold (h)',
    dateRange: 'Test Period',
    startDate: 'Start', endDate: 'End',
    coins: 'Coins',
    allCoins: 'All Coins',
    topN: 'Top',
    selectCoins: 'Select...',
    preset: 'Presets',
    indicators: 'Indicators',
    run: 'Run Backtest',
    running: 'Running...',
    results: 'Results',
    noResults: 'Run a backtest to see results.',
    exportCsv: 'Download CSV',
    exportExcel: 'Download Excel',
    trades: 'Trade List',
    equity: 'Equity Curve',
    summary: 'Summary',
    field: 'Field',
    op: 'Op',
    val: 'Value',
    shift: 'Candle',
    prev: 'Prev',
    curr: 'Curr',
    remove: 'Remove',
    avoidHours: 'Avoid Hours',
    short: 'SHORT',
    long: 'LONG',
    symbol: 'Symbol',
    entryTime: 'Entry', exitTime: 'Exit',
    pnl: 'PnL %', reason: 'Reason', held: 'Bars',
    loading: 'Loading...',
    error: 'Error',
    apiDown: 'API unavailable. Using demo mode.',
    mobile: { chart: 'Chart', config: 'Settings', results: 'Results' },
  },
};

// ─── Component ───
interface Props { lang?: 'en' | 'ko'; }

export default function SimulatorPage({ lang = 'en' }: Props) {
  const t = L[lang] || L.en;

  // API state
  const [apiReady, setApiReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [coinsLoaded, setCoinsLoaded] = useState(0);

  // Indicator state
  const [availableIndicators, setAvailableIndicators] = useState<IndicatorInfo[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(new Set(['bb', 'ema', 'volume', 'candle']));
  const [indicatorParams, setIndicatorParams] = useState<Record<string, Record<string, number>>>({});

  // Conditions
  const [conditions, setConditions] = useState<Condition[]>([
    { id: nextCondId(), field: 'is_squeeze', op: '==', value: true, shift: 1 },
    { id: nextCondId(), field: 'bb_width_change', op: '>=', value: 10, shift: 1 },
    { id: nextCondId(), field: 'ema_fast', op: '<', field2: 'ema_slow', shift: 1 },
    { id: nextCondId(), field: 'vol_ratio', op: '>=', value: 2.0, shift: 1 },
    { id: nextCondId(), field: 'bearish', op: '==', value: true, shift: 1 },
  ]);

  // Params
  const [direction, setDirection] = useState<'short' | 'long'>('short');
  const [slPct, setSlPct] = useState(10);
  const [tpPct, setTpPct] = useState(8);
  const [maxBars, setMaxBars] = useState(48);
  const [avoidHours, setAvoidHours] = useState<Set<number>>(new Set([2, 3, 10, 20, 21, 22, 23]));

  // Date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Coin selection
  const [coinMode, setCoinMode] = useState<'all' | 'top' | 'select'>('all');
  const [topN, setTopN] = useState(50);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [coinSearch, setCoinSearch] = useState('');
  const [allCoins, setAllCoins] = useState<CoinOption[]>([]);

  // Presets
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>('bb-squeeze-short');

  // Chart
  const [chartSymbol, setChartSymbol] = useState('BTCUSDT');
  const [chartData, setChartData] = useState<OhlcvBar[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Backtest
  const [isRunning, setIsRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Results tab
  const [resultTab, setResultTab] = useState<'summary' | 'equity' | 'trades'>('summary');
  const equityChartRef = useRef<HTMLDivElement>(null);
  const equityInstanceRef = useRef<any>(null);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'chart' | 'config' | 'results'>('config');

  const resultsRef = useRef<HTMLDivElement>(null);

  // Available fields from selected indicators
  const availableFields = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .flatMap((ind) => ind.fields);

  // ─── Init: healthcheck + load indicators + coins ───
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Health check
      try {
        const healthRes = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
        if (healthRes.ok) {
          const h = await healthRes.json();
          setCoinsLoaded(h.coins_loaded || h.coin_count || 0);
          setApiReady(true);
        } else {
          setDemoMode(true);
        }
      } catch {
        setDemoMode(true);
      }

      // Load indicators
      try {
        const indRes = await fetch(`${API_URL}/builder/indicators`);
        if (indRes.ok) {
          const data = await indRes.json();
          if (!cancelled) setAvailableIndicators(Array.isArray(data) ? data : data.indicators || []);
        }
      } catch {}

      // Load presets
      try {
        const presetRes = await fetch(`${API_URL}/builder/presets`);
        if (presetRes.ok) {
          const data = await presetRes.json();
          if (!cancelled) setPresets(Array.isArray(data) ? data : data.presets || []);
        }
      } catch {}

      // Load coin list
      try {
        const coinRes = await fetch(`${API_URL}/coins`);
        if (coinRes.ok) {
          const data = await coinRes.json();
          if (!cancelled) { const arr = Array.isArray(data) ? data : data.coins || []; setAllCoins(arr.map((c: any) => ({ symbol: c.symbol || c }))); }
        }
      } catch {}
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ─── Chart loading ───
  useEffect(() => {
    if (!chartSymbol || !apiReady) return;
    let cancelled = false;
    setChartLoading(true);

    fetch(`${API_URL}/ohlcv/${chartSymbol}?limit=500`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && (data.data || data.bars)) {
          setChartData(data.data || data.bars);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChartLoading(false); });

    return () => { cancelled = true; };
  }, [chartSymbol, apiReady]);

  // ─── Render chart ───
  useEffect(() => {
    if (!chartData.length || !chartContainerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('lightweight-charts').then(({ createChart, CandlestickSeries, LineSeries, HistogramSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      // Cleanup existing
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 400,
        layout: {
          background: { color: getCssVar('--color-bg-card') },
          textColor: getCssVar('--color-text-muted'),
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: getCssVar('--color-bg-hover') },
          horzLines: { color: getCssVar('--color-bg-hover') },
        },
        rightPriceScale: { borderColor: getCssVar('--color-border') },
        timeScale: { borderColor: getCssVar('--color-border'), timeVisible: true },
        crosshair: { mode: 0 },
      });

      // Candlestick
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: getCssVar('--color-up') || '#00ff88',
        downColor: getCssVar('--color-down') || '#ff4444',
        wickUpColor: getCssVar('--color-up') || '#00ff88',
        wickDownColor: getCssVar('--color-down') || '#ff4444',
        borderVisible: false,
      });
      candleSeries.setData(chartData.map((b) => ({
        time: b.t as any, open: b.o, high: b.h, low: b.l, close: b.c,
      })));

      // BB bands
      const hasBB = chartData.some((b) => b.bb_upper != null);
      if (hasBB) {
        const bbUpper = chart.addSeries(LineSeries, {
          color: 'rgba(100, 150, 255, 0.4)', lineWidth: 1, priceLineVisible: false,
          lastValueVisible: false,
        });
        bbUpper.setData(chartData.filter((b) => b.bb_upper != null).map((b) => ({
          time: b.t as any, value: b.bb_upper!,
        })));

        const bbLower = chart.addSeries(LineSeries, {
          color: 'rgba(100, 150, 255, 0.4)', lineWidth: 1, priceLineVisible: false,
          lastValueVisible: false,
        });
        bbLower.setData(chartData.filter((b) => b.bb_lower != null).map((b) => ({
          time: b.t as any, value: b.bb_lower!,
        })));

        const bbMid = chart.addSeries(LineSeries, {
          color: 'rgba(100, 150, 255, 0.2)', lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        bbMid.setData(chartData.filter((b) => b.bb_mid != null).map((b) => ({
          time: b.t as any, value: b.bb_mid!,
        })));
      }

      // Volume as subchart (histogram at bottom)
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volSeries.setData(chartData.map((b) => ({
        time: b.t as any,
        value: b.v,
        color: b.c >= b.o ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)',
      })));

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
      });
      ro.observe(chartContainerRef.current);
    });

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [chartData]);

  // ─── Run backtest ───
  const runBacktest = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgressStep(0);

    // Demo mode
    if (demoMode) {
      const steps = [300, 400, 500, 200, 100];
      for (let i = 0; i < steps.length; i++) {
        setProgressStep(i);
        await new Promise((r) => setTimeout(r, steps[i]));
      }
      try {
        const demoData = await fetch('/data/demo-backtest-result.json').then((r) => r.json());
        setResult({ ...demoData, _isDemo: true });
        setResultTab('summary');
      } catch { setError('Demo data load failed'); }
      finally { setIsRunning(false); }
      return;
    }

    // Build request
    const indicatorConfigs: Record<string, Record<string, number>> = {};
    for (const id of selectedIndicators) {
      indicatorConfigs[id] = indicatorParams[id] || {};
    }

    const entryConditions = conditions.map((c) => {
      const cond: any = { field: c.field, op: c.op, shift: c.shift };
      if (c.field2) cond.field2 = c.field2;
      else cond.value = c.value;
      return cond;
    });

    const body: Record<string, any> = {
      name: 'Custom Strategy',
      direction,
      indicators: indicatorConfigs,
      entry: { type: 'AND', conditions: entryConditions },
      avoid_hours: Array.from(avoidHours).sort((a, b) => a - b),
      sl_pct: slPct,
      tp_pct: tpPct,
      max_bars: maxBars,
    };

    // Coin selection
    if (coinMode === 'top') body.top_n = topN;
    else if (coinMode === 'select' && selectedCoins.length > 0) body.symbols = selectedCoins;
    else body.top_n = 535; // all

    // Date range
    if (startDate) body.start_date = startDate;
    if (endDate) body.end_date = endDate;

    const progressInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 2500);

    try {
      const res = await fetch(`${API_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Server error' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data: BacktestResult = await res.json();
      setResult(data);
      setResultTab('summary');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      clearInterval(progressInterval);
      setIsRunning(false);
    }
  }, [demoMode, selectedIndicators, indicatorParams, conditions, direction, slPct, tpPct, maxBars, avoidHours, coinMode, topN, selectedCoins, startDate, endDate]);

  // ─── Load preset ───
  const loadPreset = useCallback(async (presetId: string) => {
    setActivePreset(presetId);
    try {
      const res = await fetch(`${API_URL}/builder/presets/${presetId}`);
      if (!res.ok) return;
      const p = await res.json();

      // Apply preset settings
      if (p.indicators) {
        setSelectedIndicators(new Set(Object.keys(p.indicators)));
        setIndicatorParams(p.indicators);
      }
      if (p.entry?.conditions) {
        setConditions(p.entry.conditions.map((c: any) => ({ ...c, id: nextCondId() })));
      }
      if (p.direction) setDirection(p.direction);
      if (p.sl_pct) setSlPct(p.sl_pct);
      if (p.tp_pct) setTpPct(p.tp_pct);
      if (p.max_bars) setMaxBars(p.max_bars);
      if (p.avoid_hours) setAvoidHours(new Set(p.avoid_hours));
    } catch {}
  }, []);

  // ─── Equity curve chart ───
  useEffect(() => {
    if (resultTab !== 'equity' || !result?.equity_curve?.length || !equityChartRef.current) return;
    let disposed = false;

    import('lightweight-charts').then(({ createChart, AreaSeries }) => {
      if (disposed || !equityChartRef.current) return;
      if (equityInstanceRef.current) {
        equityInstanceRef.current.remove();
        equityInstanceRef.current = null;
      }

      const chart = createChart(equityChartRef.current, {
        width: equityChartRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: getCssVar('--color-bg-card') },
          textColor: getCssVar('--color-text-muted'),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: getCssVar('--color-bg-hover') },
          horzLines: { color: getCssVar('--color-bg-hover') },
        },
      });

      const isPos = result.equity_curve[result.equity_curve.length - 1]?.value >= 0;
      const color = isPos ? getCssVar('--color-accent') : getCssVar('--color-red');

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: isPos ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%` },
      });
      series.setData(result.equity_curve);
      chart.timeScale().fitContent();
      equityInstanceRef.current = chart;

      const ro = new ResizeObserver((entries) => {
        for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
      });
      ro.observe(equityChartRef.current);
    });

    return () => {
      disposed = true;
      if (equityInstanceRef.current) { equityInstanceRef.current.remove(); equityInstanceRef.current = null; }
    };
  }, [resultTab, result]);

  // ─── CSV download ───
  const downloadCsv = useCallback(() => {
    if (!result) return;
    // If server provides export_hash, use API
    if (result.export_hash) {
      window.open(`${API_URL}/export/csv?hash=${result.export_hash}`, '_blank');
      return;
    }
    // Client-side CSV from equity curve
    const rows = ['time,value'];
    (result.equity_curve || []).forEach((p) => rows.push(`${p.time},${p.value}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pruviq_backtest_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // ─── Condition helpers ───
  const addCondition = () => {
    setConditions((prev) => [...prev, {
      id: nextCondId(), field: availableFields[0] || 'close', op: '>=', value: 0, shift: 1,
    }]);
  };

  const updateCondition = (id: string, key: string, val: any) => {
    setConditions((prev) => prev.map((c) => c.id === id ? { ...c, [key]: val } : c));
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // ─── Filtered coin list for search ───
  const filteredCoins = coinSearch
    ? allCoins.filter((c) => c.symbol.toLowerCase().includes(coinSearch.toLowerCase())).slice(0, 20)
    : allCoins.slice(0, 20);

  // Progress steps label
  const progressLabels = ['Preparing data...', 'Computing indicators...', 'Finding signals...', 'Simulating trades...', 'Building results...'];

  // ────── RENDER ──────
  return (
    <div class="max-w-[1400px] mx-auto px-3 md:px-4">
      {/* Mobile tabs */}
      <div class="md:hidden flex border-b border-[--color-border] mb-3 gap-0">
        {(['chart', 'config', 'results'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            class={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors
              ${mobileTab === tab ? 'text-[--color-accent] border-b-2 border-[--color-accent] sim-btn-active' : 'text-[--color-text-muted] hover:text-[--color-text]'}`}
          >
            {t.mobile[tab]}
          </button>
        ))}
      </div>

      {/* ═══ MAIN SPLIT LAYOUT ═══ */}
      <div class="flex flex-col md:flex-row gap-3">

        {/* ══ LEFT: Chart (70%) ══ */}
        <div class={`md:w-[70%] flex-shrink-0 ${mobileTab !== 'chart' ? 'hidden md:block' : ''}`}>
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
            {/* Chart header */}
            <div class="flex items-center justify-between px-3 py-2 border-b border-[--color-border]">
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm font-bold">{chartSymbol}</span>
                <span class="text-[--color-text-muted] text-xs">1H</span>
              </div>
              {/* Quick coin switch */}
              <div class="flex items-center gap-1.5">
                {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setChartSymbol(sym)}
                    class={`px-2 py-0.5 text-xs font-mono rounded transition-colors
                      ${chartSymbol === sym ? 'bg-[--color-accent]/20 text-[--color-accent] sim-btn-active' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]'}`}
                  >
                    {sym.replace('USDT', '')}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Symbol..."
                  class="w-20 px-2 py-0.5 text-xs font-mono bg-[--color-bg-tooltip] border border-[--color-border] rounded outline-none focus:border-[--color-accent]"
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.toUpperCase().trim();
                      if (val) setChartSymbol(val.endsWith('USDT') ? val : val + 'USDT');
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
            {/* Chart body */}
            <div ref={chartContainerRef} style={{ height: '400px', minHeight: '300px' }}>
              {chartLoading && (
                <div class="flex items-center justify-center h-full text-[--color-text-muted] text-sm">
                  <div class="spinner mr-2" />{t.loading}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Conditions Panel (30%) ══ */}
        <div class={`md:w-[30%] flex-shrink-0 ${mobileTab !== 'config' ? 'hidden md:block' : ''}`}>
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
            {/* Panel header */}
            <div class="px-3 py-2 border-b border-[--color-border]">
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs text-[--color-accent] tracking-wider">STRATEGY BUILDER</span>
                {coinsLoaded > 0 && (
                  <span class="text-[--color-text-muted] text-[10px] font-mono">{coinsLoaded} coins</span>
                )}
              </div>
            </div>

            {/* Scrollable panel content */}
            <div class="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {/* Presets */}
              {presets.length > 0 && (
                <div class="px-3 py-2 border-b border-[--color-border]">
                  <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.preset}</div>
                  <div class="flex flex-wrap gap-1">
                    {/* Custom from-scratch option */}
                    <button
                      onClick={() => {
                        setActivePreset(null);
                        setSelectedIndicators(new Set());
                        setConditions([]);
                        setDirection('short');
                        setSlPct(10);
                        setTpPct(8);
                        setMaxBars(48);
                        setAvoidHours(new Set());
                      }}
                      class={`px-2 py-1 text-[11px] font-mono rounded transition-colors
                        ${activePreset === null
                          ? 'bg-[--color-accent]/20 text-[--color-accent] border border-[--color-accent]/30 sim-btn-active'
                          : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]'}`}
                    >
                      Custom
                    </button>
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => loadPreset(p.id)}
                        class={`px-2 py-1 text-[11px] font-mono rounded transition-colors
                          ${activePreset === p.id
                            ? 'bg-[--color-accent]/20 text-[--color-accent] border border-[--color-accent]/30 sim-btn-active'
                            : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicators */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.indicators}</div>
                <div class="flex flex-wrap gap-1">
                  {availableIndicators.map((ind) => (
                    <button
                      key={ind.id}
                      onClick={() => {
                        setSelectedIndicators((prev) => {
                          const next = new Set(prev);
                          if (next.has(ind.id)) next.delete(ind.id);
                          else next.add(ind.id);
                          return next;
                        });
                      }}
                      class={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors
                        ${selectedIndicators.has(ind.id)
                          ? 'bg-[--color-accent]/15 text-[--color-accent] border border-[--color-accent]/20 sim-btn-active'
                          : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-accent]/20'}`}
                    >
                      {ind.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry Conditions */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-mono text-[--color-text-muted] uppercase">{t.conditions}</span>
                  <button onClick={addCondition} class="text-[10px] font-mono text-[--color-accent] hover:underline">
                    {t.addCondition}
                  </button>
                </div>
                <div class="space-y-1.5">
                  {conditions.map((c) => (
                    <div key={c.id} class="flex items-center gap-1 text-[10px]">
                      {/* Field */}
                      <select
                        value={c.field}
                        onChange={(e: any) => {
                          const newField = e.target.value;
                          updateCondition(c.id, 'field', newField);
                          if (booleanFields.has(newField)) {
                            updateCondition(c.id, 'op', '==');
                            updateCondition(c.id, 'value', true);
                          }
                        }}
                        class="flex-1 min-w-0 px-1 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                      >
                        {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      {/* Op */}
                      <select
                        value={c.op}
                        onChange={(e: any) => updateCondition(c.id, 'op', e.target.value)}
                        class="w-10 px-0.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                      >
                        {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {/* Value */}
                      {booleanFields.has(c.field) ? (
                        <select
                          value={String(c.value)}
                          onChange={(e: any) => updateCondition(c.id, 'value', e.target.value === 'true')}
                          class="w-12 px-0.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type="number"
                          step="any"
                          value={c.value as number}
                          onChange={(e: any) => updateCondition(c.id, 'value', parseFloat(e.target.value))}
                          class="w-14 px-1 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                        />
                      )}
                      {/* Shift */}
                      <select
                        value={c.shift}
                        onChange={(e: any) => updateCondition(c.id, 'shift', parseInt(e.target.value))}
                        class="w-8 px-0.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                        title={c.shift === 1 ? 'Previous candle (safe)' : 'Current candle (risky)'}
                      >
                        <option value="1">P</option>
                        <option value="0">C</option>
                      </select>
                      {/* Remove */}
                      <button
                        onClick={() => removeCondition(c.id)}
                        class="text-[--color-text-muted] hover:text-[--color-red] px-0.5"
                        title={t.remove}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parameters */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.parameters}</div>
                <div class="grid grid-cols-2 gap-1.5">
                  {/* Direction */}
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.direction}</label>
                    <div class="flex gap-1 mt-0.5">
                      <button
                        onClick={() => setDirection('short')}
                        class={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${direction === 'short' ? 'bg-[--color-red]/20 text-[--color-red] border border-[--color-red]/30 sim-btn-active-red' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-red]/30'}`}
                      >{t.short}</button>
                      <button
                        onClick={() => setDirection('long')}
                        class={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${direction === 'long' ? 'bg-[--color-accent]/20 text-[--color-accent] border border-[--color-accent]/30 sim-btn-active' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-accent]/30'}`}
                      >{t.long}</button>
                    </div>
                  </div>
                  {/* Max bars */}
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.maxBars}</label>
                    <input type="number" value={maxBars} min={1} max={168}
                      onChange={(e: any) => setMaxBars(parseInt(e.target.value) || 48)}
                      class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    />
                  </div>
                  {/* SL */}
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.sl}</label>
                    <input type="number" value={slPct} min={1} max={50} step={0.5}
                      onChange={(e: any) => setSlPct(parseFloat(e.target.value) || 10)}
                      class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    />
                  </div>
                  {/* TP */}
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.tp}</label>
                    <input type="number" value={tpPct} min={1} max={50} step={0.5}
                      onChange={(e: any) => setTpPct(parseFloat(e.target.value) || 8)}
                      class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    />
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.dateRange}</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.startDate}</label>
                    <input type="date" value={startDate}
                      onChange={(e: any) => setStartDate(e.target.value)}
                      class="w-full mt-0.5 px-1.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    />
                  </div>
                  <div>
                    <label class="text-[9px] text-[--color-text-muted]">{t.endDate}</label>
                    <input type="date" value={endDate}
                      onChange={(e: any) => setEndDate(e.target.value)}
                      class="w-full mt-0.5 px-1.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    />
                  </div>
                </div>
              </div>

              {/* Coin Selection */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.coins}</div>
                <div class="flex gap-1 mb-1.5">
                  {[
                    { mode: 'all' as const, label: t.allCoins },
                    { mode: 'top' as const, label: `${t.topN} N` },
                    { mode: 'select' as const, label: t.selectCoins },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => setCoinMode(mode)}
                      class={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors
                        ${coinMode === mode
                          ? 'bg-[--color-accent]/15 text-[--color-accent] border border-[--color-accent]/20 sim-btn-active'
                          : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-accent]/20'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {coinMode === 'top' && (
                  <input type="number" value={topN} min={1} max={549}
                    onChange={(e: any) => setTopN(parseInt(e.target.value) || 50)}
                    class="w-full px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
                    placeholder="Number of top coins"
                  />
                )}
                {coinMode === 'select' && (
                  <div>
                    <input
                      type="text"
                      value={coinSearch}
                      onInput={(e: any) => setCoinSearch(e.target.value)}
                      placeholder="Search coins..."
                      class="w-full px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] outline-none mb-1"
                    />
                    {selectedCoins.length > 0 && (
                      <div class="flex flex-wrap gap-0.5 mb-1">
                        {selectedCoins.map((s) => (
                          <span key={s} class="px-1.5 py-0.5 text-[9px] font-mono bg-[--color-accent]/10 text-[--color-accent] rounded flex items-center gap-0.5">
                            {s.replace('USDT', '')}
                            <button onClick={() => setSelectedCoins((p) => p.filter((x) => x !== s))} class="hover:text-[--color-red]">x</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div class="max-h-24 overflow-y-auto">
                      {filteredCoins.map((c) => (
                        <button
                          key={c.symbol}
                          onClick={() => {
                            setSelectedCoins((prev) =>
                              prev.includes(c.symbol) ? prev.filter((x) => x !== c.symbol) : [...prev, c.symbol]
                            );
                          }}
                          class={`block w-full text-left px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-[--color-bg-hover]
                            ${selectedCoins.includes(c.symbol) ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`}
                        >
                          {selectedCoins.includes(c.symbol) ? '✓ ' : ''}{c.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Avoid Hours */}
              <div class="px-3 py-2 border-b border-[--color-border]">
                <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1.5">{t.avoidHours}</div>
                <div class="flex flex-wrap gap-0.5">
                  {Array.from({ length: 24 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAvoidHours((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      }}
                      class={`w-6 h-5 text-[9px] font-mono rounded transition-colors
                        ${avoidHours.has(i)
                          ? 'bg-[--color-red]/20 text-[--color-red] border border-[--color-red]/20 sim-btn-active-red'
                          : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-red]/20'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Button */}
              <div class="px-3 py-3">
                {demoMode && (
                  <div class="text-[9px] text-[--color-yellow] font-mono mb-2 px-2 py-1 bg-[--color-yellow]/10 rounded border border-[--color-yellow]/20">
                    {t.apiDown}
                  </div>
                )}
                <button
                  onClick={runBacktest}
                  disabled={isRunning}
                  class={`w-full py-2.5 rounded-lg font-mono text-sm font-bold transition-colors
                    ${isRunning
                      ? 'bg-[--color-bg-hover] text-[--color-text-muted] cursor-wait'
                      : 'bg-[--color-accent] text-[--color-bg] hover:opacity-90'}`}
                >
                  {isRunning ? (
                    <span class="flex items-center justify-center gap-2">
                      <span class="spinner" />
                      {progressLabels[progressStep] || t.running}
                    </span>
                  ) : t.run}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RESULTS SECTION ═══ */}
      <div ref={resultsRef} class={`mt-3 ${mobileTab !== 'results' && !result ? 'hidden md:block' : ''}`}>
        {error && (
          <div class="border border-[--color-red]/30 rounded-lg p-4 bg-[--color-red]/5 mb-3">
            <span class="font-mono text-sm text-[--color-red]">{t.error}: {error}</span>
          </div>
        )}

        {result ? (
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
            {/* Result tabs */}
            <div class="flex border-b border-[--color-border]">
              {(['summary', 'equity', 'trades'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setResultTab(tab)}
                  class={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors
                    ${resultTab === tab ? 'text-[--color-accent] border-b-2 border-[--color-accent] bg-[--color-bg-hover]/30 sim-btn-active' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]/20'}`}
                >
                  {t[tab]}
                </button>
              ))}
              {/* Export buttons */}
              <div class="flex items-center gap-1 px-3">
                <button onClick={downloadCsv} class="px-2 py-1 text-[10px] font-mono bg-[--color-bg-tooltip] border border-[--color-border] rounded hover:border-[--color-accent] transition-colors hover:bg-[--color-bg-hover]">
                  {t.exportCsv}
                </button>
              </div>
            </div>

            {/* Summary tab */}
            {resultTab === 'summary' && (
              <div class="p-4">
                <ResultsCard data={result} isDefault={activePreset === 'bb-squeeze-short'} lang={lang} isDemo={result._isDemo} />
                {/* Yearly stats */}
                {result.yearly_stats && result.yearly_stats.length > 0 && (
                  <div class="mt-4">
                    <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-2">Yearly Breakdown</div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {result.yearly_stats.map((y) => (
                        <div key={y.year} class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]">
                          <div class="font-mono text-xs font-bold mb-1">{y.year}</div>
                          <div class="grid grid-cols-2 gap-x-2 text-[10px]">
                            <span class="text-[--color-text-muted]">WR</span>
                            <span class="font-mono" style={{ color: winRateColor(y.win_rate) }}>{y.win_rate.toFixed(1)}%</span>
                            <span class="text-[--color-text-muted]">PF</span>
                            <span class="font-mono" style={{ color: profitFactorColor(y.profit_factor) }}>{y.profit_factor.toFixed(2)}</span>
                            <span class="text-[--color-text-muted]">Trades</span>
                            <span class="font-mono">{y.trades}</span>
                            <span class="text-[--color-text-muted]">Return</span>
                            <span class="font-mono" style={{ color: signColor(y.total_return_pct) }}>{y.total_return_pct > 0 ? '+' : ''}{y.total_return_pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Meta info */}
                <div class="mt-3 flex flex-wrap gap-3 text-[10px] text-[--color-text-muted] font-mono">
                  <span>{result.coins_used} coins</span>
                  <span>{result.data_range}</span>
                  <span>{result.compute_time_ms}ms</span>
                  {result._isDemo && <span class="text-[--color-yellow]">DEMO</span>}
                </div>
              </div>
            )}

            {/* Equity tab */}
            {resultTab === 'equity' && (
              <div class="p-4">
                <div ref={equityChartRef} style={{ height: '300px' }} />
              </div>
            )}

            {/* Trades tab */}
            {resultTab === 'trades' && (
              <div class="p-2 overflow-x-auto">
                {result.trades && result.trades.length > 0 ? (
                  <table class="w-full text-[10px] font-mono">
                    <thead>
                      <tr class="text-[--color-text-muted] border-b border-[--color-border]">
                        <th class="py-1.5 px-2 text-left">{t.symbol}</th>
                        <th class="py-1.5 px-2 text-left">{t.entryTime}</th>
                        <th class="py-1.5 px-2 text-left">{t.exitTime}</th>
                        <th class="py-1.5 px-2 text-right">{t.pnl}</th>
                        <th class="py-1.5 px-2 text-center">{t.reason}</th>
                        <th class="py-1.5 px-2 text-right">{t.held}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.slice(0, 200).map((tr, i) => (
                        <tr key={i} class="border-b border-[--color-border]/30 hover:bg-[--color-bg-hover]/30">
                          <td class="py-1 px-2">{tr.symbol?.replace('USDT', '')}</td>
                          <td class="py-1 px-2 text-[--color-text-muted]">{tr.entry_time?.slice(0, 16)}</td>
                          <td class="py-1 px-2 text-[--color-text-muted]">{tr.exit_time?.slice(0, 16)}</td>
                          <td class="py-1 px-2 text-right" style={{ color: signColor(tr.pnl_pct) }}>
                            {tr.pnl_pct > 0 ? '+' : ''}{tr.pnl_pct.toFixed(2)}%
                          </td>
                          <td class="py-1 px-2 text-center">
                            <span class={`px-1 py-0.5 rounded text-[9px] ${
                              tr.exit_reason === 'TP' ? 'bg-green-500/10 text-green-400' :
                              tr.exit_reason === 'SL' ? 'bg-red-500/10 text-red-400' :
                              'bg-yellow-500/10 text-yellow-400'
                            }`}>{tr.exit_reason}</span>
                          </td>
                          <td class="py-1 px-2 text-right text-[--color-text-muted]">{tr.bars_held}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div class="text-center py-8 text-[--color-text-muted] text-sm">
                    Trade details not available for this backtest type.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !error && (
          <div class="hidden md:block border border-[--color-border] rounded-lg bg-[--color-bg-card] p-8 text-center">
            <div class="text-[--color-text-muted] text-sm font-mono">{t.noResults}</div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div class="mt-6 mb-8 text-center">
        <p class="text-[--color-text-muted] text-[10px] max-w-lg mx-auto">
          Past performance does not guarantee future results. Simulations include estimated fees (0.04%) and slippage (0.02%).
          This is not financial advice.
        </p>
      </div>
    </div>
  );
}
