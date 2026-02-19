import { useState, useEffect, useRef } from 'preact/hooks';
import ResultsCard from './ResultsCard';
import { API_BASE_URL as API_URL } from '../config/api';

// --- Types ---
interface IndicatorInfo {
  id: string;
  name: string;
  fields: string[];
  default_params: Record<string, number>;
}

interface Condition {
  id: string;
  field: string;
  op: string;
  value?: number | boolean;
  field2?: string;
  shift: number;
}

interface YearlyStat {
  year: number;
  trades: number;
  wins: number;
  win_rate: number;
  total_return_pct: number;
  profit_factor: number;
}

interface BacktestResult {
  name: string;
  direction: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  max_consecutive_losses: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  equity_curve: { time: string; value: number }[];
  yearly_stats: YearlyStat[];
  indicators_used: string[];
  conditions_count: number;
  coins_used: number;
  data_range: string;
  is_valid: boolean;
  validation_errors: string[];
  compute_time_ms: number;
}

interface PresetItem {
  id: string;
  name: string;
  direction: string;
  indicators: string[];
  conditions_count: number;
  sl_pct: number;
  tp_pct: number;
}

// --- i18n ---
const labels = {
  en: {
    tag: 'STRATEGY BUILDER',
    title: 'Build & Backtest',
    desc: 'Design a trading strategy with no code. Pick indicators, set conditions, run a backtest on 535+ coins with 2+ years of data.',
    presets: 'Quick Start',
    presetsDesc: 'Start from a preset, then customize.',
    custom: 'Or build from scratch',
    indicators: 'Indicators',
    indicatorsDesc: 'Select indicators to use in your conditions.',
    conditions: 'Entry Conditions',
    conditionsDesc: 'All conditions must be true (AND logic).',
    addCondition: '+ Add Condition',
    field: 'Field',
    operator: 'Operator',
    compareWith: 'Compare with',
    literalValue: 'Value',
    anotherField: 'Another field',
    shift: 'Candle',
    prevCandle: 'Previous (safe)',
    currentCandle: 'Current (risky)',
    remove: 'Remove',
    params: 'Parameters',
    direction: 'Direction',
    short: 'SHORT',
    long: 'LONG',
    slLabel: 'Stop Loss %',
    tpLabel: 'Take Profit %',
    maxBarsLabel: 'Max Hold (hours)',
    coinsLabel: 'Coins to test',
    avoidHours: 'Avoid Hours (UTC)',
    runBacktest: 'Run Backtest',
    running: 'Running backtest...',
    results: 'Results',
    computeTime: 'Computed in',
    validationFailed: 'Strategy validation failed:',
    noTrades: 'No signals found with these conditions. Try relaxing the criteria.',
    presetError: 'Failed to load preset.',
    serverError: 'Server error. Please try again.',
    apiLoadError: 'Failed to load indicators. Check your connection and reload.',
    crossAbove: 'Cross Above',
    crossBelow: 'Cross Below',
    disclaimer: '* Simulation includes 0.04% futures fees + 0.02% slippage. Past performance does not guarantee future results.',
    chart: 'CUMULATIVE RETURN (%)',
    yearly: 'YEARLY BREAKDOWN',
    year: 'Year',
    yearTrades: 'Trades',
    yearReturn: 'Return',
    yearWR: 'Win Rate',
    yearPF: 'PF',
    tuneParams: 'Tune',
    resetParams: 'Reset to default',
    backtestFailed: 'Backtest failed',
    paramTitle: 'Parameters',
    prevShift: 'prev',
    currShift: 'curr',
    toggleVal: '[val]',
    toggleField: '[field]',
    coinsUnit: 'coins',
    ctaTitle: 'Ready to Trade?',
    ctaDesc: 'Save up to 20% on exchange fees with PRUVIQ referral links.',
    ctaButton: 'Compare Fees',
  },
  ko: {
    tag: '전략 빌더',
    title: '직접 만들고 백테스트',
    desc: '코드 없이 트레이딩 전략을 설계하세요. 지표 선택, 조건 설정, 535+ 코인 2년+ 데이터로 백테스트.',
    presets: '빠른 시작',
    presetsDesc: '프리셋에서 시작한 후 커스터마이즈.',
    custom: '또는 처음부터 만들기',
    indicators: '지표',
    indicatorsDesc: '조건에 사용할 지표를 선택하세요.',
    conditions: '진입 조건',
    conditionsDesc: '모든 조건이 참이어야 진입합니다 (AND 논리).',
    addCondition: '+ 조건 추가',
    field: '필드',
    operator: '연산자',
    compareWith: '비교 대상',
    literalValue: '값',
    anotherField: '다른 필드',
    shift: '캔들',
    prevCandle: '이전 (안전)',
    currentCandle: '현재 (위험)',
    remove: '삭제',
    params: '파라미터',
    direction: '방향',
    short: 'SHORT (매도)',
    long: 'LONG (매수)',
    slLabel: '손절 %',
    tpLabel: '익절 %',
    maxBarsLabel: '최대 보유 (시간)',
    coinsLabel: '테스트 코인 수',
    avoidHours: '회피 시간 (UTC)',
    runBacktest: '백테스트 실행',
    running: '백테스트 실행 중...',
    results: '결과',
    computeTime: '계산 시간',
    validationFailed: '전략 유효성 검증 실패:',
    noTrades: '이 조건으로 시그널이 발견되지 않았습니다. 조건을 완화해 보세요.',
    presetError: '프리셋 로딩 실패.',
    serverError: '서버 오류. 다시 시도해 주세요.',
    apiLoadError: '지표 로딩에 실패했습니다. 연결을 확인하고 새로고침하세요.',
    crossAbove: '상향 돌파',
    crossBelow: '하향 돌파',
    disclaimer: '* 시뮬레이션은 0.04% 선물 수수료 + 0.02% 슬리피지를 포함합니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
    chart: '누적 수익률 (%)',
    yearly: '연도별 분석',
    year: '연도',
    yearTrades: '거래수',
    yearReturn: '수익률',
    yearWR: '승률',
    yearPF: 'PF',
    tuneParams: '조정',
    resetParams: '기본값 복원',
    backtestFailed: '백테스트 실패',
    paramTitle: '파라미터',
    prevShift: '이전',
    currShift: '현재',
    toggleVal: '[값]',
    toggleField: '[필드]',
    coinsUnit: '코인',
    ctaTitle: '실제 거래를 시작하려면?',
    ctaDesc: 'PRUVIQ 추천 링크로 거래소 수수료 최대 20% 할인.',
    ctaButton: '수수료 비교',
  },
};

