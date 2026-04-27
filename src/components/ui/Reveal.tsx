/**
 * Reveal.tsx — Single-child fade + translateY entrance.
 *
 * Wraps existing global `.reveal` CSS (src/styles/global.css line 706-715).
 * Two modes:
 *   1. auto (default) — animates on viewport entry via IntersectionObserver
 *   2. trigger — animates when the `trigger` prop becomes truthy
 *      (use for orchestrated reveals after API responses)
 *
 * `prefers-reduced-motion: reduce` is honored by the global CSS rule
 * (line 753-757) — children stay visible without transition.
 */
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

interface RevealProps {
  children: ComponentChildren;
  /** When provided, animates only after this becomes truthy. */
  trigger?: boolean;
  /** Delay in ms before adding `.visible` (default 0) */
  delay?: number;
  /** Tailwind/utility classes to merge onto the wrapper */
  class?: string;
  /** Wrapper element type (default `div`) */
  as?: "div" | "section" | "article" | "li" | "span";
  /** Pass-through ARIA / data attributes for testing + a11y. */
  "data-testid"?: string;
  "aria-label"?: string;
  "aria-live"?: JSX.HTMLAttributes["aria-live"];
  role?: string;
  id?: string;
}

export default function Reveal({
  children,
  trigger,
  delay = 0,
  class: className = "",
  as = "div",
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const isManual = trigger !== undefined;

  // Manual trigger mode — flip on prop change
  useEffect(() => {
    if (!isManual) return;
    if (!trigger) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [trigger, delay, isManual]);

  // Auto mode — IntersectionObserver
  useEffect(() => {
    if (isManual) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setTimeout(() => setVisible(true), delay);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, isManual]);

  const Tag = as as keyof JSX.IntrinsicElements;
  return (
    <Tag
      ref={ref as never}
      class={`reveal ${visible ? "visible" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
