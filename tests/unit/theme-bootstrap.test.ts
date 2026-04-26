import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PR-6 guard — verifies the light-mode plumbing stays wired up.
 *
 * Catches the silent regression where someone removes the FOUC script
 * or the toggle button from Layout.astro and dark/light is suddenly
 * a no-op. Cheaper than booting Playwright for a one-line smoke check.
 */

const LAYOUT = join(__dirname, "..", "..", "src", "layouts", "Layout.astro");

const EN = join(__dirname, "..", "..", "src", "i18n", "en.ts");
const KO = join(__dirname, "..", "..", "src", "i18n", "ko.ts");
const GLOBAL_CSS = join(__dirname, "..", "..", "src", "styles", "global.css");

describe("theme bootstrap wiring", () => {
  test("Layout.astro contains FOUC-prevention head script", () => {
    const src = readFileSync(LAYOUT, "utf8");
    expect(src).toMatch(/FOUC-prevention/);
    expect(src).toMatch(/localStorage\.getItem\(.pruviq-theme.\)/);
    expect(src).toMatch(/setAttribute\(.data-theme., .light.\)/);
  });

  test("Layout.astro contains toggle button + click handler", () => {
    const src = readFileSync(LAYOUT, "utf8");
    expect(src).toMatch(/id="theme-toggle"/);
    expect(src).toMatch(/aria-pressed=/);
    expect(src).toMatch(/theme-icon-sun/);
    expect(src).toMatch(/theme-icon-moon/);
    expect(src).toMatch(/localStorage\.setItem\(.pruviq-theme./);
  });

  test("global.css declares :root[data-theme='light'] override", () => {
    const css = readFileSync(GLOBAL_CSS, "utf8");
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{/);
    // sanity-check a few key tokens are overridden
    expect(css).toMatch(/--color-bg:\s*#FFFFFF/i);
    expect(css).toMatch(/--color-text:\s*#18181B/i);
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  test("i18n: theme.* keys exist in EN and KO", () => {
    const en = readFileSync(EN, "utf8");
    const ko = readFileSync(KO, "utf8");
    for (const key of [
      "theme.toggle_label",
      "theme.light",
      "theme.dark",
      "theme.system",
    ]) {
      expect(en.includes(`"${key}"`), `EN missing ${key}`).toBe(true);
      expect(ko.includes(`"${key}"`), `KO missing ${key}`).toBe(true);
    }
  });
});
