/**
 * DCAParityCheck — backtest-vs-paper Day-7 acceptance test, in-product.
 *
 * Lists every DCA bot in this session that has any fills, with a
 * "Run parity check" button per bot. Hitting it calls
 * GET /dca-bots/:id/parity which:
 *   - Loads the bot's open + closed fills from paper-mode
 *   - Runs the dca_backtest simulator with the same params over the
 *     window (bot.created_at → now)
 *   - Returns side-by-side counts + a PASS/FAIL per dog-foot manual
 *     acceptance criteria (fills ≤ 10%, avg ≤ 1%, TP cycles ≤ 1)
 *
 * Surfaces what owners currently do manually via SSH + curl on Day 7.
 * Critical signal for whether paper-mode is safe to graduate to real.
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Bot {
  id: string;
  name: string;
  symbol: string;
  is_active: number;
}

interface ParityResult {
  bot_id: string;
  skipped?: string;
  hint?: string;
  hours_elapsed?: number;
  window?: { start_iso: string; hours_elapsed: number; candle_count: number };
  paper?: {
    fills_count: number;
    avg_entry_price: number;
    tp_cycles: number;
  };
  backtest?: {
    fills_count: number;
    avg_entry_price: number;
    tp_cycles: number;
    exit_reason: string;
  };
  deltas?: {
    fills_diff_pct: number;
    avg_diff_pct: number;
    tp_abs_diff: number;
  };
  pass?: {
    fills: boolean;
    avg_entry: boolean;
    tp_cycles: boolean;
    overall: boolean;
  };
}

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    title: "Parity check (backtest vs paper)",
    subtitle:
      "Day-7 dog-foot acceptance: how closely does paper fill match what backtest predicts?",
    notConnected: "Connect OKX to run parity checks.",
    empty:
      "No bots with fills yet — activate a bot and wait for at least one base fill.",
    runBtn: "Run parity check",
    running: "Running…",
    pass: "PASS",
    fail: "FAIL",
    skipped: "Skipped",
    paper: "Paper",
    backtest: "Backtest",
    diff: "Δ",
    fillsCount: "Fills",
    avgEntry: "Avg entry",
    tpCycles: "TP cycles",
    overall: "Overall parity",
    windowH: "Window",
    candles: "candles",
    error: "Parity check failed",
    rateLimitHint: "5s rate limit between checks",
  },
  ko: {
    title: "패리티 검증 (백테스트 vs 모의)",
    subtitle:
      "Day-7 dog-foot 합격 기준: paper 체결이 backtest 예측과 얼마나 일치?",
    notConnected: "OKX를 연결하면 패리티 검증을 실행할 수 있습니다.",
    empty:
      "체결이 있는 봇이 없습니다 — 봇을 활성화하고 최소 1개의 기준 체결을 기다리세요.",
    runBtn: "패리티 검증 실행",
    running: "실행 중…",
    pass: "통과",
    fail: "실패",
    skipped: "건너뜀",
    paper: "Paper",
    backtest: "Backtest",
    diff: "Δ",
    fillsCount: "체결 수",
    avgEntry: "평단가",
    tpCycles: "익절 사이클",
    overall: "전체 패리티",
    windowH: "기간",
    candles: "캔들",
    error: "패리티 검증 실패",
    rateLimitHint: "검증 간 5초 제한",
  },
} as const;

export default function DCAParityCheck({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [bots, setBots] = useState<Bot[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [results, setResults] = useState<Record<string, ParityResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});

  const loadBots = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots`, {
        credentials: "include",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { bots: Bot[] };
      setBots(data.bots ?? []);
      setUnauthed(false);
    } catch {
      // silent — bot list comes from another widget anyway
    }
  }, []);

  useEffect(() => {
    void loadBots();
    const id = setInterval(() => void loadBots(), 60_000);
    return () => clearInterval(id);
  }, [loadBots]);

  async function runParity(botId: string) {
    setLoading((s) => ({ ...s, [botId]: true }));
    setErrs((e) => ({ ...e, [botId]: "" }));
    try {
      const res = await fetch(
        `${API_BASE_URL}/dca-bots/${encodeURIComponent(botId)}/parity`,
        { credentials: "include", signal: AbortSignal.timeout(30_000) },
      );
      if (res.status === 429) {
        throw new Error(t.rateLimitHint);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ParityResult;
      setResults((r) => ({ ...r, [botId]: data }));
    } catch (e) {
      setErrs((er) => ({
        ...er,
        [botId]: e instanceof Error ? e.message : t.error,
      }));
    } finally {
      setLoading((s) => ({ ...s, [botId]: false }));
    }
  }

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 text-sm text-(--color-text-muted)">
        {t.notConnected}
      </div>
    );
  }

  // Only show bots that could plausibly have fills (active OR has been active)
  // — backend returns "no_paper_fills_yet" for new bots anyway, but we filter
  // to keep the UI focused.
  const visibleBots = bots;

  return (
    <div class="card-enterprise rounded-2xl p-5 md:p-6">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="font-bold text-lg">{t.title}</h2>
        <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
      </div>

      {visibleBots.length === 0 ? (
        <p class="text-sm text-(--color-text-muted) italic">{t.empty}</p>
      ) : (
        <ul class="space-y-3">
          {visibleBots.map((b) => {
            const r = results[b.id];
            const err = errs[b.id];
            const busy = loading[b.id];
            return (
              <li
                key={b.id}
                class="p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40"
              >
                <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div class="min-w-0">
                    <p class="font-bold text-sm truncate">{b.name}</p>
                    <p class="text-xs font-mono text-(--color-text-muted)">
                      {b.symbol}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm min-h-[44px]"
                    onClick={() => runParity(b.id)}
                    disabled={busy}
                  >
                    {busy ? t.running : t.runBtn}
                  </button>
                </div>

                {err && (
                  <div
                    class="p-2.5 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-xs text-(--color-down)"
                    role="alert"
                    aria-live="assertive"
                  >
                    ⚠ {err}
                  </div>
                )}

                {r && r.skipped && (
                  <div class="p-2.5 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-xs">
                    <p class="font-bold">
                      {t.skipped}: {r.skipped}
                    </p>
                    {r.hint && (
                      <p class="text-(--color-text-muted) mt-1">{r.hint}</p>
                    )}
                  </div>
                )}

                {r &&
                  r.pass &&
                  r.paper &&
                  r.backtest &&
                  r.deltas &&
                  r.window && (
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span
                          class={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                            r.pass.overall
                              ? "bg-(--color-up)/20 border border-(--color-up)/40 text-(--color-up)"
                              : "bg-(--color-down)/20 border border-(--color-down)/40 text-(--color-down)"
                          }`}
                        >
                          {r.pass.overall ? "✅" : "❌"} {t.overall}:{" "}
                          {r.pass.overall ? t.pass : t.fail}
                        </span>
                        <span class="text-xs text-(--color-text-muted) font-mono">
                          {t.windowH} {r.window.hours_elapsed.toFixed(1)}h ·{" "}
                          {r.window.candle_count} {t.candles}
                        </span>
                      </div>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs font-mono">
                          <thead>
                            <tr class="border-b border-(--color-border)">
                              <th class="text-left p-2"></th>
                              <th class="text-right p-2">{t.paper}</th>
                              <th class="text-right p-2">{t.backtest}</th>
                              <th class="text-right p-2">{t.diff}</th>
                              <th class="text-center p-2">✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            <Row
                              label={t.fillsCount}
                              paper={r.paper.fills_count}
                              bt={r.backtest.fills_count}
                              diff={`${r.deltas.fills_diff_pct.toFixed(1)}%`}
                              pass={r.pass.fills}
                            />
                            <Row
                              label={t.avgEntry}
                              paper={r.paper.avg_entry_price.toFixed(2)}
                              bt={r.backtest.avg_entry_price.toFixed(2)}
                              diff={`${r.deltas.avg_diff_pct.toFixed(2)}%`}
                              pass={r.pass.avg_entry}
                            />
                            <Row
                              label={t.tpCycles}
                              paper={r.paper.tp_cycles}
                              bt={r.backtest.tp_cycles}
                              diff={`±${r.deltas.tp_abs_diff}`}
                              pass={r.pass.tp_cycles}
                            />
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  paper,
  bt,
  diff,
  pass,
}: {
  label: string;
  paper: number | string;
  bt: number | string;
  diff: string;
  pass: boolean;
}) {
  return (
    <tr class="border-b border-(--color-border)/40">
      <td class="p-2 text-(--color-text-muted)">{label}</td>
      <td class="p-2 text-right">{paper}</td>
      <td class="p-2 text-right">{bt}</td>
      <td class="p-2 text-right">{diff}</td>
      <td class="p-2 text-center">
        {pass ? (
          <span class="text-(--color-up)">✓</span>
        ) : (
          <span class="text-(--color-down)">✗</span>
        )}
      </td>
    </tr>
  );
}
