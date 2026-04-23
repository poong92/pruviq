// Expert Builder (/simulate/builder/) real-user audit — prod-only.
// 5 personas walking through the Builder, capturing console/network/DOM state.

import { test, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

async function harness(page: Page) {
  const errors: string[] = [];
  const network404: string[] = [];
  const simulateCalls: {
    method: string;
    url: string;
    status?: number;
    body?: string;
  }[] = [];
  page.on("pageerror", (e) => {
    if (!/AbortError|net::ERR_/.test(e.message)) errors.push(e.message);
  });
  page.on("response", async (r) => {
    if (r.status() >= 400 && /pruviq\.com/.test(r.url())) {
      network404.push(`${r.status()} ${r.url()}`);
    }
    if (/api\.pruviq\.com\/(simulate|backtest|generate)/.test(r.url())) {
      const body = r.request().postData() || "";
      simulateCalls.push({
        method: r.request().method(),
        url: r.url(),
        status: r.status(),
        body: body.slice(0, 200),
      });
    }
  });
  return { errors, network404, simulateCalls };
}

async function dumpState(page: Page, title: string) {
  const state = await page.evaluate(() => {
    return {
      url: location.href,
      h1: document.querySelector("h1")?.textContent?.trim(),
      bodyLen: document.body.innerText.length,
      hasRunBtn: !!document.querySelector("[data-testid=run-backtest]"),
      hasDirBtns: !!document.querySelector("[data-testid=dir-short]"),
      hasChart: !!document.querySelector("canvas, svg.chart, [class*=chart i]"),
      hasResult: /Return|Profit|Win Rate|수익|승률/.test(
        document.body.innerText,
      ),
      tabs: Array.from(document.querySelectorAll('[role="tab"]'))
        .map((t) => (t as HTMLElement).innerText.trim())
        .slice(0, 10),
      ctaTexts: Array.from(document.querySelectorAll("button"))
        .map((b) => (b as HTMLElement).innerText.trim())
        .filter((t) => t && t.length < 40)
        .slice(0, 15),
    };
  });
  console.log(`\n[${title}] url=${state.url}`);
  console.log(`  h1="${state.h1}" bodyLen=${state.bodyLen}`);
  console.log(
    `  runBtn=${state.hasRunBtn} dirBtns=${state.hasDirBtns} chart=${state.hasChart} result=${state.hasResult}`,
  );
  console.log(`  tabs=[${state.tabs.join(", ")}]`);
  console.log(`  ctas=[${state.ctaTexts.join(" | ")}]`);
  return state;
}

test.describe("Expert Builder — real-user persona walkthroughs", () => {
  test("P1: cold-open /simulate/builder/ (no query, EN, desktop)", async ({
    page,
  }) => {
    const h = await harness(page);
    await page.goto("/simulate/builder/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // hydration
    const s = await dumpState(page, "P1 cold-open EN");
    console.log(`  errors=${h.errors.length}`, h.errors.slice(0, 3));
    console.log(`  404s=${h.network404.length}`, h.network404.slice(0, 3));
    console.log(
      `  api_calls=${h.simulateCalls.length}`,
      h.simulateCalls.slice(0, 3),
    );
  });

  test("P2: cold-open /ko/simulate/builder/ (Korean user)", async ({
    page,
  }) => {
    const h = await harness(page);
    await page.goto("/ko/simulate/builder/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const s = await dumpState(page, "P2 cold-open KO");
    console.log(`  errors=${h.errors.length}`, h.errors.slice(0, 3));
    console.log(`  404s=${h.network404.length}`, h.network404.slice(0, 3));
  });

  test("P3: deep-link from /simulate (Quick Start state transfer)", async ({
    page,
  }) => {
    const h = await harness(page);
    await page.goto(
      "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(3500);
    const s = await dumpState(page, "P3 deep-link");
    // Verify SL=3 / TP=7 / dir=short applied
    const picked = await page.evaluate(() => {
      const sl = (
        document.querySelector(
          "input[type=range][name*=sl i], input[name*=sl i]",
        ) as HTMLInputElement
      )?.value;
      const tp = (
        document.querySelector(
          "input[type=range][name*=tp i], input[name*=tp i]",
        ) as HTMLInputElement
      )?.value;
      const dir = Array.from(
        document.querySelectorAll("button[data-testid^=dir-]"),
      ).map((b) => ({
        id: b.getAttribute("data-testid"),
        active:
          b.getAttribute("aria-pressed") === "true" ||
          /active|selected/i.test(b.className || ""),
      }));
      return { sl, tp, dir };
    });
    console.log(`  picked:`, JSON.stringify(picked));
  });

  test("P4: click RUN BACKTEST button → result within 30s", async ({
    page,
  }) => {
    const h = await harness(page);
    await page.goto(
      "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=10",
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(2500);
    const runBtn = page.locator("[data-testid=run-backtest]");
    const runCount = await runBtn.count();
    console.log(`  run button count: ${runCount}`);
    if (runCount === 0) {
      console.log("  ❌ RUN button absent — persona cannot execute.");
      const s = await dumpState(page, "P4 no-run-btn");
      return;
    }
    await runBtn.first().click();
    // Wait up to 30s for result
    const found = await page
      .waitForFunction(
        () =>
          /(\+|-)\d+(\.\d+)?%/.test(document.body.innerText) &&
          /Win Rate|승률|Profit Factor|PF/i.test(document.body.innerText),
        null,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    console.log(`  result appeared: ${found}`);
    await dumpState(page, "P4 after-run");
    console.log(
      `  api_calls=${h.simulateCalls.length}`,
      h.simulateCalls
        .map((c) => `${c.method} ${c.url.split("/").pop()} → ${c.status}`)
        .slice(0, 5),
    );
  });

  test("P5: mobile 375×812 — can user operate the Builder?", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    const h = await harness(page);
    await page.goto("/simulate/builder/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const overflowX = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    const runBtn = page.locator("[data-testid=run-backtest]");
    const runBox = await runBtn
      .first()
      .boundingBox()
      .catch(() => null);
    const dirBtn = page.locator("[data-testid=dir-short]");
    const dirBox = await dirBtn
      .first()
      .boundingBox()
      .catch(() => null);
    console.log(`  h-overflow=${overflowX}`);
    console.log(
      `  run tap target: ${runBox ? `${runBox.width}×${runBox.height}` : "NOT FOUND"}`,
    );
    console.log(
      `  dir tap target: ${dirBox ? `${dirBox.width}×${dirBox.height}` : "NOT FOUND"}`,
    );
    await dumpState(page, "P5 mobile");
    await ctx.close();
  });
});
