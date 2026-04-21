// SimulatorV1 E2E suite — the new Quick Start surface at /simulate/.
//
// Separate from the legacy simulator-e2e.spec.ts (which lives at
// /simulate/builder/ now). This file covers the Quick Start onboarding
// flow that most users will see.
//
// Run locally:
//   npx playwright test tests/e2e/simulator-v1.spec.ts
//
// Mocks: none. Hits the real backend /simulate once for the result panel,
// so the error-state path is exercised naturally on CI where the preview
// server may not reach api.pruviq.com.

import { expect, test, type Page } from "@playwright/test";

async function openSim(page: Page, path = "/simulate/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 15000 });
}

test.describe("SimulatorV1 — Quick Start surface", () => {
  test("Hero + preset grid + skill switcher render (EN)", async ({ page }) => {
    await openSim(page);

    const hero = page.locator("[data-testid=sim-v1-hero-title]");
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(/Most Backtests Lie|거짓말/);

    // 7 preset cards (curated Quick Start set)
    const cards = page.locator(
      "[data-testid^=sim-v1-preset-]:not([data-testid$=-grid])",
    );
    expect(await cards.count()).toBe(7);

    // Skill switcher with 3 tabs
    const tabs = page.locator("[data-testid^=sim-v1-skill-]");
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
  });

  test("Preset click → URL updates + ResultsPanel mounts", async ({ page }) => {
    await openSim(page);
    await page.click("[data-testid=sim-v1-preset-rsi-reversal-long]");
    await page.waitForTimeout(300);
    expect(page.url()).toContain("preset=rsi-reversal-long");

    // Results panel mounts in one of three states
    const state = await page
      .locator(
        "[data-testid=sim-v1-results-loading], [data-testid=sim-v1-results-ok], [data-testid=sim-v1-results-error]",
      )
      .count();
    expect(state).toBeGreaterThan(0);
  });

  test("Standard mode unlocks slider controls", async ({ page }) => {
    await openSim(page);
    await page.click("[data-testid=sim-v1-skill-standard]");
    await page.waitForTimeout(300);
    await expect(
      page.locator("[data-testid=sim-v1-standard-controls]"),
    ).toBeVisible();
    await expect(page.locator("[data-testid=sim-v1-std-sl]")).toBeVisible();
    await expect(page.locator("[data-testid=sim-v1-std-topn]")).toBeVisible();
  });

  test("Expert tab is a link to /simulate/builder/", async ({ page }) => {
    await openSim(page);
    const href = await page.getAttribute(
      "[data-testid=sim-v1-skill-expert]",
      "href",
    );
    expect(href).toBe("/simulate/builder/");
  });

  test("OKXConnectCTA href includes active preset", async ({ page }) => {
    await openSim(page, "/simulate/?preset=rsi-reversal-long");
    const href = await page.getAttribute(
      "[data-testid=sim-v1-cta-connect-btn]",
      "href",
    );
    expect(href).toContain("/dashboard");
    expect(href).toContain("preset=rsi-reversal-long");
  });

  test("Keyboard: ArrowRight cycles preset + '3' jumps to rsi-reversal-long", async ({
    page,
  }) => {
    await openSim(page);
    const before = page.url();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    expect(page.url()).not.toBe(before);

    await page.keyboard.press("3");
    await page.waitForTimeout(200);
    expect(page.url()).toContain("preset=rsi-reversal-long");
  });

  test("KO mirror renders Korean hero", async ({ page }) => {
    await openSim(page, "/ko/simulate/");
    const hero = page.locator("[data-testid=sim-v1-hero-title]");
    await expect(hero).toContainText(/백테스트|거짓말/);
  });

  test("Legacy ?preset= deep-link compatibility", async ({ page }) => {
    await openSim(page, "/simulate/?preset=bb-squeeze-short");
    const activeCard = page.locator(
      '[data-testid="sim-v1-preset-bb-squeeze-short"][aria-pressed="true"]',
    );
    await expect(activeCard).toBeVisible();
  });

  test("Trust gap panel renders 3-column grid", async ({ page }) => {
    await openSim(page);
    await expect(
      page.locator("[data-testid=sim-v1-gap-backtest]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid=sim-v1-live-return]"),
    ).toBeVisible();
    await expect(page.locator("[data-testid=sim-v1-gap-delta]")).toBeVisible();
  });

  test("Mobile: preset grid single column, no horizontal scroll", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    await openSim(page);
    const overflowX = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth > d.clientWidth;
    });
    expect(overflowX).toBe(false);
    await ctx.close();
  });
});
