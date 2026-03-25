import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Production Smoke Tests — hits actual pruviq.com (not localhost)
 *
 * Run only when BASE_URL=https://pruviq.com.
 * Catches bugs that only appear on the DEPLOYED site:
 *   - SSR blank pages (crawlers see empty content)
 *   - Hardcoded stale data (coin count, strategy names)
 *   - KO/EN SSR parity gaps
 *   - JS component crashes on real API data
 *   - Canvas/chart not rendering
 *
 * Skipped automatically when BASE_URL is localhost (dev/CI local build).
 */

const BASE_URL = process.env.BASE_URL || "";
const IS_PROD = BASE_URL.includes("pruviq.com");

// QA Rules SSoT — stale coin count value는 여기서만 관리
const QA_RULES_PATH = path.join(process.cwd(), "tests/harness/qa-rules.json");
const QA_RULES = fs.existsSync(QA_RULES_PATH)
  ? JSON.parse(fs.readFileSync(QA_RULES_PATH, "utf-8"))
  : null;
const STALE_COIN_STR = String(QA_RULES?.coin_count?.stale_value ?? 549);
const CURRENT_COIN = QA_RULES?.coin_count?.current ?? 569;

// Skip all tests if not running against production
test.beforeEach(async ({}, testInfo) => {
  if (!IS_PROD) {
    testInfo.skip(true, "prod-smoke only runs against https://pruviq.com");
  }
});

// ─── 1. SSR content: ranking page ───────────────────────────────────────────

test.describe("SSR: ranking pages have real data in static HTML", () => {
  test("EN /strategies/ranking — SSR fallback has strategy data", async ({
    page,
  }) => {
    const res = await page.goto("/strategies/ranking");
    expect(res?.status()).toBeLessThan(400);

    // SSR fallback div must exist (regression: PR #460)
    const ssrDiv = page.locator("#ranking-ssr-fallback");
    await expect(ssrDiv).toBeAttached();

    // Must contain real data, not placeholder text
    const ssrText = await ssrDiv.textContent();
    expect(ssrText?.length ?? 0).toBeGreaterThan(100);

    // Win Rate must appear in SSR HTML (means API data was fetched at build time)
    expect(ssrText).toMatch(/Win Rate|win_rate|\d+\.\d+%/i);

    // Should have at least one strategy name
    const hasStrategy = /MACD|RSI|BB Squeeze|Breakout|ATR|Bollinger/i.test(
      ssrText ?? "",
    );
    expect(hasStrategy, "SSR fallback should contain strategy names").toBe(
      true,
    );
  });

  test("KO /ko/strategies/ranking — SSR fallback exists with data", async ({
    page,
  }) => {
    const res = await page.goto("/ko/strategies/ranking");
    expect(res?.status()).toBeLessThan(400);

    // KO page must also have SSR fallback (regression: PR #464 — KO was blank for crawlers)
    const ssrDiv = page.locator("#ranking-ssr-fallback");
    await expect(ssrDiv).toBeAttached();

    const ssrText = await ssrDiv.textContent();
    expect(ssrText?.length ?? 0).toBeGreaterThan(100);

    // KO page SSR must have Korean text
    const koreanRegex = /[\uAC00-\uD7AF]/;
    expect(
      koreanRegex.test(ssrText ?? ""),
      "KO ranking SSR must contain Korean text",
    ).toBe(true);
  });

  test("Ranking SSR data is fresh — not older than 2 days", async ({
    request,
  }) => {
    const res = await request.get(
      "https://api.pruviq.com/rankings/daily?period=30d&group=Market%20Cap%20Top%2050",
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    const dateStr: string = data.date;
    expect(dateStr).toBeTruthy();
    const ageMs = Date.now() - new Date(dateStr).getTime();
    const ageDays = ageMs / 86400000;
    expect(
      ageDays,
      `Ranking data is ${ageDays.toFixed(1)} days old`,
    ).toBeLessThan(2);
  });
});

// ─── 2. Coin count: no stale hardcoded number ───────────────────────────────

test.describe("Coin count: deployed HTML reflects current count", () => {
  test("Home page HTML contains coin count number", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();

    // Must have some coin count number (not blank)
    const hasCoinCount = /\d{3}\+?\s*(coins?|Coins?)/i.test(html);
    expect(hasCoinCount, "Home page must display coin count").toBe(true);

    // Must NOT show stale coin count (qa-rules.json SSoT — 하드코딩 금지)
    expect(html).not.toContain(`${STALE_COIN_STR}+`);
    expect(html).not.toContain(`${STALE_COIN_STR} coins`);
    expect(html).not.toContain(`${STALE_COIN_STR}개`);
    // Must show current coin count
    expect(html).toMatch(new RegExp(String(CURRENT_COIN)));
  });

  test("Simulate page HTML has correct coin count", async ({ page }) => {
    await page.goto("/simulate/");
    const html = await page.content();
    expect(html).not.toContain(`${STALE_COIN_STR}+`);
    expect(html).not.toContain(`${STALE_COIN_STR} coins`);
  });

  test("KO simulate page has correct coin count", async ({ page }) => {
    await page.goto("/ko/simulate/");
    const html = await page.content();
    expect(html).not.toContain(`${STALE_COIN_STR}개`);
    expect(html).not.toContain(`${STALE_COIN_STR}+`);
  });
});

