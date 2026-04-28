/**
 * DataTable.tsx — Typed table primitive (W4-1).
 *
 * Generic data table with sortable headers, sticky header, mobile card
 * transform, empty state, and a11y. Replaces the 8+ bespoke table
 * implementations across PerformanceDashboard, CoinListTable,
 * LiveTradeHistory, OptimizePanel, etc.
 *
 * NOT included in this PR (intentional):
 *   - Virtualization (would require TanStack Virtual install)
 *   - Column resize, column reorder, multi-sort
 *   - Pagination (caller controls slicing)
 *
 * Sort: click header toggles asc → desc → none (3-state).
 *       Caller can also pre-sort by passing sorted data — primitive
 *       only wraps the visual + click events.
 *
 * Mobile: at <md breakpoint, rows transform into card-style stack.
 *         Each visible cell shown as label+value pair. Sortable header
 *         renders as a chip row above the cards.
 *
 * a11y:
 *   - <table role="table"> with aria-rowcount, aria-colcount
 *   - <th> with aria-sort="ascending|descending|none"
 *   - sortable <th> wraps content in <button> for keyboard activation
 *   - Empty state announced via role="status"
 */
import type { ComponentChildren, JSX } from "preact";
import { useState, useMemo } from "preact/hooks";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  /** Unique key for the column — also used as data key when no `render`. */
  key: string;
  /** Header label */
  label: string;
  /** Optional accessor — defaults to row[key]. */
  accessor?: (row: T) => unknown;
  /** Custom cell renderer — receives the row and returns JSX. */
  render?: (row: T, rowIndex: number) => ComponentChildren;
  /** Sortable header. Default false. */
  sortable?: boolean;
  /** Sort comparator. Defaults to numeric/string compare on accessor value. */
  compare?: (a: T, b: T) => number;
  /** Text alignment. Default "left". */
  align?: "left" | "center" | "right";
  /** Tailwind width utility (e.g., "w-32"). */
  width?: string;
  /** Hide on mobile card view. Default false. */
  hideOnMobile?: boolean;
  /** Class for the cell. */
  cellClass?: string;
  /** Class for the header. */
  headerClass?: string;
}

