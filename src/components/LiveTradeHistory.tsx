/**
 * LiveTradeHistory.tsx
 * Displays the last 20 auto-traded orders for the authenticated user.
 * Fetches GET /settings/trades?limit=20 (credentials: include) on mount.
 * 401 → prompt to connect OKX. Empty → "No trades yet" message.
 */
import { useState, useEffect, useCallback } from "preact/hooks";
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

interface TradesResponse {
  trades: Trade[];
}

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    title: "Trade History",
    connect_prompt: "Connect OKX to see trade history",
    no_trades: "No trades yet. Auto-trading will log here.",
    col_time: "Time",
    col_strategy: "Strategy",
    col_coin: "Coin",
    col_direction: "Direction",
    col_pnl: "Est. P&L",
    error: "Failed to load trade history",
    retry: "Retry →",
    just_now: "just now",
    min_ago: "{n} min ago",
    hour_ago: "{n}h ago",
    day_ago: "{n}d ago",
  },
  ko: {
    title: "거래 내역",
    connect_prompt: "거래 내역을 보려면 OKX를 연결하세요",
    no_trades: "아직 거래 없음. 자동매매 시작 후 여기에 기록됩니다.",
    col_time: "시간",
    col_strategy: "전략",
    col_coin: "코인",
    col_direction: "방향",
    col_pnl: "예상 손익",
    error: "거래 내역 로드 실패",
    retry: "다시 시도 →",
    just_now: "방금",
    min_ago: "{n}분 전",
    hour_ago: "{n}시간 전",
    day_ago: "{n}일 전",
  },
} as const;

type I18nKey = keyof (typeof i18n)["en"];

function useTimeAgo(t: (typeof i18n)["en"] | (typeof i18n)["ko"]) {
  return (ts: number): string => {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t.just_now;
    if (diffMin < 60) return t.min_ago.replace("{n}", String(diffMin));
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t.hour_ago.replace("{n}", String(diffHour));
    const diffDay = Math.floor(diffHour / 24);
    return t.day_ago.replace("{n}", String(diffDay));
  };
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)} USDT`;
}

function SkeletonRow() {
  return (
    <tr class="border-b border-[--color-border]">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} class="px-4 py-3">
          <div class="h-4 rounded bg-[--color-bg-elevated] animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );
}

export default function LiveTradeHistory({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const timeAgo = useTimeAgo(t);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthed, setUnauthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/trades?limit=20`, {
        credentials: "include",
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: TradesResponse = await res.json();
      setTrades(body.trades ?? []);
      setError(null);
      setUnauthed(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return (
    <div class="card-enterprise rounded-xl p-5">
      {/* Header */}
      <div class="flex items-center gap-2 mb-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-[--color-accent]"
          aria-hidden="true"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <h2 class="font-bold text-sm">{t.title}</h2>
      </div>

      {/* Unauthenticated */}
      {unauthed && (
        <div class="flex items-center justify-center gap-2 py-10 text-[--color-text-muted]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p class="text-sm">{t.connect_prompt}</p>
        </div>
      )}

      {/* Error */}
      {!unauthed && error && (
        <div class="flex flex-col items-center gap-3 py-10">
          <p
            class="text-sm text-[--color-down]"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchTrades();
            }}
            class="text-xs text-[--color-accent] hover:underline cursor-pointer"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Table */}
      {!unauthed && !error && (
        <div class="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table class="w-full text-sm" role="table" aria-label={t.title}>
            <thead class="sticky top-0 bg-[--color-bg-card] z-10">
              <tr class="border-b border-[--color-border]">
                {(
                  [
                    "col_time",
                    "col_strategy",
                    "col_coin",
                    "col_direction",
                    "col_pnl",
                  ] as I18nKey[]
                ).map((col) => (
                  <th
                    key={col}
                    scope="col"
                    class="px-4 py-2 text-left text-xs font-semibold text-[--color-text-muted] whitespace-nowrap"
                  >
                    {t[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && trades.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    class="px-4 py-10 text-center text-sm text-[--color-text-muted]"
                  >
                    {t.no_trades}
                  </td>
                </tr>
              )}

              {!loading &&
                trades.map((trade, idx) => {
                  const dir = trade.signal.direction;
                  const isLong =
                    typeof dir === "string" && dir.toLowerCase() === "long";
                  const isShort =
                    typeof dir === "string" && dir.toLowerCase() === "short";

                  const dirColor = isLong
                    ? "text-[--color-up]"
                    : isShort
                      ? "text-[--color-down]"
                      : "text-[--color-text-secondary]";

                  const pnlColor =
                    trade.pnl_usdt >= 0
                      ? "text-[--color-up]"
                      : "text-[--color-down]";

                  // Use result.timestamp (ISO string) if available, else fall back to unix ms
                  const tsMs = trade.result.timestamp
                    ? new Date(trade.result.timestamp).getTime()
                    : trade.timestamp;

                  return (
                    <tr
                      key={`${trade.signal.coin}-${trade.signal.strategy}-${idx}`}
                      class="border-b border-[--color-border] hover:bg-[--color-bg-elevated] transition-colors"
                    >
                      <td class="px-4 py-3 font-mono text-xs text-[--color-text-muted] whitespace-nowrap">
                        {timeAgo(tsMs)}
                      </td>
                      <td class="px-4 py-3 text-xs text-[--color-text-secondary] whitespace-nowrap">
                        {trade.signal.strategy}
                      </td>
                      <td class="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                        {trade.signal.coin}
                      </td>
                      <td
                        class={`px-4 py-3 font-mono text-xs font-bold ${dirColor}`}
                      >
                        {dir.toUpperCase()}
                      </td>
                      <td
                        class={`px-4 py-3 font-mono font-semibold whitespace-nowrap ${pnlColor}`}
                      >
                        {formatPnl(trade.pnl_usdt)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
