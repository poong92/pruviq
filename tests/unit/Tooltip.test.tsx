/**
 * Tooltip.test.tsx — contract test for W1-1i.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import Tooltip from "../../src/components/ui/Tooltip";

afterEach(cleanup);

describe("Tooltip primitive", () => {
  test("default state — no tooltip rendered", () => {
    const { container } = render(
      <Tooltip content="Hint">
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test("focus shows tooltip immediately + sets aria-describedby", () => {
    const { container } = render(
      <Tooltip content="Hint">
        <button data-testid="t">Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.focus(wrapper);
    const tip = container.querySelector('[role="tooltip"]')!;
    expect(tip).toBeTruthy();
    expect(tip.textContent).toContain("Hint");
    expect(wrapper.getAttribute("aria-describedby")).toBe(tip.id);
  });

  test("blur hides tooltip + clears aria-describedby", () => {
    const { container } = render(
      <Tooltip content="Hint">
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.focus(wrapper);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
    fireEvent.blur(wrapper);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(wrapper.getAttribute("aria-describedby")).toBeNull();
  });

  test("hover triggers show after delay", async () => {
    const { container } = render(
      <Tooltip content="Hint" delay={50}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.mouseEnter(wrapper);
    // Before delay elapses, tooltip is not yet visible
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    // Wait for the show timer + flush
    await waitFor(
      () => expect(container.querySelector('[role="tooltip"]')).toBeTruthy(),
      { timeout: 200 },
    );
  });

  test("mouseleave cancels pending show + hides if shown", async () => {
    const { container } = render(
      <Tooltip content="Hint" delay={200}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.mouseEnter(wrapper);
    // Don't wait for the 200ms delay — leave first
    fireEvent.mouseLeave(wrapper);
    // After waiting longer than the original delay, tooltip should still be hidden
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test("touch shows immediately + auto-hides after touchHideMs", async () => {
    const { container } = render(
      <Tooltip content="Hint" touchHideMs={80}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.touchStart(wrapper);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
    await waitFor(
      () => expect(container.querySelector('[role="tooltip"]')).toBeNull(),
      { timeout: 300 },
    );
  });

  test("Escape hides while open", () => {
    const { container } = render(
      <Tooltip content="Hint">
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.focus(wrapper);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test("placement=right applies right-side classes", () => {
    const { container } = render(
      <Tooltip content="Hint" placement="right">
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.focus(wrapper);
    const tip = container.querySelector('[role="tooltip"]')!;
    expect(tip.getAttribute("data-placement")).toBe("right");
    expect(tip.className).toContain("left-full");
  });

  test("disabled=true bypasses tooltip rendering entirely", () => {
    const { container } = render(
      <Tooltip content="Hint" disabled>
        <button data-testid="b">Trigger</button>
      </Tooltip>,
    );
    const btn = container.querySelector('[data-testid="b"]')!;
    expect(btn).toBeTruthy();
    // No wrapper span with hover handlers
    fireEvent.focus(btn);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test("custom tooltipClass merges onto bubble", () => {
    const { container } = render(
      <Tooltip content="Hint" tooltipClass="text-base bg-red-500">
        <button>x</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.focus(wrapper);
    const tip = container.querySelector('[role="tooltip"]')!;
    expect(tip.className).toContain("text-base");
    expect(tip.className).toContain("bg-red-500");
  });

  test("delay=0 shows immediately on hover", () => {
    const { container } = render(
      <Tooltip content="Hint" delay={0}>
        <button>x</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector("span")!;
    fireEvent.mouseEnter(wrapper);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
  });
});
