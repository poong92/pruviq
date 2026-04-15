/**
 * OptimizePanel.tsx – SL/TP grid-search heatmap
 *
 * Calls POST /simulate/optimize and renders a color-coded table where
 * each cell shows the primary metric value for that SL/TP combination.
 */
import { useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";
import { COLORS } from "./simulator-types";

// ── Types ────────────────────────────────────────────────────────────────────

interface OptimizeCell {
  sl_pct: number;
  tp_pct: number;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
}

interface OptimizeResponse {
  strategy: string;
  direction: string;
  metric: string;
  sl_steps: number[];
  tp_steps: number[];
  grid: OptimizeCell[];
  coins_used: number;
  data_range: string;
  compute_time_ms: number;
}

type MetricKey =
  | "total_return_pct"
  | "win_rate"
  | "profit_factor"
  | "sharpe_ratio";

interface Props {
  strategy: string;
  direction: string;
  max_bars: number;
  top_n: number;
  market_type?: "futures" | "spot";
  start_date?: string | null;
  end_date?: string | null;
  timeframe?: string;
  lang: "en" | "ko";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<MetricKey, { en: string; ko: string }> = {
  total_return_pct: { en: "Total Return %", ko: "총 수익률 %" },
  win_rate: { en: "Win Rate %", ko: "승률 %" },
  profit_factor: { en: "Profit Factor", ko: "손익비" },
  sharpe_ratio: { en: "Sharpe Ratio", ko: "샤프 비율" },
};

const DEFAULT_STEPS = [5, 8, 10, 15, 20];

function getMetricValue(cell: OptimizeCell, metric: MetricKey): number {
  return cell[metric] ?? 0;
}

function metricLabel(metric: MetricKey, lang: "en" | "ko"): string {
  return METRIC_LABELS[metric][lang];
}

function formatMetric(v: number, metric: MetricKey): string {
  if (metric === "profit_factor") return v === 0 ? "–" : v.toFixed(2);
  if (metric === "sharpe_ratio") return v === 0 ? "–" : v.toFixed(2);
  if (metric === "total_return_pct" || metric === "win_rate")
    return v === 0 ? "–" : v.toFixed(1) + "%";
  return v.toFixed(2);
}

/** Map value to a green↔red color.  Higher is always better. */
function heatColor(v: number, min: number, max: number): string {
  if (max === min) return "rgba(49,130,246,0.15)";
  const ratio = Math.max(0, Math.min(1, (v - min) / (max - min)));
  // ratio=1 → green, ratio=0 → red
  const r = Math.round(240 * (1 - ratio) + 0 * ratio);
  const g = Math.round(66 * (1 - ratio) + 192 * ratio);
  const b = Math.round(81 * (1 - ratio) + 115 * ratio);
  return `rgba(${r},${g},${b},${0.12 + ratio * 0.28})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OptimizePanel({
  strategy,
  direction,
  max_bars,
  top_n,
  market_type = "futures",
  start_date,
  end_date,
  timeframe = "1H",
  lang,
  t,
}: Props) {
  const [metric, setMetric] = useState<MetricKey>("total_return_pct");
  const [slSteps, setSlSteps] = useState<number[]>(DEFAULT_STEPS);
  const [tpSteps, setTpSteps] = useState<number[]>(DEFAULT_STEPS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Step editor helpers ───────────────────────────────────────────────────

  function toggleStep(
    arr: number[],
    setArr: (v: number[]) => void,
    val: number,
  ) {
    if (arr.includes(val)) {
      if (arr.length <= 2) return; // min 2 steps
      setArr(arr.filter((x) => x !== val).sort((a, b) => a - b));
    } else {
      if (arr.length >= 6) return; // max 6
      setArr([...arr, val].sort((a, b) => a - b));
    }
  }

  const STEP_OPTIONS = [3, 5, 8, 10, 12, 15, 18, 20, 25];

  // ── Run optimization ──────────────────────────────────────────────────────

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        strategy,
        direction: direction === "both" ? "both" : direction,
        sl_steps: slSteps,
        tp_steps: tpSteps,
        max_bars,
        market_type,
        top_n: Math.min(top_n, 50),
        metric,
        ...(start_date ? { start_date } : {}),
        ...(end_date ? { end_date } : {}),
        timeframe,
      };
      const res = await fetch(`${API_BASE_URL}/simulate/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Heatmap rendering ─────────────────────────────────────────────────────

  function renderHeatmap(data: OptimizeResponse) {
    const { sl_steps, tp_steps, grid } = data;
    const values = grid.map((c) => getMetricValue(c, metric));
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    // Find best cell
    const bestIdx = values.reduce((bi, v, i) => (v > values[bi] ? i : bi), 0);

    const colCount = tp_steps.length;

    return (
      <div class="overflow-x-auto">
        <table class="w-full text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th class="p-2 text-left text-[--color-text-muted]">
                {lang === "ko" ? "SL\\ TP→" : "SL\\ TP→"}
              </th>
              {tp_steps.map((tp) => (
                <th
                  key={tp}
                  class="p-2 text-center font-semibold"
                  style={{ color: COLORS.accent }}
                >
                  TP {tp}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sl_steps.map((sl, ri) => (
              <tr key={sl}>
                <td class="p-2 font-semibold" style={{ color: COLORS.accent }}>
                  SL {sl}%
                </td>
                {tp_steps.map((tp, ci) => {
                  const idx = ri * colCount + ci;
                  const cell = grid[idx];
                  const v = getMetricValue(cell, metric);
                  const isBest = idx === bestIdx && cell.total_trades > 0;
                  const noTrades = cell.total_trades === 0;
                  return (
                    <td
                      key={tp}
                      class="p-2 text-center transition-all"
                      style={{
                        background: noTrades
                          ? "rgba(255,255,255,0.03)"
                          : heatColor(v, minV, maxV),
                        border: isBest
                          ? `1.5px solid ${COLORS.green}`
                          : "1px solid rgba(255,255,255,0.04)",
                        borderRadius: "4px",
                        position: "relative",
                      }}
                      title={
                        noTrades
                          ? "No trades"
                          : `Trades: ${cell.total_trades} | WR: ${cell.win_rate.toFixed(1)}% | PF: ${cell.profit_factor.toFixed(2)} | Return: ${cell.total_return_pct.toFixed(1)}% | MDD: ${cell.max_drawdown_pct.toFixed(1)}%`
                      }
                    >
                      {isBest && (
                        <span
                          class="absolute top-0.5 right-0.5 text-[8px]"
                          style={{ color: COLORS.green }}
                        >
                          ★
                        </span>
                      )}
                      <span
                        style={{
                          color: noTrades
                            ? "var(--color-text-muted)"
                            : v >= 0
                              ? COLORS.green
                              : COLORS.red,
                          fontWeight: isBest ? 700 : 400,
                        }}
                      >
                        {noTrades ? "–" : formatMetric(v, metric)}
                      </span>
                      {!noTrades && (
                        <div
                          class="text-[9px] mt-0.5"
                          style={{
                            color: "var(--color-text-muted)",
                            opacity: 0.7,
                          }}
                        >
                          {cell.total_trades}t
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div class="space-y-4 p-3 md:p-4">
      {/* Header */}
      <div>
        <h3
          class="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text)" }}
        >
          {lang === "ko"
            ? "SL/TP 파라미터 최적화"
            : "SL/TP Parameter Optimization"}
        </h3>
        <p class="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {lang === "ko"
            ? "SL/TP 조합별 성과를 비교해 최적 파라미터를 찾습니다 (코인 최대 50개)."
            : "Compare performance across SL/TP combinations to find the optimal parameters (up to 50 coins)."}
        </p>
      </div>

      {/* Config row */}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Metric selector */}
        <div>
          <label
            class="block text-[11px] mb-1.5 font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {lang === "ko" ? "최적화 기준" : "Optimize by"}
          </label>
          <select
            value={metric}
            onChange={(e) =>
              setMetric((e.target as HTMLSelectElement).value as MetricKey)
            }
            class="w-full rounded px-2 py-1.5 text-xs font-mono"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
              <option key={k} value={k}>
                {metricLabel(k, lang)}
              </option>
            ))}
          </select>
        </div>

        {/* SL steps */}
        <div>
          <label
            class="block text-[11px] mb-1.5 font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {lang === "ko"
              ? `손절 범위 (${slSteps.length}/6)`
              : `SL steps (${slSteps.length}/6)`}
          </label>
          <div class="flex flex-wrap gap-1">
            {STEP_OPTIONS.map((v) => {
              const active = slSteps.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`SL ${v}%`}
                  aria-pressed={active}
                  onClick={() => toggleStep(slSteps, setSlSteps, v)}
                  class="px-2 py-0.5 rounded text-[11px] font-mono transition-all"
                  style={{
                    background: active
                      ? COLORS.accentBg
                      : "var(--color-surface)",
                    color: active ? COLORS.accent : "var(--color-text-muted)",
                    border: active
                      ? `1px solid ${COLORS.accent}`
                      : "1px solid var(--color-border)",
                    opacity: !active && slSteps.length >= 6 ? 0.4 : 1,
                  }}
                >
                  {v}%
                </button>
              );
            })}
          </div>
        </div>

        {/* TP steps */}
        <div>
          <label
            class="block text-[11px] mb-1.5 font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {lang === "ko"
              ? `익절 범위 (${tpSteps.length}/6)`
              : `TP steps (${tpSteps.length}/6)`}
          </label>
          <div class="flex flex-wrap gap-1">
            {STEP_OPTIONS.map((v) => {
              const active = tpSteps.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`TP ${v}%`}
                  aria-pressed={active}
                  onClick={() => toggleStep(tpSteps, setTpSteps, v)}
                  class="px-2 py-0.5 rounded text-[11px] font-mono transition-all"
                  style={{
                    background: active
                      ? COLORS.accentBg
                      : "var(--color-surface)",
                    color: active ? COLORS.accent : "var(--color-text-muted)",
                    border: active
                      ? `1px solid ${COLORS.accent}`
                      : "1px solid var(--color-border)",
                    opacity: !active && tpSteps.length >= 6 ? 0.4 : 1,
                  }}
                >
                  {v}%
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        aria-label={lang === "ko" ? "최적화 실행" : "Run optimization"}
        class="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
        style={{
          background: loading ? "var(--color-surface)" : COLORS.accent,
          color: loading ? "var(--color-text-muted)" : "#fff",
          border: `1px solid ${loading ? "var(--color-border)" : COLORS.accent}`,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading
          ? lang === "ko"
            ? `분석 중… (${slSteps.length}×${tpSteps.length} = ${slSteps.length * tpSteps.length}회)`
            : `Running… (${slSteps.length}×${tpSteps.length} = ${slSteps.length * tpSteps.length} simulations)`
          : lang === "ko"
            ? `최적화 실행 (${slSteps.length}×${tpSteps.length} = ${slSteps.length * tpSteps.length}회 시뮬레이션)`
            : `Run Optimization (${slSteps.length}×${tpSteps.length} = ${slSteps.length * tpSteps.length} simulations)`}
      </button>

      {/* Error */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          class="text-xs p-3 rounded"
          style={{
            background: COLORS.redBg,
            color: COLORS.red,
            border: `1px solid ${COLORS.red}44`,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div class="space-y-3">
          {/* Meta */}
          <div
            class="flex flex-wrap gap-x-4 gap-y-1 text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>
              {lang === "ko" ? "기준 지표" : "Metric"}:{" "}
              <span style={{ color: COLORS.accent }}>
                {metricLabel(metric, lang)}
              </span>
            </span>
            <span>
              {lang === "ko" ? "코인" : "Coins"}:{" "}
              <span style={{ color: "var(--color-text)" }}>
                {result.coins_used}
              </span>
            </span>
            <span>
              {lang === "ko" ? "데이터" : "Data"}:{" "}
              <span style={{ color: "var(--color-text)" }}>
                {result.data_range}
              </span>
            </span>
            <span>
              {lang === "ko" ? "소요" : "Time"}:{" "}
              <span style={{ color: "var(--color-text)" }}>
                {(result.compute_time_ms / 1000).toFixed(1)}s
              </span>
            </span>
          </div>

          {/* Heatmap */}
          {renderHeatmap(result)}

          {/* Legend */}
          <div
            class="flex items-center gap-2 text-[10px] pt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            <div
              class="w-16 h-3 rounded"
              style={{
                background: `linear-gradient(to right, rgba(240,66,81,0.35), rgba(49,130,246,0.2), rgba(0,192,115,0.4))`,
              }}
            />
            <span>{lang === "ko" ? "낮음 → 높음" : "Low → High"}</span>
            <span class="ml-auto">★ = {lang === "ko" ? "최적" : "Best"}</span>
            <span class="ml-2 italic">
              {lang === "ko"
                ? "셀에 마우스를 올려 상세 지표 확인"
                : "Hover cells for detail metrics"}
            </span>
          </div>

          <p
            class="text-[9px] mt-1"
            style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
          >
            {lang === "ko"
              ? "과거 시뮬레이션 결과는 미래 수익을 보장하지 않습니다. 최적화 결과는 과적합(overfitting) 위험이 있습니다."
              : "Past simulation results do not guarantee future returns. Optimized parameters carry overfitting risk."}
          </p>
        </div>
      )}
    </div>
  );
}
