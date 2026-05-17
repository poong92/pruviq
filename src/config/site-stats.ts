import stats from "../../public/data/site-stats.json";
import coinsStats from "../../public/data/coins-stats.json";
import presetsData from "../../public/data/builder-presets.json";

/** Total coins backtestable in the scanner.
 *
 *  Post OKX cutover (2026-04-17 Phase E). Reads site-stats.json.coins_analyzed
 *  FIRST (OKX /api/v5/public/instruments?instType=SWAP — the actual count
 *  the backtest engine can run against). Falls back to
 *  coins-stats.json.total_coins (CoinGecko market list, broader but
 *  NOT all backtestable) only if the OKX count is missing.
 *
 *  Why this precedence: marketing copy "N+ 코인에서 전략 테스트" must
 *  match the count the engine can actually backtest. Pre-2026-05-18
 *  fix the order was inverted so the marketing copy showed 750
 *  (CoinGecko market) instead of 238 (OKX SWAP backtest-capable),
 *  giving owners a misleading "did the site roll back?" perception.
 *  Backtest-capability is the truthful number, so coins_analyzed wins.
 *
 *  Fallback default 240 matches PR #1147 post-migration target. */
export const COINS_ANALYZED: number =
  stats.coins_analyzed ??
  (coinsStats as { total_coins?: number })?.total_coins ??
  240;

/** Total strategies tested */
export const STRATEGIES_COUNT: number = stats.strategies_tested ?? 16;

/** Preset count — derived from builder-presets.json (SSoT) */
export const PRESETS_COUNT: number = (presetsData as unknown[]).length;

/** Indicator count (not in site-stats.json, manually maintained) */
export const INDICATORS_COUNT: number = 14;

/** Data-source disclosure. Shown in trust/transparency copy so the coverage
 *  cut and the mid-period source change are visible to users without
 *  scattering the same sentence across a dozen pages. */
export const DATA_SOURCE_NOTE =
  "Binance historical ≤ 2026-04-17, OKX USDT-SWAP live from 2026-04-18";
