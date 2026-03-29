import { test, expect } from "@playwright/test";

/**
 * Cross-page UX consistency tests
 *
 * Verifies that shared UI components (tabs, nav) are consistent
 * across all pages that use them. Catches the "tab names change
 * when you navigate" problem that per-page tests miss.
 */

test.describe("Strategy tabs consistency", () => {
  const STRATEGY_TAB_PAGES = [
    "/strategies",
    "/strategies/ranking",
    "/leaderboard",
  ];

  const KO_STRATEGY_TAB_PAGES = [
    "/ko/strategies",
    "/ko/strategies/ranking",
    "/ko/leaderboard",
  ];

  test("EN: same tab count and labels across all strategy pages", async ({
    page,
  }) => {
    const allTabs: Record<string, string[]> = {};

    for (const path of STRATEGY_TAB_PAGES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const nav = page.locator('nav[aria-label="Strategy navigation"]');
      if ((await nav.count()) === 0) continue;

      const tabs = await nav.locator("a").allTextContents();
      allTabs[path] = tabs.map((t) => t.trim()).filter(Boolean);
    }

    // All pages should have same number of tabs
    const counts = Object.values(allTabs).map((t) => t.length);
    expect(
      new Set(counts).size,
      `Tab counts differ: ${JSON.stringify(allTabs)}`,
    ).toBe(1);

    // All pages should have same tab labels (order may differ since active tab is different)
    const sorted = Object.entries(allTabs).map(([path, tabs]) => [
      path,
      [...tabs].sort(),
    ]);
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i][1],
        `Tab labels on ${sorted[i][0]} differ from ${sorted[0][0]}`,
      ).toEqual(sorted[0][1]);
    }
  });

  test("KO: same tab count and labels across all strategy pages", async ({
    page,
  }) => {
    const allTabs: Record<string, string[]> = {};

    for (const path of KO_STRATEGY_TAB_PAGES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const nav = page.locator('nav[aria-label="전략 내비게이션"]');
      if ((await nav.count()) === 0) continue;

      const tabs = await nav.locator("a").allTextContents();
      allTabs[path] = tabs.map((t) => t.trim()).filter(Boolean);
    }

    const counts = Object.values(allTabs).map((t) => t.length);
    expect(
      new Set(counts).size,
      `Tab counts differ: ${JSON.stringify(allTabs)}`,
    ).toBe(1);

    const sorted = Object.entries(allTabs).map(([path, tabs]) => [
      path,
      [...tabs].sort(),
    ]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i][1], `KO tab labels differ`).toEqual(sorted[0][1]);
    }
  });

  test("Signals page has NO strategy tabs (independent page)", async ({
    page,
  }) => {
    await page.goto("/signals", { waitUntil: "domcontentloaded" });
    const nav = page.locator('nav[aria-label="Strategy navigation"]');
    expect(await nav.count(), "/signals should not have strategy tabs").toBe(0);
  });
});

test.describe("Cross-page link parameter consistency", () => {
  test("Signals Verify link passes correct simulator params", async ({
    page,
  }) => {
    await page.goto("/signals", { waitUntil: "domcontentloaded" });
    // Wait for signals to load (API call)
    await page.waitForTimeout(8000);

    const verifyLink = page.locator('a:has-text("Verify")').first();
    if ((await verifyLink.count()) === 0) {
      test.skip(true, "No signals available to test");
      return;
    }

    const href = await verifyLink.getAttribute("href");
    expect(href, "Verify link should exist").toBeTruthy();
    // Must use symbol= (not coin=), dir= (not direction=)
    expect(href, "Should use symbol= param").toContain("symbol=");
    expect(href, "Should use dir= param").toContain("dir=");
    expect(href, "Should include sl= param").toContain("sl=");
    expect(href, "Should include tp= param").toContain("tp=");
    // Must NOT have the broken /USDT:USDT transform
    expect(href, "Should not have /USDT:USDT").not.toContain("/USDT:USDT");
  });
});
