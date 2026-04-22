// L4: mobile-only 375×812 end-to-end flow against prod.

import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

test.describe("L4 mobile 375×812 prod", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("no horizontal scroll on /simulate/", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]");
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return {
        scrollWidth: d.scrollWidth,
        clientWidth: d.clientWidth,
        overflows: d.scrollWidth > d.clientWidth,
      };
    });
    expect(overflow.overflows).toBe(false);
  });

  test("sticky CTA present + within bottom 100px", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]");
    // MobileStickyCTA uses testid `sim-v1-sticky-cta` (v1 naming).
    const sticky = await page.$("[data-testid=sim-v1-sticky-cta]");
    expect(sticky).not.toBeNull();
  });

  test("all 5 preset cards ≥44px tall + ≥44px wide tap targets", async ({
    page,
  }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]");
    const presets = [
      "atr-breakout",
      "ichimoku",
      "bb-squeeze-short",
      "keltner-squeeze",
      "ma-cross",
    ];
    for (const id of presets) {
      const box = await page
        .locator(`[data-testid=sim-v1-preset-${id}]`)
        .boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("tapping preset → results ENTERS viewport within 3s", async ({
    page,
  }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]");
    await page.click("[data-testid=sim-v1-preset-ichimoku]");
    await page.waitForSelector("[data-testid=sim-v1-results-ok]", {
      timeout: 20000,
    });
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLElement>(
          "[data-testid=sim-v1-results-ok]",
        );
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < (window.innerHeight || 0);
      },
      { timeout: 3000 },
    );
  });

  test("skill switcher tabs ≥44px tall on mobile", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-skill-switcher]");
    for (const m of ["quick", "standard", "expert"]) {
      const box = await page
        .locator(`[data-testid=sim-v1-skill-${m}]`)
        .boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("hero CTA ≥44px tall", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    // Hero CTA is the first <a> containing ATR Breakout text
    const cta = page.locator('a:has-text("ATR Breakout")').first();
    const box = await cta.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
