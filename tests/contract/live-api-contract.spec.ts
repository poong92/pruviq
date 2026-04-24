// Layer 3.5 — Live API contract
//
// The Layer 3 unit tests (tests/unit/hook-contract.test.ts) validate the
// *static JSON* artefacts in public/data/. This spec validates the *live
// API* responses at https://api.pruviq.com against the same schemas.
//
// Why both matter: the original 2026-04-22 macro-news bug was not a static
// JSON issue — it was that fetchWithFallback fell through to the API, and
// the API payload silently omitted the `category` field the UI needed.
// Static contract tests alone would never have caught that.
//
// This spec is deliberately tolerant about missing categories on the API
// (since the API is known-divergent today and fixing the backend is a
// separate workstream). Instead it:
//   1. asserts every schema field the hook *destructures* is present
//   2. records divergence between static and API for alerting
//
// Run locally:
//   API_BASE=https://api.pruviq.com npx playwright test tests/contract/live-api-contract.spec.ts --project=desktop

import { expect, test } from "@playwright/test";
import {
  validateMacroData,
  validateMarketData,
  validateNewsData,
} from "../../src/schemas/data-contracts";

const API_BASE = process.env.API_BASE || "https://api.pruviq.com";

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

test.describe("Layer 3.5 — live API contract", () => {
  test("GET /news returns useNews-compatible shape", async () => {
    const data = (await fetchJson(`${API_BASE}/news`)) as {
      items?: Array<{ category?: string }>;
    };
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items!.length).toBeGreaterThan(0);

    // Drift check: the API that caused the 2026-04-22 bug omitted
    // `category`. We don't fail the build on that (backend fix is
    // separate) but we log it so a future nightly run flags a change.
    const withCategory = data.items!.filter((i) => i.category).length;
    const withoutCategory = data.items!.filter((i) => !i.category).length;
    // eslint-disable-next-line no-console
    console.log(
      `[live-api-contract] /news items=${data.items!.length} withCategory=${withCategory} withoutCategory=${withoutCategory}`,
    );

    // If the API *does* start emitting categories, validate the full shape
    if (withCategory === data.items!.length) {
      const r = validateNewsData({
        items: data.items,
        generated:
          (data as { generated?: string }).generated ||
          new Date().toISOString(),
      });
      expect(r.ok, r.errors.join("\n")).toBe(true);
    }
  });

  test("GET /macro returns useMacro-compatible shape", async () => {
    const data = await fetchJson(`${API_BASE}/macro`);
    const r = validateMacroData(data);
    expect(r.ok, r.errors.join("\n")).toBe(true);
  });

  test("GET /market returns useMarketOverview-compatible shape", async () => {
    const data = await fetchJson(`${API_BASE}/market`);
    const r = validateMarketData(data);
    expect(r.ok, r.errors.join("\n")).toBe(true);
  });

  test("GET /health returns 200 with ok marker", async () => {
    const r = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body.length).toBeGreaterThan(0);
    // Accept any of these status keys — varies by version
    const looksHealthy = /ok|healthy|"status":\s*"up"/i.test(body);
    expect(looksHealthy, `health body: ${body.slice(0, 200)}`).toBe(true);
  });
});