function getOps(t: typeof labels['en']) {
  return [
    { value: '==', label: '==' },
    { value: '!=', label: '!=' },
    { value: '>', label: '>' },
    { value: '>=', label: '>=' },
    { value: '<', label: '<' },
    { value: '<=', label: '<=' },
    { value: 'cross_above', label: t.crossAbove },
    { value: 'cross_below', label: t.crossBelow },
  ];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let condIdCounter = 0;
function nextCondId() {
  return `c${++condIdCounter}`;
}

// --- Component ---
interface Props {
  lang?: 'en' | 'ko';
}

export default function StrategyBuilder({ lang = 'en' }: Props) {
  const t = labels[lang] || labels.en;

  // State
  const [availableIndicators, setAvailableIndicators] = useState<IndicatorInfo[]>([]);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(new Set(['bb', 'ema', 'volume', 'candle']));
  const [indicatorParams, setIndicatorParams] = useState<Record<string, Record<string, number>>>({});
  const [showParams, setShowParams] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([
    { id: nextCondId(), field: 'is_squeeze', op: '==', value: true, shift: 1 },
    { id: nextCondId(), field: 'bb_width_change', op: '>=', value: 10, shift: 1 },
    { id: nextCondId(), field: 'ema_fast', op: '<', field2: 'ema_slow', shift: 1 },
    { id: nextCondId(), field: 'vol_ratio', op: '>=', value: 2.0, shift: 1 },
    { id: nextCondId(), field: 'bearish', op: '==', value: true, shift: 1 },
  ]);
  const [direction, setDirection] = useState<'short' | 'long'>('short');
  const [slPct, setSlPct] = useState(10);
  const [tpPct, setTpPct] = useState(8);
  const [maxBars, setMaxBars] = useState(48);
  const [topN, setTopN] = useState(50);
  const [avoidHours, setAvoidHours] = useState<Set<number>>(new Set([2, 3, 10, 20, 21, 22, 23]));
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiLoadError, setApiLoadError] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Get all available fields from selected indicators, grouped by indicator
  const availableFields = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .flatMap((ind) => ind.fields);

  const fieldGroups = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .map((ind) => ({ id: ind.id, name: ind.name, fields: ind.fields }));

  // Boolean fields (for value: true/false)
  const booleanFields = new Set([
    'is_squeeze', 'uptrend', 'downtrend', 'bullish', 'bearish', 'doji',
    'hv_squeeze', 'rsi_oversold', 'rsi_overbought', 'macd_crossover',
    'stoch_oversold', 'stoch_overbought', 'strong_trend', 'breakout_up', 'breakout_down',
  ]);

  // Load indicators and presets
  useEffect(() => {
    fetch(`${API_URL}/builder/indicators`)
      .then((r) => r.json())
      .then((data) => { setAvailableIndicators(data); setApiLoadError(false); })
      .catch(() => setApiLoadError(true));
    fetch(`${API_URL}/builder/presets`)
      .then((r) => r.json())
      .then(setPresets)
      .catch(() => {});
  }, []);

  // Load preset
  const loadPreset = async (presetId: string) => {
    try {
      const res = await fetch(`${API_URL}/builder/presets/${presetId}`);
      const preset = await res.json();
      setSelectedIndicators(new Set(Object.keys(preset.indicators)));
      setIndicatorParams({});
      setShowParams(null);
      setDirection(preset.direction);
      setSlPct(preset.sl_pct);
      setTpPct(preset.tp_pct);
      setMaxBars(preset.max_bars);
      setTopN(50);
      setAvoidHours(new Set(preset.avoid_hours));

      const newConds: Condition[] = preset.entry.conditions.map((c: Omit<Condition, 'id'>) => ({
        id: nextCondId(),
        field: c.field,
        op: c.op,
        value: c.value,
        field2: c.field2,
        shift: c.shift ?? 1,
      }));
      setConditions(newConds);
      setResult(null);
      setError(null);
    } catch {
      setError(t.presetError);
    }
  };

  // Toggle indicator
  const toggleIndicator = (id: string) => {
    setSelectedIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clean up conditions referencing fields from this indicator
        const removedFields = new Set(
          availableIndicators.find((ind) => ind.id === id)?.fields || []
        );
        if (removedFields.size > 0) {
          setConditions((prevConds) =>
            prevConds.filter((c) => !removedFields.has(c.field) && (!c.field2 || !removedFields.has(c.field2)))
          );
        }
        if (showParams === id) setShowParams(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Condition CRUD
  const addCondition = () => {
    const firstField = availableFields[0] || 'is_squeeze';
    setConditions((prev) => [
      ...prev,
      { id: nextCondId(), field: firstField, op: '==', value: booleanFields.has(firstField) ? true : 0, shift: 1 },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  // Toggle avoid hour
  const toggleHour = (h: number) => {
    setAvoidHours((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  };

  // Run backtest
  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    const indicatorConfigs: Record<string, Record<string, number>> = {};
    for (const id of selectedIndicators) {
      indicatorConfigs[id] = indicatorParams[id] || {};
    }

    const entryConditions = conditions.map((c) => {
      const cond: { field: string; op: string; shift: number; field2?: string; value?: number | boolean } = { field: c.field, op: c.op, shift: c.shift };
      if (c.field2) cond.field2 = c.field2;
      else cond.value = c.value;
      return cond;
    });

    const body = {
      name: 'Custom Strategy',
      direction,
      indicators: indicatorConfigs,
      entry: { type: 'AND', conditions: entryConditions },
      avoid_hours: Array.from(avoidHours).sort((a, b) => a - b),
      sl_pct: slPct,
      tp_pct: tpPct,
      max_bars: maxBars,
      top_n: topN,
    };

    try {
      const res = await fetch(`${API_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: t.serverError }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data: BacktestResult = await res.json();
      setResult(data);

      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.backtestFailed);
    } finally {
      setIsRunning(false);
    }
  };

  // Chart
  useEffect(() => {
    if (!result?.equity_curve?.length || !chartContainerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('lightweight-charts').then(({ createChart, AreaSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

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
      });

      const isPositive = result.equity_curve[result.equity_curve.length - 1]?.value >= 0;
      const color = isPositive ? getCssVar('--color-accent') : getCssVar('--color-red');

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: isPositive ? getCssVar('--color-up-fill') : getCssVar('--color-down-fill'),
        bottomColor: isPositive ? 'rgba(0, 255, 136, 0.0)' : 'rgba(255, 68, 68, 0.0)',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => `${price > 0 ? '+' : ''}${price.toFixed(1)}%`,
        },
      });

      series.setData(result.equity_curve);
      chart.timeScale().fitContent();
      chartRef.current = chart;
      seriesRef.current = series;

      ro = new ResizeObserver((entries) => {
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
      });
      ro.observe(chartContainerRef.current);
    });

    return () => {
      disposed = true;
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [result]);

  return (
    <div class="space-y-8">
      {/* Header */}
      <div>
        <div class="font-mono text-xs text-[--color-accent] tracking-widest mb-2 uppercase">{t.tag}</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-3">{t.title}</h1>
        <p class="text-[--color-text-muted] text-lg max-w-2xl">{t.desc}</p>
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
          <h3 class="font-mono text-xs text-[--color-accent] tracking-widest mb-1 uppercase">{t.presets}</h3>
          <p class="text-[--color-text-muted] text-sm mb-4">{t.presetsDesc}</p>
          <div class="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p.id)}
                class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg] text-sm font-mono
                       hover:border-[--color-accent] hover:text-[--color-accent] transition-colors cursor-pointer"
              >
                <span class="font-bold">{p.name}</span>
                <span class="text-[--color-text-muted] ml-2 text-xs">
                  {p.direction.toUpperCase()} &middot; SL {p.sl_pct}% / TP {p.tp_pct}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Indicators */}
      <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
        <h3 class="font-mono text-xs text-[--color-accent] tracking-widest mb-1 uppercase">{t.indicators}</h3>
        <p class="text-[--color-text-muted] text-sm mb-4">{t.indicatorsDesc}</p>
        {apiLoadError && (
          <div class="mb-4 p-3 rounded-lg border border-[--color-red]/40 bg-[--color-red]/5">
            <p class="font-mono text-xs text-[--color-red]">{t.apiLoadError}</p>
          </div>
        )}
        <div class="flex flex-wrap gap-2">
          {availableIndicators.map((ind) => {
            const active = selectedIndicators.has(ind.id);
            return (
              <div key={ind.id} class="inline-flex items-center gap-0">
                <button
                  onClick={() => toggleIndicator(ind.id)}
                  class={`px-3 py-1.5 rounded-l-lg border text-sm font-mono cursor-pointer transition-colors
                    ${active
                      ? 'border-[--color-accent] text-[--color-accent] bg-[--color-accent]/10'
                      : 'border-[--color-border] text-[--color-text-muted] hover:border-[--color-text-muted]'
                    }`}
                >
                  {ind.name}
                  <span class="text-xs ml-1 opacity-60">({ind.fields.length})</span>
                </button>
                {active && Object.keys(ind.default_params).length > 0 && (
                  <button
                    onClick={() => setShowParams(showParams === ind.id ? null : ind.id)}
                    class={`px-2 py-1.5 rounded-r-lg border border-l-0 text-[0.6875rem] font-mono cursor-pointer transition-colors min-h-[44px]
                      ${showParams === ind.id
                        ? 'border-[--color-accent] text-[--color-accent] bg-[--color-accent]/20'
                        : 'border-[--color-accent] text-[--color-text-muted] hover:text-[--color-accent]'}`}
                    title={t.tuneParams}
                  >
                    &#9881;
                  </button>
                )}
                {active && Object.keys(ind.default_params).length === 0 && (
                  <span class="px-1 py-1.5 rounded-r-lg border border-l-0 border-[--color-accent] bg-[--color-accent]/10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Parameter Tuning Panel */}
        {showParams && (() => {
          const ind = availableIndicators.find((i) => i.id === showParams);
          if (!ind) return null;
          const customParams = indicatorParams[ind.id] || {};
          return (
            <div class="mt-4 p-4 rounded-lg border border-[--color-accent]/30 bg-[--color-bg]">
              <div class="flex items-center justify-between mb-3">
                <span class="font-mono text-xs text-[--color-accent] font-bold">{ind.name} {t.paramTitle}</span>
                <button
                  onClick={() => {
                    const next = { ...indicatorParams };
                    delete next[ind.id];
                    setIndicatorParams(next);
                  }}
                  class="font-mono text-[0.6875rem] text-[--color-text-muted] hover:text-[--color-accent] cursor-pointer transition-colors"
                >
                  {t.resetParams}
                </button>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(ind.default_params).map(([key, defaultVal]) => (
                  <div key={key}>
                    <label class="font-mono text-[0.6875rem] text-[--color-text-muted] block mb-1">{key}</label>
                    <input
                      type="number"
                      step="any"
                      value={customParams[key] ?? defaultVal}
                      onChange={(e: Event) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        if (isNaN(val)) return;
                        setIndicatorParams((prev) => ({
                          ...prev,
                          [ind.id]: { ...(prev[ind.id] || {}), [key]: val },
                        }));
                      }}
                      class="w-full bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1 text-xs font-mono text-[--color-text]"
                    />
                    <span class="font-mono text-[0.5625rem] text-[--color-text-muted]">default: {defaultVal}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Conditions */}
      <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
        <h3 class="font-mono text-xs text-[--color-accent] tracking-widest mb-1 uppercase">{t.conditions}</h3>
        <p class="text-[--color-text-muted] text-sm mb-4">{t.conditionsDesc}</p>

        <div class="space-y-3">
          {conditions.map((cond, i) => (
            <div key={cond.id} class="flex flex-wrap items-center gap-2 p-2 sm:p-3 rounded-lg bg-[--color-bg] border border-[--color-border]">
              {i > 0 && (
                <span class="font-mono text-xs text-[--color-accent] font-bold w-8">AND</span>
              )}
              {i === 0 && <span class="font-mono text-xs text-[--color-text-muted] w-8">IF</span>}

              {/* Field */}
              <select
                value={cond.field}
                onChange={(e: Event) => {
                  const f = (e.target as HTMLSelectElement).value;
                  const isBool = booleanFields.has(f);
                  updateCondition(cond.id, {
                    field: f,
                    value: isBool ? true : 0,
                    field2: undefined,
                    op: isBool ? '==' : '>=',
                  });
                }}
                class="bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text] min-w-[100px] sm:min-w-[160px]"
              >
                {fieldGroups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.fields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* Op */}
              <select
                value={cond.op}
                onChange={(e: Event) => updateCondition(cond.id, { op: (e.target as HTMLSelectElement).value })}
                class="bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-accent] w-[70px] sm:w-[100px]"
              >
                {getOps(t).map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Value or Field2 */}
              {cond.field2 !== undefined ? (
                <select
                  value={cond.field2}
                  onChange={(e: Event) => updateCondition(cond.id, { field2: (e.target as HTMLSelectElement).value })}
                  class="bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text] min-w-[100px] sm:min-w-[140px]"
                >
                  {availableFields.filter((f) => f !== cond.field).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              ) : booleanFields.has(cond.field) ? (
                <select
                  value={String(cond.value)}
                  onChange={(e: Event) => updateCondition(cond.id, { value: (e.target as HTMLSelectElement).value === 'true' })}
                  class="bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text] w-[70px] sm:w-[80px]"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={cond.value as number}
                  onChange={(e: Event) => updateCondition(cond.id, { value: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                  class="bg-[--color-bg-card] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text] w-[70px] sm:w-[80px]"
                />
              )}

              {/* Toggle value/field2 */}
              {!booleanFields.has(cond.field) && (
                <button
                  onClick={() => {
                    if (cond.field2 !== undefined) {
                      updateCondition(cond.id, { field2: undefined, value: 0 });
                    } else {
                      const other = availableFields.find((f) => f !== cond.field) || '';
                      updateCondition(cond.id, { field2: other, value: undefined });
                    }
                  }}
                  class="text-[0.6875rem] font-mono text-[--color-text-muted] hover:text-[--color-accent] cursor-pointer transition-colors"
                  title={cond.field2 !== undefined ? t.literalValue : t.anotherField}
                >
                  {cond.field2 !== undefined ? t.toggleVal : t.toggleField}
                </button>
              )}

              {/* Shift */}
              <span class="text-[0.6875rem] font-mono text-[--color-text-muted] ml-auto">
                {cond.shift === 1 ? t.prevShift : t.currShift}
              </span>

              {/* Remove */}
              <button
                onClick={() => removeCondition(cond.id)}
                class="text-[--color-red] hover:text-[--color-text] text-sm cursor-pointer transition-colors px-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={t.remove}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addCondition}
          class="mt-3 px-4 py-2 rounded-lg border border-dashed border-[--color-border] text-sm font-mono
                 text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent]
                 transition-colors cursor-pointer w-full"
        >
          {t.addCondition}
        </button>
      </div>

      {/* Parameters */}
      <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
        <h3 class="font-mono text-xs text-[--color-accent] tracking-widest mb-4 uppercase">{t.params}</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Direction */}
          <div>
            <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.direction}</label>
            <div class="flex gap-2">
              <button
                onClick={() => setDirection('short')}
                class={`flex-1 py-2 rounded-lg border text-sm font-mono font-bold cursor-pointer transition-colors
                  ${direction === 'short'
                    ? 'border-[--color-red] text-[--color-red] bg-[--color-red]/10'
                    : 'border-[--color-border] text-[--color-text-muted]'}`}
              >
                {t.short}
              </button>
              <button
                onClick={() => setDirection('long')}
                class={`flex-1 py-2 rounded-lg border text-sm font-mono font-bold cursor-pointer transition-colors
                  ${direction === 'long'
                    ? 'border-[--color-accent] text-[--color-accent] bg-[--color-accent]/10'
                    : 'border-[--color-border] text-[--color-text-muted]'}`}
              >
                {t.long}
              </button>
            </div>
          </div>

          {/* SL */}
          <div>
            <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.slLabel}</label>
            <input
              type="number"
              value={slPct}
              min={0.5}
              max={50}
              step={0.5}
              onChange={(e: Event) => setSlPct(parseFloat((e.target as HTMLInputElement).value) || 10)}
              class="w-full bg-[--color-bg] border border-[--color-border] rounded-lg px-3 py-2 text-sm font-mono text-[--color-text]"
            />
          </div>

          {/* TP */}
          <div>
            <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.tpLabel}</label>
            <input
              type="number"
              value={tpPct}
              min={0.5}
              max={100}
              step={0.5}
              onChange={(e: Event) => setTpPct(parseFloat((e.target as HTMLInputElement).value) || 8)}
              class="w-full bg-[--color-bg] border border-[--color-border] rounded-lg px-3 py-2 text-sm font-mono text-[--color-text]"
            />
          </div>

          {/* Max Bars */}
          <div>
            <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.maxBarsLabel}</label>
            <input
              type="number"
              value={maxBars}
              min={1}
              max={168}
              onChange={(e: Event) => setMaxBars(parseInt((e.target as HTMLInputElement).value) || 48)}
              class="w-full bg-[--color-bg] border border-[--color-border] rounded-lg px-3 py-2 text-sm font-mono text-[--color-text]"
            />
          </div>

          {/* Coins */}
          <div>
            <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.coinsLabel}</label>
            <input
              type="number"
              value={topN}
              min={1}
              max={535}
              onChange={(e: Event) => setTopN(parseInt((e.target as HTMLInputElement).value) || 50)}
              class="w-full bg-[--color-bg] border border-[--color-border] rounded-lg px-3 py-2 text-sm font-mono text-[--color-text]"
            />
          </div>
        </div>

        {/* Avoid Hours */}
        <div class="mt-4">
          <label class="font-mono text-xs text-[--color-text-muted] block mb-2">{t.avoidHours}</label>
          <div class="flex flex-wrap gap-1">
            {HOURS.map((h) => {
              const active = avoidHours.has(h);
              return (
                <button
                  key={h}
                  onClick={() => toggleHour(h)}
                  class={`w-11 h-11 rounded text-xs font-mono cursor-pointer transition-colors
                    ${active
                      ? 'bg-[--color-red]/20 text-[--color-red] border border-[--color-red]/40'
                      : 'bg-[--color-bg] text-[--color-text-muted] border border-[--color-border] hover:border-[--color-text-muted]'
                    }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runBacktest}
        disabled={isRunning || conditions.length === 0}
        class={`w-full py-4 rounded-xl font-bold text-lg font-mono cursor-pointer transition-all
          ${isRunning || conditions.length === 0
            ? 'bg-[--color-border] text-[--color-text-muted] cursor-not-allowed'
            : 'bg-[--color-accent] text-[--color-bg] hover:shadow-[0_0_20px_var(--color-accent-glow)]'
          }`}
      >
        {isRunning ? t.running : t.runBacktest}
      </button>

      {/* Error */}
      {error && (
        <div class="border border-[--color-red]/40 rounded-xl p-4 bg-[--color-red]/5">
          <p class="font-mono text-sm text-[--color-red]">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div ref={resultsRef} class="space-y-6 fade-in">
          <div class="font-mono text-xs text-[--color-accent] tracking-widest uppercase">{t.results}</div>

          {!result.is_valid && (
            <div class="border border-[--color-red]/40 rounded-xl p-4 bg-[--color-red]/5">
              <p class="font-mono text-sm text-[--color-red] font-bold mb-2">{t.validationFailed}</p>
              <ul class="text-sm text-[--color-red] list-disc pl-4">
                {result.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {result.is_valid && result.total_trades === 0 && (
            <div class="border border-[--color-yellow]/40 rounded-xl p-4 bg-[--color-yellow]/5">
              <p class="font-mono text-sm text-[--color-yellow]">{t.noTrades}</p>
            </div>
          )}

          {result.is_valid && result.total_trades > 0 && (
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
                <ResultsCard
                  data={{
                    win_rate: result.win_rate,
                    profit_factor: result.profit_factor,
                    total_return_pct: result.total_return_pct,
                    max_drawdown_pct: result.max_drawdown_pct,
                    total_trades: result.total_trades,
                    tp_count: result.tp_count,
                    sl_count: result.sl_count,
                    timeout_count: result.timeout_count,
                    avg_win_pct: result.avg_win_pct,
                    avg_loss_pct: result.avg_loss_pct,
                    max_consecutive_losses: result.max_consecutive_losses,
                  }}
                  isDefault={false}
                  lang={lang}
                />
                <div class="mt-3 font-mono text-[0.6875rem] text-[--color-text-muted]">
                  {result.coins_used} {t.coinsUnit} &middot; {result.data_range} &middot; {t.computeTime} {result.compute_time_ms}ms
                </div>
              </div>

              <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden">
                <div class="px-4 pt-3 font-mono text-[0.625rem] text-[--color-text-muted] tracking-widest uppercase">{t.chart}</div>
                <div ref={chartContainerRef} class="w-full h-[300px]" />
              </div>
            </div>
          )}

          {/* Yearly Breakdown */}
          {result.yearly_stats?.length > 0 && (
            <div class="bg-[--color-bg-card] border border-[--color-border] rounded-xl overflow-hidden">
              <div class="px-4 pt-3 pb-2 font-mono text-[0.625rem] text-[--color-accent] tracking-widest uppercase">{t.yearly}</div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm font-mono">
                  <thead>
                    <tr class="border-b border-[--color-border] text-[--color-text-muted] text-xs">
                      <th class="px-4 py-2 text-left">{t.year}</th>
                      <th class="px-4 py-2 text-right">{t.yearTrades}</th>
                      <th class="px-4 py-2 text-right">{t.yearWR}</th>
                      <th class="px-4 py-2 text-right">{t.yearPF}</th>
                      <th class="px-4 py-2 text-right">{t.yearReturn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.yearly_stats.map((ys) => (
                      <tr key={ys.year} class="border-b border-[--color-border]/50 hover:bg-[--color-bg-hover] transition-colors">
                        <td class="px-4 py-2 font-bold">{ys.year}</td>
                        <td class="px-4 py-2 text-right text-[--color-text-muted]">{ys.trades}</td>
                        <td class="px-4 py-2 text-right" style={{ color: ys.win_rate >= 50 ? 'var(--color-accent)' : 'var(--color-red)' }}>
                          {ys.win_rate}%
                        </td>
                        <td class="px-4 py-2 text-right" style={{ color: ys.profit_factor >= 1 ? 'var(--color-accent)' : 'var(--color-red)' }}>
                          {ys.profit_factor}
                        </td>
                        <td class="px-4 py-2 text-right font-bold" style={{ color: ys.total_return_pct >= 0 ? 'var(--color-accent)' : 'var(--color-red)' }}>
                          {ys.total_return_pct > 0 ? '+' : ''}{ys.total_return_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p class="font-mono text-[0.625rem] text-[--color-text-muted] leading-relaxed">{t.disclaimer}</p>

          {/* CTA after results */}
          <div class="mt-6 p-5 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-bold text-sm mb-1">{t.ctaTitle}</h3>
                <p class="text-[--color-text-muted] text-xs">{t.ctaDesc}</p>
              </div>
              <a href={lang === 'ko' ? '/ko/fees' : '/fees'} class="shrink-0 bg-[--color-accent] text-[--color-bg] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity whitespace-nowrap">
                {t.ctaButton} &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
