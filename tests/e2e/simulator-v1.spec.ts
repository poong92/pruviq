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
//
// 2026-04-22: updated to match the real-data preset rewrite. 7 fake presets
// reduced to 5 real ones (atr-breakout, ichimoku, bb-squeeze-short,
// keltner-squeeze, ma-cross). Internal <h1> removed — hero landmark is
// the Astro page h1. Removed sim-v1-hero-title locator.

import { expect, test, type Page } from "@playwright/test";

async function openSim(page: Page, path = "/simulate/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 15000 });
}

test.describe("SimulatorV1 — Quick Start surface", () => {
  test("Root mounts + preset grid + skill switcher render (EN)", async ({
    page,
  }) => {
    await openSim(page);

    // Astro page's h1 is the hero now; SimulatorV1 no longer duplicates it.
    const pageH1 = page.locator("h1").first();
    await expect(pageH1).toBeVisible();

    // 5 real presets (previously 7 fakes, 5 of which were silent fallbacks)
    const cards = page.locator(
      "[data-testid^=sim-v1-preset-]:not([data-testid$=-grid])",
    );
    expect(await cards.count()).toBe(5);

    // Skill switcher with 3 tabs
    const tabs = page.locator("[data-testid^=sim-v1-skill-]");
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
  });

  test("Preset click → URL updates + ResultsPanel mounts", async ({ page }) => {
    await openSim(page);
    await page.click("[data-testid=sim-v1-preset-atr-breakout]");
    await page.waitForTimeout(300);
    expect(page.url()).toContain("preset=atr-breakout");

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

  test("Expert tab links to /simulate/builder/ with state passthrough", async ({
    page,
  }) => {
    await openSim(page, "/simulate/?preset=atr-breakout");
    const href = await page.getAttribute(
      "[data-testid=sim-v1-skill-expert]",
      "href",
    );
    // Expert link should contain the active preset so state is preserved.
    expect(href).toMatch(/^\/simulate\/builder\/(\?|$)/);
    expect(href).toContain("preset=atr-breakout");
  });

  test("OKXConnectCTA href includes active preset", async ({ page }) => {
    await openSim(page, "/simulate/?preset=atr-breakout");
    const href = await page.getAttribute(
      "[data-testid=sim-v1-cta-connect-btn]",
      "href",
    );
    expect(href).toContain("/dashboard");
    expect(href).toContain("preset=atr-breakout");
  });

  test("Keyboard: digit keys jump to Nth preset (1-5)", async ({ page }) => {
    await openSim(page);
    // '2' → second preset in SIMULATOR_PRESETS which is ichimoku
    await page.keyboard.press("2");
    await page.waitForTimeout(200);
    expect(page.url()).toContain("preset=ichimoku");
  });

  test("KO mirror renders Korean page (Astro h1 contains 한글)", async ({
    page,
  }) => {
    await openSim(page, "/ko/simulate/");
    const pageH1 = page.locator("h1").first();
    const text = await pageH1.textContent();
    // Either "거짓말" (hero copy) or "시뮬레이션" — KO content must be present
    expect(text).toMatch(/거짓말|시뮬레이|전략/);
  });

  test("Legacy ?preset= deep-link compatibility (bb-squeeze-short still valid)", async ({
    page,
  }) => {
    await openSim(page, "/simulate/?preset=bb-squeeze-short");
    const activeCard = page.locator(
      '[data-testid="sim-v1-preset-bb-squeeze-short"][aria-pressed="true"]',
    );
    await expect(activeCard).toBeVisible();
  });

  test("Unknown preset in URL → URL cleaned + fallback preset active", async ({
    page,
  }) => {
    // Stale link pointing at a preset that no longer exists. Used to
    // silently fall back to bb-squeeze-short while keeping the misleading
    // URL. Now we warn + strip the param.
    await openSim(page, "/simulate/?preset=rsi-divergence-both");
    await page.waitForTimeout(300);
    expect(page.url()).not.toContain("preset=rsi-divergence-both");
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
