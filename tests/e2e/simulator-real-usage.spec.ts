// Real-user usability tests for /simulate — runs actual clicks and
// verifies navigation/scroll/state at runtime (not just code shape).
//
// This suite is **prod-only**: tests hit api.pruviq.com, whose CORS
// policy allows only https://pruviq.com + https://www.pruviq.com.
// Running it against localhost:4321 (the CI preview) would all fail
// with CORS blocks — not a product bug, just an environment mismatch.
//
// Usage:
//   BASE_URL=https://pruviq.com npx playwright test tests/e2e/simulator-real-usage.spec.ts
//
// In CI (which defaults to localhost:4321), the whole file skips.

import { expect, test, type Page } from "@playwright/test";

// Skip entire suite unless running against a production-like origin
// (the only place api.pruviq.com's CORS allow-list will permit the
// fetches these tests trigger).
const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(
  !IS_PROD_LIKE,
  "Skipped: real-usage suite requires BASE_URL=https://pruviq.com (api.pruviq.com CORS rejects localhost)",
);

async function open(page: Page, path = "/simulate/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 15000 });
  // Ensure Preact hydration has mounted the preset grid BEFORE tests click.
  // Without this, page.click races the island's client:load fire. Wait for
  // the first preset button to become interactive (aria-pressed attr is a
  // reliable hydration signal since it's set by Preact state, not SSR).
  await page.waitForSelector("[data-testid=sim-v1-preset-atr-breakout]", {
    timeout: 15000,
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-testid=sim-v1-preset-atr-breakout]")
        ?.getAttribute("aria-pressed") !== null,
    { timeout: 10000 },
  );
}

