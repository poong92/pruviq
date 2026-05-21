/**
 * RecentDCAFills — cross-bot paper-mode activity feed.
 *
 * Polls GET /dca-bots/recent-fills every 30s. Surfaces every fill
 * (base + safety + tp_closed) across all DCA bots a session owns so
 * the owner can monitor paper-mode dog-foot at a glance without
 * clicking into individual bots. Multi-fire ticks (Sprint A parity
 * fix) appear as multiple rows from the same timestamp.
 *
 * Never writes. Empty state shows guidance.
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Fill {
  id: number;
  bot_id: string;
  bot_name: string;
  symbol: string;
  direction: "long" | "short";
  order_num: number;
  fill_price: number;
  fill_size_usdt: number;
  okx_order_id: string | null;
  filled_at: number;
  status: "open" | "tp_closed" | string;
  paper_mode: boolean;
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_MS = 30_000;

const i18n = {
  en: {
    title: "Recent fills",
    subtitle: "Latest activity across all DCA bots in this session.",
    notConnected: "Connect OKX to see recent fills.",
    empty:
      "No fills yet. After you activate a bot, the loop writes a base fill within ~60s.",
    error: "Failed to load fills",
    retry: "Retry",
    base: "BASE",
    safety: "SAFETY",
    tp: "TP",
    paper: "PAPER",
    real: "REAL",
    columns: {
      when: "When",
      bot: "Bot",
      kind: "Kind",
      price: "Price",
      size: "Size (USDT)",
      status: "Status",
    },
    updated: "Auto-refreshes every 30s",
    exportCsv: "Export CSV",
    filterAll: "All",
    filterOpen: "Open",
    filterTpClosed: "TP closed",
    filterAllBots: "All bots",
    filteredEmpty: "No fills match current filters.",
    showingN: "%d of %d",
  },
  ko: {
    title: "최근 체결",
    subtitle: "이 세션의 모든 DCA 봇 활동.",
    notConnected: "OKX를 연결하면 최근 체결이 표시됩니다.",
    empty:
      "아직 체결이 없습니다. 봇을 활성화하면 ~60초 안에 기준 체결이 기록됩니다.",
    error: "체결 불러오기 실패",
    retry: "다시 시도",
    base: "기준",
    safety: "안전",
    tp: "익절",
    paper: "모의",
    real: "실거래",
    columns: {
      when: "시각",
      bot: "봇",
      kind: "종류",
      price: "가격",
      size: "크기 (USDT)",
      status: "상태",
    },
    updated: "30초마다 자동 갱신",
    exportCsv: "CSV 내보내기",
    filterAll: "전체",
    filterOpen: "열림",
    filterTpClosed: "익절 완료",
    filterAllBots: "모든 봇",
    filteredEmpty: "현재 필터에 맞는 체결이 없습니다.",
    showingN: "%d / %d",
  },
} as const;

function fmtAgo(secAgo: number, lang: "en" | "ko"): string {
  if (secAgo < 60)
    return lang === "ko"
      ? `${Math.round(secAgo)}초 전`
      : `${Math.round(secAgo)}s ago`;
  const m = Math.round(secAgo / 60);
  if (m < 60) return lang === "ko" ? `${m}분 전` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return lang === "ko" ? `${h}시간 전` : `${h}h ago`;
  const d = Math.round(h / 24);
  return lang === "ko" ? `${d}일 전` : `${d}d ago`;
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1000)
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function RecentDCAFills({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [fills, setFills] = useState<Fill[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now() / 1000);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "tp_closed"
  >("all");
  const [botFilter, setBotFilter] = useState<string>("");

  const fetchFills = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/dca-bots/recent-fills?limit=20`,
        {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { fills: Fill[] };
      setFills(data.fills ?? []);
      setUnauthed(false);
      setErr("");
      setNow(Date.now() / 1000);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    void fetchFills();
    const id = setInterval(() => {
      void fetchFills();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchFills]);

  // Update "ago" timestamps every 15s without re-fetching
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 15_000);
    return () => clearInterval(id);
  }, []);

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 flex items-center gap-3 text-(--color-text-muted)">
        <p class="text-sm">{t.notConnected}</p>
      </div>
    );
  }

  // Unique bots in the current fills list — drives the bot-filter dropdown.
  // Hidden when ≤1 unique bot since filtering by "the only bot" is pointless.
  const uniqueBots = Array.from(
    new Map(fills.map((f) => [f.bot_id, f.bot_name])).entries(),
  );

  const filtered = fills.filter((f) => {
    if (statusFilter === "open" && f.status !== "open") return false;
    if (statusFilter === "tp_closed" && f.status !== "tp_closed") return false;
    if (botFilter && f.bot_id !== botFilter) return false;
    return true;
  });

  return (
    <div class="card-enterprise rounded-2xl p-5 md:p-6">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="font-bold text-lg">
          {t.title}
          {(statusFilter !== "all" || botFilter) && (
            <span class="ml-2 text-xs font-mono font-normal text-(--color-text-muted)">
              (
              {t.showingN
                .replace("%d", String(filtered.length))
                .replace("%d", String(fills.length))}
              )
            </span>
          )}
        </h2>
        <div class="flex items-center gap-3">
          {fills.length > 0 && (
            <a
              href={`${API_BASE_URL}/dca-bots/fills.csv`}
              class="text-xs font-bold text-(--color-accent) hover:underline min-h-[44px] inline-flex items-center"
              download
            >
              ⬇ {t.exportCsv}
            </a>
          )}
          <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
        </div>
      </div>

      {fills.length > 0 && (
        <div
          class="flex items-center gap-2 flex-wrap mb-3 text-xs"
          role="group"
          aria-label="filters"
        >
          {(["all", "open", "tp_closed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              class={`px-2.5 py-1 rounded-full border min-h-[44px] ${
                statusFilter === s
                  ? "bg-(--color-accent)/10 border-(--color-accent)/40 text-(--color-accent-bright) font-bold"
                  : "border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-secondary)"
              }`}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === "all"
                ? t.filterAll
                : s === "open"
                  ? t.filterOpen
                  : t.filterTpClosed}
            </button>
          ))}
          {uniqueBots.length > 1 && (
            <select
              class="px-2.5 py-1 rounded-full border border-(--color-border) bg-(--color-bg) text-xs min-h-[44px]"
              value={botFilter}
              onChange={(e) =>
                setBotFilter((e.target as HTMLSelectElement).value)
              }
              aria-label="bot filter"
            >
              <option value="">{t.filterAllBots}</option>
              {uniqueBots.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {err && (
        <div
          class="p-3 mb-3 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-sm text-(--color-down)"
          role="alert"
          aria-live="assertive"
        >
          {err}
          <button
            type="button"
            class="ml-3 underline min-h-[44px] px-2"
            onClick={() => {
              setErr("");
              void fetchFills();
            }}
          >
            {t.retry}
          </button>
        </div>
      )}

      {loading && fills.length === 0 ? (
        <div class="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              class="h-10 rounded bg-(--color-bg-elevated) motion-safe:animate-pulse"
            />
          ))}
        </div>
      ) : fills.length === 0 ? (
        <div class="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
          <div
            class="w-12 h-12 rounded-full bg-(--color-bg-elevated) border border-(--color-border) flex items-center justify-center text-2xl"
            aria-hidden="true"
          >
            ⏳
          </div>
          <p class="text-sm text-(--color-text-muted) max-w-md leading-relaxed">
            {t.empty}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p class="text-sm text-(--color-text-muted) italic">
          {t.filteredEmpty}
        </p>
      ) : (
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-(--color-border) bg-(--color-bg)/30">
                <th class="text-left p-2 font-bold">{t.columns.when}</th>
                <th class="text-left p-2 font-bold">{t.columns.bot}</th>
                <th class="text-left p-2 font-bold">{t.columns.kind}</th>
                <th class="text-right p-2 font-bold">{t.columns.price}</th>
                <th class="text-right p-2 font-bold">{t.columns.size}</th>
                <th class="text-left p-2 font-bold">{t.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const kind =
                  f.order_num === 0
                    ? t.base
                    : f.status === "tp_closed"
                      ? t.tp
                      : `${t.safety} ${f.order_num}`;
                const dirColor =
                  f.direction === "long"
                    ? "text-(--color-up)"
                    : "text-(--color-down)";
                const statusColor =
                  f.status === "tp_closed"
                    ? "text-(--color-up)"
                    : "text-(--color-text-muted)";
                return (
                  <tr
                    key={f.id}
                    class="border-b border-(--color-border)/40 hover:bg-(--color-bg)/30"
                  >
                    <td class="p-2 font-mono text-xs whitespace-nowrap">
                      {fmtAgo(now - f.filled_at, lang)}
                    </td>
                    <td class="p-2 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold truncate max-w-[10rem]">
                          {f.bot_name}
                        </span>
                        {!f.paper_mode && (
                          <span class="text-[0.65rem] px-1 py-0.5 rounded bg-(--color-down)/10 border border-(--color-down)/30 text-(--color-down) font-mono">
                            {t.real}
                          </span>
                        )}
                      </div>
                      <div class="text-xs font-mono text-(--color-text-muted)">
                        <span class={dirColor}>
                          {f.direction.toUpperCase()}
                        </span>{" "}
                        · {f.symbol}
                      </div>
                    </td>
                    <td class="p-2 font-mono text-xs">{kind}</td>
                    <td class="p-2 font-mono text-right">
                      {fmtPrice(f.fill_price)}
                    </td>
                    <td class="p-2 font-mono text-right">
                      {f.fill_size_usdt.toFixed(2)}
                    </td>
                    <td class={`p-2 font-mono text-xs ${statusColor}`}>
                      {f.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p class="text-xs text-(--color-text-muted) mt-3 text-right">
        {t.updated}
      </p>
    </div>
  );
}
