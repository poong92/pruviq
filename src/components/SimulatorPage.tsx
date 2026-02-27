/**
 * SimulatorPage.tsx - PRUVIQ Strategy Simulator v1.1
 *
 * Layout: 70:30 split (chart left, conditions right), both 640px
 * Below: Backtest results with CSV/Excel download
 *
 * Split into: ChartPanel, BuilderPanel, ResultsPanel
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { API_BASE_URL as API_URL } from '../config/api';
import type { OhlcvBar, IndicatorInfo, Condition, BacktestResult, PresetItem, CoinOption } from './simulator-types';
import { nextCondId, COLORS } from './simulator-types';
import ChartPanel from './ChartPanel';
import BuilderPanel from './BuilderPanel';
import ResultsPanel from './ResultsPanel';

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
    runWithCoins: 'Simulate on {n} Coins',
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
    disclaimer: 'Past performance does not guarantee future results. Simulations include estimated fees (0.04%) and slippage (0.02%). This is not financial advice.',
    mobile: { chart: 'Chart', config: 'Settings', results: 'Results' },
    quickStart: 'New to backtesting?',
    quickStartDesc: 'Try our proven BB Squeeze SHORT strategy — pre-loaded and ready to run.',
    quickStartCta: 'Run BB Squeeze SHORT',
    quickStartDismiss: 'I\'ll build my own',
  },
  ko: {
    title: '전략 시뮬레이터',
    previewChart: '미리보기 차트',
    conditions: '진입 조건',
    addCondition: '+ 조건 추가',
    parameters: '파라미터',
    direction: '방향',
    sl: '손절 %', tp: '익절 %', maxBars: '최대 보유 (h)',
    dateRange: '테스트 기간',
    startDate: '시작', endDate: '종료',
    coins: '코인',
    allCoins: '전체',
    topN: '상위',
    selectCoins: '선택...',
    preset: '프리셋',
    indicators: '지표',
    run: '백테스트 실행',
    runWithCoins: '{n}개 코인 시뮬레이션',
    running: '실행 중...',
    results: '결과',
    noResults: '백테스트를 실행하면 결과가 표시됩니다.',
    exportCsv: 'CSV 다운로드',
    exportExcel: 'Excel 다운로드',
    trades: '거래 목록',
    equity: '수익 곡선',
    summary: '요약',
    field: '필드',
    op: '연산',
    val: '값',
    shift: '캔들',
    prev: '이전',
    curr: '현재',
    remove: '삭제',
    avoidHours: '제외 시간',
    short: 'SHORT',
    long: 'LONG',
    symbol: '심볼',
    entryTime: '진입', exitTime: '청산',
    pnl: 'PnL %', reason: '사유', held: '보유',
    loading: '로딩 중...',
    error: '에러',
    apiDown: 'API 연결 불가. 데모 모드로 전환합니다.',
    disclaimer: '과거 성과가 미래 수익을 보장하지 않습니다. 시뮬레이션에는 예상 수수료(0.04%)와 슬리피지(0.02%)가 포함됩니다. 이것은 투자 조언이 아닙니다.',
    mobile: { chart: '차트', config: '설정', results: '결과' },
    quickStart: '백테스팅이 처음이신가요?',
    quickStartDesc: '검증된 BB Squeeze SHORT 전략을 바로 실행해보세요.',
    quickStartCta: 'BB Squeeze SHORT 실행',
    quickStartDismiss: '직접 만들기',
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

  // Backtest
  const [isRunning, setIsRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Results tab
  const [resultTab, setResultTab] = useState<'summary' | 'equity' | 'trades'>('summary');

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'chart' | 'config' | 'results'>('config');

  // Quick Start banner
  const [showQuickStart, setShowQuickStart] = useState(true);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Available fields from selected indicators
  const availableFields = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .flatMap((ind) => ind.fields);

  // ─── Init: healthcheck + load indicators + coins ───
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const healthRes = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
        if (healthRes.ok) {
          const h = await healthRes.json();
          setCoinsLoaded(h.coins_loaded || h.coin_count || 0);
          setApiReady(true);
        } else { setDemoMode(true); }
      } catch { setDemoMode(true); }

      try {
        const indRes = await fetch(`${API_URL}/builder/indicators`);
        if (indRes.ok) {
          const data = await indRes.json();
          if (!cancelled) setAvailableIndicators(Array.isArray(data) ? data : data.indicators || []);
        }
      } catch {}

      try {
        const presetRes = await fetch(`${API_URL}/builder/presets`);
        if (presetRes.ok) {
          const data = await presetRes.json();
          if (!cancelled) setPresets(Array.isArray(data) ? data : data.presets || []);
        }
      } catch {}

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

  // ─── Run backtest ───
  const runBacktest = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgressStep(0);

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
        setMobileTab('results');
      } catch { setError('Demo data load failed'); }
      finally { setIsRunning(false); }
      return;
    }

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

    if (coinMode === 'top') body.top_n = topN;
    else if (coinMode === 'select' && selectedCoins.length > 0) body.symbols = selectedCoins;
    else body.top_n = 535;

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
      setMobileTab('results');
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

  const onSelectPreset = useCallback((id: string | null) => {
    if (id === null) {
      setActivePreset(null);
      setSelectedIndicators(new Set());
      setConditions([]);
      setDirection('short');
      setSlPct(10);
      setTpPct(8);
      setMaxBars(48);
      setAvoidHours(new Set());
    } else {
      loadPreset(id);
    }
  }, [loadPreset]);

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

  const filteredCoins = coinSearch
    ? allCoins.filter((c) => c.symbol.toLowerCase().includes(coinSearch.toLowerCase())).slice(0, 20)
    : allCoins.slice(0, 20);

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
              ${mobileTab === tab ? 'font-bold border-b-2' : 'text-[--color-text-muted] hover:text-[--color-text]'}`}
            style={mobileTab === tab ? { color: COLORS.accent, borderColor: COLORS.accent, background: COLORS.accentBg } : undefined}
          >
            {t.mobile[tab]}
          </button>
        ))}
      </div>

      {/* Quick Start Banner */}
      {showQuickStart && !result && (
        <div class="mb-3 border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderColor: COLORS.accent, background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)` }}>
          <div>
            <p class="font-mono text-sm font-bold" style={{ color: COLORS.accent }}>{t.quickStart}</p>
            <p class="text-[--color-text-muted] text-xs mt-0.5">{t.quickStartDesc}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { loadPreset('bb-squeeze-short'); setShowQuickStart(false); runBacktest(); }}
              class="px-4 py-2 rounded font-mono text-xs font-bold transition-colors hover:opacity-90"
              style={{ background: COLORS.accent, color: '#fff', boxShadow: `0 0 12px ${COLORS.accentGlow}` }}
            >
              {t.quickStartCta} &rarr;
            </button>
            <button
              onClick={() => setShowQuickStart(false)}
              class="px-3 py-2 rounded font-mono text-[10px] text-[--color-text-muted] border border-[--color-border] hover:text-[--color-text] transition-colors"
            >
              {t.quickStartDismiss}
            </button>
          </div>
        </div>
      )}

      {/* Main split layout */}
      <div class="flex flex-col md:flex-row gap-3">
        {/* Left: Chart (70%) */}
        <div class={`md:w-[55%] flex-shrink-0 ${mobileTab !== 'chart' ? 'hidden md:block' : ''}`}>
          <ChartPanel
            chartSymbol={chartSymbol}
            setChartSymbol={setChartSymbol}
            chartData={chartData}
            chartLoading={chartLoading}
            loadingText={t.loading}
            trades={result?.trades}
          />
        </div>

        {/* Right: Conditions Panel (30%) */}
        <div class={`md:w-[45%] flex-shrink-0 ${mobileTab !== 'config' ? 'hidden md:block' : ''}`}>
          <BuilderPanel
            t={t}
            coinsLoaded={coinsLoaded}
            demoMode={demoMode}
            availableIndicators={availableIndicators}
            selectedIndicators={selectedIndicators}
            setSelectedIndicators={setSelectedIndicators}
            availableFields={availableFields}
            conditions={conditions}
            addCondition={addCondition}
            updateCondition={updateCondition}
            removeCondition={removeCondition}
            direction={direction}
            setDirection={setDirection}
            slPct={slPct} setSlPct={setSlPct}
            tpPct={tpPct} setTpPct={setTpPct}
            maxBars={maxBars} setMaxBars={setMaxBars}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            coinMode={coinMode} setCoinMode={setCoinMode}
            topN={topN} setTopN={setTopN}
            selectedCoins={selectedCoins} setSelectedCoins={setSelectedCoins}
            coinSearch={coinSearch} setCoinSearch={setCoinSearch}
            filteredCoins={filteredCoins}
            avoidHours={avoidHours} setAvoidHours={setAvoidHours}
            presets={presets}
            activePreset={activePreset}
            onSelectPreset={onSelectPreset}
            isRunning={isRunning}
            progressStep={progressStep}
            progressLabels={progressLabels}
            onRun={runBacktest}
          />
        </div>
      </div>

      {/* Results section */}
      <div ref={resultsRef} class={`mt-3 ${mobileTab !== 'results' && !result ? 'hidden md:block' : ''}`}>
        <ResultsPanel
          t={t}
          result={result}
          error={error}
          resultTab={resultTab}
          setResultTab={setResultTab}
          activePreset={activePreset}
          lang={lang}
        />
      </div>

      {/* Disclaimer */}
      <div class="mt-6 mb-8 text-center">
        <p class="text-[--color-text-muted] text-[10px] max-w-lg mx-auto">
          {t.disclaimer}
        </p>
      </div>
    </div>
  );
}
