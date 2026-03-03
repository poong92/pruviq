import { test, expect } from '@playwright/test';

test('mobile menu toggles on click', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Ensure mobile view by setting viewport to a mobile size
  await page.setViewportSize({ width: 390, height: 844 });

  const btn = await page.$('#mobile-menu-btn');
  expect(btn).not.toBeNull();

  const before = await btn!.getAttribute('aria-expanded');
  console.log('aria-expanded before:', before);

  await page.click('#mobile-menu-btn');
  await page.waitForTimeout(250);

  const after = await btn!.getAttribute('aria-expanded');
  console.log('aria-expanded after:', after);

  const mobileMenu = await page.$('#mobile-menu');
  const isHidden = mobileMenu ? await mobileMenu.evaluate((el) => el.classList.contains('hidden')) : null;
  console.log('mobileMenu.hidden:', isHidden);

  expect(after).toBe('true');
  expect(isHidden).toBe(false);

  // Close the menu and confirm aria-expands false
  await page.click('#mobile-menu-btn');
  await page.waitForTimeout(200);
  const afterClose = await btn!.getAttribute('aria-expanded');
  console.log('aria-expanded after close:', afterClose);
  expect(afterClose).toBe('false');
});
