import { test } from '@playwright/test';
import path from 'path';

const sites = [
  { name: 'linear', url: 'https://linear.app' },
  { name: 'vercel', url: 'https://vercel.com' },
  { name: 'resend', url: 'https://resend.com' },
  { name: 'raycast', url: 'https://raycast.com' },
  { name: 'coingecko', url: 'https://www.coingecko.com' },
  { name: 'pruviq-current', url: 'https://pruviq.com' },
];

const outDir = 'docs/design-references';

for (const site of sites) {
  test(`capture ${site.name} desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outDir}/${site.name}-desktop.png` });
  });

  test(`capture ${site.name} mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/${site.name}-mobile.png` });
  });
}
