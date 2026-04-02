import { describe, expect, test } from "vitest";
import {
  EXCHANGES,
  effectiveTakerFee,
  discountTooltip,
} from "../../src/config/exchanges";

describe("Exchange config", () => {
  test("Binance exists with correct referral", () => {
    const binance = EXCHANGES.find((e) => e.id === "binance");
    expect(binance).toBeDefined();
    expect(binance!.referralUrl).toContain("ref=PRUVIQ");
  });

  test("OKX exists with correct referral", () => {
    const okx = EXCHANGES.find((e) => e.id === "okx");
    expect(okx).toBeDefined();
    expect(okx!.referralUrl).toContain("join/PRUVIQ");
  });

  test("effectiveTakerFee calculates correctly", () => {
    const binance = EXCHANGES.find((e) => e.id === "binance")!;
    const fee = effectiveTakerFee(binance);
    // 0.05 * (1 - 9/100) = 0.0455
    expect(fee).toBeCloseTo(0.0455, 4);
  });

  test("discountTooltip includes percentages", () => {
    const binance = EXCHANGES.find((e) => e.id === "binance")!;
    const tip = discountTooltip(binance);
    expect(tip).toContain("9%");
    expect(tip).toContain("19%");
  });

  test("all exchanges have valid URLs", () => {
    for (const ex of EXCHANGES) {
      expect(ex.referralUrl).toMatch(/^https:\/\//);
      expect(ex.url).toMatch(/^https:\/\//);
    }
  });
});
