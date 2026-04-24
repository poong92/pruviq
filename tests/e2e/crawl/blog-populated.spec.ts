// Blog populated-content verification
//
// Iterates every blog slug (read from the build output's /blog/ and /ko/blog/
// index listings) and asserts the detail page:
//   - returned HTTP 200
//   - renders an h1 with non-empty text
//   - has body length > 500 chars (short posts get caught)
//   - no visible [data-testid*="-error"] sentinel
//
// This complements Layer 1 runtime inventory (which only samples
// canonical routes) by enumerating every content-collection post so no
// silent render regression slips through.
//
// Run locally:
//   BASE_URL=http://localhost:4321 npx playwright test tests/e2e/crawl/blog-populated.spec.ts --project=desktop

import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO = resolve(dirname(__filename), "../../..");

function slugsIn(subdir: string): string[] {
  const dir = resolve(REPO, subdir);
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

const EN_SLUGS = slugsIn("src/content/blog");
const KO_SLUGS = slugsIn("src/content/blog-ko");

test.describe("Blog — every EN post populated", () => {
  for (const slug of EN_SLUGS) {
    test(`/blog/${slug}/`, async ({ page }) => {
      const resp = await page.goto(`/blog/${slug}/`, {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status(), `HTTP for /blog/${slug}/`).toBe(200);

      const h1 = (await page.locator("h1").first().textContent())?.trim() ?? "";
      expect(h1.length, `h1 text on /blog/${slug}/`).toBeGreaterThan(0);

      const body = (await page.textContent("body")) ?? "";
      expect(
        body.length,
        `body length on /blog/${slug}/ (got ${body.length})`,
      ).toBeGreaterThan(500);

      const errorCount = await page.locator('[data-testid*="-error"]').count();
      expect(errorCount, `error sentinels on /blog/${slug}/`).toBe(0);
    });
  }
});

test.describe("Blog — every KO post populated", () => {
  for (const slug of KO_SLUGS) {
    test(`/ko/blog/${slug}/`, async ({ page }) => {
      const resp = await page.goto(`/ko/blog/${slug}/`, {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status(), `HTTP for /ko/blog/${slug}/`).toBe(200);

      const h1 = (await page.locator("h1").first().textContent())?.trim() ?? "";
      expect(h1.length, `h1 text on /ko/blog/${slug}/`).toBeGreaterThan(0);

      const body = (await page.textContent("body")) ?? "";
      expect(
        body.length,
        `body length on /ko/blog/${slug}/ (got ${body.length})`,
      ).toBeGreaterThan(500);

      const errorCount = await page.locator('[data-testid*="-error"]').count();
      expect(errorCount, `error sentinels on /ko/blog/${slug}/`).toBe(0);
    });
  }
});
