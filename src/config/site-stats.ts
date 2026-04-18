import stats from "../../public/data/site-stats.json";
import coinsStats from "../../public/data/coins-stats.json";

/** Total coins currently loaded into the scanner.
 *
 *  Post OKX cutover (2026-04-17 Phase E). Reads coins-stats.json.total_coins
 *  first (coverage filter), falls back to site-stats.json.coins_analyzed
 *  (OKX /api/v5/public/instruments?instType=SWAP live count).
 *  Fallback default 240 matches PR #1147 post-migration target. */
export const COINS_ANALYZED: number =
  (coinsStats as { total_coins?: number })?.total_coins ??
  stats.coins_analyzed ??
  240;

/** Total strategies tested */
export const STRATEGIES_COUNT: number = stats.strategies_tested ?? 16;

/** Indicator count (not in site-stats.json, manually maintained) */
export const INDICATORS_COUNT: number = 14;

/** Data-source disclosure. Shown in trust/transparency copy so the coverage
 *  cut and the mid-period source change are visible to users without
 *  scattering the same sentence across a dozen pages. */
export const DATA_SOURCE_NOTE =
  "Binance historical ≤ 2026-04-17, OKX USDT-SWAP live from 2026-04-18";
