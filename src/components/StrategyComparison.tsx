import { useState, useEffect } from 'preact/hooks';
import { winRateColor, profitFactorColor, signColor } from '../utils/format';
import { API_BASE_URL as API_URL } from '../config/api';

interface PresetFull {
  id: string;
  name: string;
  direction: string;
  indicators: Record<string, Record<string, number>>;
  entry: { type: string; conditions: { field: string; op: string; value?: number | boolean; field2?: string; shift?: number }[] };
  avoid_hours: number[];
  sl_pct: number;
  tp_pct: number;
  max_bars: number;
}

interface BacktestResult {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  compute_time_ms: number;
  coins_used: number;
  data_range: string;
}

const labels = {
  en: {
    tag: 'STRATEGY COMPARISON',
    title: 'Compare All Strategies',
    desc: 'Same conditions, same data. Adjust SL/TP to see how each strategy responds.',
    sl: 'Stop Loss %',
    tp: 'Take Profit %',
    run: 'Compare',
    running: 'Running 5 backtests...',
    loading: 'Loading strategies...',
    strategy: 'Strategy',
    direction: 'Dir',
    trades: 'Trades',
    winRate: 'Win Rate',
    pf: 'PF',
    totalReturn: 'Return',
    maxDD: 'Max DD',
    noData: 'Run comparison to see results.',
    error: 'Failed to load strategies.',
    disclaimer: '* All strategies simulated on 50 coins with identical fees (0.04% + 0.02% slippage). Past performance does not guarantee future results.',
    computeTime: 'Computed in',
    useDefault: 'Use each strategy\'s default SL/TP',
    view: 'Details',
  },
  ko: {
    tag: '전략 비교',
    title: '모든 전략 비교',
    desc: '동일한 조건, 동일한 데이터. SL/TP를 조정하여 각 전략의 반응을 확인하세요.',
    sl: '손절 %',
    tp: '익절 %',
    run: '비교 실행',
    running: '5개 백테스트 실행 중...',
    loading: '전략 로딩 중...',
    strategy: '전략',
    direction: '방향',
    trades: '거래 수',
    winRate: '승률',
    pf: '수익 팩터',
    totalReturn: '수익률',
    maxDD: '최대 DD',
    noData: '비교를 실행하면 결과가 표시됩니다.',
    error: '전략 데이터 로딩 실패.',
    disclaimer: '* 모든 전략은 50개 코인, 동일한 수수료(0.04% + 0.02% 슬리피지)로 시뮬레이션됩니다. 과거 성과는 미래 결과를 보장하지 않습니다.',
    computeTime: '계산 시간',
    useDefault: '각 전략의 기본 SL/TP 사용',
    view: '자세히',
  },
};

const STATUS_MAP: Record<string, { en: string; ko: string; color: string }> = {
  'bb-squeeze-short': { en: 'VERIFIED', ko: '검증됨', color: 'var(--color-accent)' },
  'bb-squeeze-long': { en: 'KILLED', ko: '중단됨', color: 'var(--color-red)' },
  'momentum-long': { en: 'KILLED', ko: '중단됨', color: 'var(--color-red)' },
  'atr-breakout': { en: 'SHELVED', ko: '보류', color: 'var(--color-text-muted)' },
  'hv-squeeze': { en: 'SHELVED', ko: '보류', color: 'var(--color-text-muted)' },
};

interface Props {
  lang?: 'en' | 'ko';
}

