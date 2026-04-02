import type { Page } from "@playwright/test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "../../fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

/** Mock all PRUVIQ API endpoints with local fixture files.
 *  Call BEFORE page.goto() — Playwright routes are set up per-page. */
export async function mockPruviqApi(page: Page) {
  // Single catch-all handler for all api.pruviq.com requests.
  // Dispatches to fixture files based on URL path.
  await page.route("**/api.pruviq.com/**", (route) => {
    const url = route.request().url();

    if (url.includes("/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("health.json"),
      });
    }

    if (url.includes("/simulate")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("simulate-response.json"),
      });
    }

    if (url.includes("/backtest")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("simulate-response.json"),
      });
    }

    // Single preset (e.g. /builder/presets/bb-squeeze-short) vs list (/builder/presets)
    if (url.match(/\/builder\/presets\/[a-z]/)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("preset-bb-squeeze-short.json"),
      });
    }

    if (url.includes("/builder/presets")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("builder-presets.json"),
      });
    }

    if (url.includes("/builder/indicators") || url.includes("/indicators")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("indicators.json"),
      });
    }

    if (url.includes("/ohlcv")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("ohlcv-btc.json"),
      });
    }

    if (url.includes("/coins")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture("coins.json"),
      });
    }

    // Catch-all: return empty JSON for any unhandled API endpoint
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}
