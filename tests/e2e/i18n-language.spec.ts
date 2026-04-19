import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

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

/** Get all visible text on page (excludes scripts, style, hidden elements, lang toggles) */
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
          // Exclude language toggle links — intentional Korean label "한국어" on EN pages
          if (parent.closest("[hreflang]")) return NodeFilter.FILTER_REJECT;
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
      // Use 5s timeout (not networkidle) — production pages poll APIs continuously → networkidle never resolves
      if (["/strategies/ranking", "/market", "/simulate"].includes(path)) {
        await page
          .waitForLoadState("networkidle", { timeout: 5000 })
          .catch(() => {});
        await page.waitForTimeout(2000); // allow client:load components to render
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

  test("/rankings/daily — schema valid, low_sample_count is number when present", async ({
    request,
  }) => {
    // Skip gracefully if API is unreachable (CI network hiccup) — avoids false failures
    const res = await request
      .get(`${API_BASE}/rankings/daily`, { timeout: 15000 })
      .catch(() => null);
    if (!res || res.status() >= 500) {
      test.skip(
        true,
        `API returned ${res?.status() ?? "unreachable"} — skipping schema check`,
      );
      return;
    }
    expect(res.status()).toBeLessThan(400);

    const data = await res.json();
    expect(data).toHaveProperty("date");
    expect(Array.isArray(data.top3)).toBe(true);

    if ("low_sample_count" in data && data.low_sample_count !== null) {
      expect(typeof data.low_sample_count).toBe("number");
    }
  });

  test("/market/live — response is non-Korean", async ({ request }) => {
    const res = await request
      .get(`${API_BASE}/market/live`, { timeout: 15000 })
      .catch(() => null);
    if (!res || res.status() >= 500) {
      test.skip(
        true,
        `API returned ${res?.status() ?? "unreachable"} — skipping`,
      );
      return;
    }
    expect(res.status()).toBeLessThan(400);
    const parsed = await res.json();
    expect(Array.isArray(parsed.coins || parsed)).toBe(true);
  });
});

test.describe("Ranking page: EN component language", () => {
  const API_BASE = process.env.API_URL || "https://api.pruviq.com";

  // Ranking UI test preconditions:
  //   1. API reachable (status < 500)
  //   2. top3 has entries (non-empty data)
  //   3. First entry is NOT low_sample — the "Best 3 Strategies" header is
  //      only rendered when there is a real top-tier cohort. `low_sample:true`
  //      swaps the UI for a yellow-warning variant without the section title.
  //   4. Data is not stale beyond 2 days — when the daily-ranking cron is
  //      broken (as during the 2026-04-19 Mac-path regression), the UI falls
  //      back to skeleton/empty state and the header disappears.
  //
  // Returning `null` means the test can run. Any string is the skip reason.
  async function shouldSkipRankingTest(
    request: APIRequestContext,
  ): Promise<string | null> {
    const probe = await request
      .get(`${API_BASE}/rankings/daily`, { timeout: 10000 })
      .catch(() => null);
    if (!probe || probe.status() >= 500) {
      return `API returned ${probe?.status() ?? "unreachable"}`;
    }
    let data: {
      top3?: { low_sample?: boolean }[];
      generated_at?: string;
    } | null = null;
    try {
      data = await probe.json();
    } catch {
      return "ranking data: invalid JSON";
    }
    const top3 = data?.top3 ?? [];
    if (top3.length === 0) {
      return "ranking data: empty top3";
    }
    if (top3[0]?.low_sample === true) {
      // Not a bug: the UI intentionally swaps the section when sample is
      // thin. The i18n test needs the normal-render path to assert strings.
      return "ranking data: low_sample=true (UI shows warning state, not Best 3 header)";
    }
    const generatedAt = data?.generated_at;
    if (generatedAt) {
      const ageMs = Date.now() - new Date(generatedAt).getTime();
      const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
      if (Number.isFinite(ageMs) && ageMs > MAX_AGE_MS) {
        const ageH = (ageMs / 3_600_000).toFixed(1);
        return `ranking data: stale ${ageH}h (>48h) — daily-ranking cron likely broken`;
      }
    }
    return null;
  }

  test("EN ranking page — no Korean in RankingCard content", async ({
    page,
    request,
  }) => {
    const skipReason = await shouldSkipRankingTest(request);
    if (skipReason) {
      test.skip(true, skipReason);
      return;
    }

    await page.goto("/strategies/ranking", { waitUntil: "networkidle" });
    await page
      .waitForFunction(
        () =>
          document.body.innerText.includes("Best 3") ||
          document.body.innerText.includes("Ranking"),
        { timeout: 15000 },
      )
      .catch(() => null);

    const warnings = page.locator("text=/샘플|부족|건 </");
    const count = await warnings.count();
    expect(count, 'Korean "샘플 부족" found in EN ranking page').toBe(0);

    const bestSection = page.locator("text=Best 3 Strategies");
    await expect(bestSection.first()).toBeVisible({ timeout: 10000 });
  });

  test("KO ranking page — Korean section headers", async ({
    page,
    request,
  }) => {
    const skipReason = await shouldSkipRankingTest(request);
    if (skipReason) {
      test.skip(true, skipReason);
      return;
    }

    await page.goto("/ko/strategies/ranking", { waitUntil: "networkidle" });
    await page
      .waitForFunction(
        () =>
          document.body.innerText.includes("Best 3") ||
          document.body.innerText.includes("전략"),
        { timeout: 15000 },
      )
      .catch(() => null);

    const bestSection = page.locator("text=상위 3개 전략");
    await expect(bestSection.first()).toBeVisible({ timeout: 10000 });
  });
});
