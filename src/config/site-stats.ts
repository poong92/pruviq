import stats from "../../public/data/site-stats.json";
import coinsStats from "../../public/data/coins-stats.json";

/** Total coins currently loaded into the scanner.
 *
 *  Prefers `coins-stats.json.total_coins` (the authoritative, post-Phase-B
 *  coverage filter — 235 after the 2026-04-17 OKX cutover). Falls back to
 *  `site-stats.json.coins_analyzed`, which is a separate daily-pipeline
 *  artifact and can lag the coverage filter by up to a day. */
export const COINS_ANALYZED: number =
  (coinsStats as { total_coins?: number })?.total_coins ??
  stats.coins_analyzed ??
  235;

/** Total strategies tested */
export const STRATEGIES_COUNT: number = stats.strategies_tested ?? 16;

/** Indicator count (not in site-stats.json, manually maintained) */
export const INDICATORS_COUNT: number = 14;
