/**
 * QuickTestPanel.tsx — Quick Test (AI optimized) mode
 *
 * 5 situation-based categories, each mapped to 2 backend presets.
 * One tap → auto-load preset → run backtest → show results.
 *
 * Categories (6-expert consensus):
 *  1. Breakout (폭발 직전) — BB Squeeze SHORT + LONG
 *  2. Catch the Bounce (반등 기회) — RSI Reversal LONG + DCA Oversold LONG
 *  3. Sideways Profit (횡보 수익) — Grid Mean Rev LONG + BB Band Bounce LONG
 *  4. Ride the Trend (추세 탑승) — MACD Momentum LONG + EMA Crossover LONG
 *  5. All Weather (전천후) — Stochastic Overbought SHORT + Stoch RSI Overbought SHORT
 */

import { useState } from 'preact/hooks';
import { COLORS } from './simulator-types';

export interface QuickCategory {
  id: string;
  icon: string;
  presets: string[];       // backend preset IDs
  defaultPreset: string;   // which one to run first
}

interface Props {
  lang: 'en' | 'ko';
  onRunPreset: (presetId: string) => Promise<void>;
  isRunning: boolean;
  hasResult: boolean;
}

const CATEGORIES: QuickCategory[] = [
  { id: 'breakout',    icon: '💥', presets: ['bb-squeeze-short', 'bb-squeeze-long', 'hv-squeeze-breakout-short', 'hv-squeeze-breakout-long'], defaultPreset: 'bb-squeeze-short' },
  { id: 'bounce',      icon: '📈', presets: ['rsi-reversal-long', 'dca-oversold-long', 'rsi-bb-oversold-long'],  defaultPreset: 'rsi-reversal-long' },
  { id: 'sideways',    icon: '↔️',  presets: ['grid-mean-reversion-long', 'bb-band-bounce-long', 'rsi-bb-overbought-short'], defaultPreset: 'grid-mean-reversion-long' },
  { id: 'trend',       icon: '🚀', presets: ['macd-momentum-long', 'ema-crossover-long', 'adx-trend-long', 'adx-trend-short'], defaultPreset: 'adx-trend-long' },
  { id: 'allweather',  icon: '🛡️', presets: ['stochastic-oversold-short', 'stoch-rsi-overbought-short', 'macd-crossover-short', 'ema-crossover-short'], defaultPreset: 'stochastic-oversold-short' },
  { id: 'turtle',      icon: '🐢', presets: ['turtle-breakout-long', 'turtle-breakout-short'], defaultPreset: 'turtle-breakout-long' },
];

const L = {
  en: {
    title: 'Choose a Market Scenario',
    subtitle: 'AI picks the best strategy for each situation',
    breakout: 'Breakout',
    breakoutDesc: 'Volatility squeeze → explosion',
    bounce: 'Catch the Bounce',
    bounceDesc: 'Oversold reversal signals',
    sideways: 'Sideways Profit',
    sidewaysDesc: 'Range-bound mean reversion',
    trend: 'Ride the Trend',
    trendDesc: 'ADX + MACD + EMA trend',
    allweather: 'All Weather',
    allweatherDesc: 'Hedging & short strategies',
    turtle: 'Turtle Trading',
    turtleDesc: '20-bar breakout system',
    run: 'Test Now',
    running: 'Running...',
    aiPick: 'AI Recommended',
    alsoTry: 'Also try:',
    resultHint: 'Scroll down to see results',
  },
  ko: {
    title: '시장 상황을 선택하세요',
    subtitle: 'AI가 각 상황에 최적 전략을 선택합니다',
    breakout: '폭발 직전',
    breakoutDesc: '변동성 압축 → 폭발',
    bounce: '반등 기회',
    bounceDesc: '과매도 반전 신호',
    sideways: '횡보 수익',
    sidewaysDesc: '박스권 평균회귀',
    trend: '추세 탑승',
    trendDesc: 'ADX + MACD + EMA 추세',
    allweather: '전천후',
    allweatherDesc: '헤징 & 숏 전략',
    turtle: '거북이 트레이딩',
    turtleDesc: '20봉 돌파 시스템',
    run: '지금 테스트',
    running: '실행 중...',
    aiPick: 'AI 추천',
    alsoTry: '추가 전략:',
    resultHint: '아래로 스크롤하면 결과를 볼 수 있습니다',
  },
};

