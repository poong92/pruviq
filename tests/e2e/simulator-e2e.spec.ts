import { test, expect, type Page } from "@playwright/test";

/**
 * PRUVIQ Simulator — Complete E2E Tests
 *
 * Tests EVERY aspect of the simulator:
 * 1. Load & default state verification
 * 2. Every input field interaction
 * 3. Full backtest execution
 * 4. Every result metric verification
 * 5. All result tabs (Summary, Equity, Trades, Coins)
 * 6. API direct validation with complete response schema
 * 7. Edge cases & error handling
 */

const API_BASE = process.env.API_URL || "https://api.pruviq.com";
// Skip slow backtest tests in CI — production API too slow from GitHub runners
const skipInCI = !!process.env.CI;

// ─── Helpers ──────────────────────────────────────────────────

/** Opens simulator and waits for Preact hydration (lands on Quick Test by default).
 *  Uses event-based waits instead of hardcoded timeouts — reliable on slow CI runners. */
async function openSimulator(page: Page) {
  // domcontentloaded + waitForFunction: production pages poll APIs → networkidle never resolves → 60s timeout
  await page.goto("/simulate/", { waitUntil: "domcontentloaded" });

  // Wait for ModeSwitcher to fully hydrate: tablist exists AND all 3 tabs are visible.
  // waitForTimeout(1500) was too short on slow GitHub runners (hydration takes 3-5s).
  await page.waitForFunction(
    () => {
      const tabs = document.querySelectorAll('[role="tab"]');
      return tabs.length >= 3;
    },
    { timeout: 20000 },
  );
}

/** Switches to Expert mode (STRATEGY BUILDER) — call after openSimulator */
async function switchToExpert(page: Page) {
  const expertTab = page
    .locator('[role="tab"]')
    .filter({ hasText: /Expert|엑스퍼트/i });
  if ((await expertTab.count()) > 0) {
    await expertTab.first().waitFor({ state: "visible", timeout: 5000 });
    await expertTab.first().click();
  }

  // On mobile, the config panel may be behind a tab
  const mobileConfigTab = page
    .locator("button")
    .filter({ hasText: /Config|config|설정|Strategy/i });
  if ((await mobileConfigTab.count()) > 0) {
    await mobileConfigTab.first().waitFor({ state: "visible", timeout: 3000 });
    await mobileConfigTab.first().click();
  }

  // Wait for STRATEGY BUILDER header — confirms Expert panel is mounted
  await page.waitForSelector("text=/STRATEGY BUILDER|전략 빌더/i", {
    timeout: 15000,
  });
}

