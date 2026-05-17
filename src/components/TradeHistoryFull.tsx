/**
 * TradeHistoryFull — dedicated /dashboard/trades page component.
 *
 * Backend reuse: GET /settings/trades?limit=N (max 200 — server cap in
 * router.py). Filters/sorting/export happen client-side over the fetched
 * window. For history beyond 200 trades, raise the server limit or
 * add pagination separately.
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface TradeSignal {
  strategy: string;
  coin: string;
  direction: "long" | "short" | string;
}

interface TradeResult {
  order: string;
  algo: string;
  timestamp: string;
}

interface Trade {
  signal: TradeSignal;
  result: TradeResult;
  pnl_usdt: number;
  timestamp: number;
}

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    title: "Trade History",
    subtitle: "All executed auto-trades. Filter, sort, and export to CSV.",
    backToDashboard: "← Back to dashboard",
    notConnected: "Connect OKX on the dashboard to see your trade history.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    export: "Export CSV",
    none: "No trades yet — auto-trading will log here.",
    filters: "Filters",
    fStrategy: "Strategy",
    fSymbol: "Symbol",
    fDirection: "Direction",
    fAll: "All",
    fLong: "Long",
    fShort: "Short",
    fFromDate: "From",
    fToDate: "To",
    clearFilters: "Clear filters",
    showing: "Showing",
    of: "of",
    trades: "trades",
    sumPnL: "Total P&L",
    winRate: "Win rate",
    avgPnL: "Avg P&L / trade",
    colTime: "Time",
    colStrategy: "Strategy",
    colCoin: "Symbol",
    colDirection: "Direction",
    colPnL: "P&L (USDT)",
    colOrder: "Order ID",
    sortAsc: "▲",
    sortDesc: "▼",
    error: "Failed to load — retry?",
  },
  ko: {
    title: "거래 이력",
    subtitle: "실행된 자동매매 거래 전체. 필터·정렬·CSV 내보내기.",
    backToDashboard: "← 대시보드로",
    notConnected: "대시보드에서 OKX를 연결하면 거래 이력이 표시됩니다.",
    refresh: "새로고침",
    refreshing: "불러오는 중…",
    export: "CSV 내보내기",
    none: "거래 없음 — 자동매매 시작 시 여기에 기록됩니다.",
    filters: "필터",
    fStrategy: "전략",
    fSymbol: "심볼",
    fDirection: "방향",
    fAll: "전체",
    fLong: "롱",
    fShort: "숏",
    fFromDate: "시작",
    fToDate: "종료",
    clearFilters: "필터 초기화",
    showing: "표시",
    of: "/",
    trades: "건",
    sumPnL: "총 손익",
    winRate: "승률",
    avgPnL: "거래당 평균 손익",
    colTime: "시간",
    colStrategy: "전략",
    colCoin: "심볼",
    colDirection: "방향",
    colPnL: "손익 (USDT)",
    colOrder: "주문 ID",
    sortAsc: "▲",
    sortDesc: "▼",
    error: "불러오기 실패 — 재시도?",
  },
} as const;

type SortKey = "timestamp" | "strategy" | "coin" | "direction" | "pnl_usdt";
type SortDir = "asc" | "desc";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Trade[]) {
  const header = [
    "timestamp_iso",
    "strategy",
    "coin",
    "direction",
    "pnl_usdt",
    "order_id",
    "algo_id",
  ];
  const lines = [header.join(",")];
  for (const t of rows) {
    lines.push(
      [
        new Date(t.timestamp * 1000).toISOString(),
        t.signal.strategy,
        t.signal.coin,
        t.signal.direction,
        t.pnl_usdt.toFixed(4),
        t.result.order,
        t.result.algo,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  // RFC 4180 specifies CRLF line endings — Excel on Windows renders LF-only
  // as a single line. Use CRLF for cross-platform compatibility.
  const blob = new Blob([lines.join("\r\n") + "\r\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pruviq-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TradeHistoryFull({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthed, setUnauthed] = useState(false);
  const [err, setErr] = useState("");

  // Filters
  const [fStrategy, setFStrategy] = useState("");
  const [fSymbol, setFSymbol] = useState("");
  const [fDirection, setFDirection] = useState<"all" | "long" | "short">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE_URL}/settings/trades?limit=200`, {
        credentials: "include",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        setTrades([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { trades: Trade[] };
      setTrades(data.trades ?? []);
      setUnauthed(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(t.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Strategy + symbol options derived from data (avoids hard-coding the 18)
  const strategyOptions = useMemo(() => {
    const set = new Set(trades.map((tr) => tr.signal.strategy));
    return Array.from(set).sort();
  }, [trades]);
  const symbolOptions = useMemo(() => {
    const set = new Set(trades.map((tr) => tr.signal.coin));
    return Array.from(set).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    let list = trades.slice();
    if (fStrategy) list = list.filter((x) => x.signal.strategy === fStrategy);
    if (fSymbol) list = list.filter((x) => x.signal.coin === fSymbol);
    if (fDirection !== "all")
      list = list.filter((x) => x.signal.direction === fDirection);
    if (fFrom) {
      const fromTs = Date.parse(fFrom) / 1000;
      if (!Number.isNaN(fromTs))
        list = list.filter((x) => x.timestamp >= fromTs);
    }
    if (fTo) {
      // Inclusive end of day
      const toTs = Date.parse(fTo) / 1000 + 86_400;
      if (!Number.isNaN(toTs)) list = list.filter((x) => x.timestamp <= toTs);
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "timestamp":
          cmp = a.timestamp - b.timestamp;
          break;
        case "strategy":
          cmp = a.signal.strategy.localeCompare(b.signal.strategy);
          break;
        case "coin":
          cmp = a.signal.coin.localeCompare(b.signal.coin);
          break;
        case "direction":
          cmp = String(a.signal.direction).localeCompare(
            String(b.signal.direction),
          );
          break;
        case "pnl_usdt":
          cmp = a.pnl_usdt - b.pnl_usdt;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [trades, fStrategy, fSymbol, fDirection, fFrom, fTo, sortKey, sortDir]);

  const stats = useMemo(() => {
    if (filtered.length === 0)
      return { total: 0, wins: 0, sum: 0, avg: 0, winRate: 0 };
    let sum = 0;
    let wins = 0;
    for (const x of filtered) {
      sum += x.pnl_usdt;
      if (x.pnl_usdt > 0) wins++;
    }
    return {
      total: filtered.length,
      wins,
      sum,
      avg: sum / filtered.length,
      winRate: (wins / filtered.length) * 100,
    };
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setFStrategy("");
    setFSymbol("");
    setFDirection("all");
    setFFrom("");
    setFTo("");
  }

  function fmtTime(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-2xl p-6 text-center">
        <p class="text-sm text-(--color-text-muted) mb-4">{t.notConnected}</p>
        <a
          href={lang === "ko" ? "/ko/dashboard" : "/dashboard"}
          class="btn btn-primary btn-md min-h-[44px]"
        >
          {t.backToDashboard}
        </a>
      </div>
    );
  }

  return (
    <div class="space-y-5">
      {/* Header */}
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">{t.title}</h1>
          <p class="text-sm text-(--color-text-muted)">{t.subtitle}</p>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={lang === "ko" ? "/ko/dashboard" : "/dashboard"}
            class="text-sm text-(--color-text-muted) hover:text-(--color-accent)"
          >
            {t.backToDashboard}
          </a>
        </div>
      </div>

      {/* Stats */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card-enterprise rounded-xl p-4">
          <p class="text-xs text-(--color-text-muted) mb-1">{t.showing}</p>
          <p class="text-2xl font-bold font-mono">
            {filtered.length}
            <span class="text-sm text-(--color-text-muted) ml-1">
              {t.of} {trades.length}
            </span>
          </p>
        </div>
        <div class="card-enterprise rounded-xl p-4">
          <p class="text-xs text-(--color-text-muted) mb-1">{t.sumPnL}</p>
          <p
            class={`text-2xl font-bold font-mono ${stats.sum >= 0 ? "text-(--color-up)" : "text-(--color-down)"}`}
          >
            {stats.sum >= 0 ? "+" : ""}${stats.sum.toFixed(2)}
          </p>
        </div>
        <div class="card-enterprise rounded-xl p-4">
          <p class="text-xs text-(--color-text-muted) mb-1">{t.winRate}</p>
          <p class="text-2xl font-bold font-mono">
            {stats.winRate.toFixed(1)}%
          </p>
        </div>
        <div class="card-enterprise rounded-xl p-4">
          <p class="text-xs text-(--color-text-muted) mb-1">{t.avgPnL}</p>
          <p
            class={`text-2xl font-bold font-mono ${stats.avg >= 0 ? "text-(--color-up)" : "text-(--color-down)"}`}
          >
            {stats.avg >= 0 ? "+" : ""}${stats.avg.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div class="card-enterprise rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-sm">{t.filters}</h3>
          <button
            type="button"
            class="text-xs text-(--color-accent) hover:underline"
            onClick={clearFilters}
          >
            {t.clearFilters}
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={fStrategy}
            onChange={(e) =>
              setFStrategy((e.target as HTMLSelectElement).value)
            }
            class="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            aria-label={t.fStrategy}
          >
            <option value="">
              {t.fAll} · {t.fStrategy}
            </option>
            {strategyOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={fSymbol}
            onChange={(e) => setFSymbol((e.target as HTMLSelectElement).value)}
            class="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            aria-label={t.fSymbol}
          >
            <option value="">
              {t.fAll} · {t.fSymbol}
            </option>
            {symbolOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={fDirection}
            onChange={(e) =>
              setFDirection(
                (e.target as HTMLSelectElement).value as
                  | "all"
                  | "long"
                  | "short",
              )
            }
            class="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            aria-label={t.fDirection}
          >
            <option value="all">
              {t.fAll} · {t.fDirection}
            </option>
            <option value="long">{t.fLong}</option>
            <option value="short">{t.fShort}</option>
          </select>
          <input
            type="date"
            value={fFrom}
            onInput={(e) => setFFrom((e.target as HTMLInputElement).value)}
            class="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            aria-label={t.fFromDate}
          />
          <input
            type="date"
            value={fTo}
            onInput={(e) => setFTo((e.target as HTMLInputElement).value)}
            class="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            aria-label={t.fToDate}
          />
        </div>
      </div>

      {/* Action bar */}
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-sm min-h-[44px]"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? t.refreshing : `↻ ${t.refresh}`}
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm min-h-[44px]"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
        >
          ⬇ {t.export}
        </button>
      </div>

      {/* Table */}
      <div class="card-enterprise rounded-xl overflow-hidden">
        {err && (
          <div
            class="p-3 text-sm text-(--color-down) bg-(--color-down)/10"
            role="alert"
            aria-live="assertive"
          >
            {err}
          </div>
        )}
        {loading && trades.length === 0 ? (
          <div class="p-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                class="h-10 rounded-lg bg-(--color-bg-elevated) animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p class="p-6 text-sm text-(--color-text-muted) italic text-center">
            {t.none}
          </p>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-(--color-border) bg-(--color-bg)/30">
                  {(
                    [
                      ["timestamp", t.colTime],
                      ["strategy", t.colStrategy],
                      ["coin", t.colCoin],
                      ["direction", t.colDirection],
                      ["pnl_usdt", t.colPnL],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      class="text-left p-3 font-bold cursor-pointer hover:bg-(--color-bg)/50 select-none"
                      onClick={() => toggleSort(key)}
                      scope="col"
                    >
                      <span class="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key && (
                          <span class="text-xs">
                            {sortDir === "asc" ? t.sortAsc : t.sortDesc}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th class="text-left p-3 font-bold" scope="col">
                    {t.colOrder}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tr, idx) => {
                  const isLong = tr.signal.direction === "long";
                  const dirColor = isLong
                    ? "text-(--color-up)"
                    : "text-(--color-down)";
                  const pnlPositive = tr.pnl_usdt > 0;
                  const pnlColor = pnlPositive
                    ? "text-(--color-up)"
                    : tr.pnl_usdt < 0
                      ? "text-(--color-down)"
                      : "text-(--color-text-muted)";
                  return (
                    <tr
                      key={tr.result.order || idx}
                      class="border-b border-(--color-border)/40 hover:bg-(--color-bg)/30"
                    >
                      <td class="p-3 font-mono text-xs whitespace-nowrap">
                        {fmtTime(tr.timestamp)}
                      </td>
                      <td class="p-3 font-mono text-xs">
                        {tr.signal.strategy}
                      </td>
                      <td class="p-3 font-mono font-bold">{tr.signal.coin}</td>
                      <td class={`p-3 font-mono font-bold ${dirColor}`}>
                        {tr.signal.direction.toUpperCase()}
                      </td>
                      <td class={`p-3 font-mono font-bold ${pnlColor}`}>
                        {pnlPositive ? "+" : ""}${tr.pnl_usdt.toFixed(2)}
                      </td>
                      <td class="p-3 font-mono text-xs text-(--color-text-muted) truncate max-w-[180px]">
                        {tr.result.order || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
