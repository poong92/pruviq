/**
 * LivePositions.tsx
 * Displays open OKX positions for the authenticated user.
 * Polls GET /execute/positions every 30s (credentials: include).
 * 401 → prompt to connect OKX. Empty → "No open positions".
 */
import { useState, useEffect, useCallback } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Position {
  instId: string;
  pos: string;
  avgPx: string;
  markPx: string;
  upl: string;
  uplRatio: string;
}

interface ApiResponse {
  data: Position[];
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_INTERVAL_MS = 30_000;

const i18n = {
  en: {
    title: "Live Positions",
    connect_prompt: "Connect OKX to see positions",
    no_positions: "No open positions",
    col_instrument: "Instrument",
    col_side: "Side",
    col_size: "Size",
    col_avg_entry: "Avg Entry",
    col_mark_price: "Mark Price",
    col_upl: "Unrealized P&L",
    updated: "Auto-refreshes every 30s",
    error: "Failed to load positions",
    retry: "Retry →",
  },
  ko: {
    title: "실시간 포지션",
    connect_prompt: "포지션을 보려면 OKX를 연결하세요",
    no_positions: "오픈 포지션 없음",
    col_instrument: "종목",
    col_side: "방향",
    col_size: "수량",
    col_avg_entry: "평균 진입가",
    col_mark_price: "마크 가격",
    col_upl: "미실현 손익",
    updated: "30초마다 자동 갱신",
    error: "포지션 로드 실패",
    retry: "다시 시도 →",
  },
} as const;

function formatPrice(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  if (n === 0) return "0";
  if (Math.abs(n) < 1) return n.toFixed(6);
  if (Math.abs(n) < 100) return n.toFixed(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUpl(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)} USDT`;
}

function formatUplRatio(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return "";
  const pct = (n * 100).toFixed(2);
  const sign = n >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function inferSide(pos: string): string {
  const n = parseFloat(pos);
  if (isNaN(n) || n === 0) return "—";
  return n > 0 ? "LONG" : "SHORT";
}

function SkeletonRow() {
  return (
    <tr class="border-b border-[--color-border]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} class="px-4 py-3">
          <div class="h-4 rounded bg-[--color-bg-elevated] animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );
}

export default function LivePositions({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthed, setUnauthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/execute/positions`, {
        credentials: "include",
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: ApiResponse = await res.json();
      setPositions(body.data ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
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
    fetchPositions();
    const interval = setInterval(fetchPositions, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return (
    <div class="card-enterprise rounded-xl p-5">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full bg-[--color-up] animate-pulse"
            aria-hidden="true"
          />
          <h2 class="font-bold text-sm">{t.title}</h2>
        </div>
        {lastUpdated && (
          <p class="text-xs text-[--color-text-muted]">{t.updated}</p>
        )}
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
              fetchPositions();
            }}
            class="text-xs text-[--color-accent] hover:underline cursor-pointer"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Table */}
      {!unauthed && !error && (
        <div class="overflow-x-auto">
          <table class="w-full text-sm" role="table" aria-label={t.title}>
            <thead>
              <tr class="border-b border-[--color-border]">
                {[
                  t.col_instrument,
                  t.col_side,
                  t.col_size,
                  t.col_avg_entry,
                  t.col_mark_price,
                  t.col_upl,
                ].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    class="px-4 py-2 text-left text-xs font-semibold text-[--color-text-muted] whitespace-nowrap"
                  >
                    {col}
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

              {!loading && positions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    class="px-4 py-10 text-center text-sm text-[--color-text-muted]"
                  >
                    {t.no_positions}
                  </td>
                </tr>
              )}

              {!loading &&
                positions.map((p, idx) => {
                  const uplNum = parseFloat(p.upl);
                  const isPositive = !isNaN(uplNum) && uplNum >= 0;
                  const uplColor = isNaN(uplNum)
                    ? "text-[--color-text-secondary]"
                    : isPositive
                      ? "text-[--color-up]"
                      : "text-[--color-down]";
                  const side = inferSide(p.pos);
                  const sideColor =
                    side === "LONG"
                      ? "text-[--color-up]"
                      : side === "SHORT"
                        ? "text-[--color-down]"
                        : "text-[--color-text-muted]";

                  return (
                    <tr
                      key={`${p.instId}-${idx}`}
                      class="border-b border-[--color-border] hover:bg-[--color-bg-elevated] transition-colors"
                    >
                      <td class="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                        {p.instId}
                      </td>
                      <td
                        class={`px-4 py-3 font-mono text-xs font-bold ${sideColor}`}
                      >
                        {side}
                      </td>
                      <td class="px-4 py-3 font-mono text-[--color-text-secondary]">
                        {p.pos}
                      </td>
                      <td class="px-4 py-3 font-mono text-[--color-text-secondary]">
                        ${formatPrice(p.avgPx)}
                      </td>
                      <td class="px-4 py-3 font-mono text-[--color-text-secondary]">
                        ${formatPrice(p.markPx)}
                      </td>
                      <td
                        class={`px-4 py-3 font-mono font-semibold ${uplColor}`}
                      >
                        <div>{formatUpl(p.upl)}</div>
                        <div class="text-xs opacity-75">
                          {formatUplRatio(p.uplRatio)}
                        </div>
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
