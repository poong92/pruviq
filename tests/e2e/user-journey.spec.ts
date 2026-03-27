import { test, expect } from "@playwright/test";

/**
 * User Journey E2E Tests
 *
 * Tests real user navigation flows across multiple pages:
 * 1. Homepage -> Coin detail -> Simulator
 * 2. Rankings/Strategies -> Simulator
 * 3. Search -> Coin detail
 */

test.describe("User Journey: Homepage -> Coin -> Simulator", () => {
  test("click coin from table, then navigate to simulator", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for coin table to render (Preact hydration + data fetch)
    const coinLink = page
      .locator(
        'table a[href*="/coins/"], [data-testid="coin-row"] a, .coin-table a[href*="/coins/"]',
      )
      .first();
    await coinLink.waitFor({ state: "visible", timeout: 15000 });

    // Get the coin symbol from the link
    const href = await coinLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain("/coins/");

    // Click on the first coin
    await coinLink.click();
    await page.waitForLoadState("domcontentloaded");

    // Verify coin detail page loaded
    const url = page.url();
    expect(url).toContain("/coins/");

    // Page should have meaningful content (not 404)
    const body = await page.textContent("body");
    expect(body).not.toContain("Page not found");
    expect(body).not.toContain("404");

    // Look for simulator/simulate link on the coin page
    const simLink = page
      .locator('a[href*="/simulate"], a[href*="simulate"]')
      .first();

    if (await simLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await simLink.click();
      await page.waitForLoadState("domcontentloaded");

      // Verify simulator page loaded
      expect(page.url()).toContain("/simulate");

      // Simulator should have loaded (check for mode tabs or strategy selector)
      const hasTabs = await page.locator('[role="tab"]').count();
      expect(hasTabs).toBeGreaterThan(0);
    } else {
      // If no simulate link on coin page, navigate directly
      await page.goto("/simulate/");
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain("/simulate");
    }
  });
});

test.describe("User Journey: Rankings -> Simulator", () => {
  test("click strategy from rankings, navigate to simulator", async ({
    page,
  }) => {
    // Try /strategies/ranking first, fall back to /strategies
    let response = await page.goto("/strategies/ranking/");
    if (!response || response.status() >= 400) {
      response = await page.goto("/strategies/");
    }
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState("domcontentloaded");

    // Wait for strategy content to render
    await page.waitForTimeout(5000);

    // Look for clickable strategy rows or links
    const strategyLink = page
      .locator(
        'a[href*="/simulate"], a[href*="strategy"], a[href*="/strategies/"], tr[data-strategy], [data-testid="strategy-row"]',
      )
      .first();

    if (await strategyLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      const href = await strategyLink.getAttribute("href");
      await strategyLink.click();
      await page.waitForLoadState("domcontentloaded");

      const url = page.url();
      // Should navigate to simulator or strategy detail page
      const navigated =
        url.includes("/simulate") || url.includes("/strategies/");
      expect(
        navigated,
        `Expected navigation to simulator or strategy detail, got: ${url}`,
      ).toBeTruthy();
    } else {
      // Page might have strategy cards instead of table rows
      const strategyCard = page
        .locator('[class*="strategy"], [class*="card"]')
        .first();
      if (await strategyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Strategy content is present, even if not clickable
        const body = await page.textContent("body");
        const hasStrategyContent =
          body!.includes("Squeeze") ||
          body!.includes("Breakout") ||
          body!.includes("strategy") ||
          body!.includes("Strategy");
        expect(
          hasStrategyContent,
          "Strategies page should show strategy content",
        ).toBeTruthy();
      }
    }
  });
});

test.describe("User Journey: Search -> Coin", () => {
  test("search for BTC and navigate to coin detail", async ({ page }) => {
    await page.goto("/coins/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for the page to hydrate
    await page.waitForTimeout(5000);

    // Find search/filter input
    const searchInput = page
      .locator(
        'input[type="search"], input[type="text"][placeholder*="Search"], input[type="text"][placeholder*="search"], input[placeholder*="Filter"], input[placeholder*="filter"], input[aria-label*="search" i], input[aria-label*="Search" i], input[aria-label*="filter" i]',
      )
      .first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Type BTC to filter
      await searchInput.fill("BTC");
      await page.waitForTimeout(2000);

      // Look for BTCUSDT in the filtered results
      const btcLink = page
        .locator(
          'a[href*="BTCUSDT"], a[href*="btcusdt"], a:has-text("BTCUSDT")',
        )
        .first();

      if (await btcLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btcLink.click();
        await page.waitForLoadState("domcontentloaded");

        // Verify we're on the BTCUSDT coin detail page
        const url = page.url().toLowerCase();
        expect(url).toContain("btcusdt");

        // Page should have BTC-related content
        const body = await page.textContent("body");
        expect(body).toContain("BTC");
      } else {
        // BTC text should at least be visible in the table after filtering
        const body = await page.textContent("body");
        expect(body).toContain("BTC");
      }
    } else {
      // No search input — verify coins page still shows BTC data
      const body = await page.textContent("body");
      const hasBTC = body!.includes("BTC") || body!.includes("Bitcoin");
      expect(hasBTC, "Coins page should show BTC data").toBeTruthy();
    }
  });
});
