/**
 * PresetBar.tsx - Preset strategy buttons (compact)
 * Shows top 5 as RECOMMENDED, rest collapsible.
 */
import { useState } from "preact/hooks";
import type { PresetItem } from "./simulator-types";
import { COLORS } from "./simulator-types";

interface Props {
  presets: PresetItem[];
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
  label: string;
  loading?: boolean;
}

const RECOMMENDED_COUNT = 5;

const activeStyle = {
  background: COLORS.accent,
  color: "#fff",
  borderColor: COLORS.accent,
  boxShadow: `0 0 12px ${COLORS.accentGlowStrong}`,
};

function PresetButton({
  p,
  activePreset,
  onSelectPreset,
}: {
  p: PresetItem;
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
}) {
  const isActive = activePreset === p.id;
  return (
    <button
      key={p.id}
      onClick={() => onSelectPreset(p.id)}
      class={`px-2.5 py-1 text-xs font-mono rounded transition-colors border
        ${
          isActive
            ? "font-bold"
            : "bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]"
        }`}
      style={isActive ? activeStyle : undefined}
    >
      {p.name}
    </button>
  );
}

export default function PresetBar({
  presets,
  activePreset,
  onSelectPreset,
  label,
  loading,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  if (presets.length === 0) return null;

  const recommended = presets.slice(0, RECOMMENDED_COUNT);
  const rest = presets.slice(RECOMMENDED_COUNT);
  const hasMore = rest.length > 0;
  // If active preset is in "rest", auto-expand
  const activeInRest = hasMore && rest.some((p) => p.id === activePreset);

  return (
    <div
      class="px-4 py-2 border-b border-[--color-border]"
      style={{
        background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)`,
      }}
    >
      {/* RECOMMENDED row */}
      <div
        class="text-xs font-mono uppercase mb-1 flex items-center gap-1.5"
        style={{ color: COLORS.accent }}
      >
        ★ Recommended
        {loading && (
          <span class="spinner" style={{ width: "10px", height: "10px" }} />
        )}
      </div>
      <div class="flex flex-wrap gap-1 mb-1.5">
        <button
          onClick={() => onSelectPreset(null)}
          class={`px-2.5 py-1 text-xs font-mono rounded transition-colors border
            ${
              activePreset === null
                ? "font-bold"
                : "bg-[--color-bg-tooltip] text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]"
            }`}
          style={activePreset === null ? activeStyle : undefined}
        >
          Custom
        </button>
        {recommended.map((p) => (
          <PresetButton
            key={p.id}
            p={p}
            activePreset={activePreset}
            onSelectPreset={onSelectPreset}
          />
        ))}
      </div>

      {/* Collapsible "All presets" */}
      {hasMore && (
        <>
          <button
            onClick={() => setShowAll((v) => !v)}
            class="text-[0.65rem] font-mono text-[--color-text-muted] hover:text-[--color-accent] transition-colors flex items-center gap-1 mb-1"
          >
            <span
              style={{
                display: "inline-block",
                transform: showAll || activeInRest ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              ▶
            </span>
            {showAll || activeInRest ? "Hide" : `All ${presets.length} presets`}
          </button>
          {(showAll || activeInRest) && (
            <div class="flex flex-wrap gap-1">
              {rest.map((p) => (
                <PresetButton
                  key={p.id}
                  p={p}
                  activePreset={activePreset}
                  onSelectPreset={onSelectPreset}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
