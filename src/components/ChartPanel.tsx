/**
 * ChartPanel.tsx - Chart display with symbol switching
 */
import { useEffect, useRef } from 'preact/hooks';
import type { OhlcvBar, TradeItem } from './simulator-types';
import { getCssVar, COLORS } from './simulator-types';

interface Props {
  chartSymbol: string;
  setChartSymbol: (s: string) => void;
  chartData: OhlcvBar[];
  chartLoading: boolean;
  loadingText: string;
  trades?: TradeItem[];
}

export default function ChartPanel({ chartSymbol, setChartSymbol, chartData, chartLoading, loadingText, trades }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // ─── Render chart ───
  useEffect(() => {
    if (!chartData.length || !chartContainerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('lightweight-charts').then(({ createChart, CandlestickSeries, LineSeries, HistogramSeries }) => {
      if (disposed || !chartContainerRef.current) return;

      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 640,
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

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: getCssVar('--color-up') || COLORS.green,
        downColor: getCssVar('--color-down') || COLORS.red,
        wickUpColor: getCssVar('--color-up') || COLORS.green,
        wickDownColor: getCssVar('--color-down') || COLORS.red,
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

      // Volume
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
        color: b.c >= b.o ? COLORS.greenFill : COLORS.redFill,
      })));

      // Trade entry/exit markers
      if (trades && trades.length > 0) {
        const symbolTrades = trades.filter((t) => t.symbol === chartSymbol);
        if (symbolTrades.length > 0) {
          const markers = symbolTrades.flatMap((t) => {
            const entryTs = Math.floor(new Date(t.entry_time).getTime() / 1000);
            const exitTs = Math.floor(new Date(t.exit_time).getTime() / 1000);
            const isShort = t.direction === 'short';
            const isWin = t.pnl_pct > 0;
            return [
              {
                time: entryTs as any,
                position: isShort ? 'aboveBar' as const : 'belowBar' as const,
                color: COLORS.accent,
                shape: isShort ? 'arrowDown' as const : 'arrowUp' as const,
                text: isShort ? 'S' : 'L',
              },
              {
                time: exitTs as any,
                position: isShort ? 'belowBar' as const : 'aboveBar' as const,
                color: isWin ? COLORS.green : COLORS.red,
                shape: 'circle' as const,
                text: `${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct.toFixed(1)}%`,
              },
            ];
          }).sort((a, b) => (a.time as number) - (b.time as number));
          candleSeries.setMarkers(markers);
        }
      }

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
  }, [chartData, trades]);

  return (
    <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
      {/* Chart header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-[--color-border]">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm font-bold">{chartSymbol}</span>
          <span class="text-[--color-text-muted] text-xs">1H</span>
        </div>
        <div class="flex items-center gap-1.5">
          {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((sym) => (
            <button
              key={sym}
              onClick={() => setChartSymbol(sym)}
              class={`px-2 py-0.5 text-xs font-mono rounded transition-colors
                ${chartSymbol === sym ? 'font-bold text-white' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]'}`}
              style={chartSymbol === sym ? { background: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accentGlow}` } : undefined}
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
      <div ref={chartContainerRef} style={{ height: '640px', minHeight: '400px' }}>
        {chartLoading && (
          <div class="flex items-center justify-center h-full text-[--color-text-muted] text-sm">
            <div class="spinner mr-2" />{loadingText}
          </div>
        )}
      </div>
    </div>
  );
}
