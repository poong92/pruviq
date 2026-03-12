/**
 * BuilderPanel.tsx - Strategy builder panel (compact layout, no internal scroll)
 */
import { useState, useEffect } from 'preact/hooks';
import type { Condition, IndicatorInfo, PresetItem, CoinOption } from './simulator-types';
import { COLORS } from './simulator-types';
import PresetBar from './PresetBar';
import ConditionRow from './ConditionRow';

interface Props {
  // i18n
  t: Record<string, any>; // eslint-disable-line -- mixed i18n types (string, string[], Record)
  lang: 'en' | 'ko';
  // API state
  coinsLoaded: number;
  totalCoins: number;  // total available coins from /health API
  demoMode: boolean;
  // Indicators
  availableIndicators: IndicatorInfo[];
  selectedIndicators: Set<string>;
  setSelectedIndicators: (fn: (prev: Set<string>) => Set<string>) => void;
  availableFields: string[];
  // Conditions
  conditions: Condition[];
  addCondition: () => void;
  updateCondition: (id: string, key: string, val: string | number | boolean) => void;
  removeCondition: (id: string) => void;
  // Params
  direction: 'short' | 'long' | 'both';
  setDirection: (d: 'short' | 'long' | 'both') => void;
  slPct: number; setSlPct: (n: number) => void;
  tpPct: number; setTpPct: (n: number) => void;
  maxBars: number; setMaxBars: (n: number) => void;
  perCoinUsdt: number; setPerCoinUsdt: (n: number) => void;
  leverage: number; setLeverage: (n: number) => void;
  compounding: boolean; setCompounding: (b: boolean) => void;
  // Date range
  startDate: string; setStartDate: (s: string) => void;
  endDate: string; setEndDate: (s: string) => void;
  // Coins
  coinMode: 'all' | 'top' | 'select';
  setCoinMode: (m: 'all' | 'top' | 'select') => void;
  topN: number; setTopN: (n: number) => void;
  selectedCoins: string[]; setSelectedCoins: (fn: (prev: string[]) => string[]) => void;
  coinSearch: string; setCoinSearch: (s: string) => void;
  filteredCoins: CoinOption[];
  allCoinsCount: number;
  // Avoid hours
  avoidHours: Set<number>;
  setAvoidHours: (fn: (prev: Set<number>) => Set<number>) => void;
  // Presets
  presets: PresetItem[];
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
  // Preset loading state
  presetLoading?: boolean;
  presetError?: string | null;
  // Timeframe
  timeframe: string;
  setTimeframe: (tf: string) => void;
  // Run
  isRunning: boolean;
  progressStep: number;
  progressLabels: string[];
  onRun: () => void;
}

