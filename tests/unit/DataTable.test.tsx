/**
 * DataTable.test.tsx — contract test for W4-1.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import DataTable, { type Column } from "../../src/components/ui/DataTable";

afterEach(cleanup);

interface Row {
  symbol: string;
  pct: number;
  trades: number;
}
const rows: Row[] = [
  { symbol: "BTC", pct: 12.5, trades: 30 },
  { symbol: "ETH", pct: -3.2, trades: 18 },
  { symbol: "SOL", pct: 47.1, trades: 22 },
];
const cols: Column<Row>[] = [
  { key: "symbol", label: "Symbol", sortable: true },
  { key: "pct", label: "Return %", sortable: true, align: "right" },
  { key: "trades", label: "Trades", sortable: true, align: "right" },
];

describe("DataTable primitive", () => {
  test("renders header + N rows + role=table", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const table = container.querySelector("table")!;
    expect(table).toBeTruthy();
    expect(table.getAttribute("role")).toBe("table");
    expect(table.querySelectorAll("thead th").length).toBe(3);
    expect(table.querySelectorAll("tbody tr").length).toBe(3);
  });

  test("aria-rowcount = data + header", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const table = container.querySelector("table")!;
    expect(table.getAttribute("aria-rowcount")).toBe("4");
  });

  test("loading=true renders skeleton rows + role=status", () => {
    const { container } = render(
      <DataTable data={rows} columns={cols} loading loadingRows={3} />,
    );
    const status = container.querySelector('[role="status"]')!;
    expect(status.getAttribute("aria-label")).toBe("Loading table data");
    expect(status.querySelectorAll("tbody tr").length).toBe(3);
    expect(status.querySelectorAll(".animate-pulse").length).toBe(9); // 3 rows × 3 cols
  });

  test("empty data shows default empty state with role=status", () => {
    const { container } = render(<DataTable data={[]} columns={cols} />);
    const status = container.querySelector('[role="status"]')!;
    expect(status).toBeTruthy();
    expect(status.textContent).toContain("No data available");
  });

  test("custom emptyState slot replaces default", () => {
    const { container } = render(
      <DataTable
        data={[]}
        columns={cols}
        emptyState={<p data-testid="my-empty">Try adjusting filters</p>}
      />,
    );
    expect(container.querySelector('[data-testid="my-empty"]')).toBeTruthy();
  });

  test("sortable=true header has aria-sort='none' initially + button", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const ths = container.querySelectorAll("thead th");
    const symHead = ths[0];
    expect(symHead.getAttribute("aria-sort")).toBe("none");
    expect(symHead.querySelector("button")).toBeTruthy();
  });

  test("clicking sortable header → asc → desc → none", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const symButton = container.querySelectorAll(
      "thead th button",
    )[0] as HTMLButtonElement;
    // 1st click → asc
    fireEvent.click(symButton);
    expect(
      container.querySelectorAll("thead th")[0].getAttribute("aria-sort"),
    ).toBe("ascending");
    // 2nd → desc
    fireEvent.click(symButton);
    expect(
      container.querySelectorAll("thead th")[0].getAttribute("aria-sort"),
    ).toBe("descending");
    // 3rd → none
    fireEvent.click(symButton);
    expect(
      container.querySelectorAll("thead th")[0].getAttribute("aria-sort"),
    ).toBe("none");
  });

  test("ascending numeric sort orders rows correctly", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const pctButton = container.querySelectorAll(
      "thead th button",
    )[1] as HTMLButtonElement;
    fireEvent.click(pctButton); // asc
    const cells = container.querySelectorAll("tbody tr td:first-child");
    const symbols = Array.from(cells).map((c) => c.textContent);
    // -3.2 < 12.5 < 47.1 → ETH, BTC, SOL
    expect(symbols).toEqual(["ETH", "BTC", "SOL"]);
  });

  test("defaultSort is applied at first render", () => {
    const { container } = render(
      <DataTable
        data={rows}
        columns={cols}
        defaultSort={{ key: "pct", direction: "desc" }}
      />,
    );
    const cells = container.querySelectorAll("tbody tr td:first-child");
    const symbols = Array.from(cells).map((c) => c.textContent);
    expect(symbols).toEqual(["SOL", "BTC", "ETH"]);
  });

  test("onRowClick fires with row + index", () => {
    let captured: { row: Row; index: number } | null = null;
    const { container } = render(
      <DataTable
        data={rows}
        columns={cols}
        onRowClick={(row, index) => {
          captured = { row, index };
        }}
      />,
    );
    const firstRow = container.querySelector("tbody tr")!;
    fireEvent.click(firstRow);
    expect(captured).not.toBeNull();
    expect(captured!.row.symbol).toBe("BTC");
    expect(captured!.index).toBe(0);
  });

  test("custom render() per column produces JSX cells", () => {
    const customCols: Column<Row>[] = [
      {
        key: "symbol",
        label: "Sym",
        render: (r) => (
          <strong data-testid={`sym-${r.symbol}`}>{r.symbol}</strong>
        ),
      },
    ];
    const { container } = render(
      <DataTable data={rows} columns={customCols} />,
    );
    expect(container.querySelector('[data-testid="sym-BTC"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sym-BTC"]')!.tagName).toBe(
      "STRONG",
    );
  });

  test("density=compact uses tighter padding", () => {
    const { container } = render(
      <DataTable data={rows} columns={cols} density="compact" />,
    );
    const td = container.querySelector("tbody tr td")!;
    expect(td.className).toContain("py-1.5");
  });

  test("mobileMode=cards renders mobile list alongside hidden table", () => {
    const { container } = render(<DataTable data={rows} columns={cols} />);
    const table = container.querySelector("table")!;
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("md:table");
    const list = container.querySelector('[role="list"]');
    expect(list).toBeTruthy();
    expect(list!.querySelectorAll('[role="listitem"]').length).toBe(3);
  });

  test("hideOnMobile column omitted from mobile cards", () => {
    const colsWithHide: Column<Row>[] = [
      { key: "symbol", label: "Sym" },
      { key: "trades", label: "Trades", hideOnMobile: true },
    ];
    const { container } = render(
      <DataTable data={rows} columns={colsWithHide} />,
    );
    const cards = container.querySelectorAll('[role="listitem"]');
    // Each card should only show Sym (1 row), not Trades
    cards.forEach((card) => {
      expect(card.textContent).not.toContain("Trades");
    });
  });
});
