/**
 * Stagger.tsx — Multi-child staggered fade + translateY entrance.
 *
 * Wraps existing global `.reveal-child` CSS (src/styles/global.css line 727-745).
 * Each direct child gets a `transition-delay` of (80ms × index) up to 12 children.
 *
 * Mode:
 *   - auto (default)    : animates on viewport entry
 *   - trigger={bool}    : animates when prop becomes truthy (use for result reveal)
 *
 * `prefers-reduced-motion: reduce` is honored by the global CSS rule
 * (line 753-757) — all children stay visible with no transition.
 */
import { useEffect, useRef, useState, type ComponentChildren } from "preact";

interface StaggerProps {
  children: ComponentChildren;
  /** When provided, animates only after this becomes truthy. */
  trigger?: boolean;
  /** Initial delay before stagger sequence starts (default 0) */
  delay?: number;
  /** Tailwind/utility classes to merge onto the wrapper */
  class?: string;
  /** Wrapper element type (default `div`) */
  as?: "div" | "section" | "ul" | "ol";
}

export default function Stagger({
  children,
  trigger,
  delay = 0,
  class: className = "",
  as = "div",
}: StaggerProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const isManual = trigger !== undefined;

  useEffect(() => {
    if (!isManual) return;
    if (!trigger) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [trigger, delay, isManual]);

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
      class={`reveal-child ${visible ? "visible" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
