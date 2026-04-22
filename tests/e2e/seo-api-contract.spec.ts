/**
 * SEO Validation + API Schema Contract Tests
 *
 * - JSON-LD structured data
 * - Meta tags completeness
 * - hreflang pairing
 * - API response schema contracts
 * - sitemap.xml + robots.txt
 */

import { test, expect } from "@playwright/test";

const IS_PROD = (process.env.BASE_URL ?? "").includes("pruviq.com");
const API = "https://api.pruviq.com";

test.describe("SEO Validation", () => {
  test.skip(!IS_PROD, "Prod only");

  const jsonLdPages = [
    { path: "/", label: "Homepage" },
    { path: "/simulate/", label: "Simulate" },
    { path: "/strategies/", label: "Strategies" },
  ];

  for (const { path, label } of jsonLdPages) {
    test(`${label} (${path}) has valid JSON-LD structured data`, async ({
      page,
    }) => {
      await page.goto(path);
      const scripts = page.locator('script[type="application/ld+json"]');
      const count = await scripts.count();
      expect(count, `${path} must have JSON-LD`).toBeGreaterThan(0);

      const text = await scripts.first().textContent();
      const data = JSON.parse(text!);
      expect(data["@context"]).toContain("schema.org");
      expect(data["@type"]).toBeTruthy();
      expect(
        data.name || data.headline,
        `${path} JSON-LD must have name or headline`,
      ).toBeTruthy();
    });
  }

  test("Key pages have meta title (>10 chars) + description (>20 chars)", async ({
    page,
  }) => {
    const pages = [
      "/",
      "/simulate/",
      "/strategies/",
      "/coins/",
      "/market/",
      "/learn/",
      "/fees/",
    ];
    for (const p of pages) {
      await page.goto(p);
      const title = await page.title();
      expect(title.length, `${p} title too short`).toBeGreaterThan(10);

      const desc = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(desc?.length ?? 0, `${p} description too short`).toBeGreaterThan(
        20,
      );
    }
  });

  test("Homepage has og:image", async ({ page }) => {
    await page.goto("/");
    // 2026-04-22: page now ships og:image twice (jpg + webp for modern
    // clients). Strict locator would fail on duplicates — .first() is
    // fine because both satisfy the contract (non-empty + http URL).
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute("content");
    expect(ogImage, "og:image must be set").toBeTruthy();
    expect(ogImage).toMatch(/^https?:\/\//);
  });

  test("hreflang tags paired: en ↔ ko on key pages", async ({ page }) => {
    const pages = ["/", "/simulate/", "/strategies/"];
    for (const p of pages) {
      await page.goto(p);
      const enHref = await page
        .locator('link[hreflang="en"]')
        .first()
        .getAttribute("href");
      const koHref = await page
        .locator('link[hreflang="ko"]')
        .first()
        .getAttribute("href");
      expect(enHref, `${p} missing en hreflang`).toBeTruthy();
      expect(koHref, `${p} missing ko hreflang`).toBeTruthy();
      expect(koHref).toContain("/ko");
    }
  });

  test("KO homepage has reciprocal hreflang back to EN", async ({ page }) => {
    await page.goto("/ko/");
    const enHref = await page
      .locator('link[hreflang="en"]')
      .first()
      .getAttribute("href");
    const koHref = await page
      .locator('link[hreflang="ko"]')
      .first()
      .getAttribute("href");
    expect(enHref, "KO page missing hreflang=en").toBeTruthy();
    expect(koHref, "KO page missing hreflang=ko").toBeTruthy();
    expect(enHref).not.toContain("/ko");
  });

  test("sitemap index exists and has sitemap files", async ({ request }) => {
    // Astro generates sitemap-index.xml → sitemap-0.xml
    const resp = await request.get("https://pruviq.com/sitemap-index.xml");
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain("<sitemapindex");
    expect(text).toContain("<loc>");

    // Fetch actual sitemap
    const match = text.match(/<loc>([^<]+sitemap-0\.xml)<\/loc>/);
    expect(match).toBeTruthy();
    const sitemapResp = await request.get(match![1]);
    expect(sitemapResp.ok()).toBeTruthy();
    const sitemapText = await sitemapResp.text();
    const urlCount = (sitemapText.match(/<loc>/g) || []).length;
    expect(urlCount).toBeGreaterThan(50);

    // Must include key pages
    expect(sitemapText).toContain("/simulate");
    expect(sitemapText).toContain("/strategies");
    expect(sitemapText).toContain("/coins");
  });

  test("robots.txt allows crawling", async ({ request }) => {
    const resp = await request.get("https://pruviq.com/robots.txt");
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain("Sitemap:");
    // Should not blanket disallow all
    expect(text).not.toMatch(/Disallow:\s*\/\s*$/m);
    // Should not block key content paths
    expect(text).not.toContain("Disallow: /simulate");
    expect(text).not.toContain("Disallow: /strategies");
    expect(text).not.toContain("Disallow: /coins");
    expect(text).not.toContain("Disallow: /market");
    expect(text).not.toContain("Disallow: /learn");
  });
});

test.describe("API Schema Contract", () => {
  test.skip(!IS_PROD, "Prod only");

  test("GET /health returns required fields", async ({ request }) => {
    const resp = await request.get(`${API}/health`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data).toHaveProperty("status");
    expect(data.status).toBe("ok");
    expect(data).toHaveProperty("coins_loaded");
    // 2026-04-22: bound relaxed after Binance→OKX migration (238 coins,
    // previously 574). Canonical source: backend STRATEGY_REGISTRY +
    // OKX perpetual listings. ~200 is safe floor for regressions.
    expect(data.coins_loaded).toBeGreaterThanOrEqual(200);
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("uptime_seconds");
    expect(data.uptime_seconds).toBeGreaterThan(0);
  });

  test("GET /coins returns 200+ coins with required fields", async ({
    request,
  }) => {
    const resp = await request.get(`${API}/coins`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(200);

    // Sample coin structure
    const coin = data[0];
    expect(coin).toHaveProperty("symbol");
    expect(coin.symbol.length).toBeGreaterThan(2);
  });

  test("POST /simulate returns complete schema", async ({ request }) => {
    const resp = await request.post(`${API}/simulate`, {
      data: {
        strategy: "bb-squeeze",
        direction: "short",
        sl_pct: 10,
        tp_pct: 8,
        top_n: 50,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Required fields
    const required = [
      "total_trades",
      "win_rate",
      "profit_factor",
      "max_drawdown_pct",
      "total_return_pct",
      "tp_count",
      "sl_count",
      "timeout_count",
      "equity_curve",
      "coin_results",
    ];
    for (const field of required) {
      expect(data, `Missing field: ${field}`).toHaveProperty(field);
    }

    // Range validation
    expect(data.win_rate).toBeGreaterThanOrEqual(0);
    expect(data.win_rate).toBeLessThanOrEqual(100);
    expect(data.max_drawdown_pct).toBeLessThanOrEqual(100);
    expect(data.profit_factor).toBeGreaterThanOrEqual(0);
    expect(data.total_trades).toBeGreaterThan(0);

    // Equity curve structure
    expect(Array.isArray(data.equity_curve)).toBe(true);
    if (data.equity_curve.length > 0) {
      const point = data.equity_curve[0];
      expect(point).toHaveProperty("time");
      expect(point).toHaveProperty("value");
    }

    // Coin results
    expect(Array.isArray(data.coin_results)).toBe(true);
    expect(data.coin_results.length).toBeGreaterThan(0);
  });

  test("POST /backtest returns complete schema", async ({ request }) => {
    const resp = await request.post(`${API}/backtest`, {
      data: {
        name: "SEO Contract Test",
        direction: "short",
        indicators: {
          bb: { period: 20, std: 2 },
          ema: {},
          volume: {},
          candle: {},
        },
        entry: {
          type: "AND",
          conditions: [
            { indicator: "bb", field: "squeeze", op: "==", value: true },
          ],
        },
        sl_pct: 10,
        tp_pct: 8,
        max_bars: 48,
        top_n: 30,
      },
    });
    expect(resp.ok(), `backtest returned ${resp.status()}`).toBeTruthy();
    const data = await resp.json();

    // Required fields from BacktestResponse schema
    const required = [
      "name",
      "direction",
      "sl_pct",
      "tp_pct",
      "total_trades",
      "win_rate",
      "profit_factor",
      "max_drawdown_pct",
      "total_return_pct",
      "tp_count",
      "sl_count",
      "timeout_count",
      "sharpe_ratio",
      "coins_used",
      "data_range",
      "equity_curve",
    ];
    for (const field of required) {
      expect(data, `Missing field: ${field}`).toHaveProperty(field);
    }

    // Range validation
    expect(data.win_rate).toBeGreaterThanOrEqual(0);
    expect(data.win_rate).toBeLessThanOrEqual(100);
    expect(data.total_trades).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.equity_curve)).toBe(true);
  });

  test("POST /simulate with invalid params → 422", async ({ request }) => {
    const resp = await request.post(`${API}/simulate`, {
      data: { strategy: "nonexistent", direction: "short", sl_pct: -1 },
    });
    expect(resp.status()).toBe(422);
  });

  test("GET /indicators returns indicator list", async ({ request }) => {
    const resp = await request.get(`${API}/indicators`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(typeof data).toBe("object");
    // Should have at least 10 indicators
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(10);
  });

  test("GET /builder/presets returns presets", async ({ request }) => {
    const resp = await request.get(`${API}/builder/presets`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(10);

    // Each preset has required fields
    const preset = data[0];
    expect(preset).toHaveProperty("id");
    expect(preset).toHaveProperty("name");
    expect(preset).toHaveProperty("direction");
  });

  test("GET /rankings/daily returns fresh data", async ({ request }) => {
    const resp = await request.get(`${API}/rankings/daily`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty("date");
    expect(data).toHaveProperty("top3");
    expect(Array.isArray(data.top3)).toBe(true);
    expect(data.top3.length).toBeGreaterThan(0);
  });
});
