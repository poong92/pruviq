/**
 * Tabs.test.tsx — contract test for W1-1e.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import Tabs, { TabPanel, type TabItem } from "../../src/components/ui/Tabs";
import { useState } from "preact/hooks";

afterEach(cleanup);

type V = "summary" | "trades" | "monthly";
const items: TabItem<V>[] = [
  { value: "summary", label: "Summary" },
  { value: "trades", label: "Trades", badge: "30" },
  { value: "monthly", label: "Monthly" },
];

function Harness({
  initial = "summary" as V,
  manualActivation = false,
}: {
  initial?: V;
  manualActivation?: boolean;
}) {
  const [v, setV] = useState<V>(initial);
  return (
    <div>
      <Tabs
        tabs={items}
        value={v}
        onChange={setV}
        idPrefix="t"
        manualActivation={manualActivation}
      />
      <TabPanel idPrefix="t" active={v} value="summary">
        S
      </TabPanel>
      <TabPanel idPrefix="t" active={v} value="trades">
        T
      </TabPanel>
      <TabPanel idPrefix="t" active={v} value="monthly">
        M
      </TabPanel>
    </div>
  );
}

describe("Tabs primitive", () => {
  test("renders role=tablist + 3 role=tab buttons", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  test("active tab has aria-selected=true + tabindex=0; others -1", () => {
    const { container } = render(<Harness initial="trades" />);
    const tabs = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ) as HTMLButtonElement[];
    const findByValue = (val: string) =>
      tabs.find((t) => t.getAttribute("data-tab-value") === val)!;
    expect(findByValue("trades").getAttribute("aria-selected")).toBe("true");
    expect(findByValue("summary").getAttribute("aria-selected")).toBe("false");
    expect(findByValue("trades").tabIndex).toBe(0);
    expect(findByValue("summary").tabIndex).toBe(-1);
  });

  test("clicking a tab fires onChange + updates active", () => {
    const { container } = render(<Harness />);
    const tradesTab = container.querySelector(
      '[data-tab-value="trades"]',
    ) as HTMLButtonElement;
    fireEvent.click(tradesTab);
    const tradesNow = container.querySelector('[data-tab-value="trades"]')!;
    expect(tradesNow.getAttribute("aria-selected")).toBe("true");
  });

  test("badge renders next to label", () => {
    const { container } = render(<Harness />);
    const tradesTab = container.querySelector('[data-tab-value="trades"]')!;
    expect(tradesTab.textContent).toContain("Trades");
    expect(tradesTab.textContent).toContain("30");
  });

  test("ArrowRight moves active tab to next (focus follows by default)", () => {
    const { container } = render(<Harness />);
    const summary = container.querySelector(
      '[data-tab-value="summary"]',
    ) as HTMLButtonElement;
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    const trades = container.querySelector('[data-tab-value="trades"]')!;
    expect(trades.getAttribute("aria-selected")).toBe("true");
  });

  test("ArrowLeft from first wraps to last", () => {
    const { container } = render(<Harness initial="summary" />);
    const summary = container.querySelector(
      '[data-tab-value="summary"]',
    ) as HTMLButtonElement;
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowLeft" });
    expect(
      container
        .querySelector('[data-tab-value="monthly"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  test("Home jumps to first, End jumps to last", () => {
    const { container } = render(<Harness initial="trades" />);
    const trades = container.querySelector(
      '[data-tab-value="trades"]',
    ) as HTMLButtonElement;
    trades.focus();
    fireEvent.keyDown(trades, { key: "End" });
    expect(
      container
        .querySelector('[data-tab-value="monthly"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(
      container.querySelector(
        '[data-tab-value="monthly"]',
      ) as HTMLButtonElement,
      { key: "Home" },
    );
    expect(
      container
        .querySelector('[data-tab-value="summary"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  test("manualActivation: ArrowRight moves focus only, Enter activates", () => {
    const { container } = render(<Harness manualActivation />);
    const summary = container.querySelector(
      '[data-tab-value="summary"]',
    ) as HTMLButtonElement;
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    // active should still be summary (not yet activated)
    expect(
      container
        .querySelector('[data-tab-value="summary"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      container
        .querySelector('[data-tab-value="trades"]')!
        .getAttribute("aria-selected"),
    ).toBe("false");
    // Activate
    const trades = container.querySelector(
      '[data-tab-value="trades"]',
    ) as HTMLButtonElement;
    fireEvent.keyDown(trades, { key: "Enter" });
    expect(
      container
        .querySelector('[data-tab-value="trades"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  test("disabled tab is skipped by arrow navigation + click no-op", () => {
    const itemsWithDisabled: TabItem<V>[] = [
      { value: "summary", label: "S" },
      { value: "trades", label: "T", disabled: true },
      { value: "monthly", label: "M" },
    ];
    function H() {
      const [v, setV] = useState<V>("summary");
      return (
        <Tabs tabs={itemsWithDisabled} value={v} onChange={setV} idPrefix="d" />
      );
    }
    const { container } = render(<H />);
    const summary = container.querySelector(
      '[data-tab-value="summary"]',
    ) as HTMLButtonElement;
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    // Should jump past disabled `trades` to `monthly`
    expect(
      container
        .querySelector('[data-tab-value="monthly"]')!
        .getAttribute("aria-selected"),
    ).toBe("true");
    // Click on disabled does nothing
    const trades = container.querySelector(
      '[data-tab-value="trades"]',
    ) as HTMLButtonElement;
    fireEvent.click(trades);
    expect(trades.getAttribute("aria-selected")).toBe("false");
  });

  test("aria-controls on tab links to panel id", () => {
    const { container } = render(<Harness />);
    const summary = container.querySelector('[data-tab-value="summary"]')!;
    const controls = summary.getAttribute("aria-controls")!;
    const panel = container.querySelector(`#${controls}`)!;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(summary.id);
  });

  test("TabPanel mount=lazy renders only the active panel", () => {
    const { container } = render(<Harness initial="summary" />);
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels.length).toBe(1);
    expect(panels[0].textContent).toBe("S");
  });

  test("variant=pills uses rounded-full + filled active style", () => {
    function H() {
      const [v, setV] = useState<V>("summary");
      return <Tabs tabs={items} value={v} onChange={setV} variant="pills" />;
    }
    const { container } = render(<H />);
    const summary = container.querySelector('[data-tab-value="summary"]')!;
    expect(summary.className).toContain("rounded-full");
    expect(summary.className).toContain("bg-[--color-accent]");
  });
});
