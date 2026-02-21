import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('home page loads', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('KO home page loads', async ({ page }) => {
    await page.goto('/ko/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('performance page loads', async ({ page }) => {
    await page.goto('/performance');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('simulate page loads', async ({ page }) => {
    await page.goto('/simulate');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('no broken internal links on home', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.$$eval('a[href^="/"]', els =>
      Array.from(new Set(els.map(e => (e as HTMLAnchorElement).getAttribute('href'))))
    );

    for (const href of hrefs.slice(0, 50)) {
      if (!href || href.startsWith('#')) continue;
      const r = await request.get(href);
      expect(r.status(), `Broken link: ${href}`).toBeLessThan(400);
    }
  });
});
