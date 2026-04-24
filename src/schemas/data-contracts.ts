// Data-contract validators for the /data/*.json pipeline and backing API.
//
// These are single-source-of-truth shape checks shared by:
//   - unit tests (tests/unit/hook-contract.test.ts) — validate static JSON files
//   - contract tests — validate live API responses
//   - future CI freshness job
//
// Intentionally no external dep (no zod). Plain predicates match the project's
// "dependency-adding-antipattern" rule (llm-anti-patterns #12).
//
// Each validator returns { ok, errors } instead of throwing, so callers can
// report multiple issues at once.

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

function err(path: string, msg: string): string {
  return `${path}: ${msg}`;
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isIsoTimestamp(v: unknown): v is string {
  if (!isString(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

// ─── useNews contract ────────────────────────────────────────────────

export type NewsCategory = "macro" | "crypto";
export type NewsItem = {
  title: string;
  link: string;
  source: string;
  category: NewsCategory;
  published: string;
  summary: string;
};
export type NewsData = {
  items: NewsItem[];
  generated: string;
};

export function validateNewsData(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null)
    return { ok: false, errors: ["news: not an object"] };
  const d = raw as Record<string, unknown>;

  if (!Array.isArray(d.items)) errors.push(err("news.items", "not an array"));
  if (!isIsoTimestamp(d.generated))
    errors.push(err("news.generated", "missing/invalid ISO timestamp"));

  if (Array.isArray(d.items)) {
    d.items.forEach((it: unknown, i: number) => {
      const p = `news.items[${i}]`;
      if (typeof it !== "object" || it === null) {
        errors.push(err(p, "not an object"));
        return;
      }
      const item = it as Record<string, unknown>;
      if (!isString(item.title)) errors.push(err(p, "title missing/empty"));
      if (!isString(item.link)) errors.push(err(p, "link missing/empty"));
      if (!isString(item.source)) errors.push(err(p, "source missing/empty"));
      if (item.category !== "macro" && item.category !== "crypto")
        errors.push(
          err(
            p,
            `category must be 'macro'|'crypto', got ${JSON.stringify(item.category)}`,
          ),
        );
      if (!isIsoTimestamp(item.published))
        errors.push(err(p, "published invalid ISO"));
      if (typeof item.summary !== "string")
        errors.push(err(p, "summary must be string"));
    });

    // Business invariant: BOTH tab tabs must have data.
    // This is exactly the check that would have caught the macro-news bug
    // (API path lost the `category` field so all items classified as crypto).
    const macros = d.items.filter(
      (it: unknown) =>
        typeof it === "object" &&
        it !== null &&
        (it as { category?: unknown }).category === "macro",
    ).length;
    const cryptos = d.items.filter(
      (it: unknown) =>
        typeof it === "object" &&
        it !== null &&
        (it as { category?: unknown }).category === "crypto",
    ).length;
    if (macros < 1)
      errors.push(
        err("news.items", "zero macro items — macro tab would be empty"),
      );
    if (cryptos < 1)
      errors.push(
        err("news.items", "zero crypto items — crypto tab would be empty"),
      );
  }

  return { ok: errors.length === 0, errors };
}

// ─── useMacro contract ───────────────────────────────────────────────

export type MacroIndicator = {
  id: string;
  name: string;
  value: number;
  change: number | null;
  previous?: number | null;
  unit: string;
  updated: string;
  source: string;
};
export type MacroData = {
  indicators: MacroIndicator[];
  generated: string;
};

export function validateMacroData(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null)
    return { ok: false, errors: ["macro: not an object"] };
  const d = raw as Record<string, unknown>;

  if (!Array.isArray(d.indicators))
    errors.push(err("macro.indicators", "not an array"));
  if (!isIsoTimestamp(d.generated))
    errors.push(err("macro.generated", "invalid ISO"));

  if (Array.isArray(d.indicators)) {
    d.indicators.forEach((ind: unknown, i: number) => {
      const p = `macro.indicators[${i}]`;
      if (typeof ind !== "object" || ind === null) {
        errors.push(err(p, "not an object"));
        return;
      }
      const x = ind as Record<string, unknown>;
      if (!isString(x.id)) errors.push(err(p, "id missing"));
      if (!isString(x.name)) errors.push(err(p, "name missing"));
      if (!isFiniteNumber(x.value)) errors.push(err(p, "value not finite"));
      if (x.change !== null && !isFiniteNumber(x.change))
        errors.push(err(p, "change must be number|null"));
      if (!isString(x.unit)) errors.push(err(p, "unit missing"));
      if (!isString(x.source)) errors.push(err(p, "source missing"));
    });
    if (d.indicators.length < 3)
      errors.push(
        err(
          "macro.indicators",
          `expected ≥3 indicators, got ${d.indicators.length}`,
        ),
      );
  }

  return { ok: errors.length === 0, errors };
}

// ─── useMarketOverview contract ──────────────────────────────────────

export type MarketData = {
  btc_price: number;
  btc_change_24h: number;
  eth_price: number;
  eth_change_24h: number;
  fear_greed_index: number;
  fear_greed_label: string;
  total_market_cap_b: number;
  btc_dominance: number;
  total_volume_24h_b: number;
  generated: string;
};

export function validateMarketData(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null)
    return { ok: false, errors: ["market: not an object"] };
  const d = raw as Record<string, unknown>;

  const numericFields: (keyof MarketData)[] = [
    "btc_price",
    "btc_change_24h",
    "eth_price",
    "eth_change_24h",
    "fear_greed_index",
    "total_market_cap_b",
    "btc_dominance",
    "total_volume_24h_b",
  ];
  for (const f of numericFields) {
    if (!isFiniteNumber(d[f]))
      errors.push(
        err(`market.${f}`, `not a finite number (got ${JSON.stringify(d[f])})`),
      );
  }
  if (!isString(d.fear_greed_label))
    errors.push(err("market.fear_greed_label", "missing"));
  if (!isIsoTimestamp(d.generated))
    errors.push(err("market.generated", "invalid ISO"));

  // Sanity bounds
  if (
    isFiniteNumber(d.btc_price) &&
    (d.btc_price < 1000 || d.btc_price > 1_000_000)
  )
    errors.push(err("market.btc_price", `out-of-range: ${d.btc_price}`));
  if (
    isFiniteNumber(d.fear_greed_index) &&
    (d.fear_greed_index < 0 || d.fear_greed_index > 100)
  )
    errors.push(
      err("market.fear_greed_index", `not 0..100: ${d.fear_greed_index}`),
    );
  if (
    isFiniteNumber(d.btc_dominance) &&
    (d.btc_dominance < 0 || d.btc_dominance > 100)
  )
    errors.push(err("market.btc_dominance", `not 0..100%: ${d.btc_dominance}`));

  return { ok: errors.length === 0, errors };
}
