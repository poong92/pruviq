/**
 * OKXBalance — read-only Trading-account balance card.
 *
 * Polls GET /execute/balance every 30s. Shows all non-zero ccy rows plus
 * a `Trading account 비어있음` hint with explicit Funding→Trading
 * transfer guidance when the array comes back empty (the most common
 * cause of "내 잔고가 왜 안 보여?" — assets sit in Funding by default
 * on OKX).
 *
 * Never writes, never places orders. Safe to keep on the dashboard
 * forever; behaves like LivePositions / AutoTradingStatus.
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface BalanceRow {
  ccy: string;
  bal: string;
  avail_bal: string;
  frozen_bal: string;
}

interface Props {
  lang?: "en" | "ko";
}

const POLL_MS = 30_000;

const i18n = {
  en: {
    title: "OKX Trading Balance",
    refreshing: "Refreshing…",
    notConnected: "Connect OKX to see your balance.",
    error: "Failed to load balance",
    retry: "Retry",
    empty: "Trading account is empty.",
    emptyHint:
      "If you have funds, they may be in your Funding account. Transfer them on OKX → Assets → Transfer → Funding to Trading.",
    columns: {
      ccy: "Asset",
      bal: "Total",
      avail: "Available",
      frozen: "Frozen",
    },
    crossMarginHint:
      "Cross-margin: Total may show 0 while Available > 0 — other assets are collateralizing USDT. This is OKX normal.",
    updated: "Auto-refreshes every 30s",
    openOkx: "Open OKX Assets ↗",
    fundingTitle: "Funding (Wallet) — ready to transfer",
    fundingHint:
      "These assets sit in your Funding account. Bots only fill against Trading. Move them on OKX → Assets → Transfer → Funding to Trading.",
    fundingTransferCta: "Transfer on OKX ↗",
  },
  ko: {
    title: "OKX 거래 계정 잔고",
    refreshing: "불러오는 중…",
    notConnected: "잔고를 보려면 OKX를 연결하세요.",
    error: "잔고 불러오기 실패",
    retry: "다시 시도",
    empty: "거래 계정이 비어 있습니다.",
    emptyHint:
      "자산이 Funding 계정에 있을 수 있습니다. OKX → 자산 → 이체 → Funding에서 Trading으로 이동하세요.",
    columns: {
      ccy: "자산",
      bal: "총량",
      avail: "사용 가능",
      frozen: "잠김",
    },
    crossMarginHint:
      "통합 마진: 다른 자산이 USDT 담보로 잡혀 있으면 총량은 0, 사용 가능은 > 0으로 표시될 수 있습니다 (OKX 정상).",
    updated: "30초마다 자동 갱신",
    openOkx: "OKX 자산 페이지 열기 ↗",
    fundingTitle: "Funding 계정 — 이체 대기 자산",
    fundingHint:
      "이 자산은 Funding 계정에 있습니다. 봇은 Trading 계정만 사용합니다. OKX → 자산 → 이체 → Funding → Trading 으로 이동하세요.",
    fundingTransferCta: "OKX에서 이체 ↗",
  },
} as const;

function fmtNumber(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return "0";
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function OKXBalance({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [fundingRows, setFundingRows] = useState<BalanceRow[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchBalance = useCallback(async () => {
    try {
      // Fetch both buckets in parallel — Trading + Funding
      const [tradingRes, fundingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/execute/balance`, {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        }),
        fetch(`${API_BASE_URL}/execute/funding-balance`, {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        }),
      ]);
      if (tradingRes.status === 401 || fundingRes.status === 401) {
        setUnauthed(true);
        setLoading(false);
        return;
      }
      if (!tradingRes.ok) throw new Error(`Trading HTTP ${tradingRes.status}`);
      const tradingData = (await tradingRes.json()) as {
        balances: BalanceRow[];
      };
      const nonZero = (tradingData.balances ?? []).filter(
        (r) => Number(r.bal) > 0 || Number(r.avail_bal) > 0,
      );
      setRows(nonZero);
      // Funding is best-effort: surface but don't fail the whole load
      if (fundingRes.ok) {
        const fundingData = (await fundingRes.json()) as {
          balances: BalanceRow[];
        };
        const fundingNonZero = (fundingData.balances ?? []).filter(
          (r) => Number(r.bal) > 0 || Number(r.avail_bal) > 0,
        );
        setFundingRows(fundingNonZero);
      } else {
        setFundingRows([]);
      }
      setUnauthed(false);
      setErr("");
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    void fetchBalance();
    const id = setInterval(() => {
      void fetchBalance();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchBalance]);

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 flex items-center gap-3 text-(--color-text-muted)">
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
        <p class="text-sm">{t.notConnected}</p>
      </div>
    );
  }

  return (
    <div class="card-enterprise rounded-2xl p-5 md:p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-lg">{t.title}</h2>
        {lastUpdated && (
          <span class="inline-flex items-center gap-1.5 text-xs text-(--color-text-muted) font-mono">
            <span
              aria-hidden="true"
              class="inline-block w-1.5 h-1.5 rounded-full bg-(--color-up) motion-safe:animate-pulse"
            />
            {lastUpdated}
          </span>
        )}
      </div>

      {err && (
        <div
          class="p-3 mb-3 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-sm text-(--color-down)"
          role="alert"
          aria-live="assertive"
        >
          {err}
          <button
            type="button"
            class="ml-3 underline"
            onClick={() => {
              setErr("");
              void fetchBalance();
            }}
          >
            {t.retry}
          </button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        // Content-shaped skeleton: 3 rows of (asset / total / available / frozen)
        // matching the final table layout so the visual jump is minimal.
        <div class="overflow-x-auto" aria-hidden="true">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-(--color-border) bg-(--color-bg)/30">
                <th class="text-left p-3 font-bold">{t.columns.ccy}</th>
                <th class="text-right p-3 font-bold">{t.columns.bal}</th>
                <th class="text-right p-3 font-bold">{t.columns.avail}</th>
                <th class="text-right p-3 font-bold">{t.columns.frozen}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} class="border-b border-(--color-border)/40">
                  <td class="p-3">
                    <div class="h-4 w-12 rounded bg-(--color-bg-elevated) motion-safe:animate-pulse" />
                  </td>
                  <td class="p-3">
                    <div class="h-4 w-20 ml-auto rounded bg-(--color-bg-elevated) motion-safe:animate-pulse" />
                  </td>
                  <td class="p-3">
                    <div class="h-4 w-20 ml-auto rounded bg-(--color-bg-elevated) motion-safe:animate-pulse" />
                  </td>
                  <td class="p-3">
                    <div class="h-4 w-16 ml-auto rounded bg-(--color-bg-elevated) motion-safe:animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div
          class="p-4 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-sm space-y-2"
          role="status"
        >
          <p class="font-bold text-(--color-warning)">⚠️ {t.empty}</p>
          <p class="text-(--color-text-secondary) leading-relaxed">
            {t.emptyHint}
          </p>
          <a
            href="https://www.okx.com/balance/main-account"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center min-h-[44px] px-3 -mx-3 text-xs text-(--color-accent) hover:underline mt-1"
          >
            {t.openOkx}
          </a>
        </div>
      ) : (
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-(--color-border) bg-(--color-bg)/30">
                <th class="text-left p-3 font-bold">{t.columns.ccy}</th>
                <th class="text-right p-3 font-bold">{t.columns.bal}</th>
                <th class="text-right p-3 font-bold">{t.columns.avail}</th>
                <th class="text-right p-3 font-bold">{t.columns.frozen}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ccy}
                  class="border-b border-(--color-border)/40 hover:bg-(--color-bg)/30"
                >
                  <td class="p-3 font-mono font-bold">{r.ccy}</td>
                  <td class="p-3 font-mono text-right">{fmtNumber(r.bal)}</td>
                  <td class="p-3 font-mono text-right">
                    {fmtNumber(r.avail_bal)}
                  </td>
                  <td class="p-3 font-mono text-right text-(--color-text-muted)">
                    {fmtNumber(r.frozen_bal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Cross-margin quirk explanation — Total can show 0 while
              Available > 0 when other assets collateralize USDT. */}
          {rows.some((r) => Number(r.bal) === 0 && Number(r.avail_bal) > 0) && (
            <p class="mt-3 text-xs text-(--color-text-muted) italic">
              ℹ {t.crossMarginHint}
            </p>
          )}
        </div>
      )}

      {fundingRows.length > 0 && (
        <div class="mt-5 pt-4 border-t border-(--color-border)">
          <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 class="font-bold text-sm text-(--color-warning)">
              💰 {t.fundingTitle}
            </h3>
            <a
              href="https://www.okx.com/balance/main-account"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center min-h-[44px] px-3 -mx-3 text-xs font-bold text-(--color-accent) hover:underline rounded-lg hover:bg-(--color-accent)/10"
            >
              {t.fundingTransferCta}
            </a>
          </div>
          <p class="text-xs text-(--color-text-muted) mb-3 leading-relaxed">
            {t.fundingHint}
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-(--color-border) bg-(--color-bg)/30">
                  <th class="text-left p-3 font-bold">{t.columns.ccy}</th>
                  <th class="text-right p-3 font-bold">{t.columns.bal}</th>
                  <th class="text-right p-3 font-bold">{t.columns.avail}</th>
                </tr>
              </thead>
              <tbody>
                {fundingRows.map((r) => (
                  <tr
                    key={r.ccy}
                    class="border-b border-(--color-border)/40 hover:bg-(--color-bg)/30"
                  >
                    <td class="p-3 font-mono font-bold">{r.ccy}</td>
                    <td class="p-3 font-mono text-right">{fmtNumber(r.bal)}</td>
                    <td class="p-3 font-mono text-right">
                      {fmtNumber(r.avail_bal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p class="text-xs text-(--color-text-muted) mt-3 text-right">
        {t.updated}
      </p>
    </div>
  );
}
