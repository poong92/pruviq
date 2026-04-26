/**
 * Reveal.test.tsx — contract test for W1-2 / W2-2.
 *
 * Covers the manual `trigger` mode + the typed pass-through props that
 * W2-2 added (data-testid, aria-label, aria-live, role, id). The `as`
 * polymorphic prop is also exercised so consumers know they can wrap
 * <section> / <article> / <li> / <span> without losing semantics.
 *
 * IntersectionObserver auto-mode isn't tested here — happy-dom doesn't
 * polyfill IO and the existing global Layout.astro observer covers
 * that path in E2E.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Reveal from "../../src/components/ui/Reveal";

afterEach(cleanup);

describe("Reveal primitive — manual trigger mode", () => {
  test("default tag is <div> with .reveal class", () => {
    const { container } = render(
      <Reveal trigger={false}>
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe("div");
    expect(root.className).toContain("reveal");
  });

  test("trigger=false renders without .visible (initial fade-out state)", () => {
    const { container } = render(
      <Reveal trigger={false}>
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("visible");
  });

  test("merges custom class with .reveal", () => {
    const { container } = render(
      <Reveal trigger={false} class="my-extra reveal-child">
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("reveal");
    expect(root.className).toContain("my-extra");
    expect(root.className).toContain("reveal-child");
  });

  test("data-testid passes through to wrapper element", () => {
    const { container } = render(
      <Reveal trigger={false} data-testid="my-reveal">
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-testid")).toBe("my-reveal");
  });

  test("aria-label, aria-live, role, id pass through", () => {
    const { container } = render(
      <Reveal
        trigger={false}
        aria-label="results"
        aria-live="polite"
        role="status"
        id="results-region"
      >
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe("results");
    expect(root.getAttribute("aria-live")).toBe("polite");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("id")).toBe("results-region");
  });

  test("as='section' renders <section> while keeping reveal class", () => {
    const { container } = render(
      <Reveal trigger={false} as="section" data-testid="sect">
        <span>child</span>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe("section");
    expect(root.className).toContain("reveal");
    expect(root.getAttribute("data-testid")).toBe("sect");
  });

  test("renders children content", () => {
    const { container } = render(
      <Reveal trigger={false}>
        <span data-testid="payload">hello</span>
      </Reveal>,
    );
    const payload = container.querySelector(
      "[data-testid='payload']",
    ) as HTMLElement;
    expect(payload).toBeTruthy();
    expect(payload.textContent).toBe("hello");
  });
});
