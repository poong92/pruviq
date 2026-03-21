import { test } from '@playwright/test';

const BASE = 'https://pruviq.com';
const OUT = 'docs/design-references/as-is';

const pages = [
  // 핵심
  { name: 'home-en', path: '/' },
  { name: 'simulate-en', path: '/simulate' },
  { name: 'market-en', path: '/market' },
  { name: 'coins-en', path: '/coins' },
  // 전략
  { name: 'strategies-index-en', path: '/strategies' },
  { name: 'strategies-ranking-en', path: '/strategies/ranking' },
  { name: 'strategies-compare-en', path: '/strategies/compare' },
  // 리더보드
  { name: 'leaderboard-en', path: '/leaderboard' },
  // 비교
  { name: 'compare-index-en', path: '/compare' },
  { name: 'compare-tradingview-en', path: '/compare/tradingview' },
  { name: 'compare-3commas-en', path: '/compare/3commas' },
  // 콘텐츠
  { name: 'learn-en', path: '/learn' },
  { name: 'blog-en', path: '/blog' },
  { name: 'methodology-en', path: '/methodology' },
  { name: 'changelog-en', path: '/changelog' },
  // 기타
  { name: 'performance-en', path: '/performance' },
  { name: 'fees-en', path: '/fees' },
  { name: 'about-en', path: '/about' },
  { name: 'api-en', path: '/api' },
  // KO 핵심
  { name: 'home-ko', path: '/ko/' },
  { name: 'simulate-ko', path: '/ko/simulate' },
  { name: 'strategies-ranking-ko', path: '/ko/strategies/ranking' },
  { name: 'leaderboard-ko', path: '/ko/leaderboard' },
  { name: 'compare-tradingview-ko', path: '/ko/compare/tradingview' },
  { name: 'methodology-ko', path: '/ko/methodology' },
  { name: 'about-ko', path: '/ko/about' },
];

for (const pg of pages) {
  test(`desktop: ${pg.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(`${BASE}${pg.path}`, { timeout: 20000 }); }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${pg.name}-desktop.png`, fullPage: true });
  });

  test(`mobile: ${pg.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(`${BASE}${pg.path}`, { timeout: 20000 }); }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${pg.name}-mobile.png`, fullPage: true });
  });
}
