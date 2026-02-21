import { test, expect } from '@playwright/test';

test.describe('Core pages load', () => {
  test('EN home', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pruviq/i);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('KO home', async ({ page }) => {
    await page.goto('/ko/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Performance page', async ({ page }) => {
    await page.goto('/performance');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Simulate page', async ({ page }) => {
    await page.goto('/simulate');
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('header nav links work', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check at least one nav link
    const links = nav.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('footer is present', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Mobile responsive', () => {
  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });
});

test.describe('External links', () => {
  test('external links have rel noopener', async ({ page }) => {
    await page.goto('/');
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });
});
