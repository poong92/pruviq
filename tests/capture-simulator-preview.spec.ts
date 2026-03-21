import { test } from '@playwright/test';

test('capture simulator result for hero', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://pruviq.com/simulate', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Click first preset (Quick Test)
  const presetBtn = page.locator('button').filter({ hasText: /Quick|BB Squeeze|RSI/i }).first();
  if (await presetBtn.count() > 0) await presetBtn.click();
  await page.waitForTimeout(500);

  // Click Run
  const runBtn = page.locator('button').filter({ hasText: /Run|Simulate|실행/i }).first();
  if (await runBtn.count() > 0) {
    await runBtn.click();
    await page.waitForTimeout(4000);
  }

  await page.screenshot({ 
    path: 'public/images/simulator-preview.png',
    fullPage: false 
  });
  console.log('Simulator preview captured');
});
