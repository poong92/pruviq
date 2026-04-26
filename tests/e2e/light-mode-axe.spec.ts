// PR-6 of light-mode rollout — verify WCAG 2.2 AA passes in *light* theme,
// not just dark. Mirrors prod-axe-audit.spec.ts structure but flips the
// theme via localStorage before navigation so the FOUC head script (PR-5)
// applies data-theme="light" on first paint.
//
// CI runs this against pruviq.com once per push; local skips (CORS).

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

const PAGES = ["/", "/ko/", "/simulate/", "/ko/simulate/", "/strategies/"];

test.describe("light theme: WCAG 2.2 AA", () => {
  for (const path of PAGES) {
    test(`light axe — ${path}`, async ({ page }) => {
      // Pre-seed localStorage so the FOUC bootstrap (Layout.astro head)
      // sets data-theme="light" before any stylesheet parses.
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem("pruviq-theme", "light");
        } catch (_) {
          /* private mode — test still meaningful via OS pref */
        }
      });

      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 20000 });

      // Sanity: confirm the theme actually flipped (otherwise the test
      // would silently audit dark mode and pass on the wrong baseline).
      const themeAttr = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );
      expect(themeAttr).toBe("light");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      for (const v of critical) {
        console.log(
          ` ${v.impact?.toUpperCase()} ${v.id} — ${v.description} (${v.nodes.length} nodes)`,
        );
      }

      expect(
        critical,
        `light-mode critical/serious violations on ${path}`,
      ).toHaveLength(0);
    });
  }
});
