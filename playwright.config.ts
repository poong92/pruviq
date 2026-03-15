import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // CI runners (GitHub US East → DO API) add 200-500ms latency per request.
  // 90s covers: page load (5s) + Preact hydration (5s) + API round trip (60s) + margin.
  timeout: process.env.CI ? 90000 : 60000,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:4321",
    screenshot: "only-on-failure",
    browserName: "chromium",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: ["**/mobile-menu.spec.ts"],
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 0.0.0.0 --port 4321",
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
