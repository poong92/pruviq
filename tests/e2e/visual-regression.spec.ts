import { test, expect } from "@playwright/test";

/**
 * Visual Regression Tests — baseline 대비 픽셀 diff 비교
 *
 * 첫 실행 시: npx playwright test visual-regression --update-snapshots
 * 이후 PR에서: baseline 대비 diff가 있으면 CI 실패
 *
 * 커버리지:
 * - /rankings 카드 영역 (배지 겹침, 레이아웃 버그 방지)
 * - / 홈페이지 히어로
 * - /strategies 카드 그리드
 */

const THRESHOLD = { maxDiffPixelRatio: 0.02 }; // 2% 이하 변화는 허용

async function waitForHydration(page: any, timeout = 8000) {
  // Preact 하이드레이션 + API 응답 대기
  await page.waitForTimeout(timeout);
}

// ─── Rankings Page ─────────────────────────────────────────────────────────

test.describe("Rankings page — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("ranking cards layout — desktop", async ({ page }) => {
    await page.goto("/rankings", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    // 카드가 로드될 때까지 대기
    await page
      .waitForSelector(".grid > div, .grid > article", {
        timeout: 15000,
      })
      .catch(() => {});

    const section = page.locator("section").first();
    await expect(section).toHaveScreenshot(
      "rankings-best3-desktop.png",
      THRESHOLD,
    );
  });

  test("period + group filter buttons — desktop", async ({ page }) => {
    await page.goto("/rankings", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const filters = page.locator(".space-y-3").first();
    await expect(filters).toHaveScreenshot(
      "rankings-filters-desktop.png",
      THRESHOLD,
    );
  });

  test("rankings full page — mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/rankings", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page).toHaveScreenshot("rankings-full-mobile.png", {
      ...THRESHOLD,
      fullPage: true,
    });
  });
});

// ─── Homepage ──────────────────────────────────────────────────────────────

test.describe("Homepage — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("homepage hero — desktop", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const hero = page.locator("h1").first();
    const heroSection = hero.locator("..").locator("..");
    await expect(page).toHaveScreenshot("home-hero-desktop.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 600 },
    });
  });
});

// ─── Strategies Page ───────────────────────────────────────────────────────

test.describe("Strategies page — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("strategy card grid — desktop", async ({ page }) => {
    await page.goto("/strategies", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot("strategies-grid-desktop.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    });
  });
});