// Preset name display (short)
const PRESET_LABELS: Record<string, { en: string; ko: string }> = {
  'bb-squeeze-short':            { en: 'BB Squeeze SHORT', ko: 'BB 스퀴즈 숏' },
  'bb-squeeze-long':             { en: 'BB Squeeze LONG',  ko: 'BB 스퀴즈 롱' },
  'rsi-reversal-long':           { en: 'RSI Reversal',     ko: 'RSI 반전' },
  'dca-oversold-long':           { en: 'DCA Oversold',     ko: 'DCA 과매도' },
  'grid-mean-reversion-long':    { en: 'Grid Mean Rev',    ko: '그리드 평균회귀' },
  'bb-band-bounce-long':         { en: 'BB Bounce',        ko: 'BB 바운스' },
  'macd-momentum-long':          { en: 'MACD Momentum',    ko: 'MACD 모멘텀' },
  'ema-crossover-long':          { en: 'EMA Crossover',    ko: 'EMA 교차' },
  'stochastic-oversold-short':   { en: 'Stoch Overbought', ko: '스토캐스틱 과매수' },
  'stoch-rsi-overbought-short':  { en: 'Stoch RSI Short',  ko: '스톡RSI 숏' },
  'adx-trend-short':             { en: 'ADX Trend SHORT',  ko: 'ADX 추세 숏' },
  'adx-trend-long':              { en: 'ADX Trend LONG',   ko: 'ADX 추세 롱' },
  'rsi-bb-overbought-short':     { en: 'RSI+BB SHORT',     ko: 'RSI+BB 과매수 숏' },
  'rsi-bb-oversold-long':        { en: 'RSI+BB LONG',      ko: 'RSI+BB 과매도 롱' },
  'turtle-breakout-short':       { en: 'Turtle SHORT',     ko: '거북이 숏' },
  'turtle-breakout-long':        { en: 'Turtle LONG',      ko: '거북이 롱' },
  'macd-crossover-short':        { en: 'MACD Cross SHORT', ko: 'MACD 크로스 숏' },
  'ema-crossover-short':         { en: 'EMA Cross SHORT',  ko: 'EMA 크로스 숏' },
  'hv-squeeze-breakout-short':   { en: 'HV Squeeze SHORT', ko: 'HV 스퀴즈 숏' },
  'hv-squeeze-breakout-long':    { en: 'HV Squeeze LONG',  ko: 'HV 스퀴즈 롱' },
};

export default function QuickTestPanel({ lang, onRunPreset, isRunning, hasResult }: Props) {
  const t = L[lang] || L.en;
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [runningPreset, setRunningPreset] = useState<string | null>(null);

  const handleCategoryClick = async (cat: QuickCategory) => {
    setSelectedCat(cat.id);
    setRunningPreset(cat.defaultPreset);
    try {
      await onRunPreset(cat.defaultPreset);
    } finally {
      setRunningPreset(null);
    }
  };

  const handleAltPreset = async (presetId: string) => {
    setRunningPreset(presetId);
    try {
      await onRunPreset(presetId);
    } finally {
      setRunningPreset(null);
    }
  };

  return (
    <div class="mb-3">
      {/* Header */}
      <div class="text-center mb-4">
        <h2 class="font-mono text-sm font-bold" style={{ color: COLORS.accent }}>
          {t.title}
        </h2>
        <p class="text-[11px] text-[--color-text-muted] mt-1">{t.subtitle}</p>
      </div>

      {/* Category Cards Grid */}
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCat === cat.id;
          const isCatRunning = runningPreset && cat.presets.includes(runningPreset);
          const catT = t as any;

          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              disabled={isRunning}
              class={`relative rounded-lg border p-3 text-center transition-all group
                ${isRunning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
                ${isSelected ? 'border-[--color-accent]' : 'border-[--color-border] hover:border-[--color-text-muted]'}`}
              style={isSelected ? {
                background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)`,
                boxShadow: `0 0 12px ${COLORS.accentGlow}`,
              } : undefined}
            >
              {/* Icon */}
              <span class="text-2xl leading-none block mb-1.5">{cat.icon}</span>

              {/* Label */}
              <span class={`font-mono text-xs font-bold block ${isSelected ? '' : 'text-[--color-text-muted] group-hover:text-[--color-text]'}`}
                style={isSelected ? { color: COLORS.accent } : undefined}>
                {catT[cat.id]}
              </span>

              {/* Description */}
              <span class="text-[10px] text-[--color-text-muted] leading-tight block mt-0.5">
                {catT[`${cat.id}Desc`]}
              </span>

              {/* Running spinner */}
              {isCatRunning && (
                <div class="absolute inset-0 flex items-center justify-center rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <span class="spinner" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Category: Alt preset button */}
      {selectedCat && !isRunning && (
        <div class="mt-3 flex items-center justify-center gap-2 text-[11px] text-[--color-text-muted]">
          <span>{t.alsoTry}</span>
          {CATEGORIES.find(c => c.id === selectedCat)?.presets
            .filter(p => p !== CATEGORIES.find(c => c.id === selectedCat)?.defaultPreset)
            .map(presetId => (
              <button
                key={presetId}
                onClick={() => handleAltPreset(presetId)}
                class="px-2 py-1 rounded border border-[--color-border] font-mono text-[10px] hover:border-[--color-accent] hover:text-[--color-accent] transition-colors"
              >
                {PRESET_LABELS[presetId]?.[lang] || presetId}
              </button>
            ))}
        </div>
      )}

      {/* Result hint */}
      {hasResult && selectedCat && (
        <p class="text-center text-[10px] text-[--color-text-muted] mt-2 animate-pulse">
          ↓ {t.resultHint}
        </p>
      )}
    </div>
  );
}
