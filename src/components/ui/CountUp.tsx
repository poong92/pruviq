/**
 * CountUp.tsx — Animated number counter triggered on viewport entry.
 * Reuses the same ease-out cubic pattern from SimulatorPreview.tsx.
 */
import { useEffect, useRef, useState } from "preact/hooks";

interface CountUpProps {
  /** Target number to count up to */
  target: number;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Text appended after number (e.g. "+", "M+") */
  suffix?: string;
  /** Text prepended before number */
  prefix?: string;
  /** Animation duration in ms */
  duration?: number;
  /** Use locale formatting (commas) */
  locale?: string;
}

export default function CountUp({
  target,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 1500,
  locale,
}: CountUpProps) {
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Trigger on viewport entry
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setCurrent(target);
      setStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  // Animate
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  const formatted = locale
    ? current.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : current.toFixed(decimals);

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
