/**
 * Badge.test.tsx — contract test for Badge primitive (W1-1b).
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Badge from "../../src/components/ui/Badge";

afterEach(cleanup);

describe("Badge primitive", () => {
  test("default renders <span> with neutral md variant", () => {
    const { container } = render(<Badge>NEW</Badge>);
    const el = container.querySelector("span")!;
    expect(el).toBeTruthy();
    expect(el.tagName).toBe("SPAN");
    expect(el.textContent).toBe("NEW");
    expect(el.className).toContain("border-[--color-border]");
    expect(el.className).toContain("text-[--color-text-muted]");
  });

  test("variant=success uses --color-up tokens", () => {
    const { container } = render(<Badge variant="success">UP</Badge>);
    const el = container.querySelector("span")!;
    expect(el.className).toContain("text-[--color-up]");
    expect(el.className).toContain("border-[--color-up]/30");
  });

  test("variant=danger uses --color-down tokens", () => {
    const { container } = render(<Badge variant="danger">KILLED</Badge>);
    const el = container.querySelector("span")!;
    expect(el.className).toContain("text-[--color-down]");
  });

  test("variant=warning uses --color-verified (amber) tokens", () => {
    const { container } = render(<Badge variant="warning">VERIFIED</Badge>);
    const el = container.querySelector("span")!;
    expect(el.className).toContain("text-[--color-verified]");
    expect(el.className).toContain("border-[--color-verified-border]");
  });

  test("size=sm uses 10px text", () => {
    const { container } = render(<Badge size="sm">x</Badge>);
    const el = container.querySelector("span")!;
    expect(el.className).toContain("text-[10px]");
  });

  test("size=lg uses 14px text", () => {
    const { container } = render(<Badge size="lg">FEATURED</Badge>);
    const el = container.querySelector("span")!;
    expect(el.className).toContain("text-sm");
  });

  test("dot prop adds a leading colored circle", () => {
    const { container } = render(
      <Badge dot variant="success">
        LIVE
      </Badge>,
    );
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeTruthy();
    expect(dot!.className).toContain("rounded-full");
    expect(dot!.className).toContain("bg-[--color-up]");
  });

  test("pulse + dot adds animate-pulse on the dot only", () => {
    const { container } = render(
      <Badge dot pulse variant="success">
        LIVE
      </Badge>,
    );
    const dot = container.querySelector('span[aria-hidden="true"]')!;
    expect(dot.className).toContain("animate-pulse");
    // Outer span must not have pulse animation
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).not.toContain("animate-pulse");
  });

  test("no dot prop = no decorative circle rendered", () => {
    const { container } = render(<Badge>plain</Badge>);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeNull();
  });

  test("aria-label passes through for screen readers", () => {
    const { container } = render(
      <Badge aria-label="Verified strategy">✓</Badge>,
    );
    const el = container.querySelector("span")!;
    expect(el.getAttribute("aria-label")).toBe("Verified strategy");
  });

  test("custom class merges after variant classes", () => {
    const { container } = render(
      <Badge variant="success" class="ml-2 shadow-md">
        UP
      </Badge>,
    );
    const el = container.querySelector("span")!;
    expect(el.className).toContain("ml-2");
    expect(el.className).toContain("shadow-md");
    expect(el.className).toContain("text-[--color-up]");
  });
});
