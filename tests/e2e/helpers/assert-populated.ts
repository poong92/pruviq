// Populated-state assertions for Layer 2 click-everything crawler.
//
// Invariant: after a user interaction, the result must be a visible non-empty
// list / populated panel — NOT "page loaded with empty body" (the class of bug
// that let /ko/market/ macro tab show 0 items while 65/65 prior tests reported
// PASS).
//
// Usage:
//   await page.click('[data-testid=news-tab-macro]');
//   await expectPopulated(page, '[data-testid=news-list]');
//   await expectListHasItems(page, '[data-testid=news-list] > a', 1);

import { expect, type Locator, type Page } from "@playwright/test";

export interface PopulatedOpts {
  /** Timeout for visibility check. Default 10s. */
  timeout?: number;
  /** Also fail if a sibling `[data-testid=<selector-base>-empty]` exists. Default true. */
  rejectSiblingEmpty?: boolean;
}

/** Pass = locator visible AND has non-whitespace textContent AND no inner
 *  `[data-testid*="-empty"]` or `[data-testid*="-error"]` AND no `[aria-busy="true"]`. */
export async function expectPopulated(
  page: Page,
  selector: string,
  opts: PopulatedOpts = {},
): Promise<void> {
  const { timeout = 10000, rejectSiblingEmpty = true } = opts;
  const loc = page.locator(selector);
  await expect(loc, `populated: ${selector} should be visible`).toBeVisible({
    timeout,
  });

  const text = (await loc.textContent()) ?? "";
  expect(
    text.trim().length,
    `populated: ${selector} must have non-empty textContent (got '${text.slice(0, 80)}')`,
  ).toBeGreaterThan(0);

  const innerEmpty = loc.locator('[data-testid*="-empty"]');
  expect(
    await innerEmpty.count(),
    `populated: ${selector} contains an -empty sentinel`,
  ).toBe(0);

  const innerError = loc.locator('[data-testid*="-error"]');
  expect(
    await innerError.count(),
    `populated: ${selector} contains an -error sentinel`,
  ).toBe(0);

  const busy = loc.locator('[aria-busy="true"]');
  expect(
    await busy.count(),
    `populated: ${selector} still has aria-busy descendants`,
  ).toBe(0);

  if (rejectSiblingEmpty) {
    const base = selector.match(/data-testid=([a-z0-9-]+)/)?.[1];
    if (base) {
      const siblingEmpty = page.locator(`[data-testid="${base}-empty"]`);
      const visible = await siblingEmpty.isVisible().catch(() => false);
      expect(
        visible,
        `populated: sibling [data-testid=${base}-empty] is visible — did list fail to populate?`,
      ).toBe(false);
    }
  }
}

/** Counts direct or descendant children matching `itemSelector` inside `listSelector`;
 *  fails with a diagnostic dump if fewer than `minItems` found. */
export async function expectListHasItems(
  page: Page,
  listSelector: string,
  minItems = 1,
  opts: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 10000 } = opts;
  const list = page.locator(listSelector);
  // Poll for count ≥ minItems; selectors resolving to multiple nodes are
  // normal for list-item queries (e.g., "ul > li"), so we do not call
  // toBeVisible on the aggregate locator (strict-mode violation).
  const deadline = Date.now() + timeout;
  let count = 0;
  while (Date.now() < deadline) {
    count = await list.count();
    if (count >= minItems) break;
    await page.waitForTimeout(200);
  }

  if (count < minItems) {
    const dump = await dumpForDiagnostics(page, listSelector);
    throw new Error(
      `expectListHasItems: ${listSelector} has ${count} items, expected ≥${minItems}\n\n${dump}`,
    );
  }

  // Sanity: at least the first matched element is visible
  await expect(
    list.first(),
    `list: ${listSelector} first should be visible`,
  ).toBeVisible();
}

/** Tab/pill has a count badge next to it (e.g., "Macro 26"); assert the
 *  displayed number matches the actual rendered children. Guards against
 *  stale caches and count/data drift. */
export async function expectBadgeMatches(
  tabLocator: Locator,
  listLocator: Locator,
): Promise<void> {
  const tabText = (await tabLocator.textContent()) ?? "";
  const badge = tabText.match(/(\d+)/)?.[1];
  if (!badge) return; // no badge = skip
  const actual = await listLocator.count();
  expect(Number(badge), `badge ${badge} vs actual rendered ${actual}`).toBe(
    actual,
  );
}

async function dumpForDiagnostics(
  page: Page,
  selector: string,
): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => "?");
  const rootHtml = await page
    .locator(selector)
    .first()
    .innerHTML()
    .catch(() => "(selector not found)");
  const bodyLen = (await page.textContent("body").catch(() => ""))?.length ?? 0;
  return [
    `URL: ${url}`,
    `Title: ${title}`,
    `Body length: ${bodyLen}`,
    `Selector HTML (trimmed 600):\n${rootHtml.slice(0, 600)}`,
  ].join("\n");
}
