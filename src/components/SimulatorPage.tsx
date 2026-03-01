/**
 * SimulatorPage.tsx - PRUVIQ Strategy Simulator v1.1
 *
 * Layout: 70:30 split (chart left, conditions right), both 640px
 * Below: Backtest results with CSV/Excel download
 *
 * Split into: ChartPanel, BuilderPanel, ResultsPanel
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { API_BASE_URL as API_URL, STATIC_DATA, fetchWithFallback } from '../config/api';
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
    perCoinUsdt: 'Per Coin $', leverage: 'Leverage',
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
    summary: 'Summary', coinsTab: 'Per Coin',
    field: 'Field',
    op: 'Op',
    val: 'Value',
    shift: 'Candle',
    prev: 'Prev',
    curr: 'Curr',
    remove: 'Remove',
    avoidHours: 'Avoid Hours (UTC)',
    short: 'SHORT',
    long: 'LONG',
    symbol: 'Symbol',
    entryTime: 'Entry', exitTime: 'Exit',
    pnl: 'PnL %', reason: 'Reason', held: 'Bars',
    loading: 'Loading...',
    error: 'Error',
    apiDown: 'API unavailable. Using demo mode.',
    disclaimer: 'Past performance does not guarantee future results. This is not financial advice.',
    simNotes: [
      'No duplicate entries — if a coin already has an open position, new signals for that coin are skipped until it closes.',
      'Fees included — results are net of trading fees (0.04%/side) and funding (0.01%/8h).',
      'Slippage not included — real fills may differ from simulated prices.',
    ],
    simNotesTitle: 'How it works',
    mobile: { chart: 'Chart', config: 'Settings', results: 'Results' },
    quickStart: 'New to backtesting?',
    quickStartDesc: 'Try our proven BB Squeeze SHORT strategy — pre-loaded and ready to run.',
    quickStartCta: 'Run BB Squeeze SHORT',
    quickStartDismiss: 'I\'ll build my own',
    lookAheadWarn: 'C = current candle (incomplete in live). P = previous candle (confirmed). Using C may cause look-ahead bias.',
    modifyRerun: 'Modify & Re-run',
    quickAdjust: 'Quick Adjust',
    rerun: 'Re-run',
    copyLink: 'Copy Link',
    linkCopied: 'Copied!',
    history: 'History',
    clearHistory: 'Clear',
    compareWith: 'Compare',
    run1: 'Run 1', run2: 'Run 2', run3: 'Run 3',
  },
  ko: {
    title: '전략 시뮬레이터',
    previewChart: '미리보기 차트',
    conditions: '진입 조건',
    addCondition: '+ 조건 추가',
    parameters: '파라미터',
    direction: '방향',
    sl: '손절 %', tp: '익절 %', maxBars: '최대 보유 (h)',
    perCoinUsdt: '코인당 $', leverage: '레버리지',
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
    summary: '요약', coinsTab: '코인별',
    field: '필드',
    op: '연산',
    val: '값',
    shift: '캔들',
    prev: '이전',
    curr: '현재',
    remove: '삭제',
    avoidHours: '제외 시간 (UTC)',
    short: 'SHORT',
    long: 'LONG',
    symbol: '심볼',
    entryTime: '진입', exitTime: '청산',
    pnl: 'PnL %', reason: '사유', held: '보유',
    loading: '로딩 중...',
    error: '에러',
    apiDown: 'API 연결 불가. 데모 모드로 전환합니다.',
    disclaimer: '과거 성과가 미래 수익을 보장하지 않습니다. 이것은 투자 조언이 아닙니다.',
    simNotes: [
      '중복 진입 불가 — 코인에 열린 포지션이 있으면 청산될 때까지 새 신호는 무시됩니다.',
      '수수료 포함 — 결과는 거래 수수료(0.04%/편도) + 펀딩(0.01%/8h) 차감 후 순수익입니다.',
      '슬리피지 미포함 — 실제 체결가는 시뮬레이션과 다를 수 있습니다.',
    ],
    simNotesTitle: '시뮬레이션 안내',
    mobile: { chart: '차트', config: '설정', results: '결과' },
    quickStart: '백테스팅이 처음이신가요?',
    quickStartDesc: '검증된 BB Squeeze SHORT 전략을 바로 실행해보세요.',
    quickStartCta: 'BB Squeeze SHORT 실행',
    quickStartDismiss: '직접 만들기',
    lookAheadWarn: 'C = 현재 캔들(실거래에서 미완성). P = 이전 캔들(확정됨). C 사용 시 look-ahead bias 위험이 있습니다.',
    modifyRerun: '수정 후 재실행',
    quickAdjust: '빠른 조정',
    rerun: '재실행',
    copyLink: '링크 복사',
    linkCopied: '복사됨!',
    history: '히스토리',
    clearHistory: '초기화',
    compareWith: '비교',
    run1: '실행 1', run2: '실행 2', run3: '실행 3',
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
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // Per-coin USDT + Leverage
  const [perCoinUsdt, setPerCoinUsdt] = useState(60);
  const [leverage, setLeverage] = useState(5);

  // Timeframe
  const [timeframe, setTimeframe] = useState<string>('1H');

  // Chart
  const [chartSymbol, setChartSymbol] = useState('BTCUSDT');
  const [chartData, setChartData] = useState<OhlcvBar[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Backtest
  const [isRunning, setIsRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Results tab
  const [resultTab, setResultTab] = useState<'summary' | 'equity' | 'trades' | 'coins'>('summary');

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'chart' | 'config' | 'results'>('config');
  const scrollPositions = useRef<Record<string, number>>({});

  // Quick Start banner
  const [showQuickStart, setShowQuickStart] = useState(true);

  // History comparison (max 3 results)
  const [history, setHistory] = useState<{ label: string; result: BacktestResult }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Copy link feedback
  const [linkCopied, setLinkCopied] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  // Available fields from selected indicators
  const availableFields = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .flatMap((ind) => ind.fields);

  // Dynamic coin count based on selection mode
  const currentCoinCount = coinMode === 'all' ? coinsLoaded :
                           coinMode === 'top' ? topN :
                           selectedCoins.length;

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
        const data = await fetchWithFallback('/builder/indicators', STATIC_DATA.builderIndicators);
        if (!cancelled) setAvailableIndicators(Array.isArray(data) ? data : data.indicators || []);
      } catch {}

      try {
        const presetsData = await fetchWithFallback('/builder/presets', STATIC_DATA.builderPresets);
        if (!cancelled) setPresets(Array.isArray(presetsData) ? presetsData : presetsData.presets || []);
      } catch {}

      try {
        const coinRes = await fetch(`${API_URL}/coins`);
        if (coinRes.ok) {
          const data = await coinRes.json();
          if (!cancelled) { const arr = Array.isArray(data) ? data : data.coins || []; setAllCoins(arr.map((c: any) => ({ symbol: c.symbol || c }))); }
        } else {
          // Fallback: try static coins-stats for a basic symbol list
          try {
            const stats = await fetchWithFallback('/coins/stats', STATIC_DATA.coinsStats);
            if (!cancelled && Array.isArray(stats.coins)) {
              setAllCoins(stats.coins.map((c: any) => ({ symbol: c.symbol || c })));
            }
          } catch {}
        }
      } catch {}
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ─── URL querystring: read on mount ───
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('sl')) setSlPct(parseFloat(params.get('sl')!) || 10);
      if (params.has('tp')) setTpPct(parseFloat(params.get('tp')!) || 8);
      if (params.has('bars')) setMaxBars(parseInt(params.get('bars')!) || 48);
      if (params.has('dir')) {
        const d = params.get('dir');
        if (d === 'short' || d === 'long') setDirection(d);
      }
      if (params.has('coins')) setTopN(parseInt(params.get('coins')!) || 50);
    } catch {}
  }, []);

  // Build shareable URL from current params
  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set('sl', String(slPct));
    url.searchParams.set('tp', String(tpPct));
    url.searchParams.set('bars', String(maxBars));
    url.searchParams.set('dir', direction);
    if (coinMode === 'top') url.searchParams.set('coins', String(topN));
    if (startDate) url.searchParams.set('start', startDate);
    if (endDate) url.searchParams.set('end', endDate);
    return url.toString();
  }, [slPct, tpPct, maxBars, direction, coinMode, topN, startDate, endDate]);

  const copyLink = useCallback(() => {
    const url = buildShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      // Update URL without reload
      window.history.replaceState(null, '', url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {});
  }, [buildShareUrl]);

  // Mobile tab change with scroll position save/restore
  const handleMobileTabChange = useCallback((newTab: typeof mobileTab) => {
    scrollPositions.current[mobileTab] = window.scrollY;
    setMobileTab(newTab);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositions.current[newTab] || 0);
    });
  }, [mobileTab]);

  // Scroll to builder panel (for Modify & Re-run)
  const scrollToBuilder = useCallback(() => {
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    handleMobileTabChange('config');
  }, [handleMobileTabChange]);

  // Quick Adjust re-run (with changed SL/TP/coins)
  const quickAdjustRerun = useCallback((newSl: number, newTp: number, newTopN: number) => {
    setSlPct(newSl);
    setTpPct(newTp);
    setTopN(newTopN);
    // runBacktest is triggered after state update via a separate effect
  }, []);

  // ─── Chart loading ───
  const loadChart = useCallback(() => {
    if (!chartSymbol) return;
    setChartLoading(true);
    setChartError(null);

    if (!apiReady) {
      setChartError(demoMode ? 'API unavailable — chart data not available in demo mode' : 'Waiting for API...');
      setChartLoading(false);
      return;
    }

    fetch(`${API_URL}/ohlcv/${chartSymbol}?limit=500&timeframe=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data || data.bars) {
          setChartData(data.data || data.bars);
          setChartError(null);
        } else {
          setChartError('No chart data returned for ' + chartSymbol);
        }
      })
      .catch(() => {
        setChartError('Failed to load chart data');
      })
      .finally(() => { setChartLoading(false); });
  }, [chartSymbol, apiReady, demoMode, timeframe]);

  useEffect(() => {
    if (!chartSymbol) return;
    // In demo mode, show error immediately
    if (demoMode && !apiReady) {
      setChartError('API unavailable — chart data not available in demo mode');
      setChartData([]);
      return;
    }
    if (!apiReady) return;
    loadChart();
  }, [chartSymbol, apiReady, demoMode, loadChart]);

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
        scrollPositions.current[mobileTab] = window.scrollY;
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

    // Convert max_bars (user thinks in hours) to the target timeframe's bar count
    const tfHours: Record<string, number> = { '1H': 1, '2H': 2, '4H': 4, '6H': 6, '12H': 12, '1D': 24, '1W': 168 };
    const hoursPerBar = tfHours[timeframe] || 1;
    const adjustedMaxBars = Math.max(6, Math.round(maxBars / hoursPerBar));

    const body: Record<string, any> = {
      name: 'Custom Strategy',
      direction,
      timeframe,
      indicators: indicatorConfigs,
      entry: { type: 'AND', conditions: entryConditions },
      avoid_hours: hoursPerBar >= 24 ? [] : Array.from(avoidHours).sort((a, b) => a - b),
      sl_pct: slPct,
      tp_pct: tpPct,
      max_bars: adjustedMaxBars,
      per_coin_usdt: perCoinUsdt,
      leverage,
    };

    if (coinMode === 'top') body.top_n = topN;
    else if (coinMode === 'select' && selectedCoins.length > 0) body.symbols = selectedCoins;
    else body.top_n = 549;

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
      scrollPositions.current[mobileTab] = window.scrollY;
      setMobileTab('results');
      // Save to history (max 3)
      setHistory((prev) => {
        const label = `SL${slPct}/TP${tpPct}/${direction.toUpperCase()}`;
        const next = [{ label, result: data }, ...prev].slice(0, 3);
        return next;
      });
      // Update URL with current params
      try {
        const url = new URL(window.location.href.split('?')[0]);
        url.searchParams.set('sl', String(slPct));
        url.searchParams.set('tp', String(tpPct));
        url.searchParams.set('bars', String(maxBars));
        url.searchParams.set('dir', direction);
        window.history.replaceState(null, '', url.toString());
      } catch {}
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      clearInterval(progressInterval);
      setIsRunning(false);
    }
  }, [demoMode, selectedIndicators, indicatorParams, conditions, direction, slPct, tpPct, maxBars, avoidHours, coinMode, topN, selectedCoins, startDate, endDate, perCoinUsdt, leverage, timeframe]);

  // ─── Load preset ───
  const loadPreset = useCallback(async (presetId: string) => {
    setActivePreset(presetId);
    setPresetLoading(true);
    setPresetError(null);
    try {
      const res = await fetch(`${API_URL}/builder/presets/${presetId}`);
      if (!res.ok) {
        setPresetError(`Failed to load preset (HTTP ${res.status})`);
        setTimeout(() => setPresetError(null), 3000);
        return;
      }
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
    } catch {
      setPresetError('Failed to load preset. Check connection.');
      setTimeout(() => setPresetError(null), 3000);
    } finally {
      setPresetLoading(false);
    }
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
            onClick={() => handleMobileTabChange(tab)}
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
            error={chartError}
            onRetry={loadChart}
            timeframe={timeframe}
          />
        </div>

        {/* Right: Conditions Panel (30%) */}
        <div ref={builderRef} class={`md:w-[45%] flex-shrink-0 ${mobileTab !== 'config' ? 'hidden md:block' : ''}`}>
          <BuilderPanel
            t={t}
            coinsLoaded={currentCoinCount}
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
            perCoinUsdt={perCoinUsdt} setPerCoinUsdt={setPerCoinUsdt}
            leverage={leverage} setLeverage={setLeverage}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            coinMode={coinMode} setCoinMode={setCoinMode}
            topN={topN} setTopN={setTopN}
            selectedCoins={selectedCoins} setSelectedCoins={setSelectedCoins}
            coinSearch={coinSearch} setCoinSearch={setCoinSearch}
            filteredCoins={filteredCoins}
            allCoinsCount={allCoins.length}
            avoidHours={avoidHours} setAvoidHours={setAvoidHours}
            presets={presets}
            activePreset={activePreset}
            onSelectPreset={onSelectPreset}
            presetLoading={presetLoading}
            presetError={presetError}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
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
          onModifyRerun={scrollToBuilder}
          onQuickAdjustRerun={(sl, tp, coins) => { setSlPct(sl); setTpPct(tp); setTopN(coins); setTimeout(runBacktest, 50); }}
          onCopyLink={copyLink}
          linkCopied={linkCopied}
          slPct={slPct}
          tpPct={tpPct}
          topN={topN}
          isRunning={isRunning}
          history={history}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          onSelectHistory={(idx) => { if (history[idx]) setResult(history[idx].result); }}
          onClearHistory={() => setHistory([])}
        />
      </div>

      {/* How it works + Disclaimer */}
      <div class="mt-6 mb-8 max-w-lg mx-auto">
        {t.simNotes && (
          <details class="mb-3 group">
            <summary class="text-[11px] font-mono text-[--color-text-muted] cursor-pointer select-none hover:text-[--color-accent] transition-colors">
              {t.simNotesTitle} <span class="opacity-50 group-open:rotate-90 inline-block transition-transform">{'▶'}</span>
            </summary>
            <ul class="mt-2 space-y-1.5 text-[11px] text-[--color-text-muted] list-none pl-0">
              {t.simNotes.map((note: string, i: number) => (
                <li key={i} class="flex gap-2">
                  <span class="text-[--color-accent] opacity-60 shrink-0">{'•'}</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p class="text-[--color-text-muted] text-[10px] text-center opacity-60">
          {t.disclaimer}
        </p>
      </div>
    </div>
  );
}
