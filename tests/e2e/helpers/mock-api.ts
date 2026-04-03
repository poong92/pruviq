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
 *  Call BEFORE page.goto() — Playwright routes are set up per-page.
 *
 *  Intercepts BOTH api.pruviq.com requests AND static /data/*.json paths
 *  because fetchWithFallback() tries static CDN files first, then API. */
export async function mockPruviqApi(page: Page) {
  // 1. Intercept static data paths (fetchWithFallback tries these first)
  await page.route("**/data/builder-indicators.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: loadFixture("indicators.json"),
    }),
  );

  await page.route("**/data/builder-presets.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: loadFixture("builder-presets.json"),
    }),
  );

  await page.route("**/data/coins-stats.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ coins: JSON.parse(loadFixture("coins.json")) }),
    }),
  );

  // 2. Intercept api.pruviq.com requests (fallback path + direct fetches)
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
