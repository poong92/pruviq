import { test, expect } from '@playwright/test';

/**
 * Data Rendering Tests
 *
 * Verify that interactive components render data (not stuck on skeleton/loading).
 * Catches bugs like:
 * - Component crashes leaving permanent skeleton state
 * - fetchWithFallback format mismatches
 * - Preact hydration failures
 *
 * These tests use the preview server which serves static data from /data/*.json
 * via fetchWithFallback. API calls will fail (expected), but static fallback must work.
 */

test.describe('Data rendering - Market', () => {
  test('market page shows data, not skeletons', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/market/');
    // Scroll to trigger client:visible hydration
    await page.evaluate(() => window.scrollTo(0, 0));
    // Wait for hydration + static fallback fetch
    await page.waitForTimeout(8000);

    // No JS errors (the macro.indicators.length crash)
    expect(errors.filter(e => !e.includes('net::') && !e.includes('fetch')),
      'No component-crashing JS errors').toHaveLength(0);

    const body = await page.textContent('body');

    // Must NOT show error state
    expect(body).not.toContain('Failed to load market');
    expect(body).not.toContain('Failed to load news');

    // Should contain actual market data from static fallback
    // (BTC price, Fear label, or dollar sign)
    const hasMarketData = body!.includes('$') || body!.includes('Fear') || body!.includes('BTC');
    expect(hasMarketData, 'Market page should render actual data').toBeTruthy();
  });
});

test.describe('Data rendering - Coins', () => {
  test('coins page shows data, not skeletons', async ({ page }) => {
    await page.goto('/coins/');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(8000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Failed to load');

    // Should have coin symbols from static fallback
    const hasCoinData = body!.includes('BTC') || body!.includes('ETH') || body!.includes('Price');
    expect(hasCoinData, 'Coins page should show coin data').toBeTruthy();
  });
});

test.describe('Data rendering - Simulate', () => {
  test('simulate page shows indicators, not error', async ({ page }) => {
    await page.goto('/simulate/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(8000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Failed to load indicators');
  });
});

test.describe('No component crashes', () => {
  const pages = ['/market/', '/coins/', '/simulate/', '/strategies/compare/'];

  for (const path of pages) {
    test(`${path} has no JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => {
        // Ignore network errors (expected when API is down)
        if (!e.message.includes('net::') && !e.message.includes('fetch') && !e.message.includes('AbortError')) {
          errors.push(e.message);
        }
      });

      await page.goto(path);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(6000);

      expect(errors, `${path} should have no component-crashing JS errors`).toHaveLength(0);
    });
  }
});
