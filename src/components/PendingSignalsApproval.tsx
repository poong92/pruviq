/**
 * PendingSignalsApproval — surfaces signals waiting for user approval in
 * `manual` or `approval` execution_mode. Backend already provides:
 *   GET  /signals/pending                  → {signals:[...]}
 *   POST /signals/:id/approve              → enqueue for next executor tick
 *   POST /signals/:id/reject               → mark rejected (skipped)
 *
 * Schema (backend/okx/strategies.py:_PENDING_COLUMNS):
 *   id, strategy_id, symbol, direction, base_strategy, signal_price,
 *   signal_time, suggested_params, expires_at, status, created_at.
 *
 * Auto-refresh every 30s so the list trims itself when a signal expires
 * (backend.expire_old_signals() runs on every GET).
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface PendingSignal {
  id: string;
  strategy_id: string;
  symbol: string;
  direction: "long" | "short";
  base_strategy: string;
  signal_price: number;
  signal_time: string;
  suggested_params: Record<string, unknown>;
  expires_at: number;
  status: string;
  created_at: number;
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_MS = 30_000;

const i18n = {
  en: {
    title: "Pending Signals",
    subtitle:
      "Signals waiting for your approval. Approve to send to the executor; Reject to skip.",
    none: "No pending signals — the bot will queue them here when conditions match.",
    notConnected: "Connect OKX to see pending signals.",
    approve: "Approve",
    reject: "Reject",
    confirmReject: "Reject this signal? It will be skipped.",
    approving: "Approving…",
    rejecting: "Rejecting…",
    expiresIn: "Expires in",
    expired: "Expired",
    just_now: "just now",
    minutes_ago: "min ago",
    hours_ago: "hr ago",
    long: "LONG",
    short: "SHORT",
    error: "Action failed — refreshing list",
  },
  ko: {
    title: "대기 중인 신호",
    subtitle:
      "승인 대기 중인 신호입니다. 승인 시 실행 큐로 전달되고, 거절 시 건너뜁니다.",
    none: "대기 중인 신호가 없습니다 — 조건이 맞으면 봇이 여기에 쌓아둡니다.",
    notConnected: "OKX를 연결하면 대기 신호가 표시됩니다.",
    approve: "승인",
    reject: "거절",
    confirmReject: "이 신호를 거절할까요? 건너뜁니다.",
    approving: "승인 중…",
    rejecting: "거절 중…",
    expiresIn: "만료까지",
    expired: "만료됨",
    just_now: "방금 전",
    minutes_ago: "분 전",
    hours_ago: "시간 전",
    long: "롱",
    short: "숏",
    error: "작업 실패 — 목록을 새로고침합니다",
  },
} as const;

type I18n = (typeof i18n)[keyof typeof i18n];

function formatRelative(unix: number, t: I18n): string {
  const diff = Date.now() / 1000 - unix;
  if (diff < 60) return t.just_now;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t.minutes_ago}`;
  return `${Math.floor(diff / 3600)} ${t.hours_ago}`;
}

function formatExpiry(unix: number, t: I18n): string {
  const diff = unix - Date.now() / 1000;
  if (diff <= 0) return t.expired;
  if (diff < 60) return `${Math.ceil(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function PendingSignalsApproval({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [signals, setSignals] = useState<PendingSignal[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [err, setErr] = useState("");

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/signals/pending`, {
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { signals: PendingSignal[] };
      setSignals(data.signals ?? []);
      setUnauthed(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Silent on transient errors — auto-refresh will retry.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
    const id = setInterval(() => {
      void fetchPending();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchPending]);

  const act = useCallback(
    async (signalId: string, action: "approve" | "reject") => {
      if (action === "reject" && !window.confirm(t.confirmReject)) return;
      setBusyId(signalId);
      setBusyAction(action);
      setErr("");
      try {
        const res = await fetch(
          `${API_BASE_URL}/signals/${encodeURIComponent(signalId)}/${action}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            // No override params yet — UI v1 keeps it simple
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchPending();
      } catch {
        setErr(t.error);
        // Re-fetch even on error — server may have already processed it
        await fetchPending();
      } finally {
        setBusyId(null);
        setBusyAction(null);
      }
    },
    [fetchPending, t.confirmReject, t.error],
  );

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 text-sm text-(--color-text-muted)">
        {t.notConnected}
      </div>
    );
  }

  return (
    <div class="card-enterprise rounded-2xl p-5 md:p-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-lg">{t.title}</h2>
        {signals.length > 0 && (
          <span
            class="text-xs font-mono font-bold text-(--color-accent)"
            aria-label={`${signals.length} pending`}
          >
            {signals.length}
          </span>
        )}
      </div>
      <p class="text-xs text-(--color-text-muted) mb-4">{t.subtitle}</p>

      {err && (
        <div
          class="mb-3 p-2 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-xs text-(--color-down)"
          role="alert"
          aria-live="assertive"
        >
          {err}
        </div>
      )}

      {loading && signals.length === 0 ? (
        <div class="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              class="h-16 rounded-lg bg-(--color-bg-elevated) motion-safe:animate-pulse"
            />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <p class="text-sm text-(--color-text-muted) italic">{t.none}</p>
      ) : (
        <ul class="space-y-2">
          {signals.map((s) => {
            const isLong = s.direction === "long";
            const dirColor = isLong
              ? "text-(--color-up)"
              : "text-(--color-down)";
            const dirLabel = isLong ? t.long : t.short;
            const expiryStr = formatExpiry(s.expires_at, t);
            const isExpired = s.expires_at <= Date.now() / 1000;
            const busy = busyId === s.id;
            return (
              <li
                key={s.id}
                class={`p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40 ${isExpired ? "opacity-50" : ""}`}
              >
                <div class="flex items-center justify-between flex-wrap gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class={`text-sm font-mono font-bold ${dirColor}`}>
                        {dirLabel}
                      </span>
                      <span class="text-sm font-mono font-bold">
                        {s.symbol}
                      </span>
                      <span class="text-xs font-mono text-(--color-text-muted)">
                        {s.base_strategy}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-(--color-text-muted) font-mono">
                      <span>@ ${s.signal_price.toFixed(4)}</span>
                      <span>·</span>
                      <span>{formatRelative(s.created_at, t)}</span>
                      <span>·</span>
                      <span class={isExpired ? "text-(--color-down)" : ""}>
                        {t.expiresIn} {expiryStr}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => act(s.id, "reject")}
                      disabled={busy || isExpired}
                      class="min-h-[36px] px-3 rounded-lg border border-(--color-border) text-xs font-bold text-(--color-text-muted) hover:text-(--color-down) hover:border-(--color-down)/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`${t.reject} ${s.symbol}`}
                    >
                      {busy && busyAction === "reject" ? t.rejecting : t.reject}
                    </button>
                    <button
                      type="button"
                      onClick={() => act(s.id, "approve")}
                      disabled={busy || isExpired}
                      class="min-h-[36px] px-3 rounded-lg bg-(--color-up)/10 border border-(--color-up)/40 text-xs font-bold text-(--color-up) hover:bg-(--color-up)/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`${t.approve} ${s.symbol}`}
                    >
                      {busy && busyAction === "approve"
                        ? t.approving
                        : t.approve}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
