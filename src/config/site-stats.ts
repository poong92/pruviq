import stats from "../../public/data/site-stats.json";

/** Total coins analyzed (from site-stats.json, auto-updated by pipeline) */
export const COINS_ANALYZED: number = stats.coins_analyzed ?? 572;

/** Total strategies tested */
export const STRATEGIES_COUNT: number = stats.strategies_tested ?? 16;

/** Indicator count (not in site-stats.json, manually maintained) */
export const INDICATORS_COUNT: number = 14;
