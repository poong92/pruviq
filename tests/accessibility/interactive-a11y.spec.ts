// Layer 6 — Axe on interactive states
//
// Static page-load a11y checks (accessibility.spec.ts) miss violations that
// appear only after user interaction: tab panels swap, sliders unlock,
// preset grids reflow. This file scans axe AFTER each click so the crawler's
// populated-result pairs (Layer 2 / 5) get paired a11y coverage.
//
// Budget: zero NEW violation categories introduced by the Layer 2/5 PRs.
// Pre-existing `color-contrast` nodes are allow-listed (inherited from
// static page state — tracked separately; see tests/accessibility/
// accessibility.spec.ts which already logs them).
const ALLOWLIST_RULES = new Set(["color-contrast"]);

import { test, expect } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

type AxeResult = {
  violations: Array<{
    id: string;
    impact: string;
    nodes: Array<unknown>;
  }>;
};

async function runAxe(
  page: import("@playwright/test").Page,
): Promise<AxeResult> {
  const axePath = require.resolve("axe-core/axe.min.js");
  await page.addScriptTag({ path: axePath });
  await page.waitForFunction(
    () => typeof (window as unknown as { axe?: unknown }).axe !== "undefined",
  );
  return (await page.evaluate(async () => {
    const w = window as unknown as {
      axe: { run: (root: Document, opts: unknown) => Promise<AxeResult> };
    };
    return w.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2aa"] },
    });
  })) as AxeResult;
}

function summarise(v: AxeResult["violations"]): string {
  return v
    .map((x) => `${x.id} (${x.impact}, ${x.nodes.length} nodes)`)
    .join("\n");
}

test.describe("Layer 6 a11y — interactive states", () => {
  test("/market/ after news-tab-macro click", async ({ page }) => {
    await page.goto("/market/", { waitUntil: "domcontentloaded" });
    await page
      .evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
      .catch(() => {});
    await page.waitForSelector('[data-testid="news-tabs"]', { timeout: 20000 });
    await page.click('[data-testid="news-tab-macro"]');
    await page.waitForTimeout(400);

    const r = await runAxe(page);
    const newCategories = r.violations.filter(
      (v) => !ALLOWLIST_RULES.has(v.id),
    );
    expect(
      newCategories.length,
      `post-macro-click NEW violations:\n${summarise(newCategories)}`,
    ).toBe(0);
  });

  test("/simulate/ after preset + standard mode", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 20000 });
    await page.click("[data-testid=sim-v1-preset-atr-breakout]");
    await page.click("[data-testid=sim-v1-skill-standard]");
    await expect(
      page.locator("[data-testid=sim-v1-standard-controls]"),
    ).toBeVisible();
    await page.waitForTimeout(400);

    const r = await runAxe(page);
    const newCategories = r.violations.filter(
      (v) => !ALLOWLIST_RULES.has(v.id),
    );
    expect(
      newCategories.length,
      `post-standard-click NEW violations:\n${summarise(newCategories)}`,
    ).toBe(0);
  });

  test("/ko/market/ 한글 컨텍스트 tab toggle", async ({ page }) => {
    await page.goto("/ko/market/", { waitUntil: "domcontentloaded" });
    await page
      .evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
      .catch(() => {});
    await page.waitForSelector('[data-testid="news-tabs"]', { timeout: 20000 });
    await page.click('[data-testid="news-tab-macro"]');
    await page.waitForTimeout(400);
    await page.click('[data-testid="news-tab-crypto"]');
    await page.waitForTimeout(400);

    const r = await runAxe(page);
    const newCategories = r.violations.filter(
      (v) => !ALLOWLIST_RULES.has(v.id),
    );
    expect(
      newCategories.length,
      `/ko/market/ tab-toggle NEW violations:\n${summarise(newCategories)}`,
    ).toBe(0);
  });
});
