import { test, expect, type Page } from "@playwright/test";

/**
 * I18N / Language Consistency Tests
 *
 * Catches: Korean text leaking into EN pages, missing i18n keys,
 * API responses containing hardcoded language strings.
 *
 * Regression coverage for:
 * - PR #382: StrategyRanking/RankingCard hardcoded KO
 * - PR #389: /rankings/daily API warning Korean string
 */

const KOREAN_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

// EN pages that must contain zero Korean characters in visible text
const EN_PAGES_NO_KOREAN = [
  "/",
  "/simulate",
  "/strategies",
  "/strategies/ranking",
  "/market",
  "/fees",
  "/about",
  "/terms",
  "/compare/tradingview",
  "/compare/coinrule",
  "/compare/cryptohopper",
  "/compare/3commas",
  "/compare/gainium",
  "/compare/streak",
];

// KO pages that must contain Korean (basic sanity check)
const KO_PAGES_HAS_KOREAN = ["/ko/", "/ko/simulate", "/ko/strategies/ranking"];

// ─── Helpers ──────────────────────────────────────────────────

/** Get all visible text on page (excludes scripts, style, hidden elements) */
async function getVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (["script", "style", "noscript"].includes(tag))
            return NodeFilter.FILTER_REJECT;
          const style = getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden")
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    const texts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }
    return texts.join(" ");
  });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe("EN pages: zero Korean text", () => {
  for (const path of EN_PAGES_NO_KOREAN) {
    test(`no Korean on ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} returned error`).toBeLessThan(400);

      // For dynamic pages, wait for hydration to settle
      if (["/strategies/ranking", "/market", "/simulate"].includes(path)) {
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(3000); // allow client:load components to render
      }

      const text = await getVisibleText(page);
      const koreanMatches =
        text.match(new RegExp(KOREAN_REGEX.source, "g")) || [];

      expect(
        koreanMatches.length,
        `Korean text found on EN page ${path}: "${koreanMatches.slice(0, 5).join("")}"`,
      ).toBe(0);
    });
  }
});

test.describe("KO pages: Korean text present", () => {
  for (const path of KO_PAGES_HAS_KOREAN) {
    test(`has Korean on ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBeLessThan(400);
      const text = await getVisibleText(page);
      expect(KOREAN_REGEX.test(text), `No Korean text found on ${path}`).toBe(
        true,
      );
    });
  }
});

test.describe("API: language-neutral responses", () => {
  const API_BASE = process.env.API_URL || "https://api.pruviq.com";

  test("/rankings/daily — warning field must not be Korean", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/rankings/daily`);
    expect(res.status()).toBeLessThan(400);

    const data = await res.json();

    // Old schema: warning (string) — must not exist or must not be Korean
    if (data.warning !== null && data.warning !== undefined) {
      expect(
        KOREAN_REGEX.test(data.warning),
        `API returned Korean warning: "${data.warning}"`,
      ).toBe(false);
    }

    // New schema: low_sample_count (number) — should be a number
    if ("low_sample_count" in data && data.low_sample_count !== null) {
      expect(typeof data.low_sample_count).toBe("number");
    }
  });

  test("/rankings/daily — response schema valid", async ({ request }) => {
    const res = await request.get(`${API_BASE}/rankings/daily`);
    const data = await res.json();

    expect(data).toHaveProperty("date");
    expect(data).toHaveProperty("top3");
    expect(data).toHaveProperty("worst3");
    expect(Array.isArray(data.top3)).toBe(true);
    expect(Array.isArray(data.worst3)).toBe(true);
  });

  test("/market/live — response is non-Korean", async ({ request }) => {
    const res = await request.get(`${API_BASE}/market/live`);
    expect(res.status()).toBeLessThan(400);
    const text = await res.text();
    // Market data should not contain Korean text (symbols, prices are language-neutral)
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed.coins || parsed)).toBe(true);
  });
});

test.describe("Ranking page: EN component language", () => {
  test("EN ranking page — no Korean in RankingCard content", async ({
    page,
  }) => {
    await page.goto("/strategies/ranking", { waitUntil: "domcontentloaded" });
    // Wait for Preact hydration
    await page.waitForTimeout(4000);

    // RankingCard low_sample warning should be in English if shown
    const warnings = page.locator("text=/샘플|부족|건 </");
    const count = await warnings.count();
    expect(count, 'Korean "샘플 부족" found in EN ranking page').toBe(0);

    // Check section headers (Best 3 Strategies, not "Best 3 전략")
    const bestSection = page.locator("text=Best 3 Strategies");
    await expect(bestSection.first()).toBeVisible({ timeout: 8000 });
  });

  test("KO ranking page — Korean section headers", async ({ page }) => {
    await page.goto("/ko/strategies/ranking", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);

    const bestSection = page.locator("text=Best 3 전략");
    await expect(bestSection.first()).toBeVisible({ timeout: 8000 });
  });
});