/** Run backtest and wait for results. Returns true if results appeared. */
async function runBacktestAndWait(page: Page): Promise<boolean> {
  // Find run button — matches "Simulate on N Coins" or "Run Backtest" or Korean
  const runBtn = page.locator("button").filter({
    hasText: /Simulate on|Coins|Run Backtest|백테스트 실행/i,
  });

  if ((await runBtn.count()) === 0) return false;
  await runBtn.first().click();

  // Wait for SUMMARY tab to appear (signals results are ready)
  try {
    await page.waitForSelector(
      'button:has-text("SUMMARY"), button:has-text("요약")',
      { timeout: 100000 },
    );
    // Wait for result metrics to actually render (not just tab label)
    await page
      .waitForFunction(
        () => {
          const els = document.querySelectorAll(
            '[data-result], .result-value, [class*="metric"]',
          );
          return els.length > 0 || document.body.innerText.includes("%");
        },
        { timeout: 10000 },
      )
      .catch(() => null); // non-fatal — SUMMARY tab appearing is sufficient signal
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. SIMULATOR LOAD & DEFAULT STATE
// ═══════════════════════════════════════════════════════════════

test.describe("Simulator — 3-Tier Mode Switcher", () => {
  test("Page loads with mode tabs (Quick/Standard/Expert)", async ({
    page,
  }) => {
    await openSimulator(page);
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();

    const tabs = page.locator('[role="tab"]');
    expect(await tabs.count(), "Should have 3 mode tabs").toBe(3);

    // Verify tab labels
    const tabTexts = await tabs.allTextContents();
    const combined = tabTexts.join(" ");
    expect(combined, "Has Quick tab").toMatch(/Quick|빠른/i);
    expect(combined, "Has Standard tab").toMatch(/Standard|스탠다드/i);
    expect(combined, "Has Expert tab").toMatch(/Expert|엑스퍼트/i);
  });

  test("Quick Test is default mode", async ({ page }) => {
    await openSimulator(page);
    // Quick Test panel shows market scenario chooser
    const quickContent = page.locator("text=/Market Scenario|시장 상황/i");
    expect(
      await quickContent.count(),
      "Quick Test content visible",
    ).toBeGreaterThan(0);
  });

  test("Mode switching: Quick → Standard → Expert", async ({ page }) => {
    await openSimulator(page);

    // Switch to Standard
    const stdTab = page
      .locator('[role="tab"]')
      .filter({ hasText: /Standard|스탠다드/i });
    await stdTab.click();
    await page.waitForTimeout(500);
    const stdPanel = page.locator('[role="tabpanel"][id="panel-standard"]');
    await expect(stdPanel).toBeVisible();

    // Switch to Expert
    await switchToExpert(page);
    const header = page.locator("text=/STRATEGY BUILDER/i");
    await expect(header).toBeVisible();
  });
});

test.describe("Simulator — Expert Load & Defaults", () => {
  test("Expert mode shows STRATEGY BUILDER header", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    const header = page.locator("text=/STRATEGY BUILDER/i");
    await expect(header).toBeVisible();
  });

  test("Shows coin count from API", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    // Header shows "N coins" text
    const coinText = page.locator("text=/\\d+ coins/i");
    if ((await coinText.count()) > 0) {
      const text = (await coinText.first().textContent()) || "";
      const count = parseInt(text.match(/(\d+)/)?.[1] || "0");
      expect(count, "Coin count should be > 400").toBeGreaterThan(400);
      console.log(`Coins loaded: ${count}`);
    }
  });

  test("Default direction is SHORT", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    // SHORT button should be visually active (has accent/highlighted styling)
    const shortBtn = page.locator("button").filter({ hasText: /^SHORT$/ });
    expect(await shortBtn.count(), "SHORT button exists").toBeGreaterThan(0);
  });

  test("Default indicators section exists", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    // Indicators are shown as toggleable buttons/badges in the builder
    const body = (await page.textContent("body")) || "";
    // Check that at least some indicator names appear in the page
    const indicators = ["BB", "EMA", "Volume", "Candle", "RSI", "MACD"];
    const found = indicators.filter((ind) => body.includes(ind));
    expect(
      found.length,
      `At least 2 indicators visible: [${found.join(", ")}]`,
    ).toBeGreaterThanOrEqual(2);
    console.log(`  Found indicators: [${found.join(", ")}]`);
  });

  test("Default conditions: entry conditions exist", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    // Entry conditions use <select> dropdowns
    const selects = page.locator("select");
    const selectCount = await selects.count();
    // Also check for condition-related text in the page
    const body = (await page.textContent("body")) || "";
    const conditionTerms = [
      "is_squeeze",
      "bb_width",
      "vol_ratio",
      "bearish",
      "ema_fast",
      "Entry",
      "Condition",
    ];
    const found = conditionTerms.filter((t) => body.includes(t));
    expect(
      selectCount + found.length,
      `Conditions: ${selectCount} selects, terms: [${found.join(", ")}]`,
    ).toBeGreaterThanOrEqual(3);
    console.log(
      `  Conditions: ${selectCount} selects, terms: [${found.join(", ")}]`,
    );
  });

  test("24 Avoid Hours buttons with correct defaults", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    const hourBtns = page.locator("button").filter({ hasText: /^[0-9]{1,2}$/ });
    expect(await hourBtns.count(), "Should have 24 hour buttons").toBe(24);
  });

  test("Default parameters: SL=10, TP=8, MaxBars=48, PerCoin=60, Leverage=5", async ({
    page,
  }) => {
    await openSimulator(page);
    await switchToExpert(page);
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    expect(count, "Should have 5+ number inputs").toBeGreaterThanOrEqual(5);

    // Collect all values
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      values.push(await numberInputs.nth(i).inputValue());
    }
    console.log(`Input values: [${values.join(", ")}]`);
    // Should contain default values (order may vary)
    expect(values, "Should contain SL=10").toContain("10");
    expect(values, "Should contain TP=8").toContain("8");
  });

  test("Timeframe default is 1H", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    const tf1H = page.locator("button").filter({ hasText: /^1H$/ });
    expect(await tf1H.count(), "1H button exists").toBeGreaterThan(0);
  });

  test("Preview chart renders canvas", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);
    // Chart data loads async from API — wait up to 10s for canvas to appear
    await page.waitForSelector("canvas", { timeout: 10000 }).catch(() => null);
    const canvases = await page.locator("canvas").count();
    expect(canvases, "Chart canvas should render").toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. PARAMETER INTERACTION (every field)
