/**
 * Dashboard hydration + frontend LOW-tier hardening (PR 2026-04-19).
 *
 * frontend audit findings:
 *   - dashboard.astro hydrated 5 islands with `client:load` — TradingSettings,
 *     LivePositions, LiveTradeHistory are below-fold and should defer.
 *   - ErrorFallback.astro used an inline `onclick="location.reload()"` which
 *     blocks strict CSP (no 'unsafe-inline' possible).
 *   - EmailCapture.tsx threw on non-array corruption, which fell through
 *     to a `catch` that OVERWROTE the stored list with just the current
 *     email — losing any prior captures.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const R = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf-8");

describe("dashboard hydration defers below-fold islands", () => {
  // Components that should hydrate immediately (first-paint semantics).
  const IMMEDIATE = ["OKXConnectButton", "AutoTradingStatus"];
  // Components that should defer to client:visible.
  const DEFERRED = ["TradingSettings", "LivePositions", "LiveTradeHistory"];

  for (const page of [
    "src/pages/dashboard.astro",
    "src/pages/ko/dashboard.astro",
  ]) {
    it(`${page} — deferred components use client:visible`, () => {
      const src = R(page);
      for (const c of DEFERRED) {
        const loadPat = new RegExp(`<${c}\\s+client:load\\b`);
        const visPat = new RegExp(`<${c}\\s+client:visible\\b`);
        expect(src, `${page}: ${c} still uses client:load`).not.toMatch(
          loadPat,
        );
        expect(src, `${page}: ${c} missing client:visible`).toMatch(visPat);
      }
    });

    it(`${page} — immediate components remain client:load`, () => {
      const src = R(page);
      for (const c of IMMEDIATE) {
        // Must have a client:load usage somewhere
        const pat = new RegExp(`<${c}\\s+client:load\\b`);
        expect(
          src,
          `${page}: ${c} lost client:load (should stay immediate)`,
        ).toMatch(pat);
      }
    });
  }
});

describe("ErrorFallback uses CSP-friendly event binding", () => {
  const file = "src/components/ui/ErrorFallback.astro";
  const src = R(file);

  it("no inline onclick attribute", () => {
    // Inline onclick would require CSP 'unsafe-inline' for script execution.
    expect(src).not.toMatch(/onclick\s*=\s*"/);
  });

  it("uses delegated listener via data attribute", () => {
    expect(src).toMatch(/data-error-refresh/);
    expect(src).toMatch(/addEventListener\s*\(\s*["']click["']/);
  });
});

describe("EmailCapture corruption-safe localStorage handling", () => {
  const src = R("src/components/EmailCapture.tsx");

  it("does not throw on non-array — filters + keeps valid entries", () => {
    // Old pattern: `if (!Array.isArray(existing)) throw new Error("corrupt")`
    // which then fell through to a catch that overwrote the whole list.
    expect(src, "old throw-on-corrupt pattern still present").not.toMatch(
      /throw new Error\(\s*["']corrupt["']/,
    );
  });

  it("filters non-string entries defensively", () => {
    // The new logic: `.filter((v) => typeof v === "string")`
    expect(src).toMatch(/typeof\s+v\s*===\s*["']string["']/);
  });

  it("fallback no longer overwrites prior list with single email", () => {
    // The old catch wrote `JSON.stringify([email])` which destroyed prior
    // captures. New path preserves whatever was salvageable.
    const badFallback =
      /localStorage\.setItem\(\s*["']captured-emails["']\s*,\s*JSON\.stringify\(\[email\]\)\s*\)/;
    expect(src, "old destructive fallback still present").not.toMatch(
      badFallback,
    );
  });
});
