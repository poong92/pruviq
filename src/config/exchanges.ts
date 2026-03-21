/**
 * exchanges.ts — Single Source of Truth for exchange fee configuration.
 *
 * All referral discount percentages, standard rates, and display labels
 * are defined here. Downstream files (fees.astro, FeeCalculator.tsx, etc.)
 * should derive values from this config rather than hardcoding them inline.
 *
 * Commission split (Binance referral dashboard, verified 2026-03-21):
 *   Spot:    PRUVIQ keeps 1%, User gets 19% → total pool 20%
 *   Futures: PRUVIQ keeps 1%, User gets 9%  → total pool 10%
 */

export interface ExchangeFeeConfig {
  id: string;
  name: string;
  /** Standard maker fee, percent. e.g. 0.10 means 0.10% */
  standardMakerFee: number;
  /** Standard taker fee, percent. e.g. 0.05 means 0.05% */
  standardTakerFee: number;
  /** Spot referral discount for user, percent. e.g. 19 means 19% off spot fees */
  spotDiscountPct: number;
  /** Futures referral discount for user, percent. e.g. 9 means 9% off futures fees */
  futuresDiscountPct: number;
  /** PRUVIQ's commission share, percent. e.g. 1 means 1% */
  platformCommissionPct: number;
  /** Display text for the discount badge */
  marketingLabel: string;
  url: string;
  referralUrl: string;
}

/**
 * Compute the effective taker fee after futures referral discount.
 * standardTakerFee * (1 - futuresDiscountPct / 100)
 */
export function effectiveTakerFee(ex: ExchangeFeeConfig): number {
  return ex.standardTakerFee * (1 - ex.futuresDiscountPct / 100);
}

/**
 * Build the tooltip string shown on the referral discount badge.
 */
export function discountTooltip(ex: ExchangeFeeConfig): string {
  const from = ex.standardTakerFee.toFixed(3) + "%";
  const to = effectiveTakerFee(ex).toFixed(3) + "%";
  return `Futures: ${ex.futuresDiscountPct}% off (${from} → ${to}) · Spot: ${ex.spotDiscountPct}% off`;
}

export const EXCHANGES: ExchangeFeeConfig[] = [
  {
    id: "binance",
    name: "Binance",
    standardMakerFee: 0.02, // futures maker: 0.020%
    standardTakerFee: 0.05, // futures taker: 0.050%
    spotDiscountPct: 19,
    futuresDiscountPct: 9,
    platformCommissionPct: 1,
    marketingLabel: "Up to 19% off",
    url: "https://www.binance.com",
    referralUrl: "https://accounts.binance.com/register?ref=PRUVIQ",
  },
];
