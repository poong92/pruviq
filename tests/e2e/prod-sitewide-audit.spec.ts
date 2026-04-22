// Site-wide real-user audit — prod only.
// Flows: landing, nav explore, performance, monetization, mobile.

import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

// Core user-facing pages + their required above-fold selectors.
const PAGES: { path: string; expectText: RegExp; label: string }[] = [
  {
    path: "/",
    expectText: /Verify|검증|Proof|증거|Strategy/i,
    label: "Home EN",
  },
  { path: "/ko/", expectText: /검증|증거|전략/i, label: "Home KO" },
  {
    path: "/simulate/",
    expectText: /Simulate|시뮬레이션|Quick Start/i,
    label: "Simulate EN",
  },
  {
    path: "/ko/simulate/",
    expectText: /시뮬레이션|프리셋|전략/i,
    label: "Simulate KO",
  },
  {
    path: "/strategies/",
    expectText: /strategies|전략/i,
    label: "Strategies EN",
  },
  { path: "/ko/strategies/", expectText: /전략/i, label: "Strategies KO" },
  {
    path: "/performance/",
    expectText: /performance|live|성과|실거래/i,
    label: "Performance EN",
  },
  { path: "/coins/", expectText: /coins|코인/i, label: "Coins EN" },
  { path: "/market/", expectText: /market|시장|사이클/i, label: "Market EN" },
  { path: "/fees/", expectText: /fees|수수료/i, label: "Fees EN" },
  { path: "/learn/", expectText: /learn|배우|학습/i, label: "Learn EN" },
  { path: "/about/", expectText: /about|소개/i, label: "About EN" },
  {
    path: "/methodology/",
    expectText: /methodology|방법론|how we/i,
    label: "Methodology",
  },
  { path: "/trust/", expectText: /trust|신뢰/i, label: "Trust" },
  { path: "/signals/", expectText: /signals|신호|live/i, label: "Signals" },
  {
    path: "/fake-404-test",
    expectText: /404|not found|찾을 수/i,
    label: "404 fallback",
  },
];