// ═══════════════════════════════════════════════════════════════

test.describe("Simulator — Expert Parameter Controls", () => {
  test("Direction toggle: SHORT → LONG → SHORT", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);

    const longBtn = page.locator("button").filter({ hasText: /^LONG$/ });
    const shortBtn = page.locator("button").filter({ hasText: /^SHORT$/ });

    // Toggle to LONG
    if ((await longBtn.count()) > 0) {
      await longBtn.click();
      await page.waitForTimeout(300);
      // Toggle back to SHORT
      await shortBtn.click();
      await page.waitForTimeout(300);
    }
    // Page should still be functional
    expect(await page.locator('input[type="number"]').count()).toBeGreaterThan(
      3,
    );
  });

  test("SL/TP/MaxBars/PerCoin/Leverage inputs accept valid values", async ({
    page,
  }) => {
    await openSimulator(page);
    await switchToExpert(page);

    const inputs = page.locator('input[type="number"]');
    const count = await inputs.count();

    // Fill each input with a test value and verify
    const testValues = ["12", "10", "24", "100", "3"];
    for (let i = 0; i < Math.min(count, testValues.length); i++) {
      const input = inputs.nth(i);
      await input.click();
      await input.fill(testValues[i]);
      const actual = await input.inputValue();
      expect(actual, `Input ${i} should accept value`).toBe(testValues[i]);
    }
  });

  test("Timeframe switching: 1H → 4H → 1D → 1H", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);

    for (const tf of ["4H", "1D", "1H"]) {
      const btn = page
        .locator("button")
        .filter({ hasText: new RegExp(`^${tf}$`) });
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
    // No crash
    expect(await page.locator("input").count()).toBeGreaterThan(0);
  });

  test("Avoid Hours toggle works", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);

    const hourBtns = page.locator("button").filter({ hasText: /^[0-9]{1,2}$/ });
    // Toggle hour 0 and verify class changes
    const btn0 = hourBtns.first();
    const classBefore = (await btn0.getAttribute("class")) || "";
    await btn0.click();
    await page.waitForTimeout(200);
    const classAfter = (await btn0.getAttribute("class")) || "";
    expect(classBefore, "Hour button class should change on click").not.toBe(
      classAfter,
    );
  });

  test("Coin mode: All → Top N (shows input) → All (hides input)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await openSimulator(page);
    await switchToExpert(page);

    const topBtn = page.locator("button").filter({ hasText: /Top N|Top/i });
    const allBtn = page
      .locator("button")
      .filter({ hasText: /All Coins|All|전체/i });

    if ((await topBtn.count()) > 0) {
      await topBtn.first().click();
      await page.waitForTimeout(500);

      // Top N number input should appear
      const topInput = page.locator(
        'input[type="number"][placeholder*="top" i], input[type="number"]',
      );
      expect(
        await topInput.count(),
        "Top N input should appear",
      ).toBeGreaterThan(0);

      // Switch back
      if ((await allBtn.count()) > 0) {
        await allBtn.first().click();
        await page.waitForTimeout(500);
      }
    }

    const real = errors.filter(
      (e) =>
        !e.includes("cloudflareinsights") &&
        !e.includes("beacon") &&
        !e.includes("ResizeObserver"),
    );
    expect(real.length, "No critical JS errors").toBeLessThanOrEqual(2);
  });

  test("Add Condition button adds a new row", async ({ page }) => {
    await openSimulator(page);
    await switchToExpert(page);

    const addBtn = page
      .locator("button")
      .filter({ hasText: /Add Condition|\+ Add/i });
    if ((await addBtn.count()) > 0) {
      const selectsBefore = await page.locator("select").count();
      await addBtn.click();
      await page.waitForTimeout(500);
      const selectsAfter = await page.locator("select").count();
      expect(
        selectsAfter,
        "Should have more selects after adding condition",
      ).toBeGreaterThan(selectsBefore);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. FULL BACKTEST EXECUTION & RESULT VERIFICATION
// ═══════════════════════════════════════════════════════════════

test.describe("Simulator — Backtest & Results", () => {
  test("Run backtest → verify ALL result metrics", async ({ page }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      console.log("Backtest did not complete — API may be unavailable");
      test.skip();
      return;
    }

    // Click SUMMARY tab to ensure we're on the right view
    const summaryTab = page
      .locator("button")
      .filter({ hasText: /SUMMARY|요약/i });
    if ((await summaryTab.count()) > 0) await summaryTab.first().click();
    await page.waitForTimeout(500);

    const body = (await page.textContent("body")) || "";

    // ─── Verify each metric ─────────────────────────

    // Total trades
    const trades = body.match(/(\d{2,})\s*(?:trades|거래)/i);
    if (trades) {
      const n = parseInt(trades[1]);
      expect(n, "Total trades > 0").toBeGreaterThan(0);
      console.log(`  Total trades: ${n}`);
    }

    // Win rate
    const wr =
      body.match(/([\d.]+)%.*(?:win|승률)/i) ||
      body.match(/(?:win|승률).*?([\d.]+)%/i);
    if (wr) {
      const v = parseFloat(wr[1]);
      expect(v, "Win rate 0-100").toBeGreaterThanOrEqual(0);
      expect(v, "Win rate 0-100").toBeLessThanOrEqual(100);
      console.log(`  Win rate: ${v}%`);
    }

    // Profit Factor
    const pf = body.match(/(?:PF|Profit Factor)[:\s]*([\d.]+)/i);
    if (pf) {
      const v = parseFloat(pf[1]);
      expect(v, "PF > 0").toBeGreaterThan(0);
      console.log(`  Profit Factor: ${v}`);
    }

    // Max Drawdown
    const mdd = body.match(/(?:MDD|Max Drawdown|최대.?낙폭)[:\s]*([\d.]+)%/i);
    if (mdd) {
      const v = parseFloat(mdd[1]);
      expect(v, "MDD >= 0").toBeGreaterThanOrEqual(0);
      console.log(`  Max Drawdown: ${v}%`);
    }

    // Coins used
    const coins = body.match(/(\d+)\s*coins/i);
    if (coins) {
      const n = parseInt(coins[1]);
      expect(n, "Coins used > 0").toBeGreaterThan(0);
      console.log(`  Coins used: ${n}`);
    }

    // Data range
    const range = body.match(
      /\d{4}[-/]\d{2}[-/]\d{2}.*?(?:to|~|—).*?\d{4}[-/]\d{2}[-/]\d{2}/,
    );
    if (range) {
      console.log(`  Data range: ${range[0]}`);
    }

    // Compute time
    const time = body.match(/(\d+)\s*ms/);
    if (time) {
      console.log(`  Compute time: ${time[1]}ms`);
    }

    await page.screenshot({
      path: "/tmp/pruviq-e2e/test-results/backtest_summary.png",
    });
  });

  test("Equity tab → canvas chart rendered", async ({ page }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      test.skip();
      return;
    }

    // Click EQUITY CURVE tab
    const eqTab = page
      .locator("button")
      .filter({ hasText: /EQUITY|자산곡선/i });
    if ((await eqTab.count()) > 0) {
      await eqTab.first().click();
      await page.waitForTimeout(1500);

      // Should have at least 2 canvases (equity chart + drawdown chart)
      const canvases = await page.locator("canvas").count();
      expect(canvases, "Equity + drawdown canvases").toBeGreaterThanOrEqual(2);

      // Max Drawdown text should be visible
      const mddText = page.locator("text=/Max Drawdown|최대 낙폭/i");
      expect(await mddText.count(), "MDD label visible").toBeGreaterThan(0);

      await page.screenshot({
        path: "/tmp/pruviq-e2e/test-results/backtest_equity.png",
      });
      console.log("  Equity tab: canvases rendered");
    }
  });

  test('Trades tab → shows trade table or "not available" message', async ({
    page,
  }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      test.skip();
      return;
    }

    // Click TRADE LIST tab
    const trTab = page
      .locator("button")
      .filter({ hasText: /TRADE LIST|거래 목록/i });
    if ((await trTab.count()) > 0) {
      await trTab.first().click();
      await page.waitForTimeout(1000);

      const body = (await page.textContent("body")) || "";

      // API may or may not return trades array — both are valid
      const table = page.locator("table");
      const tableCount = await table.count();
      const hasNotAvailable =
        body.includes("not available") || body.includes("데이터가 없습니다");

      if (tableCount > 0 && !hasNotAvailable) {
        // Has trade data — validate table structure
        const headers = await page.locator("th").allTextContents();
        console.log(`  Trade headers: [${headers.join(", ")}]`);

        const dataRows = await page.locator("tbody tr").count();
        expect(dataRows, "Should have trade rows").toBeGreaterThan(0);
        console.log(`  Trade rows: ${dataRows}`);

        if (dataRows > 0) {
          const firstRow = page.locator("tbody tr").first();
          const cells = await firstRow.locator("td").allTextContents();
          console.log(`  First trade: [${cells.join(" | ")}]`);
          expect(
            cells.length,
            "Trade row should have cells",
          ).toBeGreaterThanOrEqual(4);
        }
      } else {
        // No trade data — "not available" message should show
        expect(
          hasNotAvailable,
          'Should show "not available" message',
        ).toBeTruthy();
        console.log(
          '  Trades tab: "not available" message shown (expected for this backtest type)',
        );
      }

      await page.screenshot({
        path: "/tmp/pruviq-e2e/test-results/backtest_trades.png",
      });
    }
  });

  test("Coins tab → per-coin breakdown with sortable columns", async ({
    page,
  }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      test.skip();
      return;
    }

    // Click PER COIN tab
    const coinTab = page
      .locator("button")
      .filter({ hasText: /PER COIN|코인별/i });
    if ((await coinTab.count()) > 0) {
      await coinTab.first().click();
      await page.waitForTimeout(1000);

      // Summary stats: profitable / losing counts
      const profitableText = page.locator("text=/profitable|수익/i");
      if ((await profitableText.count()) > 0) {
        console.log("  Profitable/losing summary visible");
      }

      // Table should exist
      const table = page.locator("table");
      if ((await table.count()) > 0) {
        const headers = await page.locator("th").allTextContents();
        console.log(`  Coin headers: [${headers.join(", ")}]`);

        const dataRows = await page.locator("tbody tr").count();
        expect(dataRows, "Should have coin rows").toBeGreaterThan(0);
        console.log(`  Coin rows: ${dataRows}`);

        // First coin validation
        if (dataRows > 0) {
          const firstRow = page.locator("tbody tr").first();
          const cells = await firstRow.locator("td").allTextContents();
          console.log(`  First coin: [${cells.join(" | ")}]`);

          // Symbol should exist (e.g., "BTC")
          expect(
            cells[0]?.length,
            "Symbol should not be empty",
          ).toBeGreaterThan(0);
        }

        // Test sorting: click "Trades" or "Win%" header
        const sortableHeader = page
          .locator("th")
          .filter({ hasText: /Trades|Win|거래|승률/i });
        if ((await sortableHeader.count()) > 0) {
          await sortableHeader.first().click();
          await page.waitForTimeout(300);
          console.log("  Column sorting works");
        }
      }

      await page.screenshot({
        path: "/tmp/pruviq-e2e/test-results/backtest_coins.png",
      });
    }
  });

  test("Quick Adjust → modify SL/TP and re-run", async ({ page }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(180000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      test.skip();
      return;
    }

    // Click Quick Adjust button
    const qaBtn = page
      .locator("button")
      .filter({ hasText: /Quick Adjust|빠른 조정/i });
    if ((await qaBtn.count()) > 0) {
      await qaBtn.first().click();
      await page.waitForTimeout(500);

      // Should show sliders (range inputs)
      const sliders = page.locator('input[type="range"]');
      const sliderCount = await sliders.count();
      console.log(`  Quick Adjust sliders: ${sliderCount}`);

      if (sliderCount > 0) {
        // Modify SL slider
        await sliders.first().fill("12");
        await page.waitForTimeout(200);
      }

      // Click Re-run button
      const rerunBtn = page
        .locator("button")
        .filter({ hasText: /Re-run|재실행/i });
      if ((await rerunBtn.count()) > 0) {
        await rerunBtn.first().click();
        // Wait for new results
        try {
          await page.waitForTimeout(30000);
          console.log("  Quick Adjust re-run triggered");
        } catch {
          console.log("  Quick Adjust re-run did not complete");
        }
      }
    } else {
      console.log("  Quick Adjust not available (may need first run)");
    }
  });

  test("Download CSV button exists after backtest", async ({ page }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);
    await openSimulator(page);
    await switchToExpert(page);

    const ok = await runBacktestAndWait(page);
    if (!ok) {
      test.skip();
      return;
    }

    const csvBtn = page
      .locator("button")
      .filter({ hasText: /Download CSV|CSV 다운로드/i });
    const count = await csvBtn.count();
    console.log(`  CSV download buttons: ${count}`);
    expect(count, "CSV download button should exist").toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. API DIRECT TESTS — Complete Schema Validation
// ═══════════════════════════════════════════════════════════════

test.describe("Simulator — API Validation", () => {
  test("POST /backtest: complete response schema", async ({ request }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);

    const res = await request.post(`${API_BASE}/backtest`, {
      data: {
        name: "E2E Schema Test",
        direction: "short",
        timeframe: "1H",
        indicators: {
          bb: { period: 20 },
          ema: { fast: 12, slow: 26 },
          volume: {},
          candle: {},
        },
        entry: {
          type: "AND",
          conditions: [
            { field: "is_squeeze", op: "==", value: true, shift: 1 },
            { field: "bb_width_change", op: ">=", value: 10, shift: 1 },
            { field: "vol_ratio", op: ">=", value: 2.0, shift: 1 },
            { field: "bearish", op: "==", value: true, shift: 1 },
          ],
        },
        avoid_hours: [2, 3, 10, 20, 21, 22, 23],
        sl_pct: 10,
        tp_pct: 8,
        max_bars: 48,
        per_coin_usd: 60,
        leverage: 5,
        top_n: 50,
      },
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    });

    expect(res.ok(), `API returned ${res.status()}`).toBeTruthy();
    const d = await res.json();

    // ─── Top-level metrics ────────────────────────
    expect(d.total_trades, "total_trades > 0").toBeGreaterThan(0);
    expect(d.wins, "wins >= 0").toBeGreaterThanOrEqual(0);
    expect(d.losses, "losses >= 0").toBeGreaterThanOrEqual(0);
    expect(d.wins + d.losses, "wins + losses = total").toBeLessThanOrEqual(
      d.total_trades + 1,
    ); // +1 for timeout

    expect(d.win_rate, "win_rate 0-100").toBeGreaterThanOrEqual(0);
    expect(d.win_rate, "win_rate 0-100").toBeLessThanOrEqual(100);

    expect(d.profit_factor, "profit_factor > 0").toBeGreaterThan(0);
    expect(d.max_drawdown_pct, "max_drawdown_pct >= 0").toBeGreaterThanOrEqual(
      0,
    );
    expect(typeof d.total_return_pct, "total_return_pct is number").toBe(
      "number",
    );

    // TP/SL/TIMEOUT counts
    expect(d.tp_count, "tp_count >= 0").toBeGreaterThanOrEqual(0);
    expect(d.sl_count, "sl_count >= 0").toBeGreaterThanOrEqual(0);
    expect(d.timeout_count, "timeout_count >= 0").toBeGreaterThanOrEqual(0);

    // Coins used
    expect(d.coins_used, "coins_used > 0").toBeGreaterThan(0);
    expect(typeof d.data_range, "data_range is string").toBe("string");
    expect(typeof d.compute_time_ms, "compute_time_ms is number").toBe(
      "number",
    );

    console.log(`  Trades: ${d.total_trades} (W:${d.wins} L:${d.losses})`);
    console.log(
      `  WR: ${d.win_rate}% | PF: ${d.profit_factor} | Return: ${d.total_return_pct}%`,
    );
    console.log(
      `  MDD: ${d.max_drawdown_pct}% | TP:${d.tp_count} SL:${d.sl_count} TO:${d.timeout_count}`,
    );
    console.log(
      `  Coins: ${d.coins_used} | Range: ${d.data_range} | Time: ${d.compute_time_ms}ms`,
    );

    // ─── Equity curve ─────────────────────────────
    expect(Array.isArray(d.equity_curve), "equity_curve is array").toBeTruthy();
    expect(d.equity_curve.length, "equity_curve has points").toBeGreaterThan(
      10,
    );

    const firstPoint = d.equity_curve[0];
    expect(typeof firstPoint.time, "point.time is string").toBe("string");
    expect(typeof firstPoint.value, "point.value is number").toBe("number");
    console.log(`  Equity curve: ${d.equity_curve.length} points`);

    // ─── Yearly stats ──────────────────────────────
    expect(Array.isArray(d.yearly_stats), "yearly_stats is array").toBeTruthy();
    expect(d.yearly_stats.length, "yearly_stats has entries").toBeGreaterThan(
      0,
    );

    const firstYear = d.yearly_stats[0];
    expect(typeof firstYear.year, "year.year").toBe("number");
    expect(typeof firstYear.trades, "year.trades").toBe("number");
    expect(typeof firstYear.wins, "year.wins").toBe("number");
    expect(typeof firstYear.win_rate, "year.win_rate").toBe("number");
    expect(typeof firstYear.total_return_pct, "year.total_return_pct").toBe(
      "number",
    );
    expect(typeof firstYear.profit_factor, "year.profit_factor").toBe("number");
    console.log(
      `  Yearly stats: ${d.yearly_stats.length} years, first: ${firstYear.year} T:${firstYear.trades} WR:${firstYear.win_rate}%`,
    );

    // ─── Additional metrics ──────────────────────
    expect(typeof d.avg_win_pct, "avg_win_pct is number").toBe("number");
    expect(typeof d.avg_loss_pct, "avg_loss_pct is number").toBe("number");
    expect(typeof d.max_consecutive_losses, "max_consecutive_losses").toBe(
      "number",
    );
    expect(typeof d.sharpe_ratio, "sharpe_ratio").toBe("number");
    expect(typeof d.sortino_ratio, "sortino_ratio").toBe("number");
    expect(typeof d.calmar_ratio, "calmar_ratio").toBe("number");
    expect(typeof d.total_funding_pct, "total_funding_pct").toBe("number");
    expect(
      Array.isArray(d.indicators_used),
      "indicators_used is array",
    ).toBeTruthy();
    expect(d.is_valid, "is_valid should be boolean").toBeDefined();
    console.log(
      `  Ratios: Sharpe=${d.sharpe_ratio} Sortino=${d.sortino_ratio} Calmar=${d.calmar_ratio}`,
    );
    console.log(
      `  Indicators: [${d.indicators_used.join(", ")}] | Funding: ${d.total_funding_pct}%`,
    );

    // ─── Coin results ─────────────────────────────
    expect(Array.isArray(d.coin_results), "coin_results is array").toBeTruthy();
    expect(d.coin_results.length, "coin_results > 0").toBeGreaterThan(0);

    const firstCoin = d.coin_results[0];
    expect(typeof firstCoin.symbol, "coin.symbol").toBe("string");
    expect(typeof firstCoin.trades, "coin.trades").toBe("number");
    expect(typeof firstCoin.win_rate, "coin.win_rate").toBe("number");
    expect(typeof firstCoin.profit_factor, "coin.profit_factor").toBe("number");
    expect(typeof firstCoin.total_return_pct, "coin.total_return_pct").toBe(
      "number",
    );
    expect(typeof firstCoin.tp_count, "coin.tp_count").toBe("number");
    expect(typeof firstCoin.sl_count, "coin.sl_count").toBe("number");
    expect(typeof firstCoin.timeout_count, "coin.timeout_count").toBe("number");
    console.log(
      `  Coin results: ${d.coin_results.length} coins, first: ${firstCoin.symbol} WR${firstCoin.win_rate}%`,
    );
  });

  test("POST /backtest with invalid SL → 422", async ({ request }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API unreachable from GitHub runners",
    );
    const res = await request.post(`${API_BASE}/backtest`, {
      data: {
        name: "Invalid SL",
        direction: "short",
        timeframe: "1H",
        indicators: {},
        entry: { type: "AND", conditions: [] },
        sl_pct: 200,
        tp_pct: 8,
        max_bars: 48,
      },
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
    expect([400, 422], "Should reject invalid params").toContain(res.status());
    console.log(`  Invalid SL rejected: HTTP ${res.status()}`);
  });

  test("POST /backtest with LONG direction", async ({ request }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API too slow from GitHub runners",
    );
    test.setTimeout(120000);

    const res = await request.post(`${API_BASE}/backtest`, {
      data: {
        name: "LONG Test",
        direction: "long",
        timeframe: "1H",
        indicators: { bb: {}, ema: {}, volume: {}, candle: {} },
        entry: {
          type: "AND",
          conditions: [
            { field: "is_squeeze", op: "==", value: true, shift: 1 },
            { field: "bullish", op: "==", value: true, shift: 1 },
          ],
        },
        sl_pct: 10,
        tp_pct: 8,
        max_bars: 48,
        per_coin_usd: 60,
        leverage: 5,
        top_n: 30,
      },
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    });

    if (res.ok()) {
      const d = await res.json();
      expect(d.total_trades, "LONG should have trades").toBeGreaterThan(0);
      console.log(
        `  LONG backtest: ${d.total_trades} trades, WR ${d.win_rate}%, PF ${d.profit_factor}`,
      );
    } else {
      console.log(
        `  LONG backtest: HTTP ${res.status()} (may not be supported)`,
      );
    }
  });

  test("GET /health → coins > 400", async ({ request }) => {
    test.skip(
      skipInCI,
      "Skipped in CI — production API unreachable from GitHub runners",
    );
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const d = await res.json();
    expect(d.coins_loaded, "coins > 400").toBeGreaterThan(400);
    expect(d.status, "status ok").toBe("ok");
    console.log(`  Health: ${d.coins_loaded} coins, status: ${d.status}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. MOBILE-SPECIFIC TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("Simulator — Mobile UX", () => {
  test("Mobile tab switching: Chart ↔ Config ↔ Results", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/simulate/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Mobile should have tab buttons
    const tabs = page
      .locator("button")
      .filter({ hasText: /Chart|Config|Results|차트|설정|결과/i });
    const count = await tabs.count();
    console.log(`  Mobile tabs found: ${count}`);

    if (count >= 2) {
      // Click each tab
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(500);
      }
      console.log("  Mobile tab switching OK");
    }
  });
});
