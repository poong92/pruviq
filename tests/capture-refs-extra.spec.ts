import { test } from '@playwright/test';

const OUT = 'docs/design-references/refs-extra';

const sites = [
  { name: 'lemonsqueezy', url: 'https://www.lemonsqueezy.com' },
  { name: 'framer', url: 'https://www.framer.com' },
  { name: 'cal', url: 'https://cal.com' },
  { name: 'dub', url: 'https://dub.co' },
  { name: 'liveblocks', url: 'https://liveblocks.io' },
  { name: 'mintlify', url: 'https://mintlify.com' },
  { name: 'neon', url: 'https://neon.tech' },
];

for (const site of sites) {
  test(`REF desktop: ${site.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(site.url, { timeout: 20000 }); }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${site.name}-desktop.png` });
  });

  test(`REF mobile: ${site.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch { await page.goto(site.url, { timeout: 20000 }); }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${site.name}-mobile.png` });
  });
}