export interface DataTableProps<T> {
  data: readonly T[];
  columns: ReadonlyArray<Column<T>>;
  /** Stable row identifier for keying — defaults to row index. */
  getRowKey?: (row: T, index: number) => string | number;
  /** Default sort key + direction at first render. */
  defaultSort?: { key: string; direction: "asc" | "desc" };
  /** Click handler per row. */
  onRowClick?: (row: T, index: number) => void;
  /** Sticky header. Default true. */
  stickyHeader?: boolean;
  /** Loading state — renders N skeleton rows. */
  loading?: boolean;
  /** Number of skeleton rows. Default 5. */
  loadingRows?: number;
  /** Empty state node when data is empty (and not loading). */
  emptyState?: ComponentChildren;
  /** Density: "compact" (py-1.5) | "default" (py-2.5) | "comfortable" (py-3.5) */
  density?: "compact" | "default" | "comfortable";
  /** Mobile breakpoint behavior: "cards" (default — stack at <md) or "scroll" (horizontal scroll). */
  mobileMode?: "cards" | "scroll";
  /** Outer wrapper class. */
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

function defaultCompare<T>(col: Column<T>, a: T, b: T): number {
  const av = col.accessor
    ? col.accessor(a)
    : (a as unknown as Record<string, unknown>)[col.key];
  const bv = col.accessor
    ? col.accessor(b)
    : (b as unknown as Record<string, unknown>)[col.key];
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

const densityCellClass: Record<
  NonNullable<DataTableProps<unknown>["density"]>,
  string
> = {
  compact: "py-1.5 px-3",
  default: "py-2.5 px-4",
  comfortable: "py-3.5 px-5",
};

export default function DataTable<T>({
  data,
  columns,
  getRowKey,
  defaultSort,
  onRowClick,
  stickyHeader = true,
  loading = false,
  loadingRows = 5,
  emptyState,
  density = "default",
  mobileMode = "cards",
  class: className = "",
  ...rest
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSort?.key ?? null,
  );
  const [sortDir, setSortDir] = useState<SortDirection>(
    defaultSort?.direction ?? null,
  );

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const cmp = col.compare ?? ((a: T, b: T) => defaultCompare(col, a, b));
    const sorted = [...data].sort(cmp);
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [data, columns, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
      return;
    }
    setSortDir("asc");
  }

  const cellPad = densityCellClass[density];
  const alignClass = (a?: "left" | "center" | "right") =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  if (loading) {
    return (
      <div
        class={`overflow-x-auto rounded-lg border border-[--color-border] bg-[--color-bg-card] ${className}`.trim()}
        role="status"
        aria-label="Loading table data"
        {...rest}
      >
        <table class="w-full text-sm" role="table">
          <thead
            class={`border-b border-[--color-border] ${stickyHeader ? "sticky top-0 z-[1] bg-[--color-bg-card]" : ""}`}
          >
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  class={`${cellPad} ${alignClass(c.align)} font-mono text-[10px] uppercase tracking-wider text-[--color-text-muted] ${c.headerClass ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={i} class="border-b border-[--color-border]/50">
                {columns.map((c) => (
                  <td key={c.key} class={`${cellPad} ${alignClass(c.align)}`}>
                    <span class="inline-block h-3 w-16 rounded bg-[--color-bg-hover] animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        class={`rounded-lg border border-[--color-border] bg-[--color-bg-card] ${className}`.trim()}
        role="status"
        {...rest}
      >
        {emptyState ?? (
          <div class="px-6 py-12 text-center">
            <p class="text-sm text-[--color-text-muted]">No data available.</p>
          </div>
        )}
      </div>
    );
  }

  // Desktop table
  const tableEl = (
    <table
      class={`w-full text-sm ${mobileMode === "cards" ? "hidden md:table" : "table"}`}
      role="table"
      aria-rowcount={sortedData.length + 1}
    >
      <thead
        class={`border-b border-[--color-border] ${stickyHeader ? "sticky top-0 z-[1] bg-[--color-bg-card]" : ""}`}
      >
        <tr>
          {columns.map((c, ci) => {
            const ariaSort: JSX.AriaAttributes["aria-sort"] = !c.sortable
              ? undefined
              : sortKey !== c.key || !sortDir
                ? "none"
                : sortDir === "asc"
                  ? "ascending"
                  : "descending";
            return (
              <th
                key={c.key}
                scope="col"
                aria-colindex={ci + 1}
                aria-sort={ariaSort}
                class={`${cellPad} ${alignClass(c.align)} font-mono text-[10px] uppercase tracking-wider text-[--color-text-muted] ${c.width ?? ""} ${c.headerClass ?? ""}`}
              >
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    class="inline-flex items-center gap-1 hover:text-[--color-text] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] rounded"
                  >
                    {c.label}
                    <span aria-hidden="true" class="text-[--color-accent]">
                      {ariaSort === "ascending"
                        ? "▲"
                        : ariaSort === "descending"
                          ? "▼"
                          : ""}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, rowIdx) => {
          const key = getRowKey ? getRowKey(row, rowIdx) : rowIdx;
          return (
            <tr
              key={key}
              onClick={onRowClick ? () => onRowClick(row, rowIdx) : undefined}
              class={`border-b border-[--color-border]/50 ${onRowClick ? "cursor-pointer hover:bg-[--color-bg-hover]" : ""}`}
            >
              {columns.map((c, ci) => {
                const value = c.render
                  ? c.render(row, rowIdx)
                  : c.accessor
                    ? (c.accessor(row) as ComponentChildren)
                    : ((row as unknown as Record<string, unknown>)[
                        c.key
                      ] as ComponentChildren);
                return (
                  <td
                    key={c.key}
                    aria-colindex={ci + 1}
                    class={`${cellPad} ${alignClass(c.align)} text-[--color-text] ${c.cellClass ?? ""}`}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // Mobile card view
  const mobileCards =
    mobileMode === "cards" ? (
      <div class="md:hidden flex flex-col gap-2 p-2" role="list">
        {sortedData.map((row, rowIdx) => {
          const key = getRowKey ? getRowKey(row, rowIdx) : rowIdx;
          const visibleCols = columns.filter((c) => !c.hideOnMobile);
          return (
            <div
              key={key}
              role="listitem"
              onClick={onRowClick ? () => onRowClick(row, rowIdx) : undefined}
              class={`rounded border border-[--color-border]/50 bg-[--color-bg-card] p-3 ${onRowClick ? "cursor-pointer hover:border-[--color-accent]/40" : ""}`}
            >
              {visibleCols.map((c) => {
                const value = c.render
                  ? c.render(row, rowIdx)
                  : c.accessor
                    ? (c.accessor(row) as ComponentChildren)
                    : ((row as unknown as Record<string, unknown>)[
                        c.key
                      ] as ComponentChildren);
                return (
                  <div
                    key={c.key}
                    class="flex items-center justify-between gap-3 py-1 first:pt-0 last:pb-0"
                  >
                    <span class="text-[10px] font-mono uppercase tracking-wider text-[--color-text-muted]">
                      {c.label}
                    </span>
                    <span class="text-sm text-[--color-text] text-right">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    ) : null;

  // Mobile sort chip row (cards mode only — desktop uses headers)
  const mobileSortRow =
    mobileMode === "cards" && columns.some((c) => c.sortable) ? (
      <div
        class="md:hidden flex flex-wrap gap-1.5 px-2 pt-2"
        role="toolbar"
        aria-label="Sort options"
      >
        {columns
          .filter((c) => c.sortable)
          .map((c) => {
            const isActive = sortKey === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleSort(c.key)}
                class={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono ${
                  isActive
                    ? "border-[--color-accent] bg-[--color-accent]/10 text-[--color-accent]"
                    : "border-[--color-border] text-[--color-text-muted]"
                }`}
              >
                {c.label}
                {isActive && (
                  <span aria-hidden="true">
                    {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : ""}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    ) : null;

  return (
    <div
      class={`overflow-x-auto rounded-lg border border-[--color-border] bg-[--color-bg-card] ${className}`.trim()}
      {...rest}
    >
      {mobileSortRow}
      {tableEl}
      {mobileCards}
    </div>
  );
}
