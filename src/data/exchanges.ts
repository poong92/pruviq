import { EXCHANGES } from "../config/exchanges";

export interface FeeRate {
  maker: number; // decimal, e.g. 0.001 = 0.10%
  taker: number;
}

export interface Exchange {
  id: string;
  name: string;
  spot: FeeRate;
  futures: FeeRate;
  spotDiscount: number; // decimal, e.g. 0.19 = 19%
  futuresDiscount: number; // decimal, e.g. 0.09 = 9%
  discount: number; // primary display discount (highest), decimal
  discountLabel: string; // display string, e.g. "Up to 19%"
  referralUrl: string;
  available: boolean;
  tag: string; // English tag, e.g. "#1 Volume"
  spotOnly?: boolean; // true for exchanges without futures (e.g. Korean exchanges)
  infoOnly?: boolean; // true for non-affiliate info-only exchanges
  brokerCode?: string; // OKX Broker order tag for commission tracking
}

/** Spot fee rates per exchange (not in config — config only tracks futures) */
const SPOT_RATES: Record<string, FeeRate> = {
  binance: { maker: 0.001, taker: 0.001 }, // 0.10% / 0.10%
};

const EXCHANGE_TAGS: Record<string, string> = {
  binance: "#1 Volume",
  okx: "#2 Global",
};

/** Derive discount rates from config/exchanges.ts (SSoT) */
function configToExchange(cfg: (typeof EXCHANGES)[number]): Exchange {
  const spotDiscount = cfg.spotDiscountPct / 100;
  const futuresDiscount = cfg.futuresDiscountPct / 100;
  return {
    id: cfg.id,
    name: cfg.name,
    spot: SPOT_RATES[cfg.id] ?? {
      maker: cfg.standardMakerFee / 100,
      taker: cfg.standardTakerFee / 100,
    },
    futures: {
      maker: cfg.standardMakerFee / 100,
      taker: cfg.standardTakerFee / 100,
    },
    spotDiscount,
    futuresDiscount,
    discount: Math.max(spotDiscount, futuresDiscount),
    discountLabel: cfg.marketingLabel,
    referralUrl: cfg.referralUrl,
    available: true,
    tag: EXCHANGE_TAGS[cfg.id] ?? "",
    brokerCode: cfg.brokerCode,
  };
}

export const exchanges: Exchange[] = EXCHANGES.map(configToExchange);

/** Korean exchanges — info-only, no referral */
export const koreanExchanges: Exchange[] = [
  {
    id: "upbit",
    name: "Upbit (업비트)",
    spot: { maker: 0.0005, taker: 0.0005 },
    futures: { maker: 0, taker: 0 },
    spotDiscount: 0,
    futuresDiscount: 0,
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
    spotDiscount: 0,
    futuresDiscount: 0,
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
