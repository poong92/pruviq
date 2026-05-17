/**
 * DCASummaryStrip — rolling-window KPI strip for DCA paper-mode dog-foot.
 *
 * Polls GET /dca-bots/summary?hours=24 every 60s. Shows a 5-cell grid
 * (total fills, base, safety, TP closes, paper P&L) plus an active-bots
 * pill so owners can answer "did the bots do anything in the last day?"
 * at a glance without clicking into the feed.
 *
 * Hidden when the session has no activity AND no active bots — the
 * empty state of the RecentDCAFills feed below already covers that
 * case, no need to duplicate.
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Summary {
  window_hours: number;
  total_fills: number;
  base_fills: number;
  safety_fills: number;
  tp_closes: number;
  active_bots: number;
  bots_with_open_position: number;
  paper_pnl_usdt: number;
  cumulative_max_exposure_usdt?: number;
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_MS = 60_000;

const i18n = {
  en: {
    title: "Last 24h",
    totalFills: "Fills",
    baseFills: "Base",
    safetyFills: "Safety",
    tpCloses: "TP closes",
    paperPnl: "Paper P&L",
    activeBots: "active",
    openBots: "with open positions",
    maxExposure: "Max exposure",
    maxExposureHint:
      "If every safety order fires across all active bots, total notional reaches this number.",
  },
  ko: {
    title: "최근 24시간",
    totalFills: "체결",
    baseFills: "기준",
    safetyFills: "안전",
    tpCloses: "익절",
    paperPnl: "모의 P&L",
    activeBots: "활성",
    openBots: "포지션 보유",
    maxExposure: "최대 노출",
    maxExposureHint:
      "활성 봇 전체의 모든 안전 매수가 발사되면 총 노출이 이 금액에 도달합니다.",
  },
} as const;

export default function DCASummaryStrip({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [sum, setSum] = useState<Summary | null>(null);
  const [unauthed, setUnauthed] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots/summary?hours=24`, {
        credentials: "include",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as Summary;
      setSum(data);
      setUnauthed(false);
    } catch {
      // silent — summary is best-effort, not user-blocking
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const id = setInterval(() => void fetchSummary(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchSummary]);

  if (unauthed || !sum) return null;
  // Hide if no activity AND no active bots — RecentDCAFills empty state covers it
  if (sum.total_fills === 0 && sum.active_bots === 0) return null;

  const pnlColor =
    sum.paper_pnl_usdt > 0
      ? "text-(--color-up)"
      : sum.paper_pnl_usdt < 0
        ? "text-(--color-down)"
        : "";
  const pnlPrefix = sum.paper_pnl_usdt > 0 ? "+" : "";

  return (
    <div class="card-enterprise rounded-2xl p-4 md:p-5">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="font-bold text-sm">{t.title}</h2>
        <div class="flex items-center gap-2 text-xs font-mono">
          <span class="px-2 py-0.5 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/30 text-(--color-accent-bright)">
            {sum.active_bots} {t.activeBots}
          </span>
          {sum.bots_with_open_position > 0 && (
            <span class="px-2 py-0.5 rounded-full bg-(--color-warning)/10 border border-(--color-warning)/30 text-(--color-warning)">
              {sum.bots_with_open_position} {t.openBots}
            </span>
          )}
          {(sum.cumulative_max_exposure_usdt ?? 0) > 0 && (
            <span
              class="px-2 py-0.5 rounded-full bg-(--color-bg-elevated) border border-(--color-border)"
              title={t.maxExposureHint}
            >
              {t.maxExposure}: $
              {(sum.cumulative_max_exposure_usdt ?? 0).toLocaleString(
                undefined,
                { maximumFractionDigits: 0 },
              )}
            </span>
          )}
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Cell label={t.totalFills} value={sum.total_fills} />
        <Cell label={t.baseFills} value={sum.base_fills} />
        <Cell label={t.safetyFills} value={sum.safety_fills} />
        <Cell label={t.tpCloses} value={sum.tp_closes} />
        <Cell
          label={t.paperPnl}
          value={`${pnlPrefix}${sum.paper_pnl_usdt.toFixed(2)}`}
          color={pnlColor}
          suffix=" USDT"
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  color = "",
  suffix = "",
}: {
  label: string;
  value: number | string;
  color?: string;
  suffix?: string;
}) {
  return (
    <div class="bg-(--color-bg)/40 rounded-lg p-2.5 text-center">
      <p class="text-[0.65rem] uppercase tracking-wider text-(--color-text-muted) mb-0.5">
        {label}
      </p>
      <p class={`text-lg font-bold font-mono ${color}`}>
        {value}
        {suffix && (
          <span class="text-xs font-normal text-(--color-text-muted) ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
