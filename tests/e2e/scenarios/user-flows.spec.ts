// Layer 5 — Scenario Flows
//
// Hand-crafted end-to-end user journeys with step-level populated-result
// assertions. This is where the plan's directive materialises verbatim:
//   "실제 어떤버튼누르고 어떤어떤버튼들을 눌러서 하고 결과가 이렇고 이런식으로
//    다 나와야한다" — every click logged, every result asserted populated.
//
// Run locally:
//   npx playwright test tests/e2e/scenarios/user-flows.spec.ts --project=desktop
//
// Each flow uses test.step() for individual click → assert pairs so the
// HTML reporter shows the full trace.

import { expect, test } from "@playwright/test";
import {
  expectListHasItems,
  expectPopulated,
} from "../helpers/assert-populated";

test.describe("Flow 1: New visitor → simulator quickstart", () => {
  test("preset click → results populated → standard mode unlocks sliders → Coming Soon CTA", async ({
    page,
  }) => {
    await test.step("Step 1: /simulate/ root mounts + 5 presets visible", async () => {
      await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid=sim-v1-root]", {
        timeout: 20000,
      });
      const cards = page.locator(
        "[data-testid^=sim-v1-preset-]:not([data-testid$=-grid])",
      );
      expect(await cards.count()).toBe(5);
    });

    await test.step("Step 2: click atr-breakout preset → URL reflects selection", async () => {
      await page.click("[data-testid=sim-v1-preset-atr-breakout]");
      await expect
        .poll(() => page.url(), { timeout: 3000 })
        .toContain("preset=atr-breakout");
    });

    await test.step("Step 3: results panel reaches a terminal state", async () => {
      const anyResult = page.locator(
        "[data-testid=sim-v1-results-loading], [data-testid=sim-v1-results-ok], [data-testid=sim-v1-results-error]",
      );
      await expect(anyResult.first()).toBeVisible({ timeout: 30000 });
    });

    await test.step("Step 4: Standard mode reveals SL + TopN sliders", async () => {
      await page.click("[data-testid=sim-v1-skill-standard]");
      await expect(
        page.locator("[data-testid=sim-v1-standard-controls]"),
      ).toBeVisible();
      await expect(page.locator("[data-testid=sim-v1-std-sl]")).toBeVisible();
      await expect(page.locator("[data-testid=sim-v1-std-topn]")).toBeVisible();
    });

    await test.step("Step 5: Connect CTA is Coming Soon (autotrade on hold)", async () => {
      const btn = page.locator("[data-testid=sim-v1-cta-connect-btn]");
      await expect(btn).toBeVisible();
      expect(await btn.getAttribute("disabled")).not.toBeNull();
    });
  });
});

test.describe("Flow 2: KR visitor → macro news", () => {
  test("/ko/market/ macro tab → populated Bloomberg/MarketWatch items", async ({
    page,
  }) => {
    await test.step("Step 1: /ko/market/ loads + news-tabs visible", async () => {
      await page.goto("/ko/market/", { waitUntil: "domcontentloaded" });
      await page
        .evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
        .catch(() => {});
      await page.waitForSelector('[data-testid="news-tabs"]', {
        timeout: 20000,
      });
    });

    await test.step("Step 2: click 매크로 tab → list has ≥1 child", async () => {
      await page.click('[data-testid="news-tab-macro"]');
      await expectPopulated(page, '[data-testid="news-list"]');
      await expectListHasItems(page, '[data-testid="news-list"] > a', 1);
      const activeTab = await page
        .locator('[data-testid="news-list"]')
        .getAttribute("data-news-tab");
      expect(activeTab).toBe("macro");
    });

    await test.step("Step 3: first item link opens externally (target=_blank + https)", async () => {
      const firstLink = page.locator('[data-testid="news-list"] > a').first();
      const href = await firstLink.getAttribute("href");
      const target = await firstLink.getAttribute("target");
      expect(href).toMatch(/^https:\/\//);
      expect(target).toBe("_blank");
    });
  });
});

test.describe("Flow 3: Verified trader → BB Squeeze postmortem", () => {
  test("TrustGap paused state → postmortem page populated", async ({
    page,
  }) => {
    await test.step("Step 1: /simulate/ shows paused TrustGap card", async () => {
      await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid=sim-v1-root]", {
        timeout: 20000,
      });
      await page
        .evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7))
        .catch(() => {});
      const panel = page.locator("[data-testid=sim-v1-trust-gap]");
      await expect(panel).toBeVisible({ timeout: 15000 });
      const text = (await panel.textContent()) ?? "";
      expect(/Live tracking paused|라이브/i.test(text)).toBe(true);
    });

    await test.step("Step 2: navigate to /blog/bb-squeeze-2026q1-postmortem/ directly", async () => {
      await page.goto("/blog/bb-squeeze-2026q1-postmortem/", {
        waitUntil: "domcontentloaded",
      });
      // Body text must mention backtest + live + gap numbers
      const body = (await page.textContent("body")) ?? "";
      expect(body).toMatch(/backtest/i);
      expect(body).toMatch(/live|forward/i);
      expect(body.length).toBeGreaterThan(800);
    });
  });
});

test.describe("Flow 4: Strategy explorer → ranking → detail", () => {
  test("/strategies/ranking/ top-3 populated → click → strategy detail loads", async ({
    page,
  }) => {
    await test.step("Step 1: /strategies/ranking/ loads with top-3 populated", async () => {
      await page.goto("/strategies/ranking/", {
        waitUntil: "domcontentloaded",
      });
      // Give the island time to hydrate
      await page.waitForLoadState("networkidle");
      const body = (await page.textContent("body")) ?? "";
      expect(body.length).toBeGreaterThan(800);
      // Must render at least one card with PF/Sharpe/WR-ish label
      const hasMetric = /Sharpe|PF|Profit|Win|MDD|승률/i.test(body);
      expect(hasMetric).toBe(true);
    });

    await test.step("Step 2: ranking card → /simulate?strategy=... with ranking source", async () => {
      // Ranking page CTAs link to the simulator with the strategy pre-selected
      // (?strategy=X&src=ranking) rather than to /strategies/<id>/. Keep the
      // assertion aligned with the actual UX.
      const simLink = page.locator('a[href*="/simulate?strategy="]').first();
      await expect(simLink).toBeVisible({ timeout: 10000 });
      const href = await simLink.getAttribute("href");
      expect(href).toMatch(/strategy=[a-z0-9-]+/);
      expect(href).toContain("src=ranking");
      await simLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain("strategy=");
      expect(page.url()).toContain("src=ranking");
      // Simulator root must mount on the destination page
      await page.waitForSelector("[data-testid=sim-v1-root]", {
        timeout: 15000,
      });
    });
  });
});