export default function StrategyComparison({ lang = 'en' }: Props) {
  const t = labels[lang] || labels.en;
  const [presets, setPresets] = useState<PresetFull[]>([]);
  const [results, setResults] = useState<Record<string, BacktestResult>>({});
  const [slPct, setSlPct] = useState(10);
  const [tpPct, setTpPct] = useState(8);
  const [useDefaults, setUseDefaults] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTime, setTotalTime] = useState(0);

  // Load presets on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const listRes = await fetch(`${API_URL}/builder/presets`);
        const list = await listRes.json();
        const fullPresets: PresetFull[] = [];
        for (const item of list) {
          const res = await fetch(`${API_URL}/builder/presets/${item.id}`);
          fullPresets.push({ ...await res.json(), id: item.id });
        }
        setPresets(fullPresets);
        setIsLoading(false);
      } catch {
        setError(t.error);
        setIsLoading(false);
      }
    };
    loadPresets();
  }, []);

  // Auto-run once presets loaded
  useEffect(() => {
    if (presets.length > 0 && Object.keys(results).length === 0) {
      runComparison();
    }
  }, [presets]);

  const runComparison = async () => {
    if (presets.length === 0) return;
    setIsRunning(true);
    setError(null);
    const newResults: Record<string, BacktestResult> = {};
    let totalMs = 0;

    // Run all 5 backtests in parallel
    const promises = presets.map(async (preset) => {
      try {
        const body = {
          name: preset.name,
          direction: preset.direction,
          indicators: preset.indicators,
          entry: preset.entry,
          avoid_hours: preset.avoid_hours,
          sl_pct: useDefaults ? preset.sl_pct : slPct,
          tp_pct: useDefaults ? preset.tp_pct : tpPct,
          max_bars: preset.max_bars,
          top_n: 50,
        };

        const res = await fetch(`${API_URL}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          newResults[preset.id] = data;
          totalMs += data.compute_time_ms || 0;
        }
      } catch {
        // skip failed
      }
    });

    await Promise.all(promises);
    setResults(newResults);
    setTotalTime(totalMs);
    setIsRunning(false);
  };

  // Sort by total_return_pct descending
  const sortedPresets = [...presets].sort((a, b) => {
    const ra = results[a.id];
    const rb = results[b.id];
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return rb.total_return_pct - ra.total_return_pct;
  });

  const strategyBase = lang === 'ko' ? '/ko/strategies' : '/strategies';

  if (isLoading) {
    return (
      <div class="space-y-6">
        <div class="animate-pulse space-y-3">
          <div class="h-3 w-40 bg-[--color-border] rounded" />
          <div class="h-8 w-64 bg-[--color-border] rounded" />
          <div class="h-4 w-96 max-w-full bg-[--color-border] rounded" />
        </div>
        <div class="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} class="h-16 bg-[--color-border] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-8">
      {/* Header */}
      <div>
        <div class="font-mono text-xs text-[--color-accent] tracking-widest mb-2 uppercase">{t.tag}</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-3">{t.title}</h1>
        <p class="text-[--color-text-muted] text-lg max-w-2xl">{t.desc}</p>
      </div>

      {/* Controls */}
      <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
        <div class="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useDefaults}
              onChange={() => setUseDefaults(!useDefaults)}
              class="accent-[--color-accent] w-4 h-4"
            />
            <span class="font-mono text-sm text-[--color-text-muted]">{t.useDefault}</span>
          </label>

          {!useDefaults && (
            <>
              <div>
                <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.sl}</label>
                <input
                  type="number"
                  value={slPct}
                  min={1}
                  max={50}
                  step={0.5}
                  onChange={(e: Event) => setSlPct(parseFloat((e.target as HTMLInputElement).value) || 10)}
                  class="w-20 bg-[--color-bg] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text]"
                />
              </div>
              <div>
                <label class="font-mono text-xs text-[--color-text-muted] block mb-1">{t.tp}</label>
                <input
                  type="number"
                  value={tpPct}
                  min={1}
                  max={100}
                  step={0.5}
                  onChange={(e: Event) => setTpPct(parseFloat((e.target as HTMLInputElement).value) || 8)}
                  class="w-20 bg-[--color-bg] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-text]"
                />
              </div>
            </>
          )}

          <button
            onClick={runComparison}
            disabled={isRunning || presets.length === 0}
            class={`px-6 py-2.5 rounded-lg font-mono font-bold text-sm cursor-pointer transition-all
              ${isRunning
                ? 'bg-[--color-border] text-[--color-text-muted] cursor-not-allowed'
                : 'bg-[--color-accent] text-[--color-bg] hover:shadow-[0_0_15px_var(--color-up-fill)]'
              }`}
          >
            {isRunning ? t.running : t.run}
          </button>
        </div>
      </div>

      {error && (
        <div class="border border-[--color-red]/40 rounded-xl p-4 bg-[--color-red]/5">
          <p class="font-mono text-sm text-[--color-red]">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isRunning && Object.keys(results).length === 0 && (
        <div class="border border-[--color-border] rounded-xl p-8 bg-[--color-bg-card] text-center">
          <div class="animate-pulse space-y-3">
            <div class="h-4 w-48 bg-[--color-border] rounded mx-auto" />
            <div class="h-3 w-64 bg-[--color-border] rounded mx-auto" />
          </div>
        </div>
      )}

      {/* Results */}
      {Object.keys(results).length > 0 && (
        <>
          {/* Desktop table */}
          <div class="hidden md:block overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
            <table class="w-full font-mono text-sm">
              <thead>
                <tr class="border-b border-[--color-border] text-[--color-text-muted] text-xs uppercase tracking-wider">
                  <th class="px-4 py-3 text-left">{t.strategy}</th>
                  <th class="px-3 py-3 text-center">{t.direction}</th>
                  <th class="px-3 py-3 text-right">{t.trades}</th>
                  <th class="px-3 py-3 text-right">{t.winRate}</th>
                  <th class="px-3 py-3 text-right">{t.pf}</th>
                  <th class="px-3 py-3 text-right">{t.totalReturn}</th>
                  <th class="px-3 py-3 text-right">{t.maxDD}</th>
                  <th class="px-3 py-3 text-right">TP/SL/TO</th>
                  <th class="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedPresets.map((preset) => {
                  const r = results[preset.id];
                  const status = STATUS_MAP[preset.id];
                  if (!r) return null;
                  const total = r.tp_count + r.sl_count + r.timeout_count;
                  return (
                    <tr key={preset.id} class="border-b border-[--color-border] last:border-0 hover:bg-[--color-bg-hover] transition-colors">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <span class="text-[0.6875rem] px-1.5 py-0.5 rounded border"
                                style={{ color: status?.color, borderColor: status?.color }}>
                            {status?.[lang] || ''}
                          </span>
                          <a href={`${strategyBase}/${preset.id}`}
                             class="font-semibold text-[--color-text] hover:text-[--color-accent] transition-colors">
                            {preset.name}
                          </a>
                        </div>
                      </td>
                      <td class="px-3 py-3 text-center">
                        <span class={`text-xs ${preset.direction === 'short' ? 'text-[--color-red]' : 'text-[--color-accent]'}`}>
                          {preset.direction.toUpperCase()}
                        </span>
                      </td>
                      <td class="px-3 py-3 text-right text-[--color-text-muted]">{r.total_trades}</td>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: winRateColor(r.win_rate) }}>
                        {r.win_rate}%
                      </td>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: profitFactorColor(r.profit_factor) }}>
                        {r.profit_factor}
                      </td>
                      <td class="px-3 py-3 text-right font-bold" style={{ color: signColor(r.total_return_pct) }}>
                        {r.total_return_pct > 0 ? '+' : ''}{r.total_return_pct}%
                      </td>
                      <td class="px-3 py-3 text-right text-[--color-red]">
                        {r.max_drawdown_pct}%
                      </td>
                      <td class="px-3 py-3 text-right text-xs">
                        <span class="text-[--color-accent]">{total > 0 ? Math.round(r.tp_count / total * 100) : 0}%</span>
                        {'/'}
                        <span class="text-[--color-red]">{total > 0 ? Math.round(r.sl_count / total * 100) : 0}%</span>
                        {'/'}
                        <span class="text-[--color-text-muted]">{total > 0 ? Math.round(r.timeout_count / total * 100) : 0}%</span>
                      </td>
                      <td class="px-3 py-3 text-center">
                        <a href={`${strategyBase}/${preset.id}`}
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

          {/* Mobile cards */}
          <div class="md:hidden space-y-4">
            {sortedPresets.map((preset) => {
              const r = results[preset.id];
              const status = STATUS_MAP[preset.id];
              if (!r) return null;
              const total = r.tp_count + r.sl_count + r.timeout_count;
              const tpPctVal = total > 0 ? Math.round(r.tp_count / total * 100) : 0;
              const slPctVal = total > 0 ? Math.round(r.sl_count / total * 100) : 0;
              const toPctVal = total > 0 ? Math.round(r.timeout_count / total * 100) : 0;

              return (
                <a key={preset.id}
                   href={`${strategyBase}/${preset.id}`}
                   class="block border border-[--color-border] rounded-xl p-4 bg-[--color-bg-card] hover:border-[--color-accent] transition-colors">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-[0.6875rem] px-1.5 py-0.5 rounded border font-mono"
                          style={{ color: status?.color, borderColor: status?.color }}>
                      {status?.[lang] || ''}
                    </span>
                    <span class="font-mono font-bold text-sm">{preset.name}</span>
                    <span class={`text-xs font-mono ml-auto ${preset.direction === 'short' ? 'text-[--color-red]' : 'text-[--color-accent]'}`}>
                      {preset.direction.toUpperCase()}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 font-mono text-sm mb-3">
                    <div class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]">
                      <div class="text-[0.6875rem] text-[--color-text-muted] uppercase">{t.winRate}</div>
                      <div class="font-bold" style={{ color: winRateColor(r.win_rate) }}>{r.win_rate}%</div>
                    </div>
                    <div class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]">
                      <div class="text-[0.6875rem] text-[--color-text-muted] uppercase">{t.pf}</div>
                      <div class="font-bold" style={{ color: profitFactorColor(r.profit_factor) }}>{r.profit_factor}</div>
                    </div>
                    <div class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]">
                      <div class="text-[0.6875rem] text-[--color-text-muted] uppercase">{t.totalReturn}</div>
                      <div class="font-bold" style={{ color: signColor(r.total_return_pct) }}>
                        {r.total_return_pct > 0 ? '+' : ''}{r.total_return_pct}%
                      </div>
                    </div>
                    <div class="p-2 rounded bg-[--color-bg-tooltip] border border-[--color-border]">
                      <div class="text-[0.6875rem] text-[--color-text-muted] uppercase">{t.maxDD}</div>
                      <div class="font-bold text-[--color-red]">{r.max_drawdown_pct}%</div>
                    </div>
                  </div>

                  {/* Exit bar */}
                  <div class="flex h-1.5 rounded-full overflow-hidden bg-[--color-border] mb-1">
                    <div class="bg-[--color-accent]" style={{ width: `${tpPctVal}%` }} />
                    <div class="bg-[--color-red]" style={{ width: `${slPctVal}%` }} />
                    <div class="bg-[--color-text-muted]" style={{ width: `${toPctVal}%` }} />
                  </div>
                  <div class="flex gap-3 font-mono text-[0.6875rem]">
                    <span class="text-[--color-accent]">TP {tpPctVal}%</span>
                    <span class="text-[--color-red]">SL {slPctVal}%</span>
                    <span class="text-[--color-text-muted]">TO {toPctVal}%</span>
                    <span class="text-[--color-text-muted] ml-auto">{r.total_trades} {t.trades}</span>
                  </div>
                </a>
              );
            })}
          </div>

          <div class="font-mono text-[0.6875rem] text-[--color-text-muted]">
            {t.computeTime} {(totalTime / 1000).toFixed(1)}s
          </div>
        </>
      )}

      <p class="font-mono text-[0.625rem] text-[--color-text-muted] leading-relaxed">{t.disclaimer}</p>
    </div>
  );
}
