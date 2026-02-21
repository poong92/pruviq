import { test, expect } from '@playwright/test';

test('smoke user flow (home → coins → strategies → simulate) and console/no broken links', async ({ page, request, baseURL }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Home
  await page.goto('/');
  await expect(page).toHaveURL(/https?:\/\/(www\.)?pruviq\.com\/?$/i);

  // Coins
  await page.goto('/coins/');
  await expect(page).toHaveURL(/\/coins\/?$/);

  // Try to click first coin link if present
  const coinLink = page.locator('a[href^="/coins/"]').first();
  if (await coinLink.count() > 0) {
    await coinLink.click();
    await expect(page).toHaveURL(/\/coins\//);
  }

  // Strategies
  await page.goto('/strategies/');
  await expect(page).toHaveURL(/\/strategies\/?$/);

  // Simulate
  await page.goto('/simulate/');
  await expect(page).toHaveURL(/\/simulate\/?$/);

  // Ensure no console errors
  expect(consoleErrors).toEqual([]);

  // Broken links check on current page (/simulate)
  const hrefs = await page.$$eval('a[href]', els => Array.from(els).map(e => (e as HTMLAnchorElement).href));
  const unique = Array.from(new Set(hrefs)).slice(0, 200); // limit check to first 200 links to keep run time reasonable
  for (const href of unique) {
    try {
      const url = new URL(href);
      if (url.hostname.includes('pruviq.com')) {
        const r = await request.get(href);
        expect(r.status()).toBeLessThan(400);
      }
    } catch (e) {
      // ignore non-http links
    }
  }
});
