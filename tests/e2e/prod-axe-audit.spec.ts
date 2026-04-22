// L3: axe-core WCAG audit against prod /simulate + /ko/simulate.
// prod-only (skip in CI localhost due to CORS).

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

for (const path of ["/simulate/", "/ko/simulate/"]) {
  test(`axe WCAG 2.2 AA — ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 15000 });
    // Wait for the first preset grid card to render so axe sees the full
    // hydrated DOM.
    await page.waitForSelector("[data-testid=sim-v1-preset-atr-breakout]", {
      timeout: 15000,
    });
    await page.waitForTimeout(1500); // let TrustGap backtest fetch complete

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    const minor = results.violations.filter(
      (v) => v.impact === "moderate" || v.impact === "minor",
    );
    console.log(
      `[${path}] critical+serious: ${critical.length}, moderate+minor: ${minor.length}`,
    );
    for (const v of results.violations) {
      console.log(
        ` ${v.impact?.toUpperCase()} ${v.id} — ${v.description} (${v.nodes.length} nodes)`,
      );
    }
    expect(critical).toHaveLength(0);
  });
}
