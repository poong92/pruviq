/**
 * Partner fee SSoT regression guard (PR 2026-04-19).
 *
 * The frontend audit flagged OKX's 20% discount hardcoded across 5+
 * components (ResultsCard, OKXConnectButton, OKXExecuteButton, plus
 * i18n). A deal change would have required a grep-and-replace sweep
 * across every file. This test enforces that:
 *
 *   1. The SSoT (exchanges.ts) exports OKX_DISCOUNT_PCT as a number.
 *   2. The value matches the OKX entry in the EXCHANGES array (so a
 *      refactor that renames either half doesn't silently drift).
 *   3. The three target components source-reference OKX_DISCOUNT_PCT
 *      rather than inline "20%" (and no literal `20%` discount hardcodes
 *      remain in those files).
 */
import { describe, it, expect } from "vitest";
import {
  EXCHANGES,
  OKX,
  OKX_DISCOUNT_PCT,
  getExchange,
} from "../../src/config/exchanges";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("partner fee SSoT", () => {
  it("exports OKX with a numeric discount", () => {
    expect(typeof OKX_DISCOUNT_PCT).toBe("number");
    expect(OKX_DISCOUNT_PCT).toBeGreaterThan(0);
    expect(OKX_DISCOUNT_PCT).toBeLessThanOrEqual(100);
  });

  it("OKX_DISCOUNT_PCT matches EXCHANGES entry", () => {
    const inArray = EXCHANGES.find((e) => e.id === "okx");
    expect(inArray).toBeDefined();
    expect(OKX_DISCOUNT_PCT).toBe(inArray!.futuresDiscountPct);
    expect(OKX).toBe(inArray);
  });

  it("getExchange throws on unknown id", () => {
    expect(() => getExchange("nonesuch")).toThrow(/Unknown exchange/);
  });

  // Source-level: the three components that used to hardcode "20%" must
  // now reference OKX_DISCOUNT_PCT instead. Read the file text and assert
  // no bare `20%` discount literal remains.
  const TARGETS = [
    "src/components/OKXConnectButton.tsx",
    "src/components/OKXExecuteButton.tsx",
    "src/components/ResultsCard.tsx",
  ];
  const HARDCODE_PATTERNS: RegExp[] = [
    /"20%\s+fee/i,
    /"20%\s+수수료/,
    /"Save up to 20%/i,
    /"\uC218\uC218\uB8CC \uCD5C\uB300 20%/, // "수수료 최대 20%"
    /up to 20% on trading fees/i,
  ];

  for (const rel of TARGETS) {
    it(`${rel} imports OKX_DISCOUNT_PCT and has no 20% literal`, () => {
      const abs = resolve(__dirname, "../..", rel);
      const src = readFileSync(abs, "utf-8");
      expect(src).toContain("OKX_DISCOUNT_PCT");
      for (const pat of HARDCODE_PATTERNS) {
        expect(
          src,
          `${rel} still matches ${pat} — partner-fee SSoT broken`,
        ).not.toMatch(pat);
      }
    });
  }
});
