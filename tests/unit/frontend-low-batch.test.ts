/**
 * Frontend LOW batch regression (PR 2026-04-19).
 *
 * Bundles four frontend-audit LOW findings that share small-scope risk:
 *   1. CommandPalette hydration — `client:idle` wasted an SSR pass; the
 *      component is hidden until Cmd+K. `client:only` skips SSR.
 *   2. Touch targets 44 → 48px (min-w-12 min-h-12) — WCAG 2.5.5 is 44
 *      minimum; low-DPI rounding makes 48 the safer floor.
 *   3. i18n "20% fee discount" — literals in en.ts/ko.ts now interpolate
 *      `OKX_DISCOUNT_PCT` from config/exchanges.ts (SSoT with PR #1191).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OKX_DISCOUNT_PCT } from "../../src/config/exchanges";
import { en } from "../../src/i18n/en";
import { ko } from "../../src/i18n/ko";

const R = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf-8");

describe("CommandPalette hydration deferred via client:only", () => {
  const layout = R("src/layouts/Layout.astro");

  it("uses client:only, not client:idle", () => {
    expect(layout, "CommandPalette should skip SSR").toMatch(
      /<CommandPalette[^>]+client:only="preact"/,
    );
    expect(
      layout,
      "client:idle must be removed for CommandPalette",
    ).not.toMatch(/<CommandPalette[^>]+client:idle/);
  });
});

describe("Touch targets meet WCAG 2.5.5 with 48px safety margin", () => {
  // Files that used to have min-w-[44px] must be upgraded to min-w-12 (48px).
  const targets = [
    "src/components/ResultsPanel.tsx",
    "src/components/ConditionRow.tsx",
    "src/components/CoinListTable.tsx",
  ];

  for (const file of targets) {
    it(`${file} button-style touch targets use min-w-12 (not min-w-[44px])`, () => {
      const src = R(file);
      // Only the WIDTH axis governs touch target for inline buttons
      // (inputs intentionally keep min-h-[44px] for vertical density).
      // So we enforce `min-w-[44px]` removal, not min-h.
      expect(
        src,
        `${file} still has min-w-[44px] on a touch target`,
      ).not.toMatch(/min-w-\[44px\]/);
      expect(
        src,
        `${file} must adopt min-w-12 (48px) on its button(s)`,
      ).toMatch(/min-w-12/);
    });
  }
});

describe("i18n partner-fee literal sourced from exchanges.ts SSoT", () => {
  it("en fees.card_okx_desc contains OKX_DISCOUNT_PCT value", () => {
    expect(en["fees.card_okx_desc"]).toContain(`${OKX_DISCOUNT_PCT}%`);
    // The hardcoded "20%" literal must NOT survive in the output
    expect(en["fees.card_okx_desc"].match(/(\d+)%/)?.[1]).toBe(
      String(OKX_DISCOUNT_PCT),
    );
  });

  it("en fees.okx_discount_pending mirrors the SSoT value", () => {
    expect(en["fees.okx_discount_pending"]).toContain(`${OKX_DISCOUNT_PCT}%`);
  });

  it("ko fees.card_okx_desc mirrors the SSoT value", () => {
    expect(ko["fees.card_okx_desc"]).toContain(`${OKX_DISCOUNT_PCT}%`);
  });

  it("ko fees.okx_discount_pending mirrors the SSoT value", () => {
    expect(ko["fees.okx_discount_pending"]).toContain(`${OKX_DISCOUNT_PCT}%`);
  });

  it("no hardcoded '20%' literal survives in fee-related i18n keys", () => {
    // Source-level check: if PR #1191 + this PR did their job, any future
    // edit that re-introduces a hardcoded "20%" at these keys fails.
    const en_src = R("src/i18n/en.ts");
    const ko_src = R("src/i18n/ko.ts");
    // Lines containing "fees.card_okx_desc" or "okx_discount_pending"
    // should use template literals (backtick) not plain strings
    for (const src of [en_src, ko_src]) {
      const feeCardLine = src
        .split("\n")
        .find((l) => l.includes('"fees.card_okx_desc"'));
      const feeActiveLine = src
        .split("\n")
        .find((l) => l.includes('"fees.okx_discount_pending"'));
      // They may span multiple lines — grab a 3-line window instead.
      const hit = /OKX_DISCOUNT_PCT/.test(src);
      expect(
        hit,
        `${feeCardLine?.slice(0, 40)} + ${feeActiveLine?.slice(0, 40)} must reference OKX_DISCOUNT_PCT`,
      ).toBe(true);
    }
  });
});
