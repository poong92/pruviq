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

// V1 audit (validation-analyst): multi-window distribution
interface MultiWindowResult {
  bot_id: string;
  n_windows: number;
  window_days: number;
  windows: Array<{
    start_iso: string;
    end_iso: string;
    fills_count: number;
    avg_entry_price: number;
    tp_cycles: number;
  }>;
  stats: {
    fills_count: { mean: number; std: number; cv: number; n: number };
    avg_entry_price: { mean: number; std: number; cv: number; n: number };
    tp_cycles: { mean: number; std: number; cv: number; n: number };
  };
  skipped?: string;
}

// V2 audit: parameter sensitivity sweep
interface SensitivityResult {
  bot_id: string;
  cv: number;
  mean: number;
  n: number;
  grid: Array<{ step: number; m: number; tp: number; fills_count: number }>;
  pass: boolean;
  skipped?: string;
}

// V3 audit: cycle count gate (derived from ParityResult.paper.tp_cycles ≥ 3)

interface FourGateState {
  parity?: ParityResult;
  multiWindow?: MultiWindowResult;
  sensitivity?: SensitivityResult;
  loaded: boolean;
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
    // 4-gate audit additions
    gate1: "Gate 1 — single-window parity",
    gate2: "Gate 2 — multi-window distribution (V1)",
    gate3: "Gate 3 — parameter sensitivity (V2)",
    gate4: "Gate 4 — cycle count ≥ 3 (V3)",
    overall4Gate: "4-Gate verdict",
    multiWinMean: "mean",
    multiWinStd: "±σ",
    multiWinBand: "±2σ band",
    multiWinInside: "Paper inside band",
    multiWinOutside: "Paper outside band",
    sensCv: "Grid CV",
    sensRobust: "Robust (CV<0.25)",
    sensFragile: "Fragile (CV≥0.25)",
    cycleNeed: "TP cycles observed",
    cycleNeedHint: "≥ 3 required for Gate 4",
    nWindows: "windows",
    sensGridSize: "27-cell grid",
    paperFills: "Paper fills",
    paperCycles: "Paper TP cycles",
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
    // 4-gate audit additions (KO)
    gate1: "Gate 1 — 단일 윈도우 패리티",
    gate2: "Gate 2 — 다중 윈도우 분포 (V1)",
    gate3: "Gate 3 — 파라미터 민감도 (V2)",
    gate4: "Gate 4 — TP 사이클 ≥ 3 (V3)",
    overall4Gate: "4-Gate 판정",
    multiWinMean: "평균",
    multiWinStd: "±σ",
    multiWinBand: "±2σ 범위",
    multiWinInside: "Paper 범위 안",
    multiWinOutside: "Paper 범위 밖",
    sensCv: "Grid CV",
    sensRobust: "안정 (CV<0.25)",
    sensFragile: "민감 (CV≥0.25)",
    cycleNeed: "관측된 TP 사이클",
    cycleNeedHint: "Gate 4 통과는 ≥ 3 필요",
    nWindows: "윈도우",
    sensGridSize: "27-셀 그리드",
    paperFills: "Paper 체결",
    paperCycles: "Paper TP 사이클",
  },
} as const;

