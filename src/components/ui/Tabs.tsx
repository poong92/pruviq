/**
 * Tabs.tsx — Typed controlled tab strip primitive (W1-1e).
 *
 * Replaces 13+ bespoke tab implementations across ResultsPanel,
 * MarketDashboard, ModeSwitcher, SimulatorPage, SkillSwitcher, etc.
 *
 * Controlled component: caller owns the active tab state and renders the
 * <TabPanels> separately. This separation lets callers structure layouts
 * freely and avoids forcing children-as-tabs API ergonomics.
 *
 * Variants:
 *   underline  active tab gets accent underline                — default
 *   pills      active tab gets filled bg                       — chip-style
 *   subtle     active tab gets muted bg, no underline          — secondary nav
 *
 * Sizes: sm | md (default) | lg
 *
 * a11y:
 *   - role="tablist" on container (aria-orientation="horizontal")
 *   - role="tab" with aria-selected per tab
 *   - aria-controls + id wiring so panels can use aria-labelledby
 *   - Keyboard: ←/→ to move, Home/End to jump, Enter/Space to activate
 *     (focus follows by default; pass `manualActivation` to require Enter)
 *   - tabIndex: active=0, others=-1 (roving tabindex pattern)
 *
 * Companion <TabPanel> renders an accessible region with the right ids.
 */
import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useId, useRef } from "preact/hooks";

export type TabsVariant = "underline" | "pills" | "subtle";
export type TabsSize = "sm" | "md" | "lg";

export interface TabItem<V extends string> {
  value: V;
  label: ComponentChildren;
  /** Optional badge/count chip after the label. */
  badge?: ComponentChildren;
  /** Disable this tab. */
  disabled?: boolean;
}

export interface TabsProps<V extends string> {
  tabs: ReadonlyArray<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  /** When true, arrow keys move focus only — Enter/Space activates. Default false (focus follows). */
  manualActivation?: boolean;
  /** Tab strip aria-label (or pass aria-labelledby externally). */
  "aria-label"?: string;
  /** Outer wrapper class. */
  class?: string;
  /** Per-tab class hook (applied to all tabs). */
  tabClass?: string;
  /** Stable id prefix for tab/panel wiring. Auto-generated when omitted. */
  idPrefix?: string;
  "data-testid"?: string;
}

const variantTabBase: Record<TabsVariant, string> = {
  underline: "border-b-2 border-transparent",
  pills: "rounded-full",
  subtle: "rounded",
};
const variantTabActive: Record<TabsVariant, string> = {
  underline: "border-[--color-accent] text-[--color-accent]",
  pills: "bg-[--color-accent] text-white",
  subtle: "bg-[--color-bg-hover] text-[--color-text]",
};
const variantTabIdle: Record<TabsVariant, string> = {
  underline:
    "text-[--color-text-muted] hover:text-[--color-text] hover:border-[--color-border-hover]",
  pills:
    "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]",
  subtle:
    "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]",
};

const variantList: Record<TabsVariant, string> = {
  underline: "border-b border-[--color-border]",
  pills: "gap-1.5",
  subtle: "gap-1",
};

const sizeClasses: Record<TabsSize, string> = {
  sm: "text-xs h-8 px-2.5 min-h-[32px]",
  md: "text-sm h-10 px-4 min-h-[40px]",
  lg: "text-base h-12 px-5 min-h-[48px]",
};

export function tabId(prefix: string, value: string) {
  return `${prefix}-tab-${value}`;
}
export function panelId(prefix: string, value: string) {
  return `${prefix}-panel-${value}`;
}

export default function Tabs<V extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  size = "md",
  manualActivation = false,
  "aria-label": ariaLabel,
  class: className = "",
  tabClass = "",
  idPrefix: idPrefixProp,
  ...rest
}: TabsProps<V>) {
  const reactId = useId();
  const idPrefix = idPrefixProp ?? `tabs-${reactId}`;
  const refs = useRef<Map<V, HTMLButtonElement>>(new Map());

  const enabledIndices = tabs
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !t.disabled)
    .map(({ i }) => i);

  const focusTabAt = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) return;
      const el = refs.current.get(tab.value);
      el?.focus();
      if (!manualActivation && !tab.disabled) onChange(tab.value);
    },
    [tabs, onChange, manualActivation],
  );

  const handleKey = useCallback(
    (e: KeyboardEvent, currentIdx: number) => {
      if (enabledIndices.length === 0) return;
      const pos = enabledIndices.indexOf(currentIdx);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = enabledIndices[(pos + 1) % enabledIndices.length];
        focusTabAt(next);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev =
          enabledIndices[
            (pos - 1 + enabledIndices.length) % enabledIndices.length
          ];
        focusTabAt(prev);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusTabAt(enabledIndices[0]);
      } else if (e.key === "End") {
        e.preventDefault();
        focusTabAt(enabledIndices[enabledIndices.length - 1]);
      } else if (manualActivation && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const tab = tabs[currentIdx];
        if (tab && !tab.disabled) onChange(tab.value);
      }
    },
    [enabledIndices, focusTabAt, manualActivation, tabs, onChange],
  );

  // Ensure refs stay current
  useEffect(() => {
    refs.current.forEach((_, k) => {
      if (!tabs.find((t) => t.value === k)) refs.current.delete(k);
    });
  }, [tabs]);

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      class={`flex items-stretch ${variantList[variant]} ${className}`.trim()}
      {...rest}
    >
      {tabs.map((tab, i) => {
        const selected = tab.value === value;
        const idle = !selected;
        const tabClasses = [
          "inline-flex items-center justify-center gap-1.5 font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg]",
          sizeClasses[size],
          variantTabBase[variant],
          selected ? variantTabActive[variant] : variantTabIdle[variant],
          tab.disabled ? "opacity-50 cursor-not-allowed" : "",
          tabClass,
        ].join(" ");

        return (
          <button
            key={tab.value}
            ref={(el: HTMLButtonElement | null) => {
              if (el) refs.current.set(tab.value, el);
              else refs.current.delete(tab.value);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.value)}
            aria-selected={selected ? "true" : "false"}
            aria-controls={panelId(idPrefix, tab.value)}
            aria-disabled={tab.disabled ? "true" : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => {
              if (tab.disabled) return;
              onChange(tab.value);
            }}
            onKeyDown={(e) => handleKey(e as KeyboardEvent, i)}
            class={tabClasses}
            data-active={selected ? "true" : undefined}
            data-tab-value={tab.value}
          >
            {tab.label}
            {tab.badge != null && (
              <span class="text-[--color-accent-bright] font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  /** The id prefix used by the parent <Tabs> (or auto-generated). */
  idPrefix: string;
  /** Active tab value — caller passes the same value as <Tabs value=>. */
  active: string;
  /** This panel's tab value. */
  value: string;
  children: ComponentChildren;
  class?: string;
  /** Render strategy: always (mount all, hide non-active) | lazy (only mount active). Default lazy. */
  mount?: "always" | "lazy";
}

export function TabPanel({
  idPrefix,
  active,
  value,
  children,
  class: className = "",
  mount = "lazy",
}: TabPanelProps) {
  const isActive = active === value;
  if (mount === "lazy" && !isActive) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      hidden={mount === "always" && !isActive ? true : undefined}
      tabIndex={0}
      class={className}
    >
      {children}
    </div>
  );
}

// Re-export so consumers can build their own panel id wiring if needed.
export type { JSX };
