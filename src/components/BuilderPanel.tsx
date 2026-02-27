/**
 * BuilderPanel.tsx - Strategy builder panel (conditions, params, coins, run)
 */
import type { Condition, IndicatorInfo, PresetItem, CoinOption } from './simulator-types';
import { COLORS } from './simulator-types';
import PresetBar from './PresetBar';
import ConditionRow from './ConditionRow';

interface Props {
  // i18n
  t: Record<string, any>;
  // API state
  coinsLoaded: number;
  demoMode: boolean;
  // Indicators
  availableIndicators: IndicatorInfo[];
  selectedIndicators: Set<string>;
  setSelectedIndicators: (fn: (prev: Set<string>) => Set<string>) => void;
  availableFields: string[];
  // Conditions
  conditions: Condition[];
  addCondition: () => void;
  updateCondition: (id: string, key: string, val: any) => void;
  removeCondition: (id: string) => void;
  // Params
  direction: 'short' | 'long';
  setDirection: (d: 'short' | 'long') => void;
  slPct: number; setSlPct: (n: number) => void;
  tpPct: number; setTpPct: (n: number) => void;
  maxBars: number; setMaxBars: (n: number) => void;
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
  // Avoid hours
  avoidHours: Set<number>;
  setAvoidHours: (fn: (prev: Set<number>) => Set<number>) => void;
  // Presets
  presets: PresetItem[];
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
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
const runStyle = { background: COLORS.accent, color: '#fff', boxShadow: `0 0 20px ${COLORS.accentGlow}` };
const runDisabledStyle = { background: COLORS.disabled, color: COLORS.disabledText };

export default function BuilderPanel(props: Props) {
  const { t } = props;

  return (
    <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden flex flex-col" style={{ height: '640px' }}>
      {/* Panel header */}
      <div class="px-3 py-2 border-b border-[--color-border] flex-shrink-0">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs text-[--color-accent] tracking-wider">STRATEGY BUILDER</span>
          {props.coinsLoaded > 0 && (
            <span class="text-[--color-text-muted] text-[10px] font-mono">{props.coinsLoaded} coins</span>
          )}
        </div>
      </div>

      {/* Scrollable panel content */}
      <div class="overflow-y-auto flex-1">
        {/* Presets */}
        <PresetBar
          presets={props.presets}
          activePreset={props.activePreset}
          onSelectPreset={props.onSelectPreset}
          label={t.preset}
        />

        {/* Indicators */}
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1">{t.indicators}</div>
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
                class={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors border
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
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-mono text-[--color-text-muted] uppercase">{t.conditions}</span>
            <button onClick={props.addCondition} class="text-[10px] font-mono text-[--color-accent] hover:underline">
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
        </div>

        {/* Parameters */}
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1">{t.parameters}</div>
          <div class="grid grid-cols-2 gap-1.5">
            {/* Direction */}
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.direction}</label>
              <div class="flex gap-1 mt-0.5">
                <button
                  onClick={() => props.setDirection('short')}
                  class={`flex-1 py-1 text-[10px] font-mono rounded transition-colors border ${props.direction === 'short' ? 'font-bold' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-red]/30'}`}
                  style={props.direction === 'short' ? shortActiveStyle : undefined}
                >{t.short}</button>
                <button
                  onClick={() => props.setDirection('long')}
                  class={`flex-1 py-1 text-[10px] font-mono rounded transition-colors border ${props.direction === 'long' ? 'font-bold' : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30'}`}
                  style={props.direction === 'long' ? longActiveStyle : undefined}
                >{t.long}</button>
              </div>
            </div>
            {/* Max bars */}
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.maxBars}</label>
              <input type="number" value={props.maxBars} min={1} max={168}
                onChange={(e: any) => props.setMaxBars(parseInt(e.target.value) || 48)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* SL */}
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.sl}</label>
              <input type="number" value={props.slPct} min={1} max={50} step={0.5}
                onChange={(e: any) => props.setSlPct(parseFloat(e.target.value) || 10)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            {/* TP */}
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.tp}</label>
              <input type="number" value={props.tpPct} min={1} max={50} step={0.5}
                onChange={(e: any) => props.setTpPct(parseFloat(e.target.value) || 8)}
                class="w-full mt-0.5 px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[11px] text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1">{t.dateRange}</div>
          <div class="grid grid-cols-2 gap-1.5">
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.startDate}</label>
              <input type="date" value={props.startDate}
                onChange={(e: any) => props.setStartDate(e.target.value)}
                class="w-full mt-0.5 px-1.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
            <div>
              <label class="text-[9px] text-[--color-text-muted]">{t.endDate}</label>
              <input type="date" value={props.endDate}
                onChange={(e: any) => props.setEndDate(e.target.value)}
                class="w-full mt-0.5 px-1.5 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
              />
            </div>
          </div>
        </div>

        {/* Coin Selection */}
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1">{t.coins}</div>
          <div class="flex gap-1 mb-1">
            {[
              { mode: 'all' as const, label: t.allCoins },
              { mode: 'top' as const, label: `${t.topN} N` },
              { mode: 'select' as const, label: t.selectCoins },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => props.setCoinMode(mode)}
                class={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors border
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
            <input type="number" value={props.topN} min={1} max={549}
              onChange={(e: any) => props.setTopN(parseInt(e.target.value) || 50)}
              class="w-full px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] text-[--color-text] outline-none focus:border-[--color-accent]"
              placeholder="Number of top coins"
            />
          )}
          {props.coinMode === 'select' && (
            <div>
              <input
                type="text"
                value={props.coinSearch}
                onInput={(e: any) => props.setCoinSearch(e.target.value)}
                placeholder="Search coins..."
                class="w-full px-2 py-1 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-[10px] outline-none mb-1"
              />
              {props.selectedCoins.length > 0 && (
                <div class="flex flex-wrap gap-0.5 mb-1">
                  {props.selectedCoins.map((s) => (
                    <span key={s} class="px-1.5 py-0.5 text-[9px] font-mono bg-[--color-accent]/10 text-[--color-accent] rounded flex items-center gap-0.5">
                      {s.replace('USDT', '')}
                      <button onClick={() => props.setSelectedCoins((p) => p.filter((x) => x !== s))} class="hover:text-[--color-red]">x</button>
                    </span>
                  ))}
                </div>
              )}
              <div class="max-h-24 overflow-y-auto">
                {props.filteredCoins.map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      props.setSelectedCoins((prev) =>
                        prev.includes(c.symbol) ? prev.filter((x) => x !== c.symbol) : [...prev, c.symbol]
                      );
                    }}
                    class={`block w-full text-left px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-[--color-bg-hover]
                      ${props.selectedCoins.includes(c.symbol) ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`}
                  >
                    {props.selectedCoins.includes(c.symbol) ? '✓ ' : ''}{c.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avoid Hours */}
        <div class="px-3 py-1.5 border-b border-[--color-border]">
          <div class="text-[10px] font-mono text-[--color-text-muted] uppercase mb-1">{t.avoidHours}</div>
          <div class="flex flex-wrap gap-0.5">
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
                class={`w-6 h-5 text-[9px] font-mono rounded transition-colors border
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

        {/* Run Button */}
        <div class="px-3 py-2">
          {props.demoMode && (
            <div class="text-[9px] text-[--color-yellow] font-mono mb-2 px-2 py-1 bg-[--color-yellow]/10 rounded border border-[--color-yellow]/20">
              {t.apiDown}
            </div>
          )}
          <button
            onClick={props.onRun}
            disabled={props.isRunning || props.conditions.length === 0}
            class={`w-full py-2.5 rounded-lg font-mono text-sm font-bold transition-colors
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
