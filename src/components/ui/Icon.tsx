/**
 * Icon.tsx — Typed icon primitive (W2-3) — references the indicator sprite.
 *
 * No external icon library (heroicons/lucide). PRUVIQ ships a custom
 * sprite at /sprites/indicators.svg with 14 trading-indicator glyphs
 * tuned to the product's visual language. This primitive is the
 * single way to consume them.
 *
 * Usage:
 *   <Icon name="bb" size={20} class="text-[--color-accent]" />
 *
 * The sprite uses `currentColor` for stroke, so consumers color via
 * `class="text-..."` (Tailwind) or `style="color: ..."`.
 *
 * Sprite is loaded once per page from /sprites/indicators.svg and
 * referenced by id via <use href="...#name"/> — browsers cache and
 * reuse it cheaply across many <Icon> instances.
 *
 * a11y:
 *   - Default: aria-hidden="true" (decorative — text label conveys
 *     the indicator name elsewhere)
 *   - Pass `ariaLabel` to expose as role="img" with the label
 *     (e.g., when icon stands alone without a text label nearby)
 */
import type { JSX } from "preact";

export type IndicatorIconName =
  | "bb"
  | "rsi"
  | "macd"
  | "atr"
  | "ema"
  | "adx"
  | "stoch"
  | "vol"
  | "ichi"
  | "kelt"
  | "dchan"
  | "aroon"
  | "cci"
  | "supertrend";

interface IconProps {
  name: IndicatorIconName;
  /** Pixel size for both width and height. Default 20. */
  size?: number;
  /** When provided, switches from decorative to role=img + aria-label. */
  ariaLabel?: string;
  /** Tailwind/utility classes — typically `text-...` for stroke color. */
  class?: string;
  /** Optional sprite path override (default `/sprites/indicators.svg`). */
  spriteUrl?: string;
  "data-testid"?: string;
}

export default function Icon({
  name,
  size = 20,
  ariaLabel,
  class: className = "",
  spriteUrl = "/sprites/indicators.svg",
  ...rest
}: IconProps) {
  const isDecorative = !ariaLabel;
  const baseClass = "inline-block shrink-0 align-middle";
  const merged = `${baseClass} ${className}`.trim();

  const svgProps: JSX.HTMLAttributes<SVGSVGElement> = {
    width: size,
    height: size,
    role: isDecorative ? "presentation" : "img",
    "aria-hidden": isDecorative ? "true" : undefined,
    "aria-label": ariaLabel,
    class: merged,
    ...rest,
  };

  return (
    <svg {...svgProps} data-icon={name}>
      <use href={`${spriteUrl}#${name}`} />
    </svg>
  );
}

/** All available indicator names — useful for picker/showcase UIs. */
export const indicatorIconNames: ReadonlyArray<IndicatorIconName> = [
  "bb",
  "rsi",
  "macd",
  "atr",
  "ema",
  "adx",
  "stoch",
  "vol",
  "ichi",
  "kelt",
  "dchan",
  "aroon",
  "cci",
  "supertrend",
] as const;
