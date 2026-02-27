/**
 * PresetBar.tsx - Preset strategy buttons
 */
import type { PresetItem } from './simulator-types';
import { COLORS } from './simulator-types';

interface Props {
  presets: PresetItem[];
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
  label: string;
}

const activeStyle = { background: COLORS.accent, color: '#fff', borderColor: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accentGlowStrong}` };

export default function PresetBar({ presets, activePreset, onSelectPreset, label }: Props) {
  if (presets.length === 0) return null;

  return (
    <div class="px-4 py-2.5 border-b border-[--color-border]" style={{ background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)` }}>
      <div class="text-xs font-mono uppercase mb-2" style={{ color: COLORS.accent }}>{label}</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelectPreset(null)}
          class={`px-3 py-1.5 text-xs font-mono rounded transition-colors border
            ${activePreset === null
              ? 'font-bold'
              : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]'}`}
          style={activePreset === null ? activeStyle : undefined}
        >
          Custom
        </button>
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectPreset(p.id)}
            class={`px-3 py-1.5 text-xs font-mono rounded transition-colors border
              ${activePreset === p.id
                ? 'font-bold'
                : 'bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]'}`}
            style={activePreset === p.id ? activeStyle : undefined}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
