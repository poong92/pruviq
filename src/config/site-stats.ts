// @ts-expect-error — JSON import
import stats from "../../public/data/site-stats.json";

/** Total coins analyzed (from site-stats.json, auto-updated by pipeline) */
export const COINS_ANALYZED: number =
  stats.coins_analyzed ?? stats.coins ?? 572;

/** Total strategies tested */
export const STRATEGIES_COUNT: number =
  stats.strategies_tested ?? stats.strategies ?? 16;

/** Indicator count */
export const INDICATORS_COUNT: number = stats.indicators ?? 14;
