/**
 * EquitySparkline.test.tsx — contract test for W2-1.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import EquitySparkline from "../../src/components/ui/EquitySparkline";

afterEach(cleanup);

describe("EquitySparkline primitive", () => {
  test("renders <figure> + <svg> with aria-label", () => {
    const { container } = render(
      <EquitySparkline data={[0, 1, 2, 3]} ariaLabel="Equity +3%" />,
    );
    const figure = container.querySelector("figure")!;
    const svg = container.querySelector("svg")!;
    expect(figure).toBeTruthy();
    expect(svg).toBeTruthy();
    expect(figure.getAttribute("aria-label")).toBe("Equity +3%");
    expect(svg.getAttribute("aria-label")).toBe("Equity +3%");
    expect(svg.querySelector("title")?.textContent).toBe("Equity +3%");
  });

  test("empty data renders only baseline (no path)", () => {
    const { container } = render(
      <EquitySparkline data={[]} ariaLabel="No data" />,
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(0);
    // baseline line still renders
    expect(container.querySelector("line")).toBeTruthy();
  });

  test("auto variant + final positive → success colors (--color-up)", () => {
    const { container } = render(
      <EquitySparkline data={[0, 5, 10]} ariaLabel="x" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("--color-up");
  });

  test("auto variant + final negative → danger colors (--color-down)", () => {
    const { container } = render(
      <EquitySparkline data={[0, -2, -5]} ariaLabel="x" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("--color-down");
  });

  test("variant=neutral overrides auto and uses --color-accent", () => {
    const { container } = render(
      <EquitySparkline data={[0, 5, 10]} variant="neutral" ariaLabel="x" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("--color-accent");
    // Should NOT lock into up/down for the stroke gradient
    const grad = container.querySelector("linearGradient");
    expect(grad?.id).toBe("equity-grad-neutral");
  });

  test("variant=success forces success regardless of final value", () => {
    const { container } = render(
      <EquitySparkline data={[0, -5]} variant="success" ariaLabel="x" />,
    );
    const grad = container.querySelector("linearGradient");
    expect(grad?.id).toBe("equity-grad-success");
  });

  test("showEndpoint=true renders dot + halo (default)", () => {
    const { container } = render(
      <EquitySparkline data={[0, 1, 2]} ariaLabel="x" />,
    );
    const circles = container.querySelectorAll("circle");
    // halo + dot = 2 circles
    expect(circles.length).toBe(2);
  });

  test("showEndpoint=false omits dot + halo", () => {
    const { container } = render(
      <EquitySparkline data={[0, 1, 2]} ariaLabel="x" showEndpoint={false} />,
    );
    expect(container.querySelectorAll("circle").length).toBe(0);
  });

  test("showZero=false omits dashed baseline", () => {
    const { container } = render(
      <EquitySparkline data={[0, 1, 2]} ariaLabel="x" showZero={false} />,
    );
    expect(container.querySelector("line")).toBeNull();
  });

  test("showDrawdown=true adds an extra path for drawdown ribbon", () => {
    const { container: noDD } = render(
      <EquitySparkline data={[0, 5, 3, 6]} ariaLabel="x" />,
    );
    cleanup();
    const { container: withDD } = render(
      <EquitySparkline data={[0, 5, 3, 6]} ariaLabel="x" showDrawdown />,
    );
    expect(withDD.querySelectorAll("path").length).toBeGreaterThan(
      noDD.querySelectorAll("path").length,
    );
  });

  test("custom width and height applied to viewBox", () => {
    const { container } = render(
      <EquitySparkline
        data={[0, 1, 2]}
        ariaLabel="x"
        width={500}
        height={120}
      />,
    );
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe(
      "0 0 500 120",
    );
  });

  test("custom class merges onto wrapper figure", () => {
    const { container } = render(
      <EquitySparkline
        data={[0, 1, 2]}
        ariaLabel="x"
        class="border rounded mt-4"
      />,
    );
    const fig = container.querySelector("figure")!;
    expect(fig.className).toContain("border");
    expect(fig.className).toContain("rounded");
    expect(fig.className).toContain("mt-4");
  });
});
