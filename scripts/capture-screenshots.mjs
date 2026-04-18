import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = 'playwright-report/screenshots';
mkdirSync(OUT, { recursive: true });

const BASE = 'https://pruviq.com';

const pages = [
  // EN Desktop
  { url: '/', name: 'home-en-desktop', w: 1280, h: 900 },
  { url: '/simulate', name: 'simulate-en-desktop', w: 1280, h: 900 },
  { url: '/strategies', name: 'strategies-en-desktop', w: 1280, h: 900 },
  { url: '/strategies/ranking', name: 'strategies-ranking-en-desktop', w: 1280, h: 900 },
  { url: '/market', name: 'market-en-desktop', w: 1280, h: 900 },
  { url: '/coins', name: 'coins-en-desktop', w: 1280, h: 900 },
  { url: '/learn', name: 'learn-en-desktop', w: 1280, h: 900 },
  { url: '/fees', name: 'fees-en-desktop', w: 1280, h: 900 },
  { url: '/compare', name: 'compare-en-desktop', w: 1280, h: 900 },
  { url: '/compare/tradingview', name: 'compare-tradingview-en-desktop', w: 1280, h: 900 },
  { url: '/signals', name: 'signals-en-desktop', w: 1280, h: 900 },
  { url: '/about', name: 'about-en-desktop', w: 1280, h: 900 },
  // EN Mobile
  { url: '/', name: 'home-en-mobile', w: 375, h: 812 },
  { url: '/simulate', name: 'simulate-en-mobile', w: 375, h: 812 },
  { url: '/strategies', name: 'strategies-en-mobile', w: 375, h: 812 },
  { url: '/strategies/ranking', name: 'strategies-ranking-en-mobile', w: 375, h: 812 },
  { url: '/market', name: 'market-en-mobile', w: 375, h: 812 },
  { url: '/learn', name: 'learn-en-mobile', w: 375, h: 812 },
  { url: '/fees', name: 'fees-en-mobile', w: 375, h: 812 },
  { url: '/compare', name: 'compare-en-mobile', w: 375, h: 812 },
  // KO Desktop
  { url: '/ko/', name: 'ko-home-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/simulate', name: 'ko-simulate-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/strategies/ranking', name: 'ko-strategies-ranking-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/market', name: 'ko-market-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/learn', name: 'ko-learn-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/fees', name: 'ko-fees-ko-desktop', w: 1280, h: 900 },
  { url: '/ko/compare', name: 'ko-compare-ko-desktop', w: 1280, h: 900 },
  // KO Mobile
  { url: '/ko/', name: 'ko-home-ko-mobile', w: 375, h: 812 },
  { url: '/ko/simulate', name: 'ko-simulate-ko-mobile', w: 375, h: 812 },
  { url: '/ko/strategies/ranking', name: 'ko-strategies-ranking-ko-mobile', w: 375, h: 812 },
  { url: '/ko/fees', name: 'ko-fees-ko-mobile', w: 375, h: 812 },
  // Special
  { url: '/', name: 'home-menu-open-en-mobile', w: 375, h: 812, openMenu: true },
  { url: '/ko/', name: 'home-menu-open-ko-mobile', w: 375, h: 812, openMenu: true },
  { url: '/strategies', name: 'nav-strategies-dropdown-en-desktop', w: 1280, h: 900, hoverDropdown: true },
];

async function run() {
  const browser = await chromium.launch({ headless: true });

  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      if (p.openMenu) {
        const btn = page.locator('#mobile-menu-btn');
        if (await btn.isVisible()) await btn.click();
        await page.waitForTimeout(500);
      }

      if (p.hoverDropdown) {
        const trigger = page.locator('.nav-dropdown-trigger').first();
        if (await trigger.isVisible()) await trigger.hover();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
      console.log(`✓ ${p.name}`);
    } catch (e) {
      console.error(`✗ ${p.name}: ${e.message}`);
    }
    await ctx.close();
  }

  await browser.close();
  console.log('Done.');
}

run();
