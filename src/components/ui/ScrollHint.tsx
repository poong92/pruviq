/**
 * ScrollHint.tsx — Shows a "Scroll →" hint when content overflows horizontally.
 *
 * Wraps a child element with overflow-x-auto and detects if scrollable.
 * On mobile, shows a subtle right-arrow indicator that fades on scroll.
 */
import { useRef, useState, useEffect, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
  class?: string;
  label?: string;
}

export default function ScrollHint({
  children,
  class: className = "",
  label = "Scroll \u2192",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [scrolledRight, setScrolledRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const overflows = el.scrollWidth > el.clientWidth + 2;
    setCanScroll(overflows);
    setScrolledRight(el.scrollLeft > 20);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow]);

  return (
    <div class={`relative ${className}`}>
      <div
        ref={containerRef}
        class="overflow-x-auto -webkit-overflow-scrolling-touch"
      >
        {children}
      </div>
      {canScroll && !scrolledRight && (
        <div
          class="absolute right-0 top-0 h-full w-8 pointer-events-none flex items-start pt-2 justify-end pr-1 md:hidden scroll-hint-fade"
          aria-hidden="true"
        >
          <span class="text-[10px] font-mono text-[--color-text-muted] bg-[--color-bg]/80 px-1 py-0.5 rounded border border-[--color-border]/50 backdrop-blur-sm">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
