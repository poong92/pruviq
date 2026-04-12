/**
 * AutoTradingStatus — live bot status widget for the dashboard.
 * Polls GET /execute/bot-status every 30s.
 * Shows: status light, mode, today's trades, today's PnL, last trade.
 */
import { useState, useEffect, useCallback } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface BotStatus {
  status: "running" | "stopped" | "paused";
  execution_mode: "manual" | "alert" | "auto";
  enabled: boolean;
  trades_today: number;
  pnl_today: number;
  daily_loss_limit: number;
  limit_reached: boolean;
  last_trade: {
    signal: { strategy: string; coin: string; direction: string };
    pnl_usdt: number;
    timestamp: number;
  } | null;
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_MS = 30_000;

const i18n = {
  en: {
    title: "Bot Status",
    status: {
      running: "Running",
      stopped: "Stopped",
      paused: "Paused (loss limit)",
    },
    mode: { manual: "Manual", alert: "Alert", auto: "Auto" },
    trades_today: "Trades Today",
    pnl_today: "P&L Today",
    last_trade: "Last Trade",
    no_trades: "No trades yet",
    limit_warn: "Daily loss limit reached — trading paused",
    configure: "Configure →",
    updated: "Auto-refreshes every 30s",
    not_connected: "Connect OKX to see bot status",
  },
  ko: {
    title: "봇 상태",
    status: {
      running: "실행 중",
      stopped: "중지됨",
      paused: "일시 중지 (손실 한도)",
    },
    mode: { manual: "수동", alert: "알림", auto: "자동" },
    trades_today: "오늘 거래 수",
    pnl_today: "오늘 수익",
    last_trade: "마지막 거래",
    no_trades: "거래 없음",
    limit_warn: "일일 손실 한도 도달 — 거래 중지",
    configure: "설정 →",
    updated: "30초마다 자동 갱신",
    not_connected: "봇 상태 확인을 위해 OKX를 연결하세요",
  },
} as const;

function StatusLight({ status }: { status: BotStatus["status"] }) {
  const colors: Record<BotStatus["status"], string> = {
    running: "bg-[--color-up]",
    stopped: "bg-[--color-text-muted]",
    paused: "bg-yellow-500",
  };
  const pulse = status === "running" ? "animate-pulse" : "";
  return (
    <span
      class={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[status]} ${pulse}`}
      aria-hidden="true"
    />
  );
}

export default function AutoTradingStatus({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [unauthed, setUnauthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/execute/bot-status`, {
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: BotStatus = await res.json();
      setBotStatus(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setUnauthed(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Not connected
  if (!loading && unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 flex items-center gap-3 text-[--color-text-muted]">
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
        <p class="text-sm">{t.not_connected}</p>
      </div>
    );
  }

  // Loading skeleton
  if (loading || !botStatus) {
    return (
      <div class="card-enterprise rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-2.5 h-2.5 rounded-full bg-[--color-bg-elevated] animate-pulse" />
          <div class="h-4 w-24 rounded bg-[--color-bg-elevated] animate-pulse" />
        </div>
        <div class="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              class="h-14 rounded-lg bg-[--color-bg-elevated] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const statusText = t.status[botStatus.status];
  const modeText = t.mode[botStatus.execution_mode];
  const pnlColor =
    botStatus.pnl_today >= 0 ? "text-[--color-up]" : "text-[--color-down]";
  const pnlSign = botStatus.pnl_today >= 0 ? "+" : "";
  const settingsPath = lang === "ko" ? "/ko/dashboard" : "/dashboard";

  return (
    <div class="card-enterprise rounded-xl p-5">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <StatusLight status={botStatus.status} />
          <h2 class="font-bold text-sm">{t.title}</h2>
          <span class="text-xs font-mono text-[--color-text-muted]">
            ({statusText} · {modeText})
          </span>
        </div>
        <a
          href={settingsPath}
          class="text-xs text-[--color-accent] hover:underline"
        >
          {t.configure}
        </a>
      </div>

      {/* Loss limit warning */}
      {botStatus.limit_reached && (
        <div
          class="mb-4 px-3 py-2 rounded-lg bg-[--color-down]/10 border border-[--color-down]/20 text-xs text-[--color-down]"
          role="alert"
          aria-live="assertive"
        >
          {t.limit_warn}
        </div>
      )}

      {/* Stats grid */}
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-[--color-bg]/50 rounded-xl p-3 text-center">
          <p class="text-xs text-[--color-text-muted] mb-1">{t.trades_today}</p>
          <p class="text-2xl font-bold">{botStatus.trades_today}</p>
        </div>
        <div class="bg-[--color-bg]/50 rounded-xl p-3 text-center">
          <p class="text-xs text-[--color-text-muted] mb-1">{t.pnl_today}</p>
          <p class={`text-2xl font-bold ${pnlColor}`}>
            {pnlSign}${botStatus.pnl_today.toFixed(2)}
          </p>
        </div>
        <div class="bg-[--color-bg]/50 rounded-xl p-3 text-center">
          <p class="text-xs text-[--color-text-muted] mb-1">Loss Limit</p>
          <p class="text-2xl font-bold">${botStatus.daily_loss_limit}</p>
        </div>
      </div>

      {/* Last trade */}
      <div class="flex items-center justify-between text-xs text-[--color-text-muted]">
        <span>{t.last_trade}:</span>
        {botStatus.last_trade ? (
          <span class="font-mono">
            {botStatus.last_trade.signal.coin} ·{" "}
            {botStatus.last_trade.signal.direction.toUpperCase()} ·{" "}
            {botStatus.last_trade.signal.strategy}
          </span>
        ) : (
          <span class="italic">{t.no_trades}</span>
        )}
      </div>

      {lastUpdated && (
        <p class="text-xs text-[--color-text-muted] mt-2 text-right">
          {t.updated}
        </p>
      )}
    </div>
  );
}
