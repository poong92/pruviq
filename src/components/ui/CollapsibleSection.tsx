/**
 * CollapsibleSection.tsx — Expandable metric group for Summary tab.
 * Uses native <details>/<summary> for zero-JS progressive enhancement.
 */
import type { ComponentChildren } from "preact";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
  badge?: string;
  badgeColor?: string;
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  badge,
  badgeColor,
}: Props) {
  return (
    <details
      class="group mb-3 rounded-lg border border-[--color-border] overflow-hidden"
      open={defaultOpen}
    >
      <summary class="flex items-center justify-between px-3 py-2 cursor-pointer select-none bg-[--color-bg-tooltip] hover:bg-[--color-bg-hover]/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] text-[--color-text-muted] uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span
              class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                color: badgeColor || "var(--color-accent)",
                background: (badgeColor || "var(--color-accent)") + "15",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <svg
          class="w-3 h-3 text-[--color-text-muted] transition-transform group-open:rotate-180"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </summary>
      <div class="px-3 py-2.5 border-t border-[--color-border]">{children}</div>
    </details>
  );
}
