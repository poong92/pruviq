/**
 * ConditionRow.tsx - Single entry condition row
 */
import type { Condition } from './simulator-types';
import { OPS, booleanFields } from './simulator-types';

interface Props {
  condition: Condition;
  availableFields: string[];
  onUpdate: (id: string, key: string, val: any) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
}

export default function ConditionRow({ condition: c, availableFields, onUpdate, onRemove, removeLabel }: Props) {
  const fieldDescriptions: Record<string, string> = {
    'is_squeeze': 'Bollinger Band Squeeze detected',
    'bb_width_change': 'BB width expansion rate (%)',
    'vol_ratio': 'Volume ratio vs average',
    'bearish': 'Bearish candle pattern',
    'bullish': 'Bullish candle pattern',
    'ema_fast': 'Fast EMA value',
    'ema_slow': 'Slow EMA value',
    'rsi': 'RSI (Relative Strength Index)',
    'macd_hist': 'MACD Histogram',
    'stoch_k': 'Stochastic %K',
    'stoch_d': 'Stochastic %D',
    'adx': 'ADX (Average Directional Index)',
    'atr': 'ATR (Average True Range)',
    'hv': 'Historical Volatility',
    'price_change': 'Price change (%)',
    'close': 'Close price',
    'open': 'Open price',
    'high': 'High price',
    'low': 'Low price',
    'volume': 'Trading volume',
    'bb_upper': 'Bollinger Band upper',
    'bb_lower': 'Bollinger Band lower',
    'bb_mid': 'Bollinger Band middle',
    'ema20': 'EMA 20-period',
    'ema50': 'EMA 50-period',
    'uptrend': 'Uptrend detected',
    'downtrend': 'Downtrend detected',
    'doji': 'Doji candle pattern',
  };

  return (
    <div class="flex items-center gap-1.5 text-xs">
      {/* Field */}
      <select
        value={c.field}
        onChange={(e: any) => {
          const newField = e.target.value;
          onUpdate(c.id, 'field', newField);
          if (booleanFields.has(newField)) {
            onUpdate(c.id, 'op', '==');
            onUpdate(c.id, 'value', true);
          }
        }}
        class="flex-1 min-w-0 px-1.5 py-1.5 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
        title={fieldDescriptions[c.field] || c.field}
      >
        {availableFields.map((f) => <option key={f} value={f} title={fieldDescriptions[f] || f}>{f}</option>)}
      </select>
      {/* Op */}
      <select
        value={c.op}
        onChange={(e: any) => onUpdate(c.id, 'op', e.target.value)}
        class="w-12 px-1 py-1.5 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
      >
        {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {/* Value */}
      {booleanFields.has(c.field) ? (
        <select
          value={String(c.value)}
          onChange={(e: any) => onUpdate(c.id, 'value', e.target.value === 'true')}
          class="w-14 px-1 py-1.5 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type="number"
          step="any"
          value={c.value as number}
          onChange={(e: any) => onUpdate(c.id, 'value', parseFloat(e.target.value))}
          class="w-16 px-1.5 py-1.5 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
        />
      )}
      {/* Shift */}
      <select
        value={c.shift}
        onChange={(e: any) => onUpdate(c.id, 'shift', parseInt(e.target.value))}
        class={`w-12 px-1 py-1.5 bg-[--color-bg-tooltip] border rounded font-mono text-xs outline-none focus:border-[--color-accent] ${
          c.shift === 0
            ? 'border-[--color-yellow] text-[--color-yellow] font-bold'
            : 'border-[--color-border] text-[--color-text]'
        }`}
        title={c.shift === 1 ? 'Previous candle (confirmed/safe for live trading)' : 'Current candle (incomplete in live) — look-ahead bias risk!'}
      >
        <option value="1">Prev</option>
        <option value="0">Curr</option>
      </select>
      {c.shift === 0 && (
        <span class="text-[--color-yellow] text-[9px] font-mono shrink-0" title="Using current (incomplete) candle data may cause look-ahead bias in live trading">!</span>
      )}
      {/* Remove */}
      <button
        onClick={() => onRemove(c.id)}
        class="text-[--color-text-muted] hover:text-[--color-red] px-1"
        title={removeLabel}
      >
        x
      </button>
    </div>
  );
}
