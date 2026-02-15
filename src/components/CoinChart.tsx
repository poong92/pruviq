import { useState, useEffect, useRef } from 'preact/hooks';
import DiscreteSlider from './DiscreteSlider';

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
const API_URL = import.meta.env.PUBLIC_PRUVIQ_API_URL || '';

const labels = {
  en: {
    apply: 'Apply Strategy',
    resim: 'Re-simulate',
    bbBands: 'BB Bands',
    ema: 'EMA 20/50',
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
  },
  ko: {
    apply: '전략 적용',
    resim: '재시뮬레이션',
    bbBands: 'BB 밴드',
    ema: 'EMA 20/50',
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
  },
};

function formatTime(unix: number): string {
  const d = new Date(unix * 1000);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '0.625rem',
      borderRadius: '0.375rem',
      backgroundColor: 'rgba(17, 17, 17, 0.8)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.125rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>{value}</div>
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
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbMidRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const ema20Ref = useRef<any>(null);
  const ema50Ref = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Load OHLCV data
  useEffect(() => {
    const url = API_URL ? `${API_URL}/ohlcv/${SYMBOL}?limit=3000` : `/ohlcv/${SYMBOL}?limit=3000`;
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

    import('lightweight-charts').then(({ createChart, LineStyle }) => {
      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: '#0a0a0a' },
          textColor: '#888888',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#151515' },
          horzLines: { color: '#151515' },
        },
        rightPriceScale: { borderColor: '#222' },
        timeScale: { borderColor: '#222', timeVisible: true, secondsVisible: false },
        crosshair: {
          vertLine: { color: '#00ff8833', width: 1, style: 2 },
          horzLine: { color: '#00ff8833', width: 1, style: 2 },
        },
      });

      // Candles
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00ff88',
        downColor: '#ff4444',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4444',
        borderVisible: false,
      });
      candleSeries.setData(ohlcv.map(b => ({ time: b.t as any, open: b.o, high: b.h, low: b.l, close: b.c })));
      candleSeriesRef.current = candleSeries;

      // BB Bands
      const bbUpper = chart.addLineSeries({ color: 'rgba(100,150,255,0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const bbMid = chart.addLineSeries({ color: 'rgba(100,150,255,0.2)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const bbLower = chart.addLineSeries({ color: 'rgba(100,150,255,0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

      const bbUpperData = ohlcv.filter(b => b.bb_upper != null).map(b => ({ time: b.t as any, value: b.bb_upper! }));
      const bbMidData = ohlcv.filter(b => b.bb_mid != null).map(b => ({ time: b.t as any, value: b.bb_mid! }));
      const bbLowerData = ohlcv.filter(b => b.bb_lower != null).map(b => ({ time: b.t as any, value: b.bb_lower! }));
      bbUpper.setData(bbUpperData);
      bbMid.setData(bbMidData);
      bbLower.setData(bbLowerData);
      bbUpperRef.current = bbUpper;
      bbMidRef.current = bbMid;
      bbLowerRef.current = bbLower;

      // EMA
      const ema20 = chart.addLineSeries({ color: '#ffaa00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ema50 = chart.addLineSeries({ color: '#aa66ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ema20Data = ohlcv.filter(b => b.ema20 != null).map(b => ({ time: b.t as any, value: b.ema20! }));
      const ema50Data = ohlcv.filter(b => b.ema50 != null).map(b => ({ time: b.t as any, value: b.ema50! }));
      ema20.setData(ema20Data);
      ema50.setData(ema50Data);
      ema20Ref.current = ema20;
      ema50Ref.current = ema50;

      // Volume
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumeSeries.setData(ohlcv.map(b => ({
        time: b.t as any,
        value: b.v,
        color: b.c >= b.o ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)',
      })));
      volumeSeriesRef.current = volumeSeries;

      chartRef.current = chart;
      chart.timeScale().fitContent();

      // Responsive
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
      });
      ro.observe(chartContainerRef.current);

      return () => ro.disconnect();
    });

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ohlcv]);

  // Toggle BB bands visibility
  useEffect(() => {
    if (bbUpperRef.current) {
      const vis = showBB ? true : false;
      bbUpperRef.current.applyOptions({ visible: vis });
      bbMidRef.current?.applyOptions({ visible: vis });
      bbLowerRef.current?.applyOptions({ visible: vis });
    }
  }, [showBB]);

  // Toggle EMA visibility
  useEffect(() => {
    if (ema20Ref.current) {
      ema20Ref.current.applyOptions({ visible: showEMA });
      ema50Ref.current?.applyOptions({ visible: showEMA });
    }
  }, [showEMA]);

  // Apply strategy simulation
  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const url = API_URL ? `${API_URL}/simulate/coin` : '/simulate/coin';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: SYMBOL, sl_pct: sl, tp_pct: tp }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const result: SimResult = await res.json();
      setSimResult(result);

      // Add markers to chart
      if (candleSeriesRef.current && result.trades.length > 0) {
        const markers: any[] = [];
        for (const trade of result.trades) {
          markers.push({
            time: trade.entry_time as any,
            position: 'aboveBar',
            shape: 'arrowDown',
            color: '#ff4444',
            text: 'S',
          });
          const exitColor = trade.exit_reason === 'tp' ? '#00ff88' : trade.exit_reason === 'sl' ? '#ff4444' : '#888888';
          const exitText = trade.exit_reason === 'tp' ? `TP` : trade.exit_reason === 'sl' ? `SL` : `TO`;
          markers.push({
            time: trade.exit_time as any,
            position: 'belowBar',
            shape: 'arrowUp',
            color: exitColor,
            text: exitText,
          });
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

  if (loading) {
    return <div style={{ padding: '3rem 0', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t.loading}</div>;
  }
  if (error || !ohlcv) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-red)', fontSize: '0.875rem' }}>{t.error}</div>;
  }

  const lastBar = ohlcv[ohlcv.length - 1];
  const prevBar = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : lastBar;
  const change = prevBar.c ? ((lastBar.c - prevBar.c) / prevBar.c * 100) : 0;
  const isDefault = sl === DEFAULT_SL && tp === DEFAULT_TP;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{SYMBOL.replace('USDT', '')}/USDT</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem' }}>${lastBar.c >= 1 ? lastBar.c.toLocaleString(undefined, { maximumFractionDigits: 2 }) : lastBar.c.toFixed(6)}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: change >= 0 ? 'var(--color-accent)' : 'var(--color-red)' }}>
          {change > 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>

      {/* Chart */}
      <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '1rem' }}>
        <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowBB(!showBB)}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            border: `1px solid ${showBB ? 'rgba(100,150,255,0.5)' : 'var(--color-border)'}`,
            backgroundColor: showBB ? 'rgba(100,150,255,0.1)' : 'transparent',
            color: showBB ? 'rgba(100,150,255,0.8)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {t.bbBands}
        </button>
        <button
          onClick={() => setShowEMA(!showEMA)}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            border: `1px solid ${showEMA ? '#ffaa00' : 'var(--color-border)'}`,
            backgroundColor: showEMA ? 'rgba(255,170,0,0.1)' : 'transparent',
            color: showEMA ? '#ffaa00' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {t.ema}
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{t.strategy}</span>
        <button
          onClick={runSimulation}
          disabled={simLoading}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: simLoading ? 'wait' : 'pointer',
            opacity: simLoading ? 0.7 : 1,
          }}
        >
          {simLoading ? t.simLoading : (simResult ? t.resim : t.apply)}
        </button>
      </div>

      {/* SL/TP Sliders + Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Sliders */}
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem' }}>
          <DiscreteSlider label={t.sl} values={SL_VALUES} value={sl} defaultValue={DEFAULT_SL} onChange={setSl} />
          <DiscreteSlider label={t.tp} values={TP_VALUES} value={tp} defaultValue={DEFAULT_TP} onChange={setTp} />
        </div>

        {/* Results */}
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem' }}>
          {simResult ? (
            <div>
              {isDefault && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-accent)', letterSpacing: '0.1em', marginBottom: '0.75rem', textTransform: 'uppercase' as const }}>{t.live}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MetricBox label={t.winRate} value={`${simResult.win_rate}%`} color={simResult.win_rate >= 55 ? 'var(--color-accent)' : simResult.win_rate >= 50 ? 'var(--color-yellow)' : 'var(--color-red)'} />
                <MetricBox label={t.pf} value={`${simResult.profit_factor}`} color={simResult.profit_factor >= 1.5 ? 'var(--color-accent)' : simResult.profit_factor >= 1.0 ? 'var(--color-yellow)' : 'var(--color-red)'} />
                <MetricBox label={t.totalReturn} value={`${simResult.total_return_pct > 0 ? '+' : ''}${simResult.total_return_pct}%`} color={simResult.total_return_pct >= 0 ? 'var(--color-accent)' : 'var(--color-red)'} />
                <MetricBox label={t.maxDD} value={`${simResult.max_drawdown_pct}%`} color="var(--color-red)" />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                {simResult.total_trades} {t.tradesLabel} &middot; TP:{simResult.tp_count} SL:{simResult.sl_count} TO:{simResult.timeout_count}
              </div>
              {/* Exit bar */}
              <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', backgroundColor: 'var(--color-border)' }}>
                {simResult.total_trades > 0 && (<>
                  <div style={{ width: `${(simResult.tp_count / simResult.total_trades) * 100}%`, backgroundColor: 'var(--color-accent)' }} />
                  <div style={{ width: `${(simResult.sl_count / simResult.total_trades) * 100}%`, backgroundColor: 'var(--color-red)' }} />
                  <div style={{ width: `${(simResult.timeout_count / simResult.total_trades) * 100}%`, backgroundColor: 'var(--color-text-muted)' }} />
                </>)}
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: '1rem 0' }}>{t.noTrades}</div>
          )}
        </div>
      </div>

      {/* Trade History */}
      {simResult && simResult.trades.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <button
            onClick={() => setShowTrades(!showTrades)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: showTrades ? '1px solid var(--color-border)' : 'none',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{showTrades ? '▼' : '▶'} {t.trades} ({simResult.trades.length})</span>
          </button>
          {showTrades && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>#</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>{t.entry}</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>{t.exit}</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>{t.result}</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>{t.pnl}</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.625rem' }}>{t.bars}</th>
                  </tr>
                </thead>
                <tbody>
                  {simResult.trades.map((trade, i) => {
                    const color = trade.exit_reason === 'tp' ? 'var(--color-accent)' : trade.exit_reason === 'sl' ? 'var(--color-red)' : 'var(--color-text-muted)';
                    const label = trade.exit_reason.toUpperCase();
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                        onClick={() => {
                          if (chartRef.current) {
                            chartRef.current.timeScale().setVisibleRange({
                              from: (trade.entry_time - 3600 * 24) as any,
                              to: (trade.exit_time + 3600 * 24) as any,
                            });
                          }
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,255,136,0.03)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{formatTime(trade.entry_time)}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{formatTime(trade.exit_time)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color, fontWeight: 600 }}>{label}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: trade.pnl_pct >= 0 ? 'var(--color-accent)' : 'var(--color-red)' }}>
                          {trade.pnl_pct > 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>{trade.bars_held}</td>
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
