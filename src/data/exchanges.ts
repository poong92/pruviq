export interface FeeRate {
  maker: number; // decimal, e.g. 0.001 = 0.10%
  taker: number;
}

export interface Exchange {
  id: string;
  name: string;
  spot: FeeRate;
  futures: FeeRate;
  discount: number; // decimal, e.g. 0.10 = 10%
  discountLabel: string; // display string, e.g. "10%"
  referralUrl: string;
  available: boolean;
  tag: string; // English tag, e.g. "#1 Volume"
  spotOnly?: boolean; // true for exchanges without futures (e.g. Korean exchanges)
  infoOnly?: boolean; // true for non-affiliate info-only exchanges
}

export const exchanges: Exchange[] = [
  {
    id: "binance",
    name: "Binance",
    spot: { maker: 0.001, taker: 0.001 },
    futures: { maker: 0.0002, taker: 0.0005 },
    discount: 0.1,
    discountLabel: "10%",
    referralUrl: "https://accounts.binance.com/register?ref=PRUVIQ",
    available: true,
    tag: "#1 Volume",
  },
];

/** Korean exchanges — info-only, no referral */
export const koreanExchanges: Exchange[] = [
  {
    id: "upbit",
    name: "Upbit (업비트)",
    spot: { maker: 0.0005, taker: 0.0005 },
    futures: { maker: 0, taker: 0 },
    discount: 0,
    discountLabel: "—",
    referralUrl: "https://upbit.com",
    available: true,
    tag: "#1 Korea",
    spotOnly: true,
    infoOnly: true,
  },
  {
    id: "bithumb",
    name: "Bithumb (빗썸)",
    spot: { maker: 0.0004, taker: 0.0004 },
    futures: { maker: 0, taker: 0 },
    discount: 0,
    discountLabel: "—",
    referralUrl: "https://www.bithumb.com",
    available: true,
    tag: "#2 Korea",
    spotOnly: true,
    infoOnly: true,
  },
];

/**
 * Format a fee rate as a percentage string.
 * @param rate - decimal rate, e.g. 0.001 = 0.10%
 * @param decimals - number of decimal places (2 for spot, 3 for futures)
 * Examples: formatFee(0.001, 2) -> "0.10%", formatFee(0.0005, 3) -> "0.050%"
 */
export function formatFee(rate: number, decimals: 2 | 3 = 2): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** Format maker/taker as "0.10% / 0.10%" (spot) or "0.020% / 0.050%" (futures) */
export function formatFeeRange(fee: FeeRate, type: "spot" | "futures"): string {
  const d = type === "futures" ? 3 : 2;
  return `${formatFee(fee.maker, d)} / ${formatFee(fee.taker, d)}`;
}
