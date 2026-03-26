/**
 * SimulationContext — Single Source of Truth for simulator URL parameters.
 *
 * All "go to simulator" links must use buildSimulatorUrl().
 * SimulatorPage must use parseSimulatorUrl() to read params.
 *
 * This prevents: parameter name typos, missing params, ID namespace confusion,
 * period mismatch between source (ranking) and destination (simulator).
 */

export interface SimulationContext {
  /** Strategy registry ID (e.g. "bb-squeeze-short", "supertrend") */
  strategy?: string;
  direction?: "short" | "long" | "both";
  sl?: number;
  tp?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  timeframe?: string; // 1H, 4H, etc.
  coin?: string; // single coin (e.g. BTCUSDT)
  topN?: number;
  /** Preset ID for /backtest (different namespace from strategy) */
  preset?: string;
  // Context metadata (not sent to API, used for UI display)
  source?: "ranking" | "strategy-page" | "coin-page" | "demo" | "compare";
  sourcePeriod?: string; // "30d" — ranking period context
}

const PARAM_MAP: [keyof SimulationContext, string][] = [
  ["strategy", "strategy"],
  ["direction", "dir"],
  ["sl", "sl"],
  ["tp", "tp"],
  ["startDate", "start"],
  ["endDate", "end"],
  ["timeframe", "tf"],
  ["coin", "coin"],
  ["topN", "coins"],
  ["preset", "preset"],
  ["source", "src"],
  ["sourcePeriod", "srcperiod"],
];

/**
 * Build a simulator URL from context.
 * Used by: RankingCard, StrategyDemo CTA, coins/[symbol], strategies/[id]
 */
export function buildSimulatorUrl(
  ctx: SimulationContext,
  lang: "en" | "ko" = "en",
): string {
  const base = lang === "ko" ? "/ko/simulate" : "/simulate";
  const params = new URLSearchParams();

  for (const [key, param] of PARAM_MAP) {
    const val = ctx[key];
    if (val != null && val !== "") {
      params.set(param, String(val));
    }
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Parse simulator URL params into context.
 * Used by: SimulatorPage.tsx on mount
 */
export function parseSimulatorUrl(search: string): Partial<SimulationContext> {
  const params = new URLSearchParams(search);
  const ctx: Partial<SimulationContext> = {};

  // Build reverse map
  const reverseMap = new Map(PARAM_MAP.map(([k, v]) => [v, k]));

  for (const [param, value] of params.entries()) {
    const key = reverseMap.get(param);
    if (key) {
      (ctx as Record<string, unknown>)[key] = value;
    }
  }

  // Legacy compat: ?symbol= → coin
  if (!ctx.coin && params.has("symbol")) {
    ctx.coin = params.get("symbol")!.toUpperCase();
  }

  // Type coercion
  if (ctx.sl) ctx.sl = Number(ctx.sl);
  if (ctx.tp) ctx.tp = Number(ctx.tp);
  if (ctx.topN) ctx.topN = Number(ctx.topN);

  // Direction validation
  if (ctx.direction && !["short", "long", "both"].includes(ctx.direction)) {
    delete ctx.direction;
  }

  // Timeframe validation
  if (ctx.timeframe) {
    ctx.timeframe = ctx.timeframe.toUpperCase();
    if (!["1H", "2H", "4H", "6H", "12H", "1D", "1W"].includes(ctx.timeframe)) {
      delete ctx.timeframe;
    }
  }

  return ctx;
}
