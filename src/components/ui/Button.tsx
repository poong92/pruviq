/**
 * Button.tsx — Typed button primitive (W1-1).
 *
 * One source of truth for buttons across the site. Replaces the ~150
 * bespoke `<button class="inline-flex items-center bg-[--color-accent] ...">`
 * patterns currently scattered across 47 files.
 *
 * Tokens-only (no raw hex). Light/dark themes adapted via tokens. 44px
 * minimum touch target on the default `md` size. `sm` (32px) is opt-in
 * for dense inline contexts only — use sparingly.
 *
 * Variants:
 *   primary    accent background, white text — main CTA
 *   secondary  border + transparent bg — secondary action
 *   ghost      no border/bg — tertiary action / nav
 *   danger     uses --color-down — destructive action
 *   success    uses --color-up   — confirm action
 *
 * Polymorphic: render as `<a>` via `as="a"` + `href`.
 */
import type { ComponentChildren, JSX } from "preact";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Square 1:1 button for icon-only content. Sets aspect-square + center align. */
  iconOnly?: boolean;
  leadingIcon?: ComponentChildren;
  trailingIcon?: ComponentChildren;
  children: ComponentChildren;
  /** Extra utility classes to merge after variant classes. */
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

interface ButtonAsButton extends BaseProps {
  as?: "button";
  type?: "button" | "submit" | "reset";
  onClick?: JSX.MouseEventHandler<HTMLButtonElement>;
  href?: never;
  target?: never;
  rel?: never;
}

interface ButtonAsAnchor extends BaseProps {
  as: "a";
  href: string;
  target?: "_blank" | "_self";
  rel?: string;
  type?: never;
  onClick?: JSX.MouseEventHandler<HTMLAnchorElement>;
}

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[--color-accent] text-white border border-transparent hover:bg-[--color-accent-dim] active:bg-[--color-accent-dim]",
  secondary:
    "bg-transparent border border-[--color-border] text-[--color-text] hover:border-[--color-accent] hover:text-[--color-accent] hover:bg-[--color-accent]/5",
  ghost:
    "bg-transparent border border-transparent text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover]",
  danger:
    "bg-[--color-down]/10 border border-[--color-down]/30 text-[--color-down] hover:bg-[--color-down]/15 hover:border-[--color-down]/50",
  success:
    "bg-[--color-up]/10 border border-[--color-up]/30 text-[--color-up] hover:bg-[--color-up]/15 hover:border-[--color-up]/50",
};

// Size — `md` meets 44px a11y minimum. `sm` (32px) for dense inline use only.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 min-h-[32px] px-3 text-xs gap-1.5",
  md: "h-11 min-h-[44px] px-5 text-sm gap-2",
  lg: "h-12 min-h-[48px] px-6 text-base gap-2.5",
};

const iconOnlySize: Record<ButtonSize, string> = {
  sm: "w-8 h-8 px-0",
  md: "w-11 h-11 px-0",
  lg: "w-12 h-12 px-0",
};

const baseClass =
  "inline-flex items-center justify-center rounded font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

function Spinner({ size }: { size: ButtonSize }) {
  const sz = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <span
      class={`${sz} inline-block rounded-full border-2 border-current border-t-transparent animate-spin`}
      aria-hidden="true"
    />
  );
}

export default function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    fullWidth = false,
    iconOnly = false,
    leadingIcon,
    trailingIcon,
    children,
    class: className = "",
    ...rest
  } = props;

  const sizeCls = iconOnly ? iconOnlySize[size] : sizeClasses[size];
  const widthCls = fullWidth ? "w-full" : "";
  const merged =
    `${baseClass} ${variantClasses[variant]} ${sizeCls} ${widthCls} ${className}`.trim();

  const isInert = disabled || loading;
  const leading = loading ? <Spinner size={size} /> : leadingIcon;

  if (rest.as === "a") {
    const { as: _as, href, target, rel, onClick, ...anchorRest } = rest;
    void _as;
    return (
      <a
        href={isInert ? undefined : href}
        target={target}
        rel={target === "_blank" ? (rel ?? "noopener noreferrer") : rel}
        onClick={isInert ? undefined : onClick}
        aria-disabled={isInert ? "true" : undefined}
        class={merged}
        {...anchorRest}
      >
        {leading}
        {children}
        {!loading && trailingIcon}
      </a>
    );
  }

  const {
    type = "button",
    onClick,
    as: _as2,
    ...buttonRest
  } = rest as ButtonAsButton;
  void _as2;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isInert}
      aria-busy={loading ? "true" : undefined}
      class={merged}
      {...buttonRest}
    >
      {leading}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
