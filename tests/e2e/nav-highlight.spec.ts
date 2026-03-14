import { test, expect, type Page } from "@playwright/test";

/**
 * Nav Highlight / Active State Tests
 *
 * Regression coverage for:
 * - New menu items (ranking, leaderboard, methodology, performance) missing
 *   aria-current="page" and accent-color highlight on desktop + mobile
 * - /strategies/ranking: strategies item must be active on desktop nav;
 *   ranking item must be active in mobile menu
 *
 * Strategy: assert aria-current="page" on the matching <a> element.
 * aria-current is set via the isActive() helper in Layout.astro and is
 * the source of truth for both visual highlight (inline style) and
 * accessibility state.
 */

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Returns the href of every <a aria-current="page"> in the desktop nav.
 * Desktop nav = the hidden-md:flex center bar; identified by its parent
 * having role=navigation and not being the mobile menu.
 */
async function desktopActiveHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // Desktop nav links are inside the nav but NOT inside #mobile-menu
    const nav = document.querySelector("nav");
    if (!nav) return [];
    const active = Array.from(
      nav.querySelectorAll<HTMLAnchorElement>("a[aria-current='page']"),
    ).filter((a) => !a.closest("#mobile-menu"));
    return active.map((a) => a.getAttribute("href") ?? "");
  });
}

/**
 * Opens the mobile menu (if not already open) and returns hrefs of
 * every <a aria-current="page"> inside #mobile-menu.
 */
async function mobileActiveHrefs(page: Page): Promise<string[]> {
  // Open mobile menu
  const btn = page.locator("#mobile-menu-btn");
  const isExpanded = (await btn.getAttribute("aria-expanded")) === "true";
  if (!isExpanded) {
    await btn.click();
    await page.waitForSelector("#mobile-menu:not(.hidden)", {
      timeout: 3000,
    });
  }

  return page.evaluate(() => {
    const menu = document.getElementById("mobile-menu");
    if (!menu) return [];
    const active = Array.from(
      menu.querySelectorAll<HTMLAnchorElement>("a[aria-current='page']"),
    );
    return active.map((a) => a.getAttribute("href") ?? "");
  });
}

// ─── Desktop Nav Active State ──────────────────────────────────

test.describe("Desktop nav: aria-current reflects current route", () => {
  const cases: Array<{
    path: string;
    expectedActive: string;
    label: string;
  }> = [
    { path: "/market", expectedActive: "/market", label: "market" },
    {
      path: "/simulate",
      expectedActive: "/simulate",
      label: "simulate",
    },
    {
      path: "/strategies",
      expectedActive: "/strategies",
      label: "strategies",
    },
    {
      path: "/strategies/ranking",
      expectedActive: "/strategies",
      label: "strategies (from ranking sub-page)",
    },
    { path: "/fees", expectedActive: "/fees", label: "fees" },
    { path: "/learn", expectedActive: "/learn", label: "learn" },
  ];

  for (const { path, expectedActive, label } of cases) {
    test(`${label}: visiting ${path} activates "${expectedActive}"`, async ({
      page,
    }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} returned error`).toBeLessThan(400);

      const active = await desktopActiveHrefs(page);
      expect(
        active,
        `Expected "${expectedActive}" to have aria-current="page" on desktop nav`,
      ).toContain(expectedActive);
    });
  }

  test("home page: no desktop nav item is active", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const active = await desktopActiveHrefs(page);
    // None of the standard nav items match '/'
    expect(active.length, "No nav item should be active on home page").toBe(0);
  });
});

// ─── Mobile Menu Active State ──────────────────────────────────

test.describe("Mobile menu: aria-current reflects current route", () => {
  const cases: Array<{
    path: string;
    expectedActive: string;
    label: string;
  }> = [
    {
      path: "/market",
      expectedActive: "/market",
      label: "market",
    },
    {
      path: "/simulate",
      expectedActive: "/simulate",
      label: "simulate",
    },
    {
      path: "/strategies",
      expectedActive: "/strategies",
      label: "strategies",
    },
    {
      path: "/strategies/ranking",
      expectedActive: "/strategies/ranking",
      label: "ranking (mobile-only extra item)",
    },
    {
      path: "/leaderboard",
      expectedActive: "/leaderboard",
      label: "leaderboard (mobile-only extra item)",
    },
    {
      path: "/methodology",
      expectedActive: "/methodology",
      label: "methodology (mobile-only extra item)",
    },
    {
      path: "/performance",
      expectedActive: "/performance",
      label: "performance (mobile-only extra item)",
    },
    { path: "/fees", expectedActive: "/fees", label: "fees" },
  ];

  for (const { path, expectedActive, label } of cases) {
    test(`${label}: visiting ${path} activates "${expectedActive}" in mobile menu`, async ({
      page,
    }) => {
      const res = await page.goto(path, {
        waitUntil: "domcontentloaded",
      });
      expect(res?.status(), `${path} returned error`).toBeLessThan(400);

      const active = await mobileActiveHrefs(page);
      expect(
        active,
        `Expected "${expectedActive}" to have aria-current="page" in mobile menu`,
      ).toContain(expectedActive);
    });
  }
});

// ─── Accent Color Style ────────────────────────────────────────

test.describe("Active nav items have accent color style", () => {
  test("desktop: active market link has font-weight:500", async ({ page }) => {
    await page.goto("/market", { waitUntil: "domcontentloaded" });
    const activeLink = page.locator("nav a[aria-current='page']").first();
    // Should not be inside mobile menu
    const fontWeight = await activeLink.evaluate(
      (el) => (el as HTMLElement).style.fontWeight,
    );
    expect(fontWeight).toBe("500");
  });

  test("mobile: active simulate link has font-weight:500 in menu", async ({
    page,
  }) => {
    await page.goto("/simulate", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click();
    await page.waitForSelector("#mobile-menu:not(.hidden)");

    const activeLink = page
      .locator("#mobile-menu a[aria-current='page']")
      .first();
    const fontWeight = await activeLink.evaluate(
      (el) => (el as HTMLElement).style.fontWeight,
    );
    expect(fontWeight).toBe("500");
  });
});

// ─── KO language nav active state ──────────────────────────────

test.describe("KO pages: nav active state still works", () => {
  test("/ko/market activates market link in mobile menu", async ({ page }) => {
    await page.goto("/ko/market", { waitUntil: "domcontentloaded" });
    const active = await mobileActiveHrefs(page);
    expect(active).toContain("/ko/market");
  });

  test("/ko/strategies/ranking activates ranking link in mobile menu", async ({
    page,
  }) => {
    await page.goto("/ko/strategies/ranking", {
      waitUntil: "domcontentloaded",
    });
    const active = await mobileActiveHrefs(page);
    expect(active).toContain("/ko/strategies/ranking");
  });
});
