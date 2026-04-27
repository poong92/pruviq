/**
 * Skeleton.tsx — Typed loading placeholder primitive (W1-1f).
 *
 * Wraps the existing global `.skeleton` CSS class (src/styles/global.css
 * line 773-783) and `@keyframes shimmer`. Use anywhere data is
 * loading and reserving space prevents layout shift.
 *
 * Variants:
 *   text     line of text (height 1em, scales with parent font-size)
 *   rect     rectangular block (height required)
 *   circle   1:1 circle (size required)
 *
 * a11y:
 *   - aria-hidden="true" by default (purely decorative — the parent
 *     should announce loading via role="status" / aria-busy="true")
 *   - Set `aria-label` and the wrapper becomes role="img" so screen
 *     readers announce something descriptive
 *
 * Reduced motion: respected via the existing global override on
 * `@media (prefers-reduced-motion: reduce)` — the shimmer animation
 * is paused and the skeleton renders as a static block.
 */
import type { JSX } from "preact";

export type SkeletonVariant = "text" | "rect" | "circle";

interface BaseProps {
  variant?: SkeletonVariant;
  /** CSS width — number (px) or string (e.g., "100%", "12rem"). */
  width?: number | string;
  /** CSS height — number (px) or string. Required for rect variant. */
  height?: number | string;
  /** Additional utility classes. */
  class?: string;
  /** Optional accessible label. When set, wrapper becomes role=img. */
  "aria-label"?: string;
  "data-testid"?: string;
}

const baseClasses = "skeleton";

const variantClasses: Record<SkeletonVariant, string> = {
  text: "block h-[1em] my-1 rounded-sm",
  rect: "block rounded",
  circle: "rounded-full",
};

function dim(v?: number | string): string | undefined {
  if (v == null) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

export default function Skeleton({
  variant = "rect",
  width,
  height,
  class: className = "",
  "aria-label": ariaLabel,
  ...rest
}: BaseProps) {
  const style: JSX.CSSProperties = {};
  if (width != null) style.width = dim(width);
  if (height != null) style.height = dim(height);

  // Circle: width = height when only one provided
  if (variant === "circle") {
    if (width != null && height == null) style.height = style.width;
    if (height != null && width == null) style.width = style.height;
  }

  const merged =
    `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  if (ariaLabel) {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        class={merged}
        style={style}
        {...rest}
      />
    );
  }

  return <span aria-hidden="true" class={merged} style={style} {...rest} />;
}
