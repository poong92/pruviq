// Layer 1 runtime — hydrated interactive inventory
//
// Static HTML crawler (scripts/discover-interactives.mjs) misses testids
// inside client:load / client:visible Preact islands — they only exist in
// the DOM after JS hydrates. This spec samples every route in the sitemap,
// waits for hydration, then dumps the rendered testid + interactive set.
//
// Writes reports/runtime-inventory.json next to the static inventory so
// reviewers can diff them.
//
// Usage:
//   BASE_URL=http://localhost:4321 npx playwright test tests/e2e/crawl/runtime-inventory.spec.ts --project=desktop
//   BASE_URL=https://pruviq.com npx playwright test tests/e2e/crawl/runtime-inventory.spec.ts --project=desktop

import { test } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO = resolve(dirname(__filename), "../../..");

// A curated but broad set of routes that represent every visible surface
// across the site. Keep this list stable — the diff between runs is the
// signal (new testid appearing = new interactive; testid vanishing =
// potential regression). Sitemap is too noisy (2000+ routes, many coin
// detail pages are structurally identical).
const ROUTES = [
  "/",
  "/ko/",
  "/simulate/",
  "/ko/simulate/",
  "/simulate/builder/",
  "/ko/simulate/builder/",
  "/market/",
  "/ko/market/",
  "/coins/",
  "/ko/coins/",
  "/strategies/",
  "/ko/strategies/",
  "/strategies/ranking/",
  "/ko/strategies/ranking/",
  "/strategies/compare/",
  "/ko/strategies/compare/",
  "/strategies/atr-breakout/",
  "/strategies/bb-squeeze-short/",
  "/strategies/ichimoku/",
  "/strategies/keltner-squeeze/",
  "/strategies/ma-cross/",
  "/performance/",
  "/ko/performance/",
  "/dashboard/",
  "/ko/dashboard/",
  "/compare/",
  "/ko/compare/",
  "/compare/3commas/",
  "/compare/coinrule/",
  "/compare/cryptohopper/",
  "/compare/gainium/",
  "/compare/streak/",
  "/compare/tradingview/",
  "/compare/binance-vs-okx/",
  "/fees/",
  "/ko/fees/",
  "/about/",
  "/ko/about/",
  "/trust/",
  "/ko/trust/",
  "/methodology/",
  "/ko/methodology/",
  "/privacy/",
  "/terms/",
  "/api/",
  "/ko/api/",
  "/learn/",
  "/ko/learn/",
  "/blog/",
  "/ko/blog/",
  "/autotrading/",
  "/ko/autotrading/",
];

type RouteInventory = {
  route: string;
  status: "ok" | "error" | "timeout";
  http_status?: number;
  testids: string[];
  button_count: number;
  anchor_count: number;
  input_count: number;
  tab_roles: number;
  h1_text: string | null;
  error?: string;
};

test.describe.configure({ mode: "serial" });

test.describe("Layer 1 runtime — hydrated inventory", () => {
  const results: RouteInventory[] = [];

  for (const route of ROUTES) {
    test(`inventory ${route}`, async ({ page }) => {
      try {
        const resp = await page.goto(route, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const status = resp?.status() ?? 0;

        // Hydrate islands that only mount on visibility — scroll through.
        await page
          .evaluate(async () => {
            const heights = [0.2, 0.5, 0.8, 1];
            for (const h of heights) {
              window.scrollTo(0, document.body.scrollHeight * h);
              await new Promise((r) => setTimeout(r, 150));
            }
          })
          .catch(() => {});
        await page.waitForTimeout(800);

        const data = await page.evaluate(() => {
          const testids = new Set<string>();
          document
            .querySelectorAll("[data-testid]")
            .forEach((el) => testids.add(el.getAttribute("data-testid") || ""));
          const h1 =
            document.querySelector("h1")?.textContent?.trim().slice(0, 80) ||
            null;
          return {
            testids: [...testids].filter(Boolean),
            button_count: document.querySelectorAll("button").length,
            anchor_count: document.querySelectorAll("a[href]").length,
            input_count: document.querySelectorAll("input").length,
            tab_roles: document.querySelectorAll('[role="tab"]').length,
            h1_text: h1,
          };
        });

        results.push({
          route,
          status: "ok",
          http_status: status,
          ...data,
        });
      } catch (e) {
        results.push({
          route,
          status: "error",
          testids: [],
          button_count: 0,
          anchor_count: 0,
          input_count: 0,
          tab_roles: 0,
          h1_text: null,
          error: String(e).slice(0, 200),
        });
      }
    });
  }

  test.afterAll(() => {
    const all = new Set<string>();
    for (const r of results) r.testids.forEach((t) => all.add(t));
    const summary = {
      generated: new Date().toISOString(),
      base_url: process.env.BASE_URL || "http://localhost:4321",
      total_routes: results.length,
      routes_ok: results.filter((r) => r.status === "ok").length,
      routes_with_testid: results.filter((r) => r.testids.length > 0).length,
      unique_testids: [...all].sort(),
      routes: results,
    };
    const out = resolve(REPO, "reports/runtime-inventory.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(summary, null, 2), "utf-8");

    const md = [
      `# Runtime Inventory (Layer 1)`,
      ``,
      `Generated: ${summary.generated}`,
      `Base URL: ${summary.base_url}`,
      ``,
      `- **Total routes sampled:** ${summary.total_routes}`,
      `- **Routes reached (HTTP ok):** ${summary.routes_ok}`,
      `- **Routes with ≥1 testid:** ${summary.routes_with_testid}`,
      `- **Unique testids (runtime):** ${summary.unique_testids.length}`,
      ``,
      `## Per-route testid count`,
      ``,
      `| Route | HTTP | testids | buttons | anchors | tabs | h1 |`,
      `|-------|------|---------|---------|---------|------|----|`,
      ...results.map(
        (r) =>
          `| ${r.route} | ${r.http_status ?? "—"} | ${r.testids.length} | ${r.button_count} | ${r.anchor_count} | ${r.tab_roles} | ${(r.h1_text ?? "").slice(0, 40)} |`,
      ),
      ``,
      `## Unique runtime testids (${summary.unique_testids.length})`,
      ``,
      summary.unique_testids.map((t) => `- \`${t}\``).join("\n"),
      ``,
    ].join("\n");
    writeFileSync(resolve(REPO, "reports/runtime-inventory.md"), md, "utf-8");

    // eslint-disable-next-line no-console
    console.log(
      `runtime inventory → ${summary.routes_with_testid}/${summary.total_routes} routes with testid, ${summary.unique_testids.length} unique`,
    );
    // Echo the first 20 unique testids so CI log shows the discovery
    // eslint-disable-next-line no-console
    console.log(summary.unique_testids.slice(0, 20).join(", "));
  });
});
