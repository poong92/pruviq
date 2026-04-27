/**
 * Badge.tsx — Typed status/label primitive (W1-1b).
 *
 * Non-interactive `<span>` for status pills, category tags, role labels.
 * Companion to Button — same token-only philosophy. Replaces inline
 * `<span class="font-mono text-xs px-2 py-0.5 rounded border ...">`
 * patterns scattered across 30+ sites (status badges on /strategies,
 * category labels on /coins, role tags on /signals, etc.).
 *
 * Variants:
 *   neutral   border + text-muted        — default (category, generic)
 *   accent    cyan tinted                — primary marker
 *   success   --color-up tinted          — gain / verified positive
 *   danger    --color-down tinted        — loss / killed
 *   warning   --color-verified (amber)   — verified-tier badge, "in review"
 *   info      blue/accent tone           — info hint
 *
 * Variant `warning` is intentionally distinct from `success` — PRUVIQ uses
 * amber for "verified" badges (separate semantic from up/down P&L green).
 *
 * Sizes:
 *   sm  10px text, tight padding   — inline meta
 *   md  12px text, default          — most pages
 *   lg  14px text, hero spacing     — featured cards
 *
 * `dot` prop adds a leading colored circle (live status indicator pattern).
 */
import type { ComponentChildren } from "preact";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "danger"
  | "warning"
  | "info";
export type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a leading colored dot (live/status indicator pattern) */
  dot?: boolean;
  /** Animate the dot with `live-pulse` keyframe (only meaningful with `dot`) */
  pulse?: boolean;
  children: ComponentChildren;
  /** Extra utility classes merged after variant classes */
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral:
    "bg-transparent border border-[--color-border] text-[--color-text-muted]",
  accent:
    "bg-[--color-accent]/10 border border-[--color-accent]/30 text-[--color-accent-bright]",
  success: "bg-[--color-up]/10 border border-[--color-up]/30 text-[--color-up]",
  danger:
    "bg-[--color-down]/10 border border-[--color-down]/30 text-[--color-down]",
  warning:
    "bg-[--color-verified-subtle] border border-[--color-verified-border] text-[--color-verified]",
  info: "bg-[--color-accent]/5 border border-[--color-accent]/20 text-[--color-accent]",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-0.5 gap-1.5",
  lg: "text-sm px-2.5 py-1 gap-1.5",
};

const dotSize: Record<BadgeSize, string> = {
  sm: "w-1 h-1",
  md: "w-1.5 h-1.5",
  lg: "w-2 h-2",
};

const dotColor: Record<BadgeVariant, string> = {
  neutral: "bg-[--color-text-muted]",
  accent: "bg-[--color-accent]",
  success: "bg-[--color-up]",
  danger: "bg-[--color-down]",
  warning: "bg-[--color-verified]",
  info: "bg-[--color-accent]",
};

const baseClass =
  "inline-flex items-center font-mono font-bold uppercase tracking-wider rounded";

export default function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  pulse = false,
  children,
  class: className = "",
  ...rest
}: BadgeProps) {
  const merged =
    `${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();
  return (
    <span class={merged} {...rest}>
      {dot && (
        <span
          class={`inline-block rounded-full shrink-0 ${dotSize[size]} ${dotColor[variant]} ${pulse ? "animate-pulse" : ""}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
