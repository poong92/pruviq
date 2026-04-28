/**
 * Field.test.tsx — contract test for Field primitive (W1-1d).
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Field from "../../src/components/ui/Field";

afterEach(cleanup);

describe("Field primitive", () => {
  test("default renders label + input wired by id", () => {
    const { container } = render(<Field label="Stop Loss" />);
    const input = container.querySelector("input")!;
    const label = container.querySelector("label")!;
    expect(input).toBeTruthy();
    expect(label).toBeTruthy();
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).toBeTruthy();
    expect(label.textContent).toContain("Stop Loss");
    expect(input.getAttribute("type")).toBe("text");
  });

  test("required → asterisk in label + aria-required + required attr", () => {
    const { container } = render(<Field label="Email" required />);
    const input = container.querySelector("input")!;
    const label = container.querySelector("label")!;
    expect(label.textContent).toContain("*");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.required).toBe(true);
  });

  test("error → role=alert + aria-invalid + aria-describedby + down border", () => {
    const { container } = render(<Field label="SL" error="Must be > 0" />);
    const input = container.querySelector("input")!;
    const errEl = container.querySelector('[role="alert"]')!;
    expect(errEl).toBeTruthy();
    expect(errEl.textContent).toBe("Must be > 0");
    expect(errEl.getAttribute("aria-live")).toBe("assertive");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(errEl.id);
    expect(input.className).toContain("border-[--color-down]");
  });

  test("helper text wires aria-describedby when no error", () => {
    const { container } = render(<Field label="SL" helper="Range 5-20%" />);
    const input = container.querySelector("input")!;
    const helper = container.querySelector('[id$="-helper"]')!;
    expect(helper).toBeTruthy();
    expect(helper.textContent).toBe("Range 5-20%");
    expect(input.getAttribute("aria-describedby")).toBe(helper.id);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  test("error supersedes helper (helper hidden when error present)", () => {
    const { container } = render(<Field label="x" helper="hint" error="bad" />);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.querySelector('[id$="-helper"]')).toBeNull();
  });

  test("type=number passes through", () => {
    const { container } = render(<Field label="Qty" type="number" />);
    expect(container.querySelector("input")!.getAttribute("type")).toBe(
      "number",
    );
  });

  test("prefix/suffix slots render with non-interactive aria", () => {
    const { container } = render(
      <Field label="Price" prefix="$" suffix="USDT" />,
    );
    const all = container.querySelectorAll("span");
    expect(all.length).toBeGreaterThanOrEqual(2);
    const text = Array.from(all)
      .map((s) => s.textContent)
      .join("");
    expect(text).toContain("$");
    expect(text).toContain("USDT");
  });

  test("size=sm uses 32px input min height", () => {
    const { container } = render(<Field label="x" size="sm" />);
    expect(container.querySelector("input")!.className).toContain(
      "min-h-[32px]",
    );
  });

  test("size=lg uses 48px input min height", () => {
    const { container } = render(<Field label="x" size="lg" />);
    expect(container.querySelector("input")!.className).toContain(
      "min-h-[48px]",
    );
  });

  test("disabled disables input + dims label", () => {
    const { container } = render(<Field label="x" disabled />);
    const input = container.querySelector("input")!;
    const label = container.querySelector("label")!;
    expect(input.disabled).toBe(true);
    expect(label.className).toContain("opacity-50");
  });

  test("custom id override is respected", () => {
    const { container } = render(<Field label="x" id="my-field" />);
    const input = container.querySelector("input")!;
    expect(input.id).toBe("my-field");
    expect(container.querySelector("label")!.getAttribute("for")).toBe(
      "my-field",
    );
  });

  test("fullWidth adds w-full", () => {
    const { container } = render(<Field label="x" fullWidth />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("w-full");
  });
});
