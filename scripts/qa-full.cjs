const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = "/tmp/pruviq-qa-screenshots";
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://pruviq.com";

const pages = [
  { name: "01-home", url: "/", checks: ["h1", "nav"] },
  { name: "02-simulate", url: "/simulate/", checks: ["strategy selector"] },
  { name: "03-strategies", url: "/strategies/", checks: ["strategy cards"] },
  {
    name: "04-strategies-ranking",
    url: "/strategies/ranking/",
    checks: ["ranking table"],
  },
  { name: "05-coins", url: "/coins/", checks: ["coin table"] },
  { name: "06-market", url: "/market/", checks: ["market dashboard"] },
  { name: "07-learn", url: "/learn/", checks: ["articles"] },
  { name: "08-fees", url: "/fees/", checks: ["fee calculator"] },
  { name: "09-about", url: "/about/", checks: ["about content"] },
  { name: "10-ko-home", url: "/ko/", checks: ["korean h1"] },
  {
    name: "11-ko-simulate",
    url: "/ko/simulate/",
    checks: ["korean simulator"],
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const results = [];

  for (const p of pages) {
    const page = await context.newPage();
    const start = Date.now();

    try {
      await page.goto(SITE + p.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(3000); // Wait for JS hydration

      const title = await page.title();
      const h1 = await page
        .$eval("h1", (el) => el.textContent)
        .catch(() => "NO H1");
      const status = page.url().includes("404") ? "404" : "OK";

      // Screenshot
      await page.screenshot({
        path: path.join(OUT, `${p.name}.png`),
        fullPage: false,
      });

      const elapsed = Date.now() - start;
      console.log(
        `✓ ${p.name}: ${status} (${elapsed}ms) — "${h1.trim().substring(0, 60)}"`,
      );
      results.push({
        page: p.name,
        url: p.url,
        status,
        title,
        h1: h1.trim().substring(0, 60),
        ms: elapsed,
      });
    } catch (e) {
      console.log(`✗ ${p.name}: ERROR — ${e.message.substring(0, 80)}`);
      results.push({
        page: p.name,
        url: p.url,
        status: "ERROR",
        error: e.message.substring(0, 80),
      });
    }

    await page.close();
  }

  // Simulate page — click through features
  console.log("\n--- Simulator Feature Test ---");
  const simPage = await context.newPage();
  try {
    await simPage.goto(SITE + "/simulate/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await simPage.waitForTimeout(5000);

    // Check Hot Strategies widget
    const hotWidget = await simPage.$(".text-yellow-400").catch(() => null);
    console.log(
      `  Hot Strategies widget: ${hotWidget ? "✓ VISIBLE" : "✗ NOT FOUND"}`,
    );

    // Screenshot simulator initial state
    await simPage.screenshot({
      path: path.join(OUT, "12-simulate-initial.png"),
      fullPage: false,
    });

    // Try clicking "Run Backtest" or similar button
    const runBtn = await simPage
      .$(
        'button:has-text("Run"), button:has-text("Backtest"), button:has-text("Simulate")',
      )
      .catch(() => null);
    if (runBtn) {
      await runBtn.click();
      await simPage.waitForTimeout(5000);
      await simPage.screenshot({
        path: path.join(OUT, "13-simulate-after-run.png"),
        fullPage: false,
      });
      console.log("  Run button: ✓ CLICKED");
    } else {
      console.log("  Run button: not found (may need preset)");
    }

    // Check if results appeared
    const resultsSection = await simPage
      .$('[class*="result"], [class*="Result"], [data-testid*="result"]')
      .catch(() => null);
    console.log(
      `  Results section: ${resultsSection ? "✓ VISIBLE" : "— not loaded (need backtest first)"}`,
    );
  } catch (e) {
    console.log(`  Simulator test error: ${e.message.substring(0, 80)}`);
  }
  await simPage.close();

  // Mobile view
  console.log("\n--- Mobile View ---");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });

  for (const p of [pages[0], pages[1], pages[3]]) {
    const mPage = await mobile.newPage();
    try {
      await mPage.goto(SITE + p.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await mPage.waitForTimeout(3000);
      await mPage.screenshot({
        path: path.join(OUT, `mobile-${p.name}.png`),
        fullPage: false,
      });
      console.log(`✓ mobile-${p.name}: OK`);
    } catch (e) {
      console.log(`✗ mobile-${p.name}: ${e.message.substring(0, 60)}`);
    }
    await mPage.close();
  }

  await browser.close();

  console.log(`\nScreenshots saved to: ${OUT}`);
  console.log(`Total: ${results.length} pages checked`);
})();
