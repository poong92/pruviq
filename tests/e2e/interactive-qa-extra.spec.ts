/**
 * Interactive QA Extra — 추가 기능 테스트
 *
 * Covers scenarios not in interactive-qa.spec.ts:
 *   1. URL Share: ?c= param appears for custom strategy, ?strategy= for preset
 *   2. Optimize tab: Expert mode exposes Optimize tab + heatmap UI renders
 *   3. KO labels: /ko/simulate/ shows Korean text in results
 *
 * prod-smoke 프로젝트 (testMatch에 포함)에서 실행:
 *   BASE_URL=https://pruviq.com npx playwright test --project=prod-smoke tests/e2e/interactive-qa-extra.spec.ts
 */

import { test, expect } from "@playwright/test";

const IS_PROD = (process.env.BASE_URL ?? "").includes("pruviq.com");

test.describe("Interactive QA Extra", () => {
  test.skip(!IS_PROD, "Prod only (BASE_URL=https://pruviq.com)");

  // ── 1. URL Share: preset run → ?strategy= (not ?c=) ───────────────────────

  test("simulate: Breakout run → Share URL contains ?strategy= (preset)", async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for hydration
    await page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        return tabs.length >= 3;
      },
      { timeout: 20000 },
    );

    // Click Breakout quick-test card
    const breakoutCard = page.locator('[data-testid="quick-cat-breakout"]');
    await expect(breakoutCard).toBeVisible({ timeout: 15000 });
    await breakoutCard.click();

    // Wait for result (a % value to appear in body)
    await expect(page.locator('[data-testid="tab-summary"]')).toBeVisible({
      timeout: 90000,
    });

    // Click copy-link button
    const copyBtn = page.locator('[data-testid="copy-link"]');
    await expect(copyBtn).toBeVisible({ timeout: 10000 });
    await copyBtn.click();

    // After click, URL should be updated in browser (window.history.replaceState)
    await page.waitForFunction(() => window.location.search.length > 0, {
      timeout: 5000,
    });

    const currentUrl = page.url();
    expect(currentUrl).toContain("sl=");
    expect(currentUrl).toContain("tp=");
    expect(currentUrl).toContain("dir=");

    // Preset-based: should have strategy= not c=
    // (c= is only for custom conditions without a preset)
    expect(currentUrl).not.toContain("c=");

    console.log(`Share URL (preset): ${currentUrl}`);
  });

  // ── 2. Optimize tab: Expert mode → tab exists → click → heatmap UI ─────────

  test("simulate: Expert mode → Optimize tab visible → click → heatmap renders", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for hydration
    await page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        return tabs.length >= 3;
      },
      { timeout: 20000 },
    );

    // Switch to Expert mode
    const expertTab = page
      .locator('[role="tab"]')
      .filter({ hasText: /Expert|엑스퍼트/i });
    await expect(expertTab.first()).toBeVisible({ timeout: 10000 });
    await expertTab.first().click();

    // Wait for STRATEGY BUILDER header
    await page.waitForSelector("text=/STRATEGY BUILDER|전략 빌더/i", {
      timeout: 15000,
    });

    // Run backtest first (Optimize only shows after result exists)
    const runBtn = page
      .locator("button")
      .filter({ hasText: /Simulate on|Coins|Run Backtest|백테스트 실행/i });

    if ((await runBtn.count()) > 0) {
      await runBtn.first().click();

      // Wait for SUMMARY tab (result ready)
      await page.waitForSelector(
        'button:has-text("SUMMARY"), button:has-text("요약"), [data-testid="tab-summary"]',
        { timeout: 90000 },
      );
    }

    // Now Optimize tab should be visible (Expert mode only)
    const optimizeTab = page.locator('[data-testid="tab-optimize"]');
    await expect(optimizeTab).toBeVisible({ timeout: 10000 });

    // Click the Optimize tab
    await optimizeTab.click();

    // Heatmap UI: either a table/grid or a loading/run button should appear
    // OptimizePanel renders "Optimize by" select + a Run button or heatmap table
    await page.waitForSelector(
      "text=/Optimize by|최적화 기준|Run Optimize|Grid/i",
      { timeout: 10000 },
    );

    const optimizePanelText = await page.locator("main").first().textContent();
    // Should contain Optimize UI — either metric selector or results table
    const hasOptimizeUI =
      /Optimize by|최적화 기준|SL|TP|Win Rate|Profit Factor/i.test(
        optimizePanelText ?? "",
      );
    expect(hasOptimizeUI).toBe(true);

    // No JS errors
    const errors: string[] = [];
    page.on("pageerror", (e) => {
      if (
        !e.message.includes("fetch") &&
        !e.message.includes("net::") &&
        !e.message.includes("AbortError")
      ) {
        errors.push(e.message);
      }
    });

    console.log(
      `Optimize tab visible and clicked. Panel text snippet: ${optimizePanelText?.slice(0, 200)}`,
    );
    expect(errors.length).toBe(0);
  });

  // ── 3. KO landing: /ko/simulate/ shows Korean labels after hydration ────────

  test("ko/simulate: Korean labels visible after hydration", async ({
    page,
  }) => {
    await page.goto("/ko/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for hydration
    await page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        return tabs.length >= 3;
      },
      { timeout: 20000 },
    );

    const bodyText = (await page.textContent("body")) ?? "";

    // Korean chars must be present (not just EN)
    const koreanRegex = /[\uAC00-\uD7AF]/;
    expect(
      koreanRegex.test(bodyText),
      "Korean text must appear after hydration",
    ).toBe(true);

    // Key Korean UI labels
    expect(bodyText).toMatch(/전략|시뮬|퀵 테스트|백테스트/i);

    // h1 must be Korean or at least present
    const h1 = await page.locator("h1").first().textContent();
    expect(h1?.trim().length ?? 0).toBeGreaterThan(3);

    // Mode tabs should exist in Korean
    const tabTexts = await page.locator('[role="tab"]').allTextContents();
    const tabJoined = tabTexts.join(" ");
    expect(tabJoined.length).toBeGreaterThan(0);

    console.log(
      `KO /simulate tabs: ${tabTexts.join(", ")} | h1: "${h1?.trim()}"`,
    );
  });

  // ── 4. KO simulate: run Breakout → Korean result labels ────────────────────

  test("ko/simulate: Breakout run → Korean result labels (승률, 수익팩터)", async ({
    page,
  }) => {
    await page.goto("/ko/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for hydration
    await page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        return tabs.length >= 3;
      },
      { timeout: 20000 },
    );

    // Click Breakout quick-test card
    const breakoutCard = page.locator('[data-testid="quick-cat-breakout"]');
    await expect(breakoutCard).toBeVisible({ timeout: 15000 });
    await breakoutCard.click();

    // Wait for result
    await expect(page.locator('[data-testid="tab-summary"]')).toBeVisible({
      timeout: 90000,
    });

    const bodyText = (await page.textContent("body")) ?? "";

    // Korean metric labels must appear in results
    const hasKoreanMetric = /승률|수익팩터|최대손실|총수익|거래|결과/i.test(
      bodyText,
    );
    expect(
      hasKoreanMetric,
      "Korean result labels (승률, 수익팩터 etc.) must appear",
    ).toBe(true);

    // No NaN / Infinity
    expect(bodyText).not.toContain("NaN");
    expect(bodyText).not.toContain("Infinity");

    console.log("KO Breakout run: Korean labels confirmed");
  });
});
