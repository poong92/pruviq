// Layer 3 — Hook-Contract Validation (unit)
//
// Validates public/data/*.json against the shape + invariants that the
// corresponding Preact hooks (src/hooks/useXxx.ts) consume. Catches the
// class of bug where a new data source (API vs static JSON) silently drops
// a field the UI depends on — the exact mechanism behind the 2026-04-22
// /ko/market/ macro-tab-empty bug.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  validateMacroData,
  validateMarketData,
  validateNewsData,
} from "../../src/schemas/data-contracts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../public/data");

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf-8"));
}

describe("Layer 3 contract — static JSON pipeline must match hook expectations", () => {
  describe("news.json ↔ useNews()", () => {
    const data = loadJson("news.json");
    const result = validateNewsData(data);

    it("conforms to the full useNews schema", () => {
      expect(result.ok, result.errors.join("\n")).toBe(true);
    });

    it("has both categories populated (the macro-tab-empty regression check)", () => {
      // This is the literal retroactive catch for PR #1331.
      const items = (data as { items: Array<{ category?: string }> }).items;
      const macros = items.filter((i) => i.category === "macro").length;
      const cryptos = items.filter((i) => i.category === "crypto").length;
      expect(
        macros,
        "news.json must have ≥1 macro item",
      ).toBeGreaterThanOrEqual(1);
      expect(
        cryptos,
        "news.json must have ≥1 crypto item",
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe("macro.json ↔ useMacro()", () => {
    const data = loadJson("macro.json");
    const result = validateMacroData(data);

    it("conforms to useMacro schema", () => {
      expect(result.ok, result.errors.join("\n")).toBe(true);
    });
  });

  describe("market.json ↔ useMarketOverview()", () => {
    const data = loadJson("market.json");
    const result = validateMarketData(data);

    it("conforms to useMarketOverview schema + sanity bounds", () => {
      expect(result.ok, result.errors.join("\n")).toBe(true);
    });
  });
});

describe("Layer 3 contract — validators reject obvious drift", () => {
  it("rejects news without category field (the actual 2026-04-22 bug)", () => {
    const bad = {
      generated: "2026-04-22T00:00:00Z",
      items: [
        {
          title: "X",
          link: "https://x",
          source: "CoinDesk",
          published: "2026-04-22T00:00:00Z",
          summary: "",
        },
      ],
    };
    const r = validateNewsData(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("category"))).toBe(true);
  });

  it("rejects news with only crypto items (macro tab would render empty)", () => {
    const cryptoOnly = {
      generated: "2026-04-22T00:00:00Z",
      items: [
        {
          title: "Crypto news",
          link: "https://x",
          source: "CoinDesk",
          category: "crypto",
          published: "2026-04-22T00:00:00Z",
          summary: "",
        },
      ],
    };
    const r = validateNewsData(cryptoOnly);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("zero macro items"))).toBe(true);
  });

  it("rejects market with out-of-range fear_greed_index", () => {
    const bad = {
      btc_price: 70000,
      btc_change_24h: 1,
      eth_price: 3500,
      eth_change_24h: 1,
      fear_greed_index: 150,
      fear_greed_label: "Greed",
      total_market_cap_b: 2500,
      btc_dominance: 55,
      total_volume_24h_b: 80,
      generated: "2026-04-22T00:00:00Z",
    };
    const r = validateMarketData(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("fear_greed_index"))).toBe(true);
  });
});
