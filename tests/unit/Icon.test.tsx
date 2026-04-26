/**
 * Icon.test.tsx — contract test for W2-3.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Icon, {
  indicatorIconNames,
  type IndicatorIconName,
} from "../../src/components/ui/Icon";

afterEach(cleanup);

describe("Icon primitive", () => {
  test("default decorative render → role=presentation + aria-hidden", () => {
    const { container } = render(<Icon name="bb" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("role")).toBe("presentation");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("aria-label")).toBeNull();
  });

  test("default size is 20×20", () => {
    const { container } = render(<Icon name="bb" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
  });

  test("custom size applies to both width and height", () => {
    const { container } = render(<Icon name="bb" size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  test("ariaLabel switches to role=img + label", () => {
    const { container } = render(<Icon name="rsi" ariaLabel="RSI indicator" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("RSI indicator");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  test("renders <use> referencing sprite#name", () => {
    const { container } = render(<Icon name="macd" />);
    const use = container.querySelector("use")!;
    expect(use).toBeTruthy();
    expect(use.getAttribute("href")).toBe("/sprites/indicators.svg#macd");
  });

  test("custom spriteUrl override is respected", () => {
    const { container } = render(
      <Icon name="atr" spriteUrl="/custom/path.svg" />,
    );
    const use = container.querySelector("use")!;
    expect(use.getAttribute("href")).toBe("/custom/path.svg#atr");
  });

  test("data-icon attribute exposes the name (analytics/testing hook)", () => {
    const { container } = render(<Icon name="ema" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-icon")).toBe("ema");
  });

  test("custom class merges after base inline-block", () => {
    const { container } = render(
      <Icon name="bb" class="text-[--color-accent] mr-2" />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("inline-block");
    expect(svg.getAttribute("class")).toContain("text-[--color-accent]");
    expect(svg.getAttribute("class")).toContain("mr-2");
  });

  test("indicatorIconNames exports all 14 names", () => {
    expect(indicatorIconNames.length).toBe(14);
    expect(indicatorIconNames).toContain("bb");
    expect(indicatorIconNames).toContain("supertrend");
  });

  test("all 14 names render without runtime error", () => {
    for (const name of indicatorIconNames) {
      const n: IndicatorIconName = name;
      const { container } = render(<Icon name={n} />);
      const use = container.querySelector("use");
      expect(use).toBeTruthy();
      expect(use!.getAttribute("href")).toBe(`/sprites/indicators.svg#${name}`);
      cleanup();
    }
  });
});
