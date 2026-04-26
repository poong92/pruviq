import { test, expect } from "@playwright/test";

/**
 * PR-6 of light-mode rollout — companion to visual-regression.spec.ts.
 *
 * Same pages, but with localStorage pre-seeded so the FOUC head script
 * (PR-5, Layout.astro) flips data-theme="light" before first paint.
 * Baselines live in __screenshots__/ alongside dark ones with the
 * `-light` suffix; first run uses --update-snapshots to seed them.
 *
 * Why a parallel file rather than a matrix inside visual-regression.spec.ts:
 *   - Existing dark baselines stay locked (zero risk of accidental rebase
 *     during rollout) — reviewers can compare light vs dark side by side.
 *   - When PR-1..PR-5 land in main, this file activates the second axis
 *     of coverage; if a future PR drifts dark, the dark spec catches it;
 *     if it drifts light, this one does.
 */

const THRESHOLD = { maxDiffPixelRatio: 0.02 };

async function setLightAndGoto(page: any, path: string) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("pruviq-theme", "light");
    } catch (_) {
      /* fall through to OS pref */
    }
  });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

test.describe("Light theme — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("home hero — light desktop", async ({ page }) => {
    await setLightAndGoto(page, "/");
    expect(
      await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      ),
    ).toBe("light");
    await expect(page).toHaveScreenshot("home-hero-desktop-light.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 600 },
    });
  });

  test("strategies grid — light desktop", async ({ page }) => {
    await setLightAndGoto(page, "/strategies/");
    await expect(page).toHaveScreenshot("strategies-grid-desktop-light.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });

  test("simulate — light desktop", async ({ page }) => {
    await setLightAndGoto(page, "/simulate/");
    await expect(page).toHaveScreenshot("simulate-desktop-light.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });

  test("home — light mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setLightAndGoto(page, "/");
    await expect(page).toHaveScreenshot("home-mobile-light.png", {
      ...THRESHOLD,
      fullPage: false,
      clip: { x: 0, y: 0, width: 375, height: 812 },
    });
  });
});
