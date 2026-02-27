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
      >
        {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
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
        class="w-10 px-1 py-1.5 bg-[--color-bg-tooltip] border border-[--color-border] rounded font-mono text-xs text-[--color-text] outline-none focus:border-[--color-accent]"
        title={c.shift === 1 ? 'Previous candle (safe)' : 'Current candle (risky)'}
      >
        <option value="1">P</option>
        <option value="0">C</option>
      </select>
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