test.describe("Real usability — clicks, scroll, nav", () => {
  test("P1: each preset click → API call → distinct numbers in ResultsPanel", async ({
    page,
  }) => {
    await open(page);
    const presets = [
      "atr-breakout",
      "ichimoku",
      "bb-squeeze-short",
      "keltner-squeeze",
      "ma-cross",
    ];
    const seen: Record<string, string> = {};
    // Snapshot the previous Return value on each iteration so we can wait
    // for it to CHANGE — waitForSelector on `results-ok` is not enough,
    // since that node is still in the DOM from the previous click while
    // a new fetch is in-flight. We need to observe the value transition.
    let previousReturn = "";
    for (const id of presets) {
      await page.click(`[data-testid=sim-v1-preset-${id}]`);
      // Wait until either (a) Return text changes from the last captured
      // value, OR (b) 25s elapses (cold cache / timeout).
      await page.waitForFunction(
        (prev) => {
          const el = document.querySelector<HTMLElement>(
            "[data-testid=sim-v1-metric-return]",
          );
          const txt = el?.textContent?.trim() || "";
          return txt && txt !== prev;
        },
        previousReturn,
        { timeout: 25000 },
      );
      const returnText = await page
        .locator("[data-testid=sim-v1-metric-return]")
        .textContent();
      seen[id] = returnText?.trim() || "";
      previousReturn = seen[id];
    }
    console.log("preset → return observed:", seen);
    // All 5 returns must be unique — proves backend dispatches correctly
    const unique = new Set(Object.values(seen));
    expect(unique.size).toBe(5);
  });

  test("P2: preset click → results scroll into viewport on mobile", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    await open(page);
    // Click preset
    await page.click("[data-testid=sim-v1-preset-ichimoku]");
    // Wait for results-ok to appear (meaning fetch completed) — this is
    // the actual target the scroll handler tries to reach. Then give
    // smooth-scroll up to 2s to complete over ~2000px at mobile width.
    await page.waitForSelector("[data-testid=sim-v1-results-ok]", {
      timeout: 20000,
    });
    await page.waitForTimeout(2000);
    // Results panel should be in viewport. Definition: any part of it
    // overlaps with the visible viewport (not strictly "top in viewport")
    // — scrollIntoView({block:'start'}) may put the element just above
    // the fold but its body extends into the visible area, which is what
    // the user actually perceives as "I see results now."
    const inView = await page.evaluate(() => {
      const el =
        document.querySelector<HTMLElement>(
          '[data-testid="sim-v1-results-ok"]',
        ) ||
        document.querySelector<HTMLElement>(
          '[data-testid="sim-v1-results-loading"]',
        ) ||
        document.getElementById("sim-v1-results-anchor");
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      return {
        found: true,
        top: r.top,
        bottom: r.bottom,
        vh,
        inView: r.bottom > 0 && r.top < vh,
      };
    });
    console.log("P2 results in view:", inView);
    expect(inView.found).toBe(true);
    expect(inView.inView).toBe(true);
    await ctx.close();
  });

  test("P3: Standard tab reveals sliders + URL updates", async ({ page }) => {
    await open(page);
    // Pick a preset first so results are present
    await page.click("[data-testid=sim-v1-preset-atr-breakout]");
    await page.waitForSelector("[data-testid=sim-v1-results-ok]", {
      timeout: 20000,
    });
    const returnBefore = await page
      .locator("[data-testid=sim-v1-metric-return]")
      .textContent();
    // Switch to Standard mode
    await page.click("[data-testid=sim-v1-skill-standard]");
    await page.waitForSelector("[data-testid=sim-v1-standard-controls]");
    // URL write happens in useEffect after render; wait for it explicitly
    // instead of assuming sync commit.
    await page.waitForFunction(
      () => window.location.search.includes("mode=standard"),
      { timeout: 5000 },
    );
    expect(page.url()).toContain("mode=standard");
    // Change SL slider to a very different value
    const sl = page.locator("[data-testid=sim-v1-std-sl]");
    await sl.fill("20");
    await sl.dispatchEvent("input");
    await page.waitForTimeout(1500); // wait for new fetch
    const returnAfter = await page
      .locator("[data-testid=sim-v1-metric-return]")
      .textContent();
    console.log("P3 SL 3→20: return", returnBefore, "→", returnAfter);
    expect(returnAfter).not.toBe(returnBefore);
  });

  test("P4: Expert link carries state → builder receives params", async ({
    page,
  }) => {
    await open(page, "/simulate/?preset=atr-breakout&sl=3&tp=7&dir=short");
    // Find Expert tab and get href
    const href = await page
      .locator("[data-testid=sim-v1-skill-expert]")
      .getAttribute("href");
    console.log("P4 Expert href:", href);
    expect(href).toContain("preset=atr-breakout");
    expect(href).toContain("sl=3");
    expect(href).toContain("tp=7");
    expect(href).toContain("dir=short");
    // Navigate
    await page.click("[data-testid=sim-v1-skill-expert]");
    await page.waitForURL(/\/simulate\/builder\//);
    // Builder should have preloaded the strategy — verify URL params transferred
    expect(page.url()).toContain("preset=atr-breakout");
    expect(page.url()).toContain("sl=3");
  });

  test("P5: stale preset slug → URL is cleaned, fallback renders", async ({
    page,
  }) => {
    await open(page, "/simulate/?preset=rsi-divergence-both");
    await page.waitForTimeout(500);
    // URL should NOT contain the stale slug
    expect(page.url()).not.toContain("preset=rsi-divergence-both");
    // Default preset (atr-breakout) should be active via aria-pressed
    const active = page.locator(
      '[data-testid="sim-v1-preset-atr-breakout"][aria-pressed="true"]',
    );
    await expect(active).toBeVisible();
  });

  test("P6: KO mirror — preset click works identically", async ({ page }) => {
    await open(page, "/ko/simulate/");
    await page.click("[data-testid=sim-v1-preset-ichimoku]");
    await page.waitForSelector("[data-testid=sim-v1-results-ok]", {
      timeout: 12000,
    });
    // Korean card label should be "일목 하락 ↓"
    const label = await page
      .locator("[data-testid=sim-v1-preset-ichimoku]")
      .textContent();
    console.log("P6 KO label:", label?.slice(0, 50));
    expect(label).toContain("일목");
  });

  test("P7: tooltip description visible without interaction (a11y)", async ({
    page,
  }) => {
    await open(page);
    await page.click("[data-testid=sim-v1-preset-atr-breakout]");
    await page.waitForSelector("[data-testid=sim-v1-results-ok]");
    // The metric description should be ALWAYS visible (not hidden until
    // hover/focus). Find all 4 metric boxes and verify each has an inline
    // description <p> below the value.
    const metricIds = [
      "sim-v1-metric-return",
      "sim-v1-metric-winrate",
      "sim-v1-metric-pf",
      "sim-v1-metric-mdd",
    ];
    for (const id of metricIds) {
      const metric = page.locator(`[data-testid=${id}]`);
      const descText = await metric.locator("p").textContent();
      console.log(`P7 ${id} description:`, descText?.slice(0, 60));
      expect(descText?.length ?? 0).toBeGreaterThan(10);
    }
  });

  test("P8: preset cards show PF/Return/MDD match verified metrics", async ({
    page,
  }) => {
    await open(page);
    // ATR Breakout card metrics
    const atr = page.locator("[data-testid=sim-v1-preset-atr-breakout]");
    const text = await atr.textContent();
    console.log("P8 ATR card text:", text?.slice(0, 200));
    expect(text).toContain("1.31"); // PF
    expect(text).toContain("158"); // Return rounded
    expect(text).toContain("46"); // MDD rounded
  });

  test("P9: hero CTA button → navigates and auto-activates preset", async ({
    page,
  }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    // Click hero CTA
    await page.click("a:has-text('ATR Breakout')");
    await page.waitForURL(/preset=atr-breakout/);
    await page.waitForSelector("[data-testid=sim-v1-root]");
    const active = page.locator(
      '[data-testid="sim-v1-preset-atr-breakout"][aria-pressed="true"]',
    );
    await expect(active).toBeVisible();
  });

  test("P10: TrustGapPanel shows 3-col grid + equity sparkline", async ({
    page,
  }) => {
    await open(page);
    await expect(
      page.locator("[data-testid=sim-v1-gap-backtest]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid=sim-v1-live-return]"),
    ).toBeVisible();
    await expect(page.locator("[data-testid=sim-v1-gap-delta]")).toBeVisible();
    // Sparkline is inside TrustGap, waits up to 10s for equity data
    await page.waitForSelector("[data-testid=sim-v1-equity-sparkline]", {
      timeout: 10000,
    });
  });
});
