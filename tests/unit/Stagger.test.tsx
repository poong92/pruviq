/**
 * Stagger.test.tsx — contract test for W1-2 / W2-2.
 *
 * Mirror of Reveal.test.tsx since Stagger has the same manual `trigger`
 * mode + the same typed pass-through props. The 80ms cascade itself is
 * pure CSS (.reveal-child > * { transition-delay: nth-child × 80ms })
 * and is verified at the page level by visual regression / E2E.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Stagger from "../../src/components/ui/Stagger";

afterEach(cleanup);

describe("Stagger primitive — manual trigger mode", () => {
  test("default tag is <div> with .reveal-child class", () => {
    const { container } = render(
      <Stagger trigger={false}>
        <span>a</span>
        <span>b</span>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe("div");
    expect(root.className).toContain("reveal-child");
  });

  test("trigger=false renders without .visible (initial fade-out)", () => {
    const { container } = render(
      <Stagger trigger={false}>
        <span>a</span>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("visible");
  });

  test("merges custom class with .reveal-child", () => {
    const { container } = render(
      <Stagger trigger={false} class="grid grid-cols-3">
        <span>a</span>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("reveal-child");
    expect(root.className).toContain("grid");
    expect(root.className).toContain("grid-cols-3");
  });

  test("data-testid passes through to wrapper", () => {
    const { container } = render(
      <Stagger trigger={false} data-testid="my-stagger">
        <span>a</span>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-testid")).toBe("my-stagger");
  });

  test("aria-label, aria-live, role, id pass through", () => {
    const { container } = render(
      <Stagger
        trigger={false}
        aria-label="card grid"
        aria-live="polite"
        role="list"
        id="stagger-region"
      >
        <span>a</span>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe("card grid");
    expect(root.getAttribute("aria-live")).toBe("polite");
    expect(root.getAttribute("role")).toBe("list");
    expect(root.getAttribute("id")).toBe("stagger-region");
  });

  test("as='ul' renders <ul> while keeping reveal-child class", () => {
    const { container } = render(
      <Stagger trigger={false} as="ul" data-testid="lst">
        <li>a</li>
        <li>b</li>
      </Stagger>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe("ul");
    expect(root.className).toContain("reveal-child");
    expect(root.getAttribute("data-testid")).toBe("lst");
  });

  test("renders all children", () => {
    const { container } = render(
      <Stagger trigger={false}>
        <span data-testid="c1">A</span>
        <span data-testid="c2">B</span>
        <span data-testid="c3">C</span>
      </Stagger>,
    );
    expect(container.querySelector("[data-testid='c1']")?.textContent).toBe(
      "A",
    );
    expect(container.querySelector("[data-testid='c2']")?.textContent).toBe(
      "B",
    );
    expect(container.querySelector("[data-testid='c3']")?.textContent).toBe(
      "C",
    );
  });
});