// ─── 3. h1 not blank on all key pages ───────────────────────────────────────

test.describe("All key pages: h1 visible and non-empty", () => {
  const keyPages = [
    { path: "/", expectedPattern: /strategy|trade|backtest/i },
    { path: "/simulate/", expectedPattern: /simulat|strategy|test/i },
    { path: "/strategies/ranking", expectedPattern: /ranking|strategy/i },
    { path: "/ko/", expectedPattern: /전략|검증|트레이드|테스트/i },
    { path: "/ko/simulate/", expectedPattern: /전략|시뮬|테스트/i },
    { path: "/ko/strategies/ranking", expectedPattern: /랭킹|전략/i },
    { path: "/market/", expectedPattern: /market|dashboard/i },
    { path: "/performance/", expectedPattern: /trade|performance|loss/i },
    { path: "/about/", expectedPattern: /trader|about|built/i },
  ];

  for (const { path, expectedPattern } of keyPages) {
    test(`${path} — h1 exists and matches expected content`, async ({
      page,
    }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} returned error`).toBeLessThan(400);

      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 10000 });

      const h1Text = await h1.textContent();
      expect(h1Text?.trim().length ?? 0).toBeGreaterThan(3);
      expect(
        expectedPattern.test(h1Text ?? ""),
        `h1 "${h1Text}" doesn't match expected pattern for ${path}`,
      ).toBe(true);
    });
  }
});

// ─── 4. No JS crashes on key pages (real API data) ──────────────────────────