const indicatorActiveStyle = { background: COLORS.accent, color: '#fff', borderColor: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accentGlow}` };
const coinActiveStyle = { background: COLORS.accent, color: '#fff', borderColor: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accentGlow}` };
const shortActiveStyle = { background: COLORS.red, color: '#fff', borderColor: COLORS.red, boxShadow: `0 0 12px ${COLORS.redGlowStrong}` };
const longActiveStyle = { background: COLORS.green, color: '#fff', borderColor: COLORS.green, boxShadow: `0 0 12px ${COLORS.greenGlow}` };
const avoidActiveStyle = { background: COLORS.red, color: '#fff', borderColor: COLORS.red, boxShadow: `0 0 6px ${COLORS.redGlow}` };
const tfActiveStyle = { background: COLORS.accent, color: '#fff', borderColor: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accentGlow}`, fontWeight: 'bold' as const };
const runStyle = { background: COLORS.accent, color: '#fff', boxShadow: `0 0 20px ${COLORS.accentGlow}` };
const runDisabledStyle = { background: COLORS.disabled, color: COLORS.disabledText };

export default function BuilderPanel(props: Props) {
  const { t } = props;
  const hasLookAhead = props.conditions.some((c) => c.shift === 0);

  // ─── Local state for numeric inputs (onBlur pattern) ───
  const [localSl, setLocalSl] = useState(String(props.slPct));
  const [localTp, setLocalTp] = useState(String(props.tpPct));
  const [localMaxBars, setLocalMaxBars] = useState(String(props.maxBars));
  const [localPerCoin, setLocalPerCoin] = useState(String(props.perCoinUsdt));
  const [localLeverage, setLocalLeverage] = useState(String(props.leverage));
  const [localTopN, setLocalTopN] = useState(String(props.topN));

  // Sync local state when props change (e.g., preset load)
  useEffect(() => { setLocalSl(String(props.slPct)); }, [props.slPct]);
  useEffect(() => { setLocalTp(String(props.tpPct)); }, [props.tpPct]);
  useEffect(() => { setLocalMaxBars(String(props.maxBars)); }, [props.maxBars]);
  useEffect(() => { setLocalPerCoin(String(props.perCoinUsdt)); }, [props.perCoinUsdt]);
  useEffect(() => { setLocalLeverage(String(props.leverage)); }, [props.leverage]);
  useEffect(() => { setLocalTopN(String(props.topN)); }, [props.topN]);

  return (
    <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden flex flex-col">
      {/* Panel header */}
      <div class="px-4 py-2 border-b border-[--color-border] flex-shrink-0">
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm text-[--color-accent] tracking-wider font-bold">STRATEGY BUILDER</span>
          {props.coinsLoaded > 0 && (
            <span class="text-[--color-text-muted] text-xs font-mono">{props.coinsLoaded} coins</span>
          )}
        </div>
      </div>

      {/* Panel content — no internal scroll */}
      <div class="flex-1">
        {/* Presets */}
        <PresetBar
          presets={props.presets}
          activePreset={props.activePreset}
          onSelectPreset={props.onSelectPreset}
          label={t.preset}
          loading={props.presetLoading}
        />
        {props.presetError && (
          <div class="mx-4 mt-1 mb-0 px-2.5 py-1 rounded bg-[--color-red]/10 border border-[--color-red]/20" role="alert">
            <span class="text-[10px] font-mono text-[--color-red]">{props.presetError}</span>
          </div>
        )}

        {/* Indicators */}
        <div class="px-4 py-2 border-b border-[--color-border]">
          <div class="text-xs font-mono text-[--color-text-muted] uppercase mb-1">{t.indicators}</div>
          <div class="flex flex-wrap gap-1">
            {props.availableIndicators.map((ind) => (
              <button
                key={ind.id}
                onClick={() => {
                  props.setSelectedIndicators((prev) => {
                    const next = new Set(prev);
                    if (next.has(ind.id)) next.delete(ind.id);
                    else next.add(ind.id);
                    return next;
                  });
                }}
                class={`px-2.5 py-0.5 text-xs font-mono rounded transition-colors border
                  ${props.selectedIndicators.has(ind.id)
                    ? 'font-bold'
                    : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/20'}`}
                style={props.selectedIndicators.has(ind.id) ? indicatorActiveStyle : undefined}
              >
                {ind.name}
              </button>
            ))}
          </div>
        </div>

        {/* Entry Conditions */}
        <div class="px-4 py-2 border-b border-[--color-border]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-mono text-[--color-text-muted] uppercase">{t.conditions}</span>
            <button onClick={props.addCondition} class="text-xs font-mono text-[--color-accent] hover:underline">
              {t.addCondition}
            </button>
          </div>
          <div class="space-y-1">
            {props.conditions.map((c) => (
              <ConditionRow
                key={c.id}
                condition={c}
                availableFields={props.availableFields}
                onUpdate={props.updateCondition}
                onRemove={props.removeCondition}
                removeLabel={t.remove}
              />
            ))}
          </div>
          {hasLookAhead && (
            <div class="mt-1.5 px-2.5 py-1 rounded bg-[--color-yellow]/10 border border-[--color-yellow]/20">
              <span class="text-[10px] font-mono text-[--color-yellow]">
                {t.lookAheadWarn || 'C = current candle (incomplete in live). P = previous candle (confirmed). Using C may cause look-ahead bias.'}
              </span>
            </div>
          )}
        </div>

        {/* Parameters + Date Range (merged 3-column grid) */}
        <div class="px-4 py-2 border-b border-[--color-border]">
          <div class="text-xs font-mono text-[--color-text-muted] uppercase mb-1">{t.parameters}</div>
          <div class="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {/* Timeframe - spans full width */}
            <div class="col-span-3 mb-1">
              <label class="text-[10px] text-[--color-text-muted]">Timeframe</label>
              <div class="flex gap-1 mt-0.5">
                {['1H', '2H', '4H', '6H', '12H', '1D', '1W'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => props.setTimeframe(tf)}
                    class={`flex-1 py-1 text-xs font-mono rounded border transition-colors cursor-pointer
                      ${props.timeframe === tf
                        ? ''
                        : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:text-[--color-text]'}`}
                    style={props.timeframe === tf ? tfActiveStyle : undefined}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            {/* Direction */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.direction}</label>
              <div class="flex gap-1 mt-0.5">
                <button
                  onClick={() => props.setDirection('short')}
                  class={`flex-1 py-1 text-xs font-mono rounded transition-colors border ${props.direction === 'short' ? 'font-bold' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-red]/30'}`}
                  style={props.direction === 'short' ? shortActiveStyle : undefined}
                >{t.short}</button>
                <button
                  onClick={() => props.setDirection('long')}
                  class={`flex-1 py-1 text-xs font-mono rounded transition-colors border ${props.direction === 'long' ? 'font-bold' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30'}`}
                  style={props.direction === 'long' ? longActiveStyle : undefined}
                >{t.long}</button>
                <button
                  onClick={() => props.setDirection('both')}
                  class={`flex-1 py-1 text-xs font-mono rounded transition-colors border ${props.direction === 'both' ? 'font-bold' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30'}`}
                  style={props.direction === 'both' ? { background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(0,255,136,0.15))', borderColor: '#888', color: '#fff' } : undefined}
                >BOTH</button>
              </div>
              <p class="text-[9px] text-[--color-text-muted] mt-0.5 font-mono">
                {props.direction === 'short' ? (props.lang === 'ko' ? '하락 시 수익' : 'Profit when price falls') :
                 props.direction === 'long' ? (props.lang === 'ko' ? '상승 시 수익' : 'Profit when price rises') :
                 (props.lang === 'ko' ? 'SHORT + LONG 동시 테스트' : 'Test SHORT + LONG simultaneously')}
              </p>
            </div>
            {/* SL */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.sl} <span class="cursor-help opacity-60 hover:opacity-100" title={t.slTip || ''}>&#9432;</span></label>
              <input type="number" value={localSl} min={1} max={50} step={0.5}
                onChange={(e: Event) => setLocalSl((e.target as HTMLInputElement).value)}
                onBlur={() => props.setSlPct(parseFloat(localSl) || 10)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* TP */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.tp} <span class="cursor-help opacity-60 hover:opacity-100" title={t.tpTip || ''}>&#9432;</span></label>
              <input type="number" value={localTp} min={1} max={50} step={0.5}
                onChange={(e: Event) => setLocalTp((e.target as HTMLInputElement).value)}
                onBlur={() => props.setTpPct(parseFloat(localTp) || 8)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* Max bars */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.maxBars} <span class="cursor-help opacity-60 hover:opacity-100" title={t.maxBarsTip || ''}>&#9432;</span></label>
              <input type="number" value={localMaxBars} min={1} max={168}
                onChange={(e: Event) => setLocalMaxBars((e.target as HTMLInputElement).value)}
                onBlur={() => props.setMaxBars(parseInt(localMaxBars) || 48)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* Capital input — compound: total portfolio capital; simple: per-coin amount */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">
                {props.compounding
                  ? (props.lang === 'ko' ? '투자 원금 $' : 'Capital $')
                  : (t.perCoinUsdt || 'Per Coin $')}
              </label>
              <input type="number" value={localPerCoin}
                min={props.compounding ? 100 : 1}
                max={props.compounding ? 1000000 : 10000}
                step={props.compounding ? 100 : 10}
                onChange={(e: Event) => setLocalPerCoin((e.target as HTMLInputElement).value)}
                onBlur={() => props.setPerCoinUsdt(parseFloat(localPerCoin) || (props.compounding ? 1000 : 60))}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* Leverage */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.leverage || 'Leverage'}</label>
              <input type="number" value={localLeverage} min={1} max={125} step={1}
                onChange={(e: Event) => setLocalLeverage((e.target as HTMLInputElement).value)}
                onBlur={() => props.setLeverage(parseInt(localLeverage) || 5)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* Compounding Toggle — fits in 3rd grid column */}
            <div class="flex flex-col justify-end">
              <div class="flex items-center gap-1.5 h-[26px]">
                <button
                  onClick={() => props.setCompounding(!props.compounding)}
                  class="relative w-8 h-[18px] rounded-full transition-colors duration-200 shrink-0"
                  style={{ background: props.compounding ? '#3182f6' : '#3a3a42' }}
                  aria-label={props.compounding ? 'Switch to Simple mode' : 'Switch to Compound mode'}
                >
                  <span
                    class="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200"
                    style={{ transform: props.compounding ? 'translateX(14px)' : 'translateX(0)' }}
                  />
                </button>
                <label class="text-[10px] font-bold cursor-pointer select-none whitespace-nowrap"
                  onClick={() => props.setCompounding(!props.compounding)}
                  style={{ color: props.compounding ? '#3182f6' : 'var(--color-text-muted)' }}>
                  {props.compounding
                    ? (props.lang === 'ko' ? '복리' : 'Compound')
                    : (props.lang === 'ko' ? '단리' : 'Simple')}
                </label>
              </div>
            </div>
            {/* Compound info */}
            {props.compounding && (
              <div class="col-span-3 text-[9px] font-mono text-[--color-accent] bg-[--color-accent]/5 border border-[--color-accent]/20 rounded px-2 py-1.5 -mt-0.5">
                {(() => {
                  const capital = parseFloat(localPerCoin) || 1000;
                  const lev = parseInt(localLeverage) || 5;
                  const exposure = capital * lev;
                  const isSingle = props.coinMode === 'select' && props.selectedCoins.length === 1;
                  const coinLabel = isSingle ? props.selectedCoins[0] : (
                    props.coinMode === 'all' ? (props.lang === 'ko' ? '전체 코인' : 'All Coins') :
                    props.coinMode === 'top' ? `Top ${props.topN}` :
                    props.selectedCoins.length > 0 ? `${props.selectedCoins.length} coins` : '?'
                  );
                  return props.lang === 'ko'
                    ? `${coinLabel} — $${capital.toLocaleString()} × ${lev}x = $${exposure.toLocaleString()} 포지션, 수익이 다음 거래 원금에 누적`
                    : `${coinLabel} — $${capital.toLocaleString()} × ${lev}x = $${exposure.toLocaleString()} position, profits compound into next trade`;
                })()}
              </div>
            )}
            {/* Start Date */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.startDate}</label>
              <input type="date" value={props.startDate}
                onChange={(e: Event) => props.setStartDate((e.target as HTMLInputElement).value)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* End Date */}
            <div>
              <label class="text-[10px] text-[--color-text-muted]">{t.endDate}</label>
              <input type="date" value={props.endDate}
                onChange={(e: Event) => props.setEndDate((e.target as HTMLInputElement).value)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
          </div>
        </div>

        {/* Coin Selection */}
        <div class="px-4 py-2 border-b border-[--color-border]">
          <div class="text-xs font-mono text-[--color-text-muted] uppercase mb-1">{t.coins}</div>
          <div class="flex gap-1 mb-1.5">
            {[
              { mode: 'all' as const, label: t.allCoins },
              { mode: 'top' as const, label: `${t.topN} N` },
              { mode: 'select' as const, label: props.coinMode === 'select' && props.selectedCoins.length > 0 ? `${t.selectCoins} (${props.selectedCoins.length})` : t.selectCoins },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => props.setCoinMode(mode)}
                class={`px-2.5 py-0.5 text-xs font-mono rounded transition-colors border
                  ${props.coinMode === mode
                    ? 'font-bold'
                    : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/20'}`}
                style={props.coinMode === mode ? coinActiveStyle : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          {props.coinMode === 'top' && (
            <div>
              <input type="number" value={localTopN} min={1} max={props.totalCoins || 999}
                onChange={(e: Event) => setLocalTopN((e.target as HTMLInputElement).value)}
                onBlur={() => props.setTopN(parseInt(localTopN) || 50)}
                class="w-full px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
                placeholder={t.topCoinsPlaceholder || "Number of top coins"}
              />
              <p class="text-[10px] text-[--color-text-muted] mt-0.5 font-mono">{props.t.topNCoinsHint || `Top ${localTopN} coins by data availability`}</p>
            </div>
          )}
          {props.coinMode === 'select' && (
            <div>
              <div class="flex items-center gap-1 mb-1">
                <input
                  type="text"
                  value={props.coinSearch}
                  onInput={(e: Event) => props.setCoinSearch((e.target as HTMLInputElement).value)}
                  placeholder={t.searchCoinsPlaceholder || "Search coins..."}
                  class="flex-1 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs outline-none"
                />
                <button
                  onClick={() => {
                    const allSymbols = props.filteredCoins.map((c) => c.symbol);
                    props.setSelectedCoins((prev) => {
                      const combined = new Set([...prev, ...allSymbols]);
                      return Array.from(combined);
                    });
                  }}
                  class="px-2 py-1 text-[10px] font-mono text-[--color-accent] border border-[--color-border] rounded hover:bg-[--color-bg-hover] transition-colors whitespace-nowrap"
                >
                  All
                </button>
                <button
                  onClick={() => props.setSelectedCoins(() => [])}
                  class="px-2 py-1 text-[10px] font-mono text-[--color-text-muted] border border-[--color-border] rounded hover:bg-[--color-bg-hover] transition-colors whitespace-nowrap"
                >
                  None
                </button>
              </div>
              <div class="text-[10px] text-[--color-text-muted] font-mono mb-1">
                {props.selectedCoins.length} of {props.allCoinsCount} selected
              </div>
              {props.selectedCoins.length > 0 && (
                <div class="flex flex-wrap gap-1 mb-1">
                  {props.selectedCoins.map((s) => (
                    <span key={s} class="px-2 py-0.5 text-[10px] font-mono bg-[--color-accent]/10 text-[--color-accent] rounded flex items-center gap-1">
                      {s.replace('USDT', '')}
                      <button onClick={() => props.setSelectedCoins((p) => p.filter((x) => x !== s))} class="hover:text-[--color-red]" aria-label={`Remove ${s}`}>x</button>
                    </span>
                  ))}
                </div>
              )}
              <div class="max-h-48 overflow-y-auto">
                {props.filteredCoins.map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      props.setSelectedCoins((prev) =>
                        prev.includes(c.symbol) ? prev.filter((x) => x !== c.symbol) : [...prev, c.symbol]
                      );
                    }}
                    class={`block w-full text-left px-2 py-0.5 text-xs font-mono rounded hover:bg-[--color-bg-hover]
                      ${props.selectedCoins.includes(c.symbol) ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`}
                  >
                    {props.selectedCoins.includes(c.symbol) ? '\u2713 ' : ''}{c.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avoid Hours (collapsible) */}
        <details class="border-b border-[--color-border]" open>
          <summary class="px-4 py-2 text-xs font-mono text-[--color-text-muted] uppercase cursor-pointer select-none hover:text-[--color-text] transition-colors list-none flex items-center justify-between">
            <span>{t.avoidHours}</span>
            <span class="text-[10px] opacity-50">{props.avoidHours.size > 0 ? `${props.avoidHours.size}h selected` : 'none'}</span>
          </summary>
          <div class="px-4 pb-2">
            <div class="flex flex-wrap gap-1 sm:gap-0.5">
              {Array.from({ length: 24 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    props.setAvoidHours((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  }}
                  class={`w-8 h-8 sm:w-[26px] sm:h-[22px] text-xs sm:text-[10px] font-mono rounded transition-colors border
                    ${props.avoidHours.has(i)
                      ? ''
                      : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-red]/20'}`}
                  style={props.avoidHours.has(i) ? avoidActiveStyle : undefined}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </details>

        {/* Run Button */}
        <div class="px-4 py-2">
          {props.demoMode && (
            <div class="text-[10px] text-[--color-yellow] font-mono mb-1.5 px-2 py-1 bg-[--color-yellow]/10 rounded border border-[--color-yellow]/20">
              {t.apiDown}
            </div>
          )}
          <button
            onClick={props.onRun}
            disabled={props.isRunning || props.conditions.length === 0}
            class={`w-full py-2 rounded-lg font-mono text-sm font-bold transition-colors
              ${props.isRunning || props.conditions.length === 0 ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
            style={props.isRunning || props.conditions.length === 0 ? runDisabledStyle : runStyle}
          >
            {props.isRunning ? (
              <span class="flex items-center justify-center gap-2">
                <span class="spinner" />
                {props.progressLabels[props.progressStep] || t.running}
              </span>
            ) : props.conditions.length === 0 ? (
              <span class="text-xs">{t.addCondition}</span>
            ) : props.coinsLoaded > 0 ? t.runWithCoins?.replace('{n}', String(props.coinsLoaded)) || t.run : t.run}
          </button>
        </div>
      </div>
    </div>
  );
}
