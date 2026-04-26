/**
 * Button.test.tsx — contract test for Button primitive (W1-1).
 *
 * Verifies the public API the rest of the codebase depends on:
 *   - default render → <button> with primary variant + md size
 *   - variant prop → swaps color classes
 *   - loading → renders spinner + sets aria-busy + disables button
 *   - disabled → disables button (no aria-busy)
 *   - as="a" + href → renders <a>; target=_blank auto-adds rel=noopener
 *   - 44px touch target on md size (a11y minimum)
 */
import { describe, expect, test } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Button from "../../src/components/ui/Button";
import { afterEach } from "vitest";

afterEach(cleanup);

describe("Button primitive", () => {
  test("default renders a <button> with primary variant + md size", () => {
    const { container } = render(<Button>Run</Button>);
    const btn = container.querySelector("button")!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe("Run");
    expect(btn.className).toContain("bg-[--color-accent]");
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.getAttribute("type")).toBe("button");
  });

  test("variant=secondary swaps to bordered transparent style", () => {
    const { container } = render(<Button variant="secondary">Cancel</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("border-[--color-border]");
    expect(btn.className).toContain("bg-transparent");
    // Should NOT have a non-prefixed `bg-[--color-accent]` rule
    // (hover/focus prefixed ones are fine — they're state, not base).
    const hasBaseAccentBg = / bg-\[--color-accent\](?!\S)/.test(
      ` ${btn.className} `,
    );
    expect(hasBaseAccentBg).toBe(false);
  });

  test("variant=danger uses --color-down tokens", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("text-[--color-down]");
    expect(btn.className).toContain("border-[--color-down]");
  });

  test("size=sm uses 32px min height (dense inline only)", () => {
    const { container } = render(<Button size="sm">x</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("min-h-[32px]");
    expect(btn.className).not.toContain("min-h-[44px]");
  });

  test("size=lg uses 48px min height (hero CTA)", () => {
    const { container } = render(<Button size="lg">Get started</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("min-h-[48px]");
  });

  test("loading renders spinner + sets aria-busy + disables", () => {
    const { container } = render(<Button loading>Saving</Button>);
    const btn = container.querySelector("button")!;
    const spinner = btn.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.disabled).toBe(true);
  });

  test("disabled prop disables button without aria-busy", () => {
    const { container } = render(<Button disabled>Locked</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBeNull();
  });

  test('as="a" + href renders an anchor', () => {
    const { container } = render(
      <Button as="a" href="/simulate">
        Open
      </Button>,
    );
    const a = container.querySelector("a")!;
    expect(a).toBeTruthy();
    expect(a.getAttribute("href")).toBe("/simulate");
    expect(container.querySelector("button")).toBeNull();
  });

  test('as="a" + target="_blank" auto-adds rel="noopener noreferrer"', () => {
    const { container } = render(
      <Button as="a" href="https://okx.com" target="_blank">
        OKX
      </Button>,
    );
    const a = container.querySelector("a")!;
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test('as="a" disabled state strips href + sets aria-disabled', () => {
    const { container } = render(
      <Button as="a" href="/x" disabled>
        Locked link
      </Button>,
    );
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBeNull();
    expect(a.getAttribute("aria-disabled")).toBe("true");
  });

  test("fullWidth adds w-full class", () => {
    const { container } = render(<Button fullWidth>Full</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("w-full");
  });

  test("iconOnly + size=md produces 44×44 square", () => {
    const { container } = render(
      <Button iconOnly aria-label="Close">
        ×
      </Button>,
    );
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("w-11");
    expect(btn.className).toContain("h-11");
    expect(btn.getAttribute("aria-label")).toBe("Close");
  });

  test("focus-visible ring is wired (a11y)", () => {
    const { container } = render(<Button>Focus</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("focus-visible:ring-2");
    expect(btn.className).toContain("focus-visible:ring-[--color-accent]");
  });
});
