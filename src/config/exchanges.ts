/**
 * exchanges.ts — Single Source of Truth for exchange fee configuration.
 *
 * All referral discount percentages, standard rates, and display labels
 * are defined here. Downstream files (fees.astro, FeeCalculator.tsx, etc.)
 * should derive values from this config rather than hardcoding them inline.
 */

export interface ExchangeFeeConfig {
  id: string;
  name: string;
  /** Standard maker fee, percent. e.g. 0.10 means 0.10% */
  standardMakerFee: number;
  /** Standard taker fee, percent. e.g. 0.05 means 0.05% */
  standardTakerFee: number;
  /** Referral discount applied to standard rate, percent. e.g. 10 means 10% off */
  referralDiscountPct: number;
  /** Display text for the discount badge, e.g. "10% off" */
  marketingLabel: string;
  url: string;
  referralUrl: string;
}

/**
 * Compute the effective taker fee after referral discount.
 * standardTakerFee * (1 - referralDiscountPct / 100)
 */
export function effectiveTakerFee(ex: ExchangeFeeConfig): number {
  return ex.standardTakerFee * (1 - ex.referralDiscountPct / 100);
}

/**
 * Build the tooltip string shown on the referral discount badge.
 * e.g. "10% off standard rate (0.050% → 0.045%)"
 */
export function discountTooltip(ex: ExchangeFeeConfig): string {
  const from = ex.standardTakerFee.toFixed(3) + "%";
  const to = effectiveTakerFee(ex).toFixed(3) + "%";
  return `${ex.referralDiscountPct}% off standard rate (${from} → ${to})`;
}

export const EXCHANGES: ExchangeFeeConfig[] = [
  {
    id: "binance",
    name: "Binance",
    standardMakerFee: 0.02, // futures maker: 0.020%
    standardTakerFee: 0.05, // futures taker: 0.050%
    referralDiscountPct: 10,
    marketingLabel: "10% off",
    url: "https://www.binance.com",
    referralUrl: "https://accounts.binance.com/register?ref=PRUVIQ",
  },
  {
    id: "bitget",
    name: "Bitget",
    standardMakerFee: 0.02, // futures maker: 0.020%
    standardTakerFee: 0.06, // futures taker: 0.060%
    referralDiscountPct: 20,
    marketingLabel: "20% off",
    url: "https://www.bitget.com",
    referralUrl: "https://partner.bitget.com/bg/71KRCS",
  },
  {
    id: "okx",
    name: "OKX",
    standardMakerFee: 0.02, // futures maker: 0.020%
    standardTakerFee: 0.05, // futures taker: 0.050%
    referralDiscountPct: 20,
    marketingLabel: "20% off",
    url: "https://www.okx.com",
    referralUrl: "#",
  },
];
