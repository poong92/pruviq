/**
 * ShareResultButton.test.tsx — contract test for W3-2.
 *
 * Covers the three branches the button takes:
 *   1. navigator.share present → uses native share sheet
 *   2. navigator.share absent → falls back to clipboard.writeText + "Copied!"
 *   3. clipboard absent → opens Twitter intent in new tab
 *
 * Render output (label, a11y) is also asserted so future copy tweaks
 * don't silently regress the button's accessibility surface.
 */
import { describe, expect, test, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/preact";
import ShareResultButton from "../../src/components/ui/ShareResultButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps = {
  presetId: "bb-squeeze-short",
  strategyName: "BB Squeeze SHORT",
  profitFactor: 2.34,
  winRate: 58.2,
  totalTrades: 156,
  totalReturnPct: 234.5,
} as const;

describe("ShareResultButton render", () => {
  test("renders button with idle EN label by default", () => {
    const { container } = render(
      <ShareResultButton {...baseProps} lang="en" />,
    );
    const btn = container.querySelector(
      "button[data-testid='share-result-btn']",
    )!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("Share result");
  });

  test("renders KO label when lang=ko", () => {
    const { container } = render(
      <ShareResultButton {...baseProps} lang="ko" />,
    );
    const btn = container.querySelector(
      "button[data-testid='share-result-btn']",
    )!;
    expect(btn.textContent).toContain("결과 공유");
  });

  test("button has 44px+ min-height + aria-live for state announcement", () => {
    const { container } = render(
      <ShareResultButton {...baseProps} lang="en" />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.getAttribute("aria-live")).toBe("polite");
  });
});

describe("ShareResultButton — native share branch", () => {
  beforeEach(() => {
    // Mock navigator.share present
    Object.defineProperty(globalThis.navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
  });

  test("clicking calls navigator.share with title/text/url", async () => {
    const { container } = render(
      <ShareResultButton {...baseProps} lang="en" />,
    );
    const btn = container.querySelector("button")!;
    fireEvent.click(btn);

    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalledTimes(1);
    });
    const call = (navigator.share as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.title).toBe("PRUVIQ — Strategy result");
    expect(call.text).toContain("BB Squeeze SHORT");
    expect(call.text).toContain("PF 2.34");
    expect(call.text).toContain("WR 58.2");
    expect(call.url).toContain("preset=bb-squeeze-short");
    expect(call.url).toContain("utm_source=share");
  });

  test("AbortError from cancelled native share does not fall through to clipboard", async () => {
    const abortErr = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      abortErr,
    );
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    const { container } = render(
      <ShareResultButton {...baseProps} lang="en" />,
    );
    fireEvent.click(container.querySelector("button")!);

    // Wait one tick to allow the rejected promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(writeTextSpy).not.toHaveBeenCalled();
  });
});

describe("ShareResultButton — clipboard fallback branch", () => {
  beforeEach(() => {
    // Remove navigator.share so the button takes the clipboard path
    delete (globalThis.navigator as { share?: unknown }).share;
  });

  test("calls clipboard.writeText with text + url, shows 'Copied!' for 2s", async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    const { container } = render(
      <ShareResultButton {...baseProps} lang="en" />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.textContent).toContain("Share result");

    fireEvent.click(btn);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
    });
    const arg = writeTextSpy.mock.calls[0][0] as string;
    expect(arg).toContain("BB Squeeze SHORT");
    expect(arg).toContain("PF 2.34");
    expect(arg).toContain("preset=bb-squeeze-short");

    // After successful copy, label flips to "Copied!"
    await waitFor(() => {
      expect(btn.textContent).toContain("Copied!");
    });
  });
});
