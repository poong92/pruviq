import { test, expect } from "@playwright/test";
import { mkdirSync } from "fs";

const SAVE_DIR = "tests/visual-baselines";
mkdirSync(SAVE_DIR, { recursive: true });

// ─── Page Lists ───────────────────────────────────────────────

const EN_PAGES = [
  { path: "/", name: "home" },
  { path: "/about", name: "about" },
  { path: "/autotrading", name: "autotrading" },
  { path: "/best-crypto-backtesting", name: "best-crypto-backtesting" },
  { path: "/blog", name: "blog" },
  { path: "/blog/atr-volatility-guide", name: "blog-atr-volatility-guide" },
  // /builder → 301 redirect to /simulate/ (skip: evaluate fails on redirected context)
  { path: "/changelog", name: "changelog" },
  { path: "/coins", name: "coins" },
  { path: "/coins/btc", name: "coins-btc" },
  { path: "/compare", name: "compare" },
  { path: "/compare/3commas", name: "compare-3commas" },
  // /compare/binance-vs-okx → 301 redirect to /fees (skip: same reason)
  { path: "/compare/coinrule", name: "compare-coinrule" },
  { path: "/compare/cryptohopper", name: "compare-cryptohopper" },
  { path: "/compare/gainium", name: "compare-gainium" },
  { path: "/compare/streak", name: "compare-streak" },
  { path: "/compare/tradingview", name: "compare-tradingview" },
  { path: "/crypto-trading-simulator", name: "crypto-trading-simulator" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/fees", name: "fees" },
  { path: "/leaderboard", name: "leaderboard" },
  { path: "/market", name: "market" },
  { path: "/methodology", name: "methodology" },
  { path: "/performance", name: "performance" },
  { path: "/privacy", name: "privacy" },
  { path: "/signals", name: "signals" },
  { path: "/simulate", name: "simulate" },
  { path: "/simulate/builder", name: "simulate-builder" },
  { path: "/strategies", name: "strategies" },
  { path: "/strategies/bb-squeeze-long", name: "strategies-bb-squeeze-long" },
  { path: "/strategies/compare", name: "strategies-compare" },
  { path: "/strategies/ranking", name: "strategies-ranking" },
  { path: "/terms", name: "terms" },
  { path: "/trust", name: "trust" },
  { path: "/why-backtests-fail", name: "why-backtests-fail" },
];

const KO_PAGES = EN_PAGES.map(({ path, name }) => ({
  path: path === "/" ? "/ko/" : `/ko${path}`,
  name: `ko-${name}`,
}));

// Light-mode inspection: key pages only (EN + KO)
const LIGHT_PAGES_EN = [
  { path: "/", name: "home" },
  { path: "/simulate", name: "simulate" },
  { path: "/strategies", name: "strategies" },
  { path: "/compare", name: "compare" },
  { path: "/market", name: "market" },
  { path: "/fees", name: "fees" },
  { path: "/about", name: "about" },
  { path: "/coins", name: "coins" },
  { path: "/performance", name: "performance" },
  { path: "/methodology", name: "methodology" },
];

const LIGHT_PAGES_KO = LIGHT_PAGES_EN.map(({ path, name }) => ({
  path: path === "/" ? "/ko/" : `/ko${path}`,
  name: `ko-${name}`,
}));

// ─── Helpers ──────────────────────────────────────────────────

async function gotoPage(page: any, path: string) {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(res?.status() ?? 200).toBeLessThan(400);
}

async function capture(page: any, name: string, suffix: string) {
  // Force all reveal/reveal-child elements visible so below-fold content
  // isn't hidden by IntersectionObserver animations in full-page screenshots.
  await page.evaluate(() => {
    document
      .querySelectorAll(".reveal, .reveal-child")
      .forEach((el) => el.classList.add("visible"));
  });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${SAVE_DIR}/${name}-${suffix}.png`,
    fullPage: true,
  });
}

async function basicSanity(page: any, path: string) {
  const title = await page.title();
  expect(title.length, `${path} has empty title`).toBeGreaterThan(0);
}

// ─── Dark Desktop EN ──────────────────────────────────────────

test.describe("Dark Desktop EN", () => {
  test.use({ viewport: { width: 1280, height: 720 }, colorScheme: "dark" });

  for (const { path, name } of EN_PAGES) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "en-desktop");
      await basicSanity(page, path);
    });
  }
});

// ─── Dark Desktop KO ──────────────────────────────────────────

test.describe("Dark Desktop KO", () => {
  test.use({ viewport: { width: 1280, height: 720 }, colorScheme: "dark" });

  for (const { path, name } of KO_PAGES) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "ko-desktop");
      await basicSanity(page, path);
    });
  }
});

// ─── Dark Mobile EN ───────────────────────────────────────────

test.describe("Dark Mobile EN", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });

  for (const { path, name } of EN_PAGES) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "en-mobile");
      await basicSanity(page, path);
    });
  }

  test("home: hamburger menu open", async ({ page }) => {
    await gotoPage(page, "/");
    await page.locator("#mobile-menu-btn").click();
    await page.locator("#mobile-menu").waitFor({ state: "visible" });
    await page.screenshot({
      path: `${SAVE_DIR}/home-menu-open-en-mobile.png`,
      fullPage: false,
    });
  });
});

// ─── Dark Mobile KO ───────────────────────────────────────────

test.describe("Dark Mobile KO", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });

  for (const { path, name } of KO_PAGES) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "ko-mobile");
      await basicSanity(page, path);
    });
  }

  test("ko-home: hamburger menu open", async ({ page }) => {
    await gotoPage(page, "/ko/");
    await page.locator("#mobile-menu-btn").click();
    await page.locator("#mobile-menu").waitFor({ state: "visible" });
    await page.screenshot({
      path: `${SAVE_DIR}/home-menu-open-ko-mobile.png`,
      fullPage: false,
    });
  });
});

// ─── Light Desktop EN ─────────────────────────────────────────

test.describe("Light Desktop EN", () => {
  test.use({ viewport: { width: 1280, height: 720 }, colorScheme: "light" });

  for (const { path, name } of LIGHT_PAGES_EN) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "en-desktop-light");
      await basicSanity(page, path);
    });
  }
});

// ─── Light Desktop KO ─────────────────────────────────────────

test.describe("Light Desktop KO", () => {
  test.use({ viewport: { width: 1280, height: 720 }, colorScheme: "light" });

  for (const { path, name } of LIGHT_PAGES_KO) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "ko-desktop-light");
      await basicSanity(page, path);
    });
  }
});

// ─── Light Mobile EN ──────────────────────────────────────────

test.describe("Light Mobile EN", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });

  for (const { path, name } of LIGHT_PAGES_EN) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "en-mobile-light");
      await basicSanity(page, path);
    });
  }
});

// ─── Light Mobile KO ──────────────────────────────────────────

test.describe("Light Mobile KO", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });

  for (const { path, name } of LIGHT_PAGES_KO) {
    test(name, async ({ page }) => {
      await gotoPage(page, path);
      await capture(page, name, "ko-mobile-light");
      await basicSanity(page, path);
    });
  }
});

// ─── GNB Interactions ─────────────────────────────────────────

test.describe("GNB interactions", () => {
  test.use({ viewport: { width: 1280, height: 720 }, colorScheme: "dark" });

  test("desktop: Strategies dropdown visible on hover", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const strategiesItem = page.locator("nav .hidden.md\\:flex .group").first();
    await strategiesItem.hover();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${SAVE_DIR}/nav-strategies-dropdown-en-desktop.png`,
      fullPage: false,
    });
  });
});
