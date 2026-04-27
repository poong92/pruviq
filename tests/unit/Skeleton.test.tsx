/**
 * Skeleton.test.tsx — contract test for W1-1f.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Skeleton from "../../src/components/ui/Skeleton";

afterEach(cleanup);

describe("Skeleton primitive", () => {
  test("default rect variant renders aria-hidden span with .skeleton class", () => {
    const { container } = render(<Skeleton width={120} height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("skeleton");
    expect(el.className).toContain("rounded");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.getAttribute("role")).toBeNull();
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("20px");
  });

  test("variant=text uses text-line preset (h-[1em])", () => {
    const { container } = render(<Skeleton variant="text" width="80%" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-[1em]");
    expect(el.className).toContain("rounded-sm");
    expect(el.style.width).toBe("80%");
  });

  test("variant=circle with width auto-applies same height (1:1)", () => {
    const { container } = render(<Skeleton variant="circle" width={32} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("rounded-full");
    expect(el.style.width).toBe("32px");
    expect(el.style.height).toBe("32px");
  });

  test("variant=circle with height auto-applies same width (1:1)", () => {
    const { container } = render(<Skeleton variant="circle" height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("2rem");
    expect(el.style.height).toBe("2rem");
  });

  test("aria-label switches to role=img + label (announced by AT)", () => {
    const { container } = render(
      <Skeleton aria-label="Loading equity chart" />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("Loading equity chart");
    expect(el.getAttribute("aria-hidden")).toBeNull();
  });

  test("number width is converted to px", () => {
    const { container } = render(<Skeleton width={48} height={48} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("48px");
  });

  test("string width passes through unchanged (e.g., %, rem)", () => {
    const { container } = render(<Skeleton width="100%" height="3rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("100%");
    expect(el.style.height).toBe("3rem");
  });

  test("custom class merges after base classes", () => {
    const { container } = render(
      <Skeleton variant="text" width="80%" class="my-4 max-w-prose" />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("skeleton");
    expect(el.className).toContain("my-4");
    expect(el.className).toContain("max-w-prose");
  });

  test("data-testid passes through", () => {
    const { container } = render(
      <Skeleton width={20} height={20} data-testid="x" />,
    );
    expect(container.querySelector('[data-testid="x"]')).toBeTruthy();
  });
});
