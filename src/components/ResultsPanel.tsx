/**
 * ResultsPanel.tsx - Backtest results display (summary, equity, trades)
 */
import { useEffect, useRef } from 'preact/hooks';
import ResultsCard from './ResultsCard';
import { winRateColor, profitFactorColor, signColor } from '../utils/format';
import type { BacktestResult } from './simulator-types';
import { getCssVar, COLORS } from './simulator-types';
import { API_BASE_URL as API_URL } from '../config/api';

interface Props {
  t: Record<string, any>;
  result: BacktestResult | null;
  error: string | null;
  resultTab: 'summary' | 'equity' | 'trades';
  setResultTab: (tab: 'summary' | 'equity' | 'trades') => void;
  activePreset: string | null;
  lang: 'en' | 'ko';
}

const tabActiveStyle = { color: COLORS.accent, borderColor: COLORS.accent, background: COLORS.accentBg };

export default function ResultsPanel({ t, result, error, resultTab, setResultTab, activePreset, lang }: Props) {
  const equityChartRef = useRef<HTMLDivElement>(null);
  const equityInstanceRef = useRef<any>(null);
  const ddChartRef = useRef<HTMLDivElement>(null);
  const ddInstanceRef = useRef<any>(null);

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
      const color = isPos ? COLORS.green : COLORS.red;

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: isPos ? COLORS.greenBg : COLORS.redBg,
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

  // ─── Drawdown chart ───
  useEffect(() => {
    if (resultTab !== 'equity' || !result?.equity_curve?.length || !ddChartRef.current) return;
    let disposed = false;

    import('lightweight-charts').then(({ createChart, AreaSeries }) => {
      if (disposed || !ddChartRef.current) return;
      if (ddInstanceRef.current) {
        ddInstanceRef.current.remove();
        ddInstanceRef.current = null;
      }

      // Calculate drawdown from equity curve
      let peak = -Infinity;
      const ddData = result.equity_curve.map((p) => {
        if (p.value > peak) peak = p.value;
        const dd = peak > 0 ? ((p.value - peak) / peak) * 100 : p.value - peak;
        return { time: p.time, value: Math.min(0, dd) };
      });

      const chart = createChart(ddChartRef.current, {
        width: ddChartRef.current.clientWidth,
        height: 120,
        layout: {
          background: { color: getCssVar('--color-bg-card') },
          textColor: getCssVar('--color-text-muted'),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: getCssVar('--color-bg-hover') },
          horzLines: { color: getCssVar('--color-bg-hover') },
        },
        rightPriceScale: { borderColor: getCssVar('--color-border') },
        timeScale: { visible: false },
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: COLORS.red,
        topColor: 'transparent',
        bottomColor: COLORS.redBg,
        lineWidth: 1,
        priceFormat: { type: 'custom', formatter: (p: number) => `${p.toFixed(1)}%` },
      });
      series.setData(ddData);
      chart.timeScale().fitContent();
      ddInstanceRef.current = chart;

      const ro = new ResizeObserver((entries) => {
        for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
      });
      ro.observe(ddChartRef.current);
    });

    return () => {
      disposed = true;
      if (ddInstanceRef.current) { ddInstanceRef.current.remove(); ddInstanceRef.current = null; }
    };
  }, [resultTab, result]);

  // ─── CSV download ───
  const downloadCsv = () => {
    if (!result) return;
    if (result.export_hash) {
      window.open(`${API_URL}/export/csv?hash=${result.export_hash}`, '_blank');
      return;
    }
    const rows = ['time,value'];
    (result.equity_curve || []).forEach((p) => rows.push(`${p.time},${p.value}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pruviq_backtest_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
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
                  ${resultTab === tab ? 'font-bold border-b-2' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]/20'}`}
                style={resultTab === tab ? tabActiveStyle : undefined}
              >
                {t[tab]}
              </button>
            ))}
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
              <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1">Equity Curve</div>
              <div ref={equityChartRef} style={{ height: '300px' }} />
              <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mt-3 mb-1">Drawdown</div>
              <div ref={ddChartRef} style={{ height: '120px' }} />
              {result && result.max_drawdown_pct !== undefined && (
                <div class="mt-2 font-mono text-xs text-[--color-text-muted]">
                  Max Drawdown: <span style={{ color: COLORS.red }}>{result.max_drawdown_pct.toFixed(1)}%</span>
                </div>
              )}
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
                            tr.exit_reason === 'TP' ? 'bg-emerald-500/10 text-emerald-400' :
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
  );
}
