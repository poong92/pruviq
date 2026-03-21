import { test } from '@playwright/test';

const BASE = 'https://pruviq.com';

const pages = [
  { name: 'home-en', path: '/' },
  { name: 'simulate-en', path: '/simulate' },
  { name: 'strategies-ranking-en', path: '/strategies/ranking' },
  { name: 'leaderboard-en', path: '/leaderboard' },
  { name: 'market-en', path: '/market' },
  { name: 'coins-en', path: '/coins' },
  { name: 'learn-en', path: '/learn' },
  { name: 'performance-en', path: '/performance' },
  { name: 'fees-en', path: '/fees' },
  { name: 'compare-en', path: '/compare/tradingview' },
  { name: 'home-ko', path: '/ko/' },
  { name: 'simulate-ko', path: '/ko/simulate' },
  { name: 'strategies-ranking-ko', path: '/ko/strategies/ranking' },
  { name: 'leaderboard-ko', path: '/ko/leaderboard' },
];

const OUT = 'docs/design-references/as-is';

for (const pg of pages) {
  test(`AS-IS desktop: ${pg.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(`${BASE}${pg.path}`, { timeout: 20000 }); }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${pg.name}-desktop.png`, fullPage: true });
  });

  test(`AS-IS mobile: ${pg.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(`${BASE}${pg.path}`, { timeout: 20000 }); }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${pg.name}-mobile.png`, fullPage: true });
  });
}
