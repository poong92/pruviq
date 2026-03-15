import { test, expect } from "@playwright/test";

/**
 * Visual Snapshot Tests — EN + KO × Desktop + Mobile
 *
 * PR마다 주요 페이지 풀스크린샷 자동 캡처 → artifacts에서 확인.
 * 렌더링 문제(레이아웃 깨짐, 이모지, 텍스트 잘림, KO 누락 등)를
 * 코드 분석만으로 놓치는 것을 방지하기 위한 근본 해결책.
 *
 * 커버리지:
 * - EN desktop (1280×720): 10 pages
 * - KO desktop (1280×720): 4 pages
 * - EN mobile (375×812):   6 pages
 * - KO mobile (375×812):   3 pages
 */

const DESKTOP_EN = [
  { path: "/", name: "home" },
  { path: "/simulate", name: "simulate" },
  { path: "/strategies", name: "strategies" },
  { path: "/strategies/ranking", name: "strategies-ranking" },
  { path: "/compare", name: "compare" },
  { path: "/compare/tradingview", name: "compare-tradingview" },
  { path: "/market", name: "market" },
  { path: "/fees", name: "fees" },
  { path: "/about", name: "about" },
  { path: "/learn", name: "learn" },
];

const DESKTOP_KO = [
  { path: "/ko/", name: "ko-home" },
  { path: "/ko/simulate", name: "ko-simulate" },
  { path: "/ko/strategies/ranking", name: "ko-strategies-ranking" },
  { path: "/ko/compare", name: "ko-compare" },
];

const MOBILE_EN = [
  { path: "/", name: "home" },
  { path: "/simulate", name: "simulate" },
  { path: "/strategies", name: "strategies" },
  { path: "/compare", name: "compare" },
  { path: "/market", name: "market" },
  { path: "/fees", name: "fees" },
];

const MOBILE_KO = [
  { path: "/ko/", name: "ko-home" },
  { path: "/ko/simulate", name: "ko-simulate" },
  { path: "/ko/strategies/ranking", name: "ko-strategies-ranking" },
];

// ─── Helpers ──────────────────────────────────────────────────

async function capture(page: any, name: string, suffix: string) {
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `playwright-report/screenshots/${name}-${suffix}.png`,
    fullPage: true,
  });
}

async function basicSanity(page: any, path: string) {
  // Page must have a title (catches blank/error pages)
  const title = await page.title();
  expect(title.length, `${path} has empty title`).toBeGreaterThan(0);
  // Note: i18n key completeness is validated by the dedicated CI step (check-i18n-keys.ts)
}

// ─── Desktop EN ───────────────────────────────────────────────

test.describe("Desktop EN — full page snapshots", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const { path, name } of DESKTOP_EN) {
    test(`en/desktop: ${name}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 200).toBeLessThan(400);
      await capture(page, name, "en-desktop");
      await basicSanity(page, path);
    });
  }
});

// ─── Desktop KO ───────────────────────────────────────────────

test.describe("Desktop KO — full page snapshots", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const { path, name } of DESKTOP_KO) {
    test(`ko/desktop: ${name}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 200).toBeLessThan(400);
      await capture(page, name, "ko-desktop");
      await basicSanity(page, path);
    });
  }
});

// ─── Mobile EN ────────────────────────────────────────────────

test.describe("Mobile EN — full page snapshots", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  for (const { path, name } of MOBILE_EN) {
    test(`en/mobile: ${name}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 200).toBeLessThan(400);
      await capture(page, name, "en-mobile");
      await basicSanity(page, path);
    });
  }

  test("en/mobile: hamburger menu open", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click();
    await page.locator("#mobile-menu").waitFor({ state: "visible" });
    await page.screenshot({
      path: "playwright-report/screenshots/home-menu-open-en-mobile.png",
      fullPage: false,
    });
  });
});

// ─── Mobile KO ────────────────────────────────────────────────

test.describe("Mobile KO — full page snapshots", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  for (const { path, name } of MOBILE_KO) {
    test(`ko/mobile: ${name}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 200).toBeLessThan(400);
      await capture(page, name, "ko-mobile");
      await basicSanity(page, path);
    });
  }

  test("ko/mobile: hamburger menu open", async ({ page }) => {
    await page.goto("/ko/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click();
    await page.locator("#mobile-menu").waitFor({ state: "visible" });
    await page.screenshot({
      path: "playwright-report/screenshots/home-menu-open-ko-mobile.png",
      fullPage: false,
    });
  });
});

// ─── GNB Interaction Snapshots ────────────────────────────────

test.describe("GNB interactions", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("desktop: Strategies dropdown visible on hover", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const strategiesItem = page.locator("nav .hidden.md\\:flex .group").first();
    await strategiesItem.hover();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: "playwright-report/screenshots/nav-strategies-dropdown-en-desktop.png",
      fullPage: false,
    });
  });
});
