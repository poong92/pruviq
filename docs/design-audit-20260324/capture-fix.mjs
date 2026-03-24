import { chromium } from 'playwright';
import path from 'path';

const OUT = '/Users/jepo/pruviq/docs/design-audit-20260324';

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Capture correct leaderboard pages
  const pages = [
    { base: 'https://pruviq.com', name: 'prod_desktop_leaderboard', path: '/leaderboard/' },
    { base: 'https://pruviq.com', name: 'prod_desktop_ko-leaderboard', path: '/ko/leaderboard/' },
    { base: 'http://localhost:4332', name: 'local_desktop_leaderboard', path: '/leaderboard/' },
    { base: 'http://localhost:4332', name: 'local_desktop_ko-leaderboard', path: '/ko/leaderboard/' },
  ];

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const p of pages) {
    await page.goto(`${p.base}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
    console.log(`OK: ${p.name}`);
  }

  await ctx.close();
  await browser.close();
}

main().catch(console.error);
