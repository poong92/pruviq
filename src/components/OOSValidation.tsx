import { useState } from 'preact/hooks';
import { API_BASE_URL as API_URL } from '../config/api';

interface OOSPeriodMetrics {
  trades: number;
  win_rate: number;
  total_return: number;
  profit_factor: number;
  max_dd: number;
  avg_win: number;
  avg_loss: number;
}

interface MCEquityBand {
  trade_idx: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

interface ValidateResult {
  strategy: string;
  direction: string;
  coins_used: number;
  data_range: string;
  oos_pct: number;
  oos: {
    is_metrics: OOSPeriodMetrics;
    oos_metrics: OOSPeriodMetrics;
    degradation_ratio: number;
    overfit_risk: string;
  };
  monte_carlo: {
    mean_return: number;
    median_return: number;
    std_return: number;
    percentile_5: number;
    percentile_25: number;
    percentile_75: number;
    percentile_95: number;
    worst_case_return: number;
    best_case_return: number;
    worst_case_mdd: number;
    positive_pct: number;
    n_simulations: number;
    n_trades: number;
    equity_bands: MCEquityBand[];
  };
}

interface Props {
  lang: string;
  strategy?: string;
  direction?: string;
  sl_pct?: number;
  tp_pct?: number;
  max_bars?: number;
  top_n?: number;
}

const t = (lang: string, key: string, fallback: string) => {
  const translations: Record<string, Record<string, string>> = {
    ko: {
      'oos.title': 'Out-of-Sample 검증',
      'oos.desc': '전략이 학습 데이터 밖에서도 작동하는지 확인합니다',
      'oos.split': 'OOS 분할',
      'oos.mc_runs': 'Monte Carlo 시뮬레이션',
      'oos.run': '검증 실행',
      'oos.running': '검증 중...',
      'oos.is_period': '학습 기간 (IS)',
      'oos.oos_period': '검증 기간 (OOS)',
      'oos.trades': '거래 수',
      'oos.win_rate': '승률',
      'oos.return': '수익률',
      'oos.pf': '수익배수',
      'oos.mdd': '최대 낙폭',
      'oos.risk': '과적합 위험도',
      'oos.risk_low': '낮음 — 안전',
      'oos.risk_mid': '보통 — 주의',
      'oos.risk_high': '높음 — 위험',
      'oos.degradation': 'OOS 유지율',
      'mc.title': 'Monte Carlo 시뮬레이션',
      'mc.desc': '거래 순서를 무작위로 섞어 성과의 신뢰 구간을 추정합니다',
      'mc.mean': '평균 수익률',
      'mc.median': '중앙값',
      'mc.ci95': '95% 신뢰 구간',
      'mc.worst_mdd': '최악 낙폭 (95th)',
      'mc.positive': '수익 확률',
      'mc.band_chart': '수익 분포 밴드',
      'mc.p5': '비관적 (5th)',
      'mc.p50': '중앙값 (50th)',
      'mc.p95': '낙관적 (95th)',
      'mc.disclaimer': 'Monte Carlo는 과거 거래 분포가 반복된다고 가정합니다. 실제 결과는 다를 수 있습니다.',
    },
  };
  return translations[lang]?.[key] ?? fallback;
};

export default function OOSValidation({ lang = 'en', strategy = 'bb-squeeze', direction = 'short', sl_pct = 10, tp_pct = 8, max_bars = 48, top_n = 50 }: Props) {
  const [oosPct, setOosPct] = useState(30);
  const [mcRuns, setMcRuns] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runValidation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/simulate/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          direction,
          sl_pct,
          tp_pct,
          max_bars,
          top_n,
          oos_pct: oosPct,
          mc_runs: mcRuns,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed to run validation');
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (risk: string) => {
    if (risk === 'LOW') return 'text-green-400';
    if (risk === 'MEDIUM') return 'text-yellow-400';
    return 'text-red-400';
  };

  const riskLabel = (risk: string) => {
    if (risk === 'LOW') return t(lang, 'oos.risk_low', 'Low — Safe');
    if (risk === 'MEDIUM') return t(lang, 'oos.risk_mid', 'Medium — Caution');
    return t(lang, 'oos.risk_high', 'High — Danger');
  };

  const fmt = (v: number, d = 2) => v.toFixed(d);

  return (
    <div class="space-y-6">
      {/* Controls */}
      <div class="border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-bg-card)]">
        <h3 class="font-bold text-lg mb-1">{t(lang, 'oos.title', 'Out-of-Sample Validation')}</h3>
        <p class="text-[var(--color-text-muted)] text-sm mb-4">{t(lang, 'oos.desc', 'Verify your strategy works on data it has never seen')}</p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="text-xs text-[var(--color-text-muted)] font-mono block mb-1">
              {t(lang, 'oos.split', 'OOS Split')}: {oosPct}%
            </label>
            <input
              type="range" min={10} max={50} step={5} value={oosPct}
              onInput={(e: any) => setOosPct(parseInt(e.target.value))}
              class="w-full accent-[var(--color-accent)]"
            />
            <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-0.5">
              <span>IS: {100 - oosPct}%</span>
              <span>OOS: {oosPct}%</span>
            </div>
          </div>

          <div>
            <label class="text-xs text-[var(--color-text-muted)] font-mono block mb-1">
              {t(lang, 'oos.mc_runs', 'Monte Carlo Simulations')}
            </label>
            <select
              value={mcRuns}
              onChange={(e: any) => setMcRuns(parseInt(e.target.value))}
              class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={2000}>2,000</option>
              <option value={5000}>5,000</option>
            </select>
          </div>

          <div class="flex items-end">
            <button
              onClick={runValidation}
              disabled={loading}
              class="w-full bg-[var(--color-accent)] text-[var(--color-bg)] px-4 py-2 rounded font-semibold text-sm hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {loading ? t(lang, 'oos.running', 'Validating...') : t(lang, 'oos.run', 'Run Validation')}
            </button>
          </div>
        </div>

        {/* IS/OOS visual bar */}
        <div class="h-2 rounded-full overflow-hidden bg-[var(--color-border)] flex">
          <div class="bg-[var(--color-accent)]" style={{ width: `${100 - oosPct}%` }} title="In-Sample" />
          <div class="bg-[var(--color-accent)]/30" style={{ width: `${oosPct}%` }} title="Out-of-Sample" />
        </div>
        <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
          <span>{t(lang, 'oos.is_period', 'Training (IS)')}</span>
          <span>{t(lang, 'oos.oos_period', 'Validation (OOS)')}</span>
        </div>
      </div>

      {error && (
        <div class="border border-red-500/30 rounded-lg p-4 bg-red-500/5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* OOS Comparison Table */}
          <div class="border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-bg-card)]">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold">{t(lang, 'oos.title', 'Out-of-Sample Validation')}</h3>
              <span class={`font-mono text-sm font-bold ${riskColor(result.oos.overfit_risk)}`}>
                {riskLabel(result.oos.overfit_risk)}
              </span>
            </div>

            {/* Desktop table */}
            <div class="hidden sm:block overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--color-border)]">
                    <th class="text-left py-2 px-3 font-mono text-xs text-[var(--color-text-muted)]">{t(lang, 'vs.feature', 'Metric')}</th>
                    <th class="text-right py-2 px-3 font-mono text-xs text-[var(--color-accent)]">{t(lang, 'oos.is_period', 'Training (IS)')}</th>
                    <th class="text-right py-2 px-3 font-mono text-xs text-[var(--color-text-muted)]">{t(lang, 'oos.oos_period', 'Validation (OOS)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t(lang, 'oos.trades', 'Trades'), result.oos.is_metrics.trades, result.oos.oos_metrics.trades],
                    [t(lang, 'oos.win_rate', 'Win Rate'), `${fmt(result.oos.is_metrics.win_rate)}%`, `${fmt(result.oos.oos_metrics.win_rate)}%`],
                    [t(lang, 'oos.return', 'Return'), `${fmt(result.oos.is_metrics.total_return)}%`, `${fmt(result.oos.oos_metrics.total_return)}%`],
                    [t(lang, 'oos.pf', 'Profit Factor'), fmt(result.oos.is_metrics.profit_factor), fmt(result.oos.oos_metrics.profit_factor)],
                    [t(lang, 'oos.mdd', 'Max Drawdown'), `${fmt(result.oos.is_metrics.max_dd)}%`, `${fmt(result.oos.oos_metrics.max_dd)}%`],
                  ].map(([label, isVal, oosVal]) => (
                    <tr class="border-b border-[var(--color-border)]">
                      <td class="py-2 px-3 font-medium">{label}</td>
                      <td class="py-2 px-3 text-right text-[var(--color-accent)]">{isVal}</td>
                      <td class="py-2 px-3 text-right text-[var(--color-text-muted)]">{oosVal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div class="sm:hidden space-y-3">
              {[
                [t(lang, 'oos.trades', 'Trades'), result.oos.is_metrics.trades, result.oos.oos_metrics.trades],
                [t(lang, 'oos.win_rate', 'Win Rate'), `${fmt(result.oos.is_metrics.win_rate)}%`, `${fmt(result.oos.oos_metrics.win_rate)}%`],
                [t(lang, 'oos.return', 'Return'), `${fmt(result.oos.is_metrics.total_return)}%`, `${fmt(result.oos.oos_metrics.total_return)}%`],
                [t(lang, 'oos.pf', 'Profit Factor'), fmt(result.oos.is_metrics.profit_factor), fmt(result.oos.oos_metrics.profit_factor)],
              ].map(([label, isVal, oosVal]) => (
                <div class="flex justify-between items-center text-sm">
                  <span class="text-[var(--color-text-muted)]">{label}</span>
                  <div class="flex gap-3">
                    <span class="text-[var(--color-accent)]">{isVal}</span>
                    <span class="text-[var(--color-text-muted)]">/</span>
                    <span>{oosVal}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Degradation bar */}
            <div class="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div class="flex items-center justify-between text-sm mb-2">
                <span class="text-[var(--color-text-muted)]">{t(lang, 'oos.degradation', 'OOS Retention')}</span>
                <span class={`font-mono font-bold ${riskColor(result.oos.overfit_risk)}`}>
                  {fmt(result.oos.degradation_ratio * 100, 0)}%
                </span>
              </div>
              <div class="h-2 rounded-full overflow-hidden bg-[var(--color-border)]">
                <div
                  class={`h-full rounded-full ${result.oos.overfit_risk === 'LOW' ? 'bg-green-500' : result.oos.overfit_risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(result.oos.degradation_ratio * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Monte Carlo */}
          <div class="border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-bg-card)]">
            <h3 class="font-bold mb-1">{t(lang, 'mc.title', 'Monte Carlo Simulation')}</h3>
            <p class="text-[var(--color-text-muted)] text-sm mb-4">{t(lang, 'mc.desc', 'Randomly resamples trade order to estimate confidence intervals')}</p>

            {/* Metric cards */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div class="border border-[var(--color-border)] rounded p-3 text-center">
                <p class="font-mono text-[var(--color-accent)] text-xl font-bold">{fmt(result.monte_carlo.median_return)}%</p>
                <p class="text-[var(--color-text-muted)] text-xs">{t(lang, 'mc.median', 'Median Return')}</p>
              </div>
              <div class="border border-[var(--color-border)] rounded p-3 text-center">
                <p class="font-mono text-green-400 text-xl font-bold">{fmt(result.monte_carlo.positive_pct, 1)}%</p>
                <p class="text-[var(--color-text-muted)] text-xs">{t(lang, 'mc.positive', 'Win Probability')}</p>
              </div>
              <div class="border border-[var(--color-border)] rounded p-3 text-center">
                <p class="font-mono text-[var(--color-text)] text-xl font-bold">{fmt(result.monte_carlo.percentile_5)}%</p>
                <p class="text-[var(--color-text-muted)] text-xs">{t(lang, 'mc.p5', 'Pessimistic (5th)')}</p>
              </div>
              <div class="border border-[var(--color-border)] rounded p-3 text-center">
                <p class="font-mono text-red-400 text-xl font-bold">{fmt(result.monte_carlo.worst_case_mdd)}%</p>
                <p class="text-[var(--color-text-muted)] text-xs">{t(lang, 'mc.worst_mdd', 'Worst MDD (95th)')}</p>
              </div>
            </div>

            {/* 95% CI */}
            <div class="border border-[var(--color-border)] rounded p-4 mb-4">
              <p class="text-xs text-[var(--color-text-muted)] font-mono mb-2">{t(lang, 'mc.ci95', '95% Confidence Interval')}</p>
              <div class="flex items-center gap-2">
                <span class="text-sm text-red-400 font-mono">{fmt(result.monte_carlo.percentile_5)}%</span>
                <div class="flex-1 h-3 rounded-full overflow-hidden bg-[var(--color-border)] relative">
                  {(() => {
                    const min = result.monte_carlo.worst_case_return;
                    const max = result.monte_carlo.best_case_return;
                    const range = max - min || 1;
                    const p5pos = ((result.monte_carlo.percentile_5 - min) / range) * 100;
                    const p95pos = ((result.monte_carlo.percentile_95 - min) / range) * 100;
                    const medPos = ((result.monte_carlo.median_return - min) / range) * 100;
                    return (
                      <>
                        <div class="absolute h-full bg-[var(--color-accent)]/20 rounded" style={{ left: `${p5pos}%`, width: `${p95pos - p5pos}%` }} />
                        <div class="absolute h-full w-0.5 bg-[var(--color-accent)]" style={{ left: `${medPos}%` }} />
                      </>
                    );
                  })()}
                </div>
                <span class="text-sm text-green-400 font-mono">{fmt(result.monte_carlo.percentile_95)}%</span>
              </div>
              <p class="text-center text-xs text-[var(--color-accent)] mt-1 font-mono">{t(lang, 'mc.median', 'Median')}: {fmt(result.monte_carlo.median_return)}%</p>
            </div>

            {/* Equity band mini chart (SVG) */}
            {result.monte_carlo.equity_bands.length > 2 && (
              <div class="border border-[var(--color-border)] rounded p-4">
                <p class="text-xs text-[var(--color-text-muted)] font-mono mb-2">{t(lang, 'mc.band_chart', 'Return Distribution Bands')}</p>
                <svg viewBox="0 0 400 160" class="w-full h-32">
                  {(() => {
                    const bands = result.monte_carlo.equity_bands;
                    const allVals = bands.flatMap(b => [b.p5, b.p95]);
                    const minVal = Math.min(...allVals, 0);
                    const maxVal = Math.max(...allVals, 0);
                    const range = maxVal - minVal || 1;
                    const scaleX = (i: number) => (i / (bands.length - 1)) * 380 + 10;
                    const scaleY = (v: number) => 150 - ((v - minVal) / range) * 140;

                    const pathPoints = (key: keyof MCEquityBand) =>
                      bands.map((b, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(b[key] as number)}`).join(' ');

                    // Fill between p5 and p95
                    const fillPath = bands.map((b, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(b.p95)}`)
                      .join(' ') + bands.slice().reverse().map((b, i) => `L${scaleX(bands.length - 1 - i)},${scaleY(b.p5)}`).join(' ') + 'Z';

                    // Fill between p25 and p75
                    const fill25 = bands.map((b, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(b.p75)}`)
                      .join(' ') + bands.slice().reverse().map((b, i) => `L${scaleX(bands.length - 1 - i)},${scaleY(b.p25)}`).join(' ') + 'Z';

                    return (
                      <>
                        {/* Zero line */}
                        <line x1="10" y1={scaleY(0)} x2="390" y2={scaleY(0)} stroke="var(--color-border)" stroke-dasharray="4" />
                        {/* p5-p95 band */}
                        <path d={fillPath} fill="var(--color-accent)" opacity="0.08" />
                        {/* p25-p75 band */}
                        <path d={fill25} fill="var(--color-accent)" opacity="0.15" />
                        {/* p50 line */}
                        <path d={pathPoints('p50')} fill="none" stroke="var(--color-accent)" stroke-width="2" />
                        {/* p5 line */}
                        <path d={pathPoints('p5')} fill="none" stroke="var(--color-text-muted)" stroke-width="1" stroke-dasharray="3" opacity="0.5" />
                        {/* p95 line */}
                        <path d={pathPoints('p95')} fill="none" stroke="var(--color-text-muted)" stroke-width="1" stroke-dasharray="3" opacity="0.5" />
                      </>
                    );
                  })()}
                </svg>
                <div class="flex justify-center gap-4 text-xs text-[var(--color-text-muted)] mt-1">
                  <span class="flex items-center gap-1"><span class="inline-block w-3 h-0.5 bg-[var(--color-accent)]" /> {t(lang, 'mc.p50', 'Median (50th)')}</span>
                  <span class="flex items-center gap-1"><span class="inline-block w-3 h-0.5 bg-[var(--color-text-muted)] opacity-50" style="border-top: 1px dashed" /> {t(lang, 'mc.p5', '5th')} / {t(lang, 'mc.p95', '95th')}</span>
                </div>
              </div>
            )}

            <p class="text-[var(--color-text-muted)] text-xs mt-3 opacity-70">
              * {t(lang, 'mc.disclaimer', 'Monte Carlo assumes past trade distribution repeats. Actual results may differ.')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
