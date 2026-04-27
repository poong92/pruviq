/**
 * Tooltip.tsx — Preact tooltip primitive (W1-1i).
 *
 * Wraps any trigger element to attach an accessible hover/focus tooltip.
 *
 * Distinct from `Tooltip.astro` — that one is for static markup
 * tooltips inside .astro pages (no client JS). This one is for
 * Preact components where tooltips need to react to dynamic state
 * and where aria-describedby wiring should be automatic.
 *
 * Triggers:
 *   - mouse hover (desktop): show with `delay` ms, hide on leave
 *   - keyboard focus: show immediately, hide on blur
 *   - touch: tap to show briefly (auto-hides after `touchHideMs`)
 *
 * Positioning:
 *   - top (default) / right / bottom / left
 *   - Position is relative to trigger via absolute positioning + flex
 *
 * a11y:
 *   - Trigger gets aria-describedby={tooltipId}
 *   - Tooltip is role="tooltip"
 *   - Escape on focused trigger hides tooltip immediately
 *
 * prefers-reduced-motion:
 *   - Respected via existing global CSS rules — uses opacity transition
 *     that the global `transition: none` override neutralizes.
 *
 * Single-child contract: caller passes ONE trigger element; tooltip
 * is rendered as a sibling positioned via wrapper.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

export type TooltipPlacement = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  children: ComponentChildren;
  /** Tooltip text or JSX. */
  content: ComponentChildren;
  /** Show delay in ms (hover only). Default 200. */
  delay?: number;
  /** Touch auto-hide delay in ms. Default 2500. */
  touchHideMs?: number;
  /** Placement. Default "top". */
  placement?: TooltipPlacement;
  /** Wrapper class hook. */
  class?: string;
  /** Tooltip class hook (the bubble itself). */
  tooltipClass?: string;
  /** Disable rendering — useful for conditional disable in React tree. */
  disabled?: boolean;
  "data-testid"?: string;
}

const placementClasses: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  right: "top-1/2 left-full -translate-y-1/2 ml-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "top-1/2 right-full -translate-y-1/2 mr-2",
};

const arrowClasses: Record<TooltipPlacement, string> = {
  top: "top-full left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45",
  right: "right-full top-1/2 translate-x-1/2 -translate-y-1/2 rotate-45",
  bottom: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45",
  left: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45",
};

export default function Tooltip({
  children,
  content,
  delay = 200,
  touchHideMs = 2500,
  placement = "top",
  class: className = "",
  tooltipClass = "",
  disabled = false,
  ...rest
}: TooltipProps) {
  const id = useId();
  const tooltipId = `tooltip-${id}`;
  const [open, setOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  function clearTimers() {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function show(immediate = false) {
    clearTimers();
    if (immediate || delay <= 0) {
      setOpen(true);
      return;
    }
    showTimer.current = setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    clearTimers();
    setOpen(false);
  }

  function showWithTouchAutoHide() {
    clearTimers();
    setOpen(true);
    hideTimer.current = setTimeout(() => setOpen(false), touchHideMs);
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  // Escape on focused trigger hides
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") hide();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (disabled) {
    return <>{children}</>;
  }

  // Inject aria-describedby into the trigger by wrapping in a span
  // (cleaner than cloning element — works regardless of child internals).
  return (
    <span
      ref={wrapperRef}
      class={`relative inline-block ${className}`.trim()}
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
      onTouchStart={showWithTouchAutoHide}
      aria-describedby={open ? tooltipId : undefined}
      {...rest}
    >
      {children}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          class={`absolute z-[120] pointer-events-none max-w-xs text-wrap rounded px-2 py-1 text-xs font-mono bg-[--color-bg-elevated] text-[--color-text] border border-[--color-border] shadow-[var(--shadow-md)] animate-[fadeIn_120ms_ease-out] ${placementClasses[placement]} ${tooltipClass}`.trim()}
          data-placement={placement}
        >
          {content}
          <span
            aria-hidden="true"
            class={`absolute w-2 h-2 bg-[--color-bg-elevated] border-r border-b border-[--color-border] ${arrowClasses[placement]}`}
          />
        </span>
      )}
    </span>
  );
}
