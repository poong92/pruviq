import { chromium } from 'playwright';
import path from 'path';

const OUT = '/Users/jepo/pruviq/docs/design-audit-20260324';

const PROD = 'https://pruviq.com';
const LOCAL = 'http://localhost:4332';

// All pages to audit
const EN_PAGES = [
  { name: 'home', path: '/' },
  { name: 'simulate', path: '/simulate/' },
  { name: 'strategies', path: '/strategies/' },
  { name: 'ranking', path: '/strategies/ranking/' },
  { name: 'leaderboard', path: '/strategies/leaderboard/' },
  { name: 'fees', path: '/fees/' },
  { name: 'learn', path: '/learn/' },
  { name: 'market', path: '/market/' },
  { name: 'about', path: '/about/' },
  { name: 'compare-tradingview', path: '/compare/tradingview/' },
  { name: 'blog', path: '/blog/' },
  { name: 'methodology', path: '/methodology/' },
  { name: 'coins-btc', path: '/coins/BTC/' },
  { name: 'changelog', path: '/changelog/' },
];

const KO_PAGES = [
  { name: 'ko-home', path: '/ko/' },
  { name: 'ko-simulate', path: '/ko/simulate/' },
  { name: 'ko-strategies', path: '/ko/strategies/' },
  { name: 'ko-ranking', path: '/ko/strategies/ranking/' },
  { name: 'ko-leaderboard', path: '/ko/strategies/leaderboard/' },
  { name: 'ko-about', path: '/ko/about/' },
];

const MOBILE_PAGES = [
  { name: 'mobile-en-home', path: '/' },
  { name: 'mobile-en-simulate', path: '/simulate/' },
  { name: 'mobile-en-ranking', path: '/strategies/ranking/' },
  { name: 'mobile-ko-home', path: '/ko/' },
  { name: 'mobile-ko-simulate', path: '/ko/simulate/' },
  { name: 'mobile-ko-ranking', path: '/ko/strategies/ranking/' },
];

async function capturePages(browser, baseUrl, pages, prefix, viewport) {
  const context = await browser.newContext({
    viewport: viewport || { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const p of pages) {
    const url = `${baseUrl}${p.path}`;
    const filename = `${prefix}_${p.name}.png`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000); // let animations settle
      await page.screenshot({
        path: path.join(OUT, filename),
        fullPage: true,
      });
      console.log(`OK: ${filename}`);
    } catch (e) {
      console.log(`FAIL: ${filename} - ${e.message.slice(0, 80)}`);
      // Try with domcontentloaded
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(2000);
        await page.screenshot({
          path: path.join(OUT, filename),
          fullPage: true,
        });
        console.log(`OK (retry): ${filename}`);
      } catch (e2) {
        console.log(`SKIP: ${filename}`);
      }
    }
  }
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Production - Desktop EN
  console.log('\n=== PRODUCTION DESKTOP EN ===');
  await capturePages(browser, PROD, EN_PAGES, 'prod_desktop');

  // Production - Desktop KO
  console.log('\n=== PRODUCTION DESKTOP KO ===');
  await capturePages(browser, PROD, KO_PAGES, 'prod_desktop');

  // Production - Mobile
  console.log('\n=== PRODUCTION MOBILE ===');
  await capturePages(browser, PROD, MOBILE_PAGES, 'prod', { width: 390, height: 844 });

  // Local - Desktop EN (for comparison with PR #643)
  console.log('\n=== LOCAL DESKTOP EN ===');
  await capturePages(browser, LOCAL, EN_PAGES, 'local_desktop');

  // Local - Desktop KO
  console.log('\n=== LOCAL DESKTOP KO ===');
  await capturePages(browser, LOCAL, KO_PAGES, 'local_desktop');

  // Local - Mobile
  console.log('\n=== LOCAL MOBILE ===');
  await capturePages(browser, LOCAL, MOBILE_PAGES, 'local', { width: 390, height: 844 });

  await browser.close();
  console.log('\nDone! Screenshots saved to:', OUT);
}

main().catch(console.error);
