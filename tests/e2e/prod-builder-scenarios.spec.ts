// Scenario-based UX measurement: can a real user complete their goal?

import { test, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

async function clickAnyOfTexts(
  page: Page,
  texts: string[],
): Promise<string | null> {
  for (const t of texts) {
    const loc = page.getByText(t, { exact: false }).first();
    if ((await loc.count()) > 0 && (await loc.isVisible())) {
      await loc.click().catch(() => undefined);
      return t;
    }
  }
  return null;
}

test.describe("Scenario completion rates on Expert Builder", () => {
  test("S1: First-timer wants to run ANY backtest (desktop, no prior context)", async ({
    page,
  }) => {
    const t0 = Date.now();
    await page.goto("/simulate/builder/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    // What does the user see? Any obvious "run" path?
    const path: string[] = [];
    const pathRuns = [
      "Run BB",
      "Run Backtest",
      "실행",
      "★ Best Start",
      "백테스트 실행",
    ];
    const clicked = await clickAnyOfTexts(page, pathRuns);
    if (clicked) path.push(`clicked: ${clicked}`);
    else path.push("no obvious run CTA");
    await page.waitForTimeout(4000);
    // Did they get a result?
    const got = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        hasResult: /Win Rate|승률|Profit Factor|PF\b/i.test(t),
        hasPercent: /[+-]?\d+(\.\d+)?%/.test(t),
        bodyLen: t.length,
      };
    });
    console.log(`[S1] ${Date.now() - t0}ms elapsed  path=${path.join(" | ")}`);
    console.log(
      `[S1] completed=${got.hasResult && got.hasPercent}  bodyLen=${got.bodyLen}`,
    );
  });

  test("S2: Modify a parameter and re-run (precondition: preset loaded)", async ({
    page,
  }) => {
    await page.goto(
      "/simulate/builder/?preset=bb-squeeze-short&dir=short&sl=10&tp=8",
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(3500);
    const t0 = Date.now();
    // Try to change SL by finding range input
    const moved = await page.evaluate(() => {
      const ranges = Array.from(
        document.querySelectorAll('input[type="range"]'),
      ) as HTMLInputElement[];
      if (ranges.length === 0) return { hasRange: false };
      const target = ranges[0];
      const before = target.value;
      target.value = String(Math.min(+target.max || 30, (+before || 10) + 5));
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        hasRange: true,
        before,
        after: target.value,
        count: ranges.length,
      };
    });
    console.log(`[S2] range change:`, JSON.stringify(moved));
    // Try re-running
    const runClicked = await clickAnyOfTexts(page, [
      "Run BB",
      "Run Backtest",
      "실행",
      "재실행",
      "Rerun",
    ]);
    console.log(`[S2] re-run via: ${runClicked}`);
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => {
      const t = document.body.innerText;
      return { hasResult: /Win Rate|승률|PF\b/i.test(t) };
    });
    console.log(
      `[S2] ${Date.now() - t0}ms elapsed  new-result=${state.hasResult}`,
    );
  });

  test("S3: Mobile commuter flow — tap preset on mobile, see result", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto("/simulate/builder/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const step1 = await clickAnyOfTexts(page, [
      "Volatility Squeeze",
      "Squeeze",
      "★ Best Start",
      "추천",
    ]);
    await page.waitForTimeout(2000);
    // On mobile, user probably needs to scroll to find RUN
    const scrollDepth = await page.evaluate(() => {
      let found = -1;
      const run = document.querySelector(
        "[data-testid=run-backtest]",
      ) as HTMLElement | null;
      if (run) {
        const r = run.getBoundingClientRect();
        found = r.top + window.scrollY;
      }
      return { foundAtY: found, vh: window.innerHeight };
    });
    console.log(
      `[S3 mobile] step1=${step1}  runBtn_y=${scrollDepth.foundAtY}px  vh=${scrollDepth.vh}`,
    );
    // If RUN was found, scroll to it and click
    if (scrollDepth.foundAtY > 0) {
      await page.evaluate(
        (y) => window.scrollTo(0, y - 100),
        scrollDepth.foundAtY,
      );
      await page.waitForTimeout(600);
      const runBtn = page.locator("[data-testid=run-backtest]");
      const enabled = await runBtn.isEnabled();
      console.log(`[S3 mobile] run enabled: ${enabled}`);
      if (enabled) {
        await runBtn.click();
        await page.waitForTimeout(8000);
        const text = await page.evaluate(() => document.body.innerText);
        console.log(
          `[S3 mobile] got result: ${/Win Rate|승률|PF\b/i.test(text)}`,
        );
      }
    }
    console.log(`[S3 mobile] total elapsed=${Date.now() - t0}ms`);
    await ctx.close();
  });
});
