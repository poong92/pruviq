/**
 * Card.tsx — Typed card primitive (W1-1c).
 *
 * Replaces the ~30+ inline `class="rounded-lg border border-[--color-border]
 * bg-[--color-bg-card] ..."` patterns repeated across React/Preact components.
 *
 * Note: existing Astro cards (BrowserFrame, MetricCard, StepCard) are
 * intentionally untouched — they have specialized layout semantics. Card
 * is for the generic "panel with border + bg" pattern that's currently
 * hand-written everywhere.
 *
 * Variants:
 *   default   bg-card + border-border                       — default panel
 *   elevated  bg-card + border-border + shadow              — lifted panel
 *   glass     translucent + backdrop-blur                   — overlay/modal-ish
 *   featured  accent border + accent-tinted bg + hover lift — primary CTA card
 *   subtle    transparent bg + border only                  — minimal frame
 *
 * Padding: none (custom inner) | sm (12px) | md (16px, default) | lg (24px)
 * Radius:  sm | md (default) | lg
 *
 * `interactive` adds cursor-pointer + hover border + hover lift translateY.
 * `as` is polymorphic: div (default) | section | article | a (uses href).
 */
import type { ComponentChildren, JSX } from "preact";

export type CardVariant =
  | "default"
  | "elevated"
  | "glass"
  | "featured"
  | "subtle";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardRadius = "sm" | "md" | "lg";

interface BaseProps {
  variant?: CardVariant;
  padding?: CardPadding;
  radius?: CardRadius;
  interactive?: boolean;
  children: ComponentChildren;
  class?: string;
  "data-testid"?: string;
}

interface CardAsDiv extends BaseProps {
  as?: "div" | "section" | "article";
  href?: never;
  target?: never;
  rel?: never;
  onClick?: JSX.MouseEventHandler<HTMLElement>;
}

interface CardAsAnchor extends BaseProps {
  as: "a";
  href: string;
  target?: "_blank" | "_self";
  rel?: string;
  onClick?: JSX.MouseEventHandler<HTMLAnchorElement>;
}

export type CardProps = CardAsDiv | CardAsAnchor;

const variantClasses: Record<CardVariant, string> = {
  default: "bg-[--color-bg-card] border border-[--color-border]",
  elevated:
    "bg-[--color-bg-card] border border-[--color-border] shadow-[var(--shadow-md)]",
  glass:
    "bg-[--color-bg-card]/60 border border-[--color-border] backdrop-blur-md",
  featured:
    "bg-[--color-accent]/5 border border-[--color-accent]/30 shadow-[var(--shadow-md)]",
  subtle: "bg-transparent border border-[--color-border]",
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const radiusClasses: Record<CardRadius, string> = {
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
};

const interactiveClass =
  "cursor-pointer transition-colors hover:border-[--color-accent] " +
  "hover:bg-[--color-bg-hover] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[--color-accent] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[--color-bg]";

export default function Card(props: CardProps) {
  const {
    variant = "default",
    padding = "md",
    radius = "md",
    interactive = false,
    children,
    class: className = "",
    ...rest
  } = props;

  const merged =
    `${variantClasses[variant]} ${paddingClasses[padding]} ${radiusClasses[radius]} ${interactive ? interactiveClass : ""} ${className}`.trim();

  if (rest.as === "a") {
    const { as: _a, href, target, rel, onClick, ...anchorRest } = rest;
    void _a;
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? (rel ?? "noopener noreferrer") : rel}
        onClick={onClick}
        class={merged}
        {...anchorRest}
      >
        {children}
      </a>
    );
  }

  const { as: tag = "div", onClick, ...elemRest } = rest as CardAsDiv;
  const Tag = tag as keyof JSX.IntrinsicElements;
  return (
    <Tag onClick={onClick} class={merged} {...elemRest}>
      {children}
    </Tag>
  );
}
