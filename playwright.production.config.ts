import { defineConfig } from '@playwright/test';

/**
 * Production E2E config — no local webServer, tests against live site.
 * Usage: BASE_URL=https://pruviq.com npx playwright test --config=playwright.production.config.ts
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60000,  // production can be slower
  retries: 1,
  outputDir: '/tmp/pruviq-e2e/test-results',
  reporter: [['json', { outputFile: '/tmp/pruviq-e2e/playwright-results.json' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://pruviq.com',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // No webServer — testing against production
});
