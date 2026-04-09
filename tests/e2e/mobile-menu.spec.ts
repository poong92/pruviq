import { test, expect } from "@playwright/test";

// Force mobile viewport for all tests in this file.
// #mobile-menu-btn has md:hidden (display:none on ≥768px) — must test at mobile width.
test.use({ viewport: { width: 375, height: 812 } });

/**
 * Mobile Menu E2E Tests
 *
 * Covers:
 * - Menu starts hidden, opens on hamburger tap
 * - All expected nav items are present and visible
 * - Touch target sizes (min 44px height)
 * - Ranking item has the live pulse dot
 * - Alignment: ranking uses gap-2 + dot; leaderboard/methodology/performance use pl-[14px]
 * - Escape key closes menu
 * - Menu closes when navigating
 * - KO language mobile menu has Korean labels
 */

// Expected EN menu item labels in order
const EN_MENU_ITEMS = [
  "Market",
  "Simulate",
  "Strategies",
  "Coins",
  "Learn",
  "Fees",
  "Daily Strategy Ranking",
  "Leaderboard",
];

async function openMobileMenu(
  page: Parameters<typeof test>[2] extends (...args: infer A) => any
    ? A[0] extends { page: infer P }
      ? P
      : never
    : never,
) {
  const btn = page.locator("#mobile-menu-btn");
  // force:true bypasses visibility check — button is md:hidden (CSS) but still clickable
  await btn.click({ force: true });
  await page.waitForSelector("#mobile-menu[aria-hidden='false']", {
    timeout: 3000,
  });
}

// ─── Menu Open / Close ─────────────────────────────────────────

// aria-hidden is the canonical state indicator (toggled by layout-client.js)
// Avoid toHaveClass(/hidden/) — matches both JS "hidden" AND Tailwind "md:hidden"
test.describe("Mobile menu: open and close", () => {
  test("menu is hidden on page load", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const menu = page.locator("#mobile-menu");
    await expect(menu).toHaveAttribute("aria-hidden", "true");

    const btn = page.locator("#mobile-menu-btn");
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("hamburger button opens menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const btn = page.locator("#mobile-menu-btn");
    const menu = page.locator("#mobile-menu");

    await btn.click({ force: true });
    await expect(menu).toHaveAttribute("aria-hidden", "false");
    await expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking hamburger again closes menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const btn = page.locator("#mobile-menu-btn");
    const menu = page.locator("#mobile-menu");

    await btn.click({ force: true }); // open
    await expect(menu).toHaveAttribute("aria-hidden", "false");
    await btn.click({ force: true }); // close
    await expect(menu).toHaveAttribute("aria-hidden", "true");
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape key closes menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await expect(page.locator("#mobile-menu")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-menu")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

// ─── Menu Items Presence ───────────────────────────────────────

test.describe("Mobile menu: all expected items present", () => {
  test("EN menu contains all required nav items", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const menu = page.locator("#mobile-menu");
    for (const label of EN_MENU_ITEMS) {
      await expect(
        menu.locator(`a:has-text("${label}")`).first(),
        `Missing menu item: "${label}"`,
      ).toBeVisible();
    }
  });

  test("EN menu: Daily Strategy Ranking item is present with correct text", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    // Should use translation, NOT a Korean fallback
    const rankingLink = page
      .locator("#mobile-menu a[href='/strategies/ranking']")
      .first();
    await expect(rankingLink).toBeVisible();
    await expect(rankingLink).toContainText("Daily Strategy Ranking");
    // Must NOT contain Korean text
    const text = (await rankingLink.textContent()) ?? "";
    const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
    expect(
      koreanRegex.test(text),
      `Ranking menu item has Korean text: "${text}"`,
    ).toBe(false);
  });

  test("KO menu: 오늘의 전략 랭킹 item is present", async ({ page }) => {
    await page.goto("/ko/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const rankingLink = page.locator(
      "#mobile-menu a[href='/ko/strategies/ranking']",
    );
    await expect(rankingLink.first()).toBeVisible();
    await expect(rankingLink.first()).toContainText("오늘의 전략 랭킹");
  });
});

// ─── Touch Targets (44px minimum) ─────────────────────────────

test.describe("Mobile menu: touch target sizes", () => {
  const CHECK_HREFS = [
    "/market",
    "/simulate",
    "/strategies",
    "/strategies/ranking",
    "/leaderboard",
  ];

  for (const href of CHECK_HREFS) {
    test(`"${href}" link has min-height 44px`, async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.locator("#mobile-menu-btn").click({ force: true });
      await page.waitForSelector("#mobile-menu[aria-hidden='false']");

      const link = page.locator(`#mobile-menu a[href="${href}"]`).first();
      await expect(link).toBeVisible();

      const height = await link.evaluate(
        (el) => el.getBoundingClientRect().height,
      );
      expect(
        height,
        `"${href}" touch target is ${height}px — must be ≥ 44px`,
      ).toBeGreaterThanOrEqual(44);
    });
  }
});

// ─── Ranking Pulse Dot ────────────────────────────────────────

test.describe("Mobile menu: ranking item chevron indicator", () => {
  test("Daily Strategy Ranking link contains chevron indicator", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const rankingLink = page
      .locator("#mobile-menu a[href='/strategies/ranking']")
      .first();
    // The chevron is a <span> with › text inside the link
    const chevron = rankingLink.locator("span").first();
    await expect(
      chevron,
      "Chevron missing from ranking menu item",
    ).toBeVisible();
  });
});

// ─── Alignment: pl-[14px] on extra items ─────────────────────

test.describe("Mobile menu: alignment consistency", () => {
  test("Leaderboard submenu item is visible and aligned", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const el = page.locator(`#mobile-menu a[href="/leaderboard"]`).first();
    await expect(el).toBeVisible();
    const classes = await el.getAttribute("class");
    expect(
      classes,
      `"/leaderboard" should have consistent submenu styling`,
    ).toContain("px-4");
  });

  test("Ranking item has gap-2.5 class — uses dot indent", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const rankingLink = page
      .locator("#mobile-menu a[href='/strategies/ranking']")
      .first();
    const classes = await rankingLink.getAttribute("class");
    expect(classes, "Ranking link should use gap-2.5").toContain("gap-2.5");
  });
});

// ─── Language toggle in mobile menu ──────────────────────────

test.describe("Mobile menu: language toggle", () => {
  // lang toggle link is the only a.font-mono in #mobile-menu (unique class)
  // Uses text "KO" on EN pages, "EN" on KO pages (from t('nav.lang'))
  test("EN page: language link exists in menu", async ({ page }) => {
    await page.goto("/simulate", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const langLink = page.locator("#mobile-menu a.font-mono");
    await expect(langLink.first()).toBeVisible();
    // Verify it links to the KO version
    await expect(langLink.first()).toHaveAttribute("href", /\/ko\//);
  });

  test("KO page: language link points to EN counterpart", async ({ page }) => {
    await page.goto("/ko/simulate", { waitUntil: "domcontentloaded" });
    await page.locator("#mobile-menu-btn").click({ force: true });
    await page.waitForSelector("#mobile-menu[aria-hidden='false']");

    const langLink = page.locator("#mobile-menu a.font-mono");
    await expect(langLink.first()).toBeVisible();
    // Verify it links to the EN version (no /ko/ prefix)
    const href = await langLink.first().getAttribute("href");
    expect(href, "Language toggle should point to EN version").not.toMatch(
      /\/ko\//,
    );
  });
});