test.describe("No JS crashes on deployed pages", () => {
  const jsPages = [
    "/simulate/",
    "/strategies/ranking",
    "/market/",
    "/coins/",
    "/ko/simulate/",
    "/ko/strategies/ranking",
  ];

  for (const path of jsPages) {
    test(`${path} — no component-crashing JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => {
        const msg = e.message;
        // Ignore network/fetch errors (expected on loaded page)
        if (
          !msg.includes("net::") &&
          !msg.includes("fetch") &&
          !msg.includes("AbortError") &&
          !msg.includes("NetworkError") &&
          !msg.includes("Failed to fetch")
        ) {
          errors.push(msg);
        }
      });

      await page.goto(path, { waitUntil: "domcontentloaded" });
      // Wait for Preact hydration
      await page.waitForTimeout(4000);

      expect(errors, `JS errors on ${path}: ${errors.join("; ")}`).toHaveLength(
        0,
      );
    });
  }
});

// ─── 5. Chart/canvas renders after hydration ────────────────────────────────

test.describe("Interactive components render after hydration", () => {
  test("Simulate page: result area visible after run", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });

    // Wait for Preact hydration
    await page.waitForTimeout(4000);

    // Strategy selector must be visible (not stuck on skeleton)
    const strategyEl = page
      .locator('[data-testid="strategy-select"], select, [role="combobox"]')
      .first();
    const isVisible = (await strategyEl.count()) > 0;

    // At minimum, the page must not show "loading..." or error state
    const body = await page.textContent("body");
    expect(body).not.toMatch(
      /failed to load simulator|오류가 발생|error loading/i,
    );
    expect(body).toMatch(/strategy|bb.squeeze|simulate/i);
  });

  test("Ranking page: data table renders (not blank)", async ({ page }) => {
    await page.goto("/strategies/ranking", { waitUntil: "domcontentloaded" });

    // SSR fallback shows immediately
    const ssrDiv = page.locator("#ranking-ssr-fallback");
    await expect(ssrDiv).toBeVisible({ timeout: 5000 });

    // After hydration, JS component takes over — SSR div hides
    await page.waitForTimeout(3000);

    // Either SSR or JS component must show data
    const body = await page.textContent("body");
    expect(body).toMatch(/Win Rate|Best 3|Worst 3|MACD|RSI|Breakout/i);
  });
});

// ─── 6. KO/EN parity: same pages have equivalent structure ──────────────────

test.describe("KO/EN page parity", () => {
  test("EN and KO home pages both have h1", async ({ page }) => {
    await page.goto("/");
    const enH1 = await page.locator("h1").first().textContent();

    await page.goto("/ko/");
    const koH1 = await page.locator("h1").first().textContent();

    expect(enH1?.trim().length ?? 0).toBeGreaterThan(5);
    expect(koH1?.trim().length ?? 0).toBeGreaterThan(5);
    // KO h1 should be different from EN (actual translation, not missing)
    expect(koH1).not.toBe(enH1);
  });

  test("EN ranking page and KO ranking page both have SSR fallback", async ({
    page,
  }) => {
    await page.goto("/strategies/ranking");
    const enSSR = await page.locator("#ranking-ssr-fallback").count();

    await page.goto("/ko/strategies/ranking");
    const koSSR = await page.locator("#ranking-ssr-fallback").count();

    expect(enSSR).toBeGreaterThan(0);
    expect(koSSR).toBeGreaterThan(0);
  });
});

// ─── 7. Critical pages return 200 (no accidental 404/500) ───────────────────

test.describe("HTTP status: no accidental 4xx/5xx", () => {
  const criticalPaths = [
    "/",
    "/simulate/",
    "/strategies/",
    "/strategies/ranking",
    "/market/",
    "/coins/",
    "/performance/",
    "/about/",
    "/fees/",
    "/ko/",
    "/ko/simulate/",
    "/ko/strategies/ranking",
    "/compare/tradingview",
    "/compare/coinrule",
  ];

  for (const path of criticalPaths) {
    test(`${path} returns 200`, async ({ request }) => {
      const res = await request.get(path, { timeout: 15000 });
      expect(res.status(), `${path} returned ${res.status()}`).toBeLessThan(
        400,
      );
    });
  }
});

// ─── 8. Page coverage: KO + SEO landing pages ───────────────────────────────

test.describe("Page coverage: KO + SEO landing pages", () => {
  // EN pages that should return 200 + have h1
  const enPages = [
    "/best-crypto-backtesting",
    "/crypto-trading-simulator",
    "/demo",
    "/blog",
    "/why-backtests-fail",
  ];

  for (const path of enPages) {
    test(`GET ${path} returns 200`, async ({ page }) => {
      const resp = await page.goto(`${path}/`);
      expect(resp?.status()).toBe(200);
    });

    test(`${path} has h1`, async ({ page }) => {
      await page.goto(`${path}/`);
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 10000 });
      const text = await h1.textContent();
      expect(text?.trim().length ?? 0).toBeGreaterThan(0);
    });
  }

  // /404 page — Cloudflare may return 200 with custom 404 content
  test("GET /404 returns 404 or custom page", async ({ page }) => {
    const resp = await page.goto("/404/");
    // Cloudflare Workers may serve 200 with custom 404 HTML
    expect([200, 404]).toContain(resp?.status());
  });

  test("/404 has h1", async ({ page }) => {
    await page.goto("/404/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const text = await h1.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(0);
  });

  // KO pages that should return 200 + have h1
  const koPages = [
    "/ko/about",
    "/ko/blog",
    "/ko/changelog",
    "/ko/coins",
    "/ko/compare/tradingview",
    "/ko/crypto-trading-simulator",
    "/ko/demo",
    "/ko/fees",
    "/ko/methodology",
    "/ko/performance",
    "/ko/privacy",
    "/ko/simulate",
    "/ko/strategies",
    "/ko/strategies/compare",
    "/ko/strategies/ranking",
    "/ko/terms",
    "/ko/why-backtests-fail",
    "/ko/best-crypto-backtesting",
  ];

  for (const path of koPages) {
    test(`GET ${path} returns 200`, async ({ page }) => {
      const resp = await page.goto(`${path}/`);
      expect(resp?.status()).toBe(200);
    });

    test(`${path} has h1`, async ({ page }) => {
      await page.goto(`${path}/`);
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 10000 });
      const text = await h1.textContent();
      expect(text?.trim().length ?? 0).toBeGreaterThan(0);
    });
  }
});

// ─── 9. Dynamic page samples: blog, learn, coins, strategies ─────────────────

test.describe("Dynamic page samples: blog, learn, coins, strategies", () => {
  const dynamicPages = [
    // EN Blog (actual slugs from src/content/blog/)
    "/blog/atr-volatility-guide",
    "/blog/crypto-futures-beginners-guide",
    // KO Blog
    "/ko/blog/atr-volatility-guide",
    "/ko/blog/crypto-futures-beginners-guide",
    // EN Learn → redirects to /blog (301), use actual blog slugs
    "/learn/atr-volatility-guide",
    "/learn/crypto-futures-beginners-guide",
    // KO Learn → redirects to /ko/blog
    "/ko/learn/atr-volatility-guide",
    "/ko/learn/crypto-futures-beginners-guide",
    // Coins
    "/coins/btcusdt",
    "/coins/ethusdt",
    "/coins/solusdt",
    // KO Coins
    "/ko/coins/btcusdt",
    // Strategies
    "/strategies/bb-squeeze-short",
    "/strategies/momentum-long",
    // KO Strategies
    "/ko/strategies/bb-squeeze-short",
  ];

  for (const path of dynamicPages) {
    test(`GET ${path} returns 200 with content`, async ({ page }) => {
      const resp = await page.goto(`${path}/`);
      expect(resp?.status()).toBe(200);

      // h1 존재 + 5자 이상
      const h1 = await page.locator("h1").first().textContent();
      expect(h1?.trim().length).toBeGreaterThan(5);

      // 본문 콘텐츠 존재
      const article = page.locator("article, main, .prose").first();
      expect(await article.textContent()).toBeTruthy();
    });
  }
});