export default function DCAParityCheck({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [bots, setBots] = useState<Bot[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [results, setResults] = useState<Record<string, ParityResult>>({});
  // 4-gate audit (V1+V2): hold multi-window + sensitivity per bot
  const [fourGate, setFourGate] = useState<Record<string, FourGateState>>({});
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
      // Gate 1 (single window) + Gate 2 (multi-window) + Gate 3 (sensitivity)
      // run in parallel. Gate 4 reads paper.tp_cycles from Gate 1 result.
      // Use Promise.allSettled so a single endpoint failure doesn't drop the
      // others — UI shows partial results.
      const enc = encodeURIComponent(botId);
      const [parityRes, mwRes, sensRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/dca-bots/${enc}/parity`, {
          credentials: "include",
          signal: AbortSignal.timeout(30_000),
        }),
        fetch(`${API_BASE_URL}/dca-bots/${enc}/parity-multi-window?windows=5`, {
          credentials: "include",
          signal: AbortSignal.timeout(60_000),
        }),
        fetch(`${API_BASE_URL}/dca-bots/${enc}/sensitivity-sweep`, {
          credentials: "include",
          signal: AbortSignal.timeout(60_000),
        }),
      ]);

      const next: FourGateState = { loaded: true };

      if (parityRes.status === "fulfilled" && parityRes.value.ok) {
        const data = (await parityRes.value.json()) as ParityResult;
        setResults((r) => ({ ...r, [botId]: data }));
        next.parity = data;
      } else if (
        parityRes.status === "fulfilled" &&
        parityRes.value.status === 429
      ) {
        throw new Error(t.rateLimitHint);
      } else if (parityRes.status === "fulfilled" && !parityRes.value.ok) {
        const body = await parityRes.value.json().catch(() => null);
        throw new Error(
          (body as { detail?: string } | null)?.detail ||
            `HTTP ${parityRes.value.status}`,
        );
      }
      if (mwRes.status === "fulfilled" && mwRes.value.ok) {
        next.multiWindow = (await mwRes.value.json()) as MultiWindowResult;
      }
      if (sensRes.status === "fulfilled" && sensRes.value.ok) {
        next.sensitivity = (await sensRes.value.json()) as SensitivityResult;
      }

      // If Gate 1 network-failed and no other gate returned data, surface error
      if (!next.parity && !next.multiWindow && !next.sensitivity) {
        throw new Error(t.error);
      }

      setFourGate((s) => ({ ...s, [botId]: next }));
    } catch (e) {
      setErrs((er) => ({
        ...er,
        [botId]: e instanceof Error ? e.message : t.error,
      }));
    } finally {
      setLoading((s) => ({ ...s, [botId]: false }));
    }
  }

  // Gate 2 verdict: paper fills_count inside backtest distribution ±2σ band?
  function gate2Verdict(g: FourGateState): {
    pass: boolean;
    paperFills: number;
    bandLow: number;
    bandHigh: number;
    mean: number;
    std: number;
  } | null {
    if (!g.multiWindow || !g.parity?.paper) return null;
    const s = g.multiWindow.stats.fills_count;
    if (!s.n) return null;
    const paperFills = g.parity.paper.fills_count;
    const bandLow = s.mean - 2 * s.std;
    const bandHigh = s.mean + 2 * s.std;
    return {
      pass: paperFills >= bandLow && paperFills <= bandHigh,
      paperFills,
      bandLow,
      bandHigh,
      mean: s.mean,
      std: s.std,
    };
  }

  // Gate 4 verdict: paper tp_cycles >= 3
  function gate4Verdict(g: FourGateState): {
    pass: boolean;
    cycles: number;
  } | null {
    if (!g.parity?.paper) return null;
    return {
      pass: g.parity.paper.tp_cycles >= 3,
      cycles: g.parity.paper.tp_cycles,
    };
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

                {/* 4-Gate audit verdict (V1+V2+V3 from validation-analyst).
                    Surfaces only after runParity successfully fetched the
                    multi-window/sensitivity endpoints. */}
                {fourGate[b.id]?.loaded &&
                  (() => {
                    const g = fourGate[b.id]!;
                    const g1 = g.parity?.pass?.overall;
                    const g2 = gate2Verdict(g);
                    const g3 = g.sensitivity;
                    const g4 = gate4Verdict(g);
                    const overall =
                      g1 === true &&
                      g2?.pass === true &&
                      g3?.pass === true &&
                      g4?.pass === true;
                    return (
                      <div class="mt-4 pt-4 border-t border-(--color-border)">
                        <div class="flex items-center gap-2 mb-3">
                          <span
                            class={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                              overall
                                ? "bg-(--color-up)/20 border border-(--color-up)/40 text-(--color-up)"
                                : "bg-(--color-down)/20 border border-(--color-down)/40 text-(--color-down)"
                            }`}
                          >
                            {overall ? "✅" : "⚠️"} {t.overall4Gate}:{" "}
                            {overall ? t.pass : t.fail}
                          </span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <GateCard
                            label={t.gate1}
                            pass={g1}
                            detail={
                              g.parity?.deltas
                                ? `Δ fills ${g.parity.deltas.fills_diff_pct.toFixed(1)}% · Δ avg ${g.parity.deltas.avg_diff_pct.toFixed(2)}%`
                                : g.parity?.skipped || "—"
                            }
                          />
                          <GateCard
                            label={t.gate2}
                            pass={g2?.pass}
                            detail={
                              g2
                                ? `${t.paperFills}: ${g2.paperFills} | ${t.multiWinMean} ${g2.mean.toFixed(1)} ${t.multiWinStd} ${g2.std.toFixed(1)} | ${t.multiWinBand} [${g2.bandLow.toFixed(1)}, ${g2.bandHigh.toFixed(1)}] · ${g.multiWindow?.n_windows ?? 0} ${t.nWindows} × ${g.multiWindow?.window_days ?? 0}d`
                                : g.multiWindow?.skipped || "—"
                            }
                          />
                          <GateCard
                            label={t.gate3}
                            pass={g3?.pass}
                            detail={
                              g3
                                ? `${t.sensCv}: ${g3.cv.toFixed(3)} (${g3.pass ? t.sensRobust : t.sensFragile}) · ${t.sensGridSize}`
                                : g.sensitivity?.skipped || "—"
                            }
                          />
                          <GateCard
                            label={t.gate4}
                            pass={g4?.pass}
                            detail={
                              g4
                                ? `${t.cycleNeed}: ${g4.cycles} (${t.cycleNeedHint})`
                                : "—"
                            }
                          />
                        </div>
                      </div>
                    );
                  })()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GateCard({
  label,
  pass,
  detail,
}: {
  label: string;
  pass: boolean | undefined;
  detail: string;
}) {
  const passed = pass === true;
  const tone =
    pass === undefined
      ? "border-(--color-border) text-(--color-text-muted)"
      : passed
        ? "border-(--color-up)/40 bg-(--color-up)/10 text-(--color-up)"
        : "border-(--color-down)/40 bg-(--color-down)/10 text-(--color-down)";
  return (
    <div class={`rounded-lg border p-3 ${tone}`}>
      <div class="font-mono font-bold mb-1 flex items-center gap-1">
        {pass === undefined ? "—" : passed ? "✅" : "❌"}
        <span>{label}</span>
      </div>
      <div class="text-(--color-text-muted) text-[11px] leading-snug font-mono">
        {detail}
      </div>
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
