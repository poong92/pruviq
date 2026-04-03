import { describe, expect, test } from "vitest";
import siteStats from "../../public/data/site-stats.json";

describe("site-stats.json integrity", () => {
  test("has required fields", () => {
    expect(siteStats).toHaveProperty("coins_analyzed");
    expect(siteStats).toHaveProperty("simulations_run");
    expect(siteStats).toHaveProperty("strategies_tested");
    expect(siteStats).toHaveProperty("trading_days");
  });

  test("coins_analyzed is reasonable", () => {
    expect(siteStats.coins_analyzed).toBeGreaterThan(100);
    expect(siteStats.coins_analyzed).toBeLessThan(10000);
  });

  test("last_updated is recent", () => {
    const updated = new Date(siteStats.last_updated);
    const daysOld = (Date.now() - updated.getTime()) / 86400000;
    expect(daysOld).toBeLessThan(30);
  });
});