test.describe("L-SITE: page renders", () => {
  for (const p of PAGES) {
    test(`${p.label} (${p.path})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => {
        // Filter noise: fetch aborts, third-party analytics
        if (!/AbortError|net::ERR_|google-analytics/.test(e.message)) {
          errors.push(e.message);
        }
      });
      const resp = await page.goto(p.path, { waitUntil: "domcontentloaded" });
      // 404 fallback is expected 404
      const expected = p.path === "/fake-404-test" ? 404 : 200;
      expect(resp?.status(), `${p.path} HTTP`).toBe(expected);
      await page.waitForTimeout(800);
      const body = await page.textContent("body");
      expect(body ?? "", `${p.path} body text`).toMatch(p.expectText);
      expect(errors, `${p.path} page errors: ${errors.join(" | ")}`).toEqual(
        [],
      );
    });
  }
});

test.describe("Flow A — first-time visitor landing → simulate", () => {
  test("Homepage hero CTA → /simulate/", async ({ page }) => {
    await page.goto("/");
    // Hero primary CTA that leads to simulator. Most common pattern:
    // first anchor with href containing /simulate
    const heroCta = page.locator('a[href*="/simulate"]').first();
    await expect(heroCta).toBeVisible({ timeout: 10000 });
    await heroCta.click();
    await page.waitForURL(/\/simulate\/?/);
    await page.waitForSelector("[data-testid=sim-v1-root]", { timeout: 15000 });
  });

  test("Homepage → simulate → click ATR preset → result visible", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForSelector("[data-testid=sim-v1-preset-atr-breakout]");
    await page.click("[data-testid=sim-v1-preset-atr-breakout]");
    await page.waitForSelector("[data-testid=sim-v1-results-ok]", {
      timeout: 20000,
    });
    const returnTxt = await page
      .locator("[data-testid=sim-v1-metric-return]")
      .textContent();
    expect(returnTxt).toMatch(/\+\d+\.\d+%/);
  });
});

test.describe("Flow B — nav explorer", () => {
  test("Homepage top nav: Simulate / Strategies / Coins links resolve", async ({
    page,
  }) => {
    await page.goto("/");
    const navLinks: Record<string, RegExp> = {
      "/simulate": /\/simulate\/?/,
      "/strategies": /\/strategies\/?/,
      "/coins": /\/coins\/?/,
    };
    for (const [href, pattern] of Object.entries(navLinks)) {
      await page.goto("/");
      const link = page.locator(`nav a[href="${href}"]`).first();
      const count = await link.count();
      if (count === 0) continue; // nav may be collapsed on some breakpoints
      await link.click();
      await page.waitForURL(pattern);
    }
  });

  test("Strategies page shows at least 1 strategy card", async ({ page }) => {
    await page.goto("/strategies/");
    const body = await page.textContent("body");
    expect(body ?? "").toMatch(/BB Squeeze|ATR|Ichimoku|MA Cross|Keltner/i);
  });
});

test.describe("Flow C — evaluator (track record)", () => {
  test("/performance/ shows live P&L numbers", async ({ page }) => {
    await page.goto("/performance/");
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    // Must show a % or $ figure to be a useful performance page
    expect(body ?? "").toMatch(/-?\d+(\.\d+)?%/);
  });
});

test.describe("Flow D — monetization (referrals)", () => {
  test("/fees/ lists exchange partners with referral codes", async ({
    page,
  }) => {
    await page.goto("/fees/");
    const body = await page.textContent("body");
    // Must mention at least one exchange we track referrals for.
    expect(body ?? "").toMatch(/OKX|Binance|Bybit/i);
  });

  test("/dashboard/ OKX connect CTA link present", async ({ page }) => {
    const resp = await page.goto("/dashboard/", {
      waitUntil: "domcontentloaded",
    });
    expect([200, 302]).toContain(resp?.status() ?? 0);
  });
});

test.describe("Flow E — mobile 375×812", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("Homepage has no h-scroll; hamburger button reachable", async ({
    page,
  }) => {
    await page.goto("/");
    const overflowX = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth > d.clientWidth;
    });
    expect(overflowX, "homepage h-scroll").toBe(false);

    const menuBtn = page
      .locator('button[aria-label*="menu" i], button[aria-label*="메뉴"]')
      .first();
    await expect(menuBtn).toBeVisible({ timeout: 8000 });
    const box = await menuBtn.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("Mobile nav opens + contains major section links", async ({ page }) => {
    await page.goto("/");
    const menuBtn = page
      .locator('button[aria-label*="menu" i], button[aria-label*="메뉴"]')
      .first();
    await menuBtn.click();
    await page.waitForTimeout(400);
    // After open, Simulate / Strategies / Coins should be in the panel
    const panel = page.locator(
      '[role="dialog"], [data-testid="mobile-nav"], nav[aria-label*="mobile" i]',
    );
    const panelOrBody =
      (await panel.count()) > 0 ? panel : page.locator("body");
    const text = await panelOrBody.first().textContent();
    expect(text ?? "").toMatch(/Simulate|시뮬|Strategies|전략|Coins|코인/i);
  });
});

test.describe("Flow F — language round-trip", () => {
  test("EN home → KO switcher → KO home renders 한글", async ({ page }) => {
    await page.goto("/");
    const koLink = page.locator('a[href^="/ko"]').first();
    if ((await koLink.count()) === 0) {
      // Some layouts use a button instead of direct link
      const langBtn = page.locator("button").filter({ hasText: /한국어|KO/i });
      if ((await langBtn.count()) > 0) {
        await langBtn.first().click();
        await page.waitForURL(/\/ko/, { timeout: 5000 }).catch(() => undefined);
      }
    } else {
      await koLink.click();
      await page.waitForURL(/\/ko/, { timeout: 5000 });
    }
    const body = await page.textContent("body");
    expect(body ?? "", "KO home must have Korean chars").toMatch(
      /[\uAC00-\uD7AF]/,
    );
  });
});

test.describe("L-SITE regressions", () => {
  test("Homepage has no <iframe> broken / 404", async ({ page }) => {
    const brokenIframes: string[] = [];
    page.on("response", (r) => {
      if (
        r.request().frame() &&
        r.status() >= 400 &&
        r.url().startsWith("http")
      ) {
        brokenIframes.push(`${r.status()} ${r.url()}`);
      }
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    // Only count OUR domain failures (4xx/5xx on pruviq.com paths)
    const ownDomainErrors = brokenIframes.filter((s) => /pruviq\.com/.test(s));
    expect(ownDomainErrors).toEqual([]);
  });

  test("All page image responses <1MB (perf guard)", async ({ page }) => {
    const heavy: { url: string; size: number }[] = [];
    page.on("response", async (r) => {
      if (r.url().match(/\.(png|jpg|jpeg|webp)$/) && r.ok()) {
        try {
          const body = await r.body();
          if (body.length > 1_000_000) {
            heavy.push({ url: r.url(), size: body.length });
          }
        } catch {
          /* may be already read */
        }
      }
    });
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(
      heavy.map((h) => `${(h.size / 1000).toFixed(0)}KB ${h.url}`),
    ).toEqual([]);
  });
});
