/**
 * Card.test.tsx — contract test for Card primitive (W1-1c).
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import Card from "../../src/components/ui/Card";

afterEach(cleanup);

describe("Card primitive", () => {
  test("default renders <div> with default variant + md padding/radius", () => {
    const { container } = render(<Card>Body</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.textContent).toBe("Body");
    expect(el.className).toContain("bg-[--color-bg-card]");
    expect(el.className).toContain("border-[--color-border]");
    expect(el.className).toContain("p-4");
    expect(el.className).toContain("rounded-lg");
  });

  test("variant=elevated adds shadow", () => {
    const { container } = render(<Card variant="elevated">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("shadow-[var(--shadow-md)]");
  });

  test("variant=glass uses backdrop-blur", () => {
    const { container } = render(<Card variant="glass">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("backdrop-blur-md");
  });

  test("variant=featured uses accent tokens", () => {
    const { container } = render(<Card variant="featured">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-[--color-accent]/5");
    expect(el.className).toContain("border-[--color-accent]/30");
  });

  test("variant=subtle has transparent bg", () => {
    const { container } = render(<Card variant="subtle">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-transparent");
  });

  test("padding=none omits padding utility", () => {
    const { container } = render(<Card padding="none">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toMatch(/\bp-[0-9]/);
  });

  test("padding=lg uses p-6", () => {
    const { container } = render(<Card padding="lg">x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("p-6");
  });

  test("radius=sm uses rounded (no -lg/-xl)", () => {
    const { container } = render(<Card radius="sm">x</Card>);
    const el = container.firstChild as HTMLElement;
    // Match `rounded` as a whole token (not as prefix of rounded-lg/-xl/-md)
    expect(/(^|\s)rounded(\s|$)/.test(el.className)).toBe(true);
    expect(el.className).not.toContain("rounded-lg");
    expect(el.className).not.toContain("rounded-xl");
  });

  test("interactive adds hover + focus-visible ring", () => {
    const { container } = render(<Card interactive>x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("cursor-pointer");
    expect(el.className).toContain("hover:border-[--color-accent]");
    expect(el.className).toContain("focus-visible:ring-[--color-accent]");
  });

  test('as="section" renders <section>', () => {
    const { container } = render(<Card as="section">x</Card>);
    expect(container.querySelector("section")).toBeTruthy();
    expect(container.querySelector("div")).toBeNull();
  });

  test('as="a" + href renders <a> with href', () => {
    const { container } = render(
      <Card as="a" href="/strategies/atr-breakout">
        Strategy
      </Card>,
    );
    const a = container.querySelector("a")!;
    expect(a).toBeTruthy();
    expect(a.getAttribute("href")).toBe("/strategies/atr-breakout");
  });

  test('as="a" + target="_blank" auto-adds rel="noopener noreferrer"', () => {
    const { container } = render(
      <Card as="a" href="https://okx.com" target="_blank">
        OKX
      </Card>,
    );
    const a = container.querySelector("a")!;
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("custom class merges after variant classes", () => {
    const { container } = render(
      <Card variant="featured" class="ml-2 mt-3">
        x
      </Card>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("ml-2");
    expect(el.className).toContain("mt-3");
    expect(el.className).toContain("bg-[--color-accent]/5");
  });
});
