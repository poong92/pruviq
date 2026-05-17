/**
 * DCABots — list of saved DCA bots + builder form + simulate preview.
 *
 * Wires backend endpoints introduced in Phase B1 (CRUD) and B3 (simulate):
 *   GET    /dca-bots
 *   POST   /dca-bots
 *   POST   /dca-bots/:id/activate
 *   POST   /dca-bots/:id/deactivate
 *   DELETE /dca-bots/:id
 *   POST   /dca-bots/simulate
 *
 * DCA paradigm differs from signal-based StrategyBuilder so this is a
 * separate dashboard section. The live execution loop is Phase B2 — until
 * it ships, activating a bot only flips is_active=1 in DB; no real OKX
 * orders fire. The UI is explicit about this so dog-fooders aren't
 * surprised when "activating" doesn't open a position yet.
 */
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface DcaBot {
  id: string;
  name: string;
  symbol: string;
  direction: "long" | "short";
  base_price_usdt: number;
  position_size_usdt: number;
  leverage: number;
  price_step_pct: number;
  size_multiplier: number;
  max_safety_orders: number;
  tp_pct: number;
  stop_scaling_price: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

interface DcaDraft {
  name: string;
  symbol: string;
  direction: "long" | "short";
  position_size_usdt: number;
  leverage: number;
  price_step_pct: number;
  size_multiplier: number;
  max_safety_orders: number;
  tp_pct: number;
  stop_scaling_price: number;
}

interface SimResult {
  fills: Array<{
    order_num: number;
    fill_time_iso: string;
    fill_price: number;
    size_usdt: number;
    fee_usdt: number;
  }>;
  exit_reason: string;
  exit_time_iso: string;
  exit_price: number;
  avg_entry_price: number;
  total_size_usdt: number;
  safety_orders_used: number;
  gross_pnl_usdt: number;
  net_pnl_usdt: number;
  total_fees_usdt: number;
  peak_drawdown_pct: number;
  duration_hours: number;
  warnings: string[];
}

interface Props {
  lang?: "en" | "ko";
}

const DEFAULT_DRAFT: DcaDraft = {
  name: "My DCA Bot",
  symbol: "BTCUSDT",
  direction: "long",
  position_size_usdt: 50,
  leverage: 1,
  price_step_pct: 2,
  size_multiplier: 1,
  max_safety_orders: 5,
  tp_pct: 3,
  stop_scaling_price: 0,
};

const i18n = {
  en: {
    title: "DCA Bots",
    subtitle:
      "Dollar-cost averaging — buy base, add on dips, take profit above running avg.",
    notConnected: "Connect OKX on the dashboard to manage DCA bots.",
    notLiveYet:
      "Paper-mode loop is live (60s tick, simulated fills). Real-money execution is gated and ships in a later phase.",
    loopHealthy: "Loop ticking",
    loopStale: "Loop stalled",
    loopUnknown: "Loop status unknown",
    loopAgo: "last tick",
    none: "No DCA bots yet — define one below and run a backtest first.",
    active: "ACTIVE",
    activate: "Activate",
    deactivate: "Deactivate",
    deleteBtn: "Delete",
    deleteConfirm: "Delete this DCA bot?",
    new: "New DCA Bot",
    name: "Name",
    symbol: "Symbol",
    symbolHelp: "Match the simulator naming (e.g. BTCUSDT)",
    direction: "Direction",
    long: "Long",
    short: "Short",
    positionSize: "First-order size (USDT)",
    leverage: "Leverage",
    priceStep: "Price step % (drop to trigger next safety)",
    sizeMultiplier: "Size multiplier (next size = prev × this)",
    maxSafety: "Max safety orders",
    tpPct: "TP % above running avg",
    stopScaling: "Stop scaling price (0 = off)",
    simulate: "Simulate on historical data",
    simulating: "Simulating…",
    save: "Save bot (inactive)",
    saving: "Saving…",
    saved: "Saved!",
    saveErr: "Save failed",
    simErr: "Simulation failed",
    simResult: "Backtest result",
    avgEntry: "Avg entry",
    fillsCount: "Fills",
    safetyUsed: "Safety orders used",
    netPnl: "Net P&L",
    grossPnl: "Gross P&L",
    fees: "Total fees",
    drawdown: "Peak drawdown",
    duration: "Duration",
    hours: "h",
    exitReason: "Exit reason",
    warns: "Warnings",
  },
  ko: {
    title: "DCA 봇",
    subtitle:
      "분할 매수 — 기준가에서 시작, 하락 시 추가 매수, 평단가 위에서 익절.",
    notConnected: "DCA 봇 관리를 위해 대시보드에서 OKX를 연결하세요.",
    notLiveYet:
      "Paper-mode 루프 가동 중 (60초 tick, 모의 체결). 실거래 실행은 별도 단계에서 출시됩니다.",
    loopHealthy: "루프 가동 중",
    loopStale: "루프 멈춤",
    loopUnknown: "루프 상태 확인 불가",
    loopAgo: "마지막 tick",
    none: "DCA 봇이 없습니다 — 아래에서 정의 후 먼저 백테스트를 돌려보세요.",
    active: "활성",
    activate: "활성화",
    deactivate: "비활성화",
    deleteBtn: "삭제",
    deleteConfirm: "이 DCA 봇을 삭제할까요?",
    new: "새 DCA 봇",
    name: "이름",
    symbol: "심볼",
    symbolHelp: "시뮬레이터와 동일한 표기 (예: BTCUSDT)",
    direction: "방향",
    long: "롱",
    short: "숏",
    positionSize: "최초 주문 크기 (USDT)",
    leverage: "레버리지",
    priceStep: "가격 step % (이만큼 하락 시 다음 안전 매수)",
    sizeMultiplier: "크기 배율 (다음 크기 = 이전 × 배율)",
    maxSafety: "최대 안전 매수 횟수",
    tpPct: "평단가 위 익절 %",
    stopScaling: "추가 매수 중단 가격 (0 = 미사용)",
    simulate: "과거 데이터로 시뮬레이션",
    simulating: "시뮬레이션 중…",
    save: "봇 저장 (비활성)",
    saving: "저장 중…",
    saved: "저장됨!",
    saveErr: "저장 실패",
    simErr: "시뮬레이션 실패",
    simResult: "백테스트 결과",
    avgEntry: "평단가",
    fillsCount: "체결 수",
    safetyUsed: "사용한 안전 매수",
    netPnl: "순 손익",
    grossPnl: "총 손익",
    fees: "총 수수료",
    drawdown: "최대 손실폭",
    duration: "기간",
    hours: "시간",
    exitReason: "종료 사유",
    warns: "경고",
  },
} as const;

export default function DCABots({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;

  const [draft, setDraft] = useState<DcaDraft>(DEFAULT_DRAFT);
  const [bots, setBots] = useState<DcaBot[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveErr, setSaveErr] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simErr, setSimErr] = useState("");
  const [sim, setSim] = useState<SimResult | null>(null);
  const [reloadErr, setReloadErr] = useState("");
  const [loopHealth, setLoopHealth] = useState<{
    healthy: boolean;
    seconds_ago: number;
    bots_last_tick: number;
  } | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots`, {
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        setReloadErr("");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { bots: DcaBot[] };
      setBots(data.bots ?? []);
      setUnauthed(false);
      setReloadErr("");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Surface instead of silent fail (rules/llm-anti-patterns.md #3)
      setReloadErr(e instanceof Error ? e.message : "Failed to load bots");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Loop heartbeat — public, no auth. Surfaces "is the dca_loop ticking?"
  // during paper-mode dog-foot so owners don't need SSH to debug a newly
  // activated bot with no fills.
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/dca-bots/loop-health`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return;
        const data = await res.json();
        setLoopHealth({
          healthy: !!data.healthy,
          seconds_ago: Number(data.seconds_ago ?? -1),
          bots_last_tick: Number(data.bots_last_tick ?? 0),
        });
      } catch {
        // silent — heartbeat is best-effort, not user-blocking
      }
    };
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleSimulate() {
    setSimulating(true);
    setSimErr("");
    setSim(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots/simulate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          params: draft,
          symbol: draft.symbol,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { result: SimResult };
      setSim(data.result);
    } catch (e) {
      setSimErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSimulating(false);
    }
  }

  async function handleSave() {
    setSaving("saving");
    setSaveErr("");
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      await reload();
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 2000);
    } catch (e) {
      setSaving("error");
      setSaveErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleActivate(id: string) {
    await fetch(`${API_BASE_URL}/dca-bots/${id}/activate`, {
      method: "POST",
      credentials: "include",
    });
    await reload();
  }
  async function handleDeactivate(id: string) {
    await fetch(`${API_BASE_URL}/dca-bots/${id}/deactivate`, {
      method: "POST",
      credentials: "include",
    });
    await reload();
  }
  async function handleDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    await fetch(`${API_BASE_URL}/dca-bots/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await reload();
  }

  const totalFills = sim?.fills.length ?? 0;
  const netPnlColor = useMemo(() => {
    if (!sim) return "";
    return sim.net_pnl_usdt >= 0 ? "text-(--color-up)" : "text-(--color-down)";
  }, [sim]);

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 text-sm text-(--color-text-muted)">
        {t.notConnected}
      </div>
    );
  }

  return (
    <div class="space-y-5">
      {/* Saved list */}
      <div class="card-enterprise rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div class="flex items-center gap-3">
            <h2 class="font-bold text-lg">{t.title}</h2>
            {loopHealth && loopHealth.seconds_ago >= 0 && (
              <span
                class={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded-full border ${
                  loopHealth.healthy
                    ? "bg-(--color-up)/10 border-(--color-up)/30 text-(--color-up)"
                    : "bg-(--color-down)/10 border-(--color-down)/30 text-(--color-down)"
                }`}
                title={`${t.loopAgo}: ${Math.round(loopHealth.seconds_ago)}s ago · bots=${loopHealth.bots_last_tick}`}
                role="status"
              >
                <span aria-hidden="true">{loopHealth.healthy ? "●" : "○"}</span>
                {loopHealth.healthy ? t.loopHealthy : t.loopStale}
                <span class="text-(--color-text-muted)">
                  · {Math.round(loopHealth.seconds_ago)}s
                </span>
              </span>
            )}
          </div>
          <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
        </div>
        <div
          class="p-2.5 mb-3 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-xs"
          role="status"
        >
          ⚠️ {t.notLiveYet}
        </div>
        {reloadErr && (
          <div
            class="p-2.5 mb-3 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-xs text-(--color-down)"
            role="alert"
            aria-live="assertive"
          >
            ⚠ {reloadErr}
          </div>
        )}
        {bots.length === 0 ? (
          <p class="text-sm text-(--color-text-muted) italic">{t.none}</p>
        ) : (
          <ul class="space-y-2">
            {bots.map((b) => {
              const dirColor =
                b.direction === "long"
                  ? "text-(--color-up)"
                  : "text-(--color-down)";
              return (
                <li
                  key={b.id}
                  class="flex items-center justify-between p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40"
                >
                  <div class="min-w-0">
                    <p class="font-bold text-sm truncate">{b.name}</p>
                    <p class="text-xs font-mono text-(--color-text-muted)">
                      <span class={dirColor}>{b.direction.toUpperCase()}</span>{" "}
                      · {b.symbol} · ×{b.leverage} · step {b.price_step_pct}% ·
                      TP {b.tp_pct}%
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {b.is_active ? (
                      <>
                        <span class="text-xs font-mono font-bold text-(--color-up)">
                          ● {t.active}
                        </span>
                        <button
                          type="button"
                          class="text-xs text-(--color-text-muted) hover:text-(--color-down) underline min-h-[44px] px-2"
                          onClick={() => handleDeactivate(b.id)}
                        >
                          {t.deactivate}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm min-h-[44px]"
                        onClick={() => handleActivate(b.id)}
                      >
                        {t.activate}
                      </button>
                    )}
                    <button
                      type="button"
                      class="text-xs text-(--color-down) hover:underline min-h-[44px] px-2"
                      onClick={() => handleDelete(b.id)}
                    >
                      {t.deleteBtn}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Builder form */}
      <div class="card-enterprise rounded-2xl p-5 md:p-6 space-y-4">
        <h3 class="font-bold text-lg">{t.new}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-bold">{t.name}</span>
            <input
              type="text"
              maxLength={80}
              value={draft.name}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  name: (e.target as HTMLInputElement).value,
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.symbol}</span>
            <input
              type="text"
              value={draft.symbol}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  symbol: (e.target as HTMLInputElement).value
                    .toUpperCase()
                    .trim(),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm font-mono"
            />
            <span class="text-xs text-(--color-text-muted)">
              {t.symbolHelp}
            </span>
          </label>
        </div>

        <fieldset>
          <legend class="text-sm font-bold mb-2">{t.direction}</legend>
          <div class="flex gap-3">
            {(["long", "short"] as const).map((d) => (
              <label
                key={d}
                class="inline-flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="dca_direction"
                  checked={draft.direction === d}
                  onChange={() => setDraft((s) => ({ ...s, direction: d }))}
                  class="accent-(--color-accent)"
                />
                <span class="text-sm">{d === "long" ? t.long : t.short}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label class="block">
            <span class="text-sm font-bold">{t.positionSize}</span>
            <input
              type="number"
              min={1}
              max={5000}
              value={draft.position_size_usdt}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  position_size_usdt: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.leverage}</span>
            <input
              type="number"
              min={1}
              max={125}
              value={draft.leverage}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  leverage: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.maxSafety}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.max_safety_orders}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_safety_orders: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.priceStep}</span>
            <input
              type="number"
              min={0.1}
              max={20}
              step={0.1}
              value={draft.price_step_pct}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  price_step_pct: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.sizeMultiplier}</span>
            <input
              type="number"
              min={0.5}
              max={3}
              step={0.1}
              value={draft.size_multiplier}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  size_multiplier: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.tpPct}</span>
            <input
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={draft.tp_pct}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  tp_pct: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-bold">{t.stopScaling}</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft.stop_scaling_price}
            onInput={(e) =>
              setDraft((d) => ({
                ...d,
                stop_scaling_price: Number(
                  (e.target as HTMLInputElement).value,
                ),
              }))
            }
            class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>

        {/* Action buttons */}
        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="btn btn-ghost btn-md flex-1 min-h-[44px]"
            onClick={handleSimulate}
            disabled={simulating}
          >
            {simulating ? t.simulating : `📊 ${t.simulate}`}
          </button>
          <button
            type="button"
            class={`btn btn-md flex-1 min-h-[44px] ${saving === "saved" ? "bg-(--color-up) text-white" : "btn-primary"}`}
            onClick={handleSave}
            disabled={saving === "saving"}
          >
            {saving === "saving"
              ? t.saving
              : saving === "saved"
                ? t.saved
                : t.save}
          </button>
        </div>

        {simErr && (
          <p
            class="text-sm text-(--color-down)"
            role="alert"
            aria-live="assertive"
          >
            {t.simErr}: {simErr}
          </p>
        )}
        {saving === "error" && (
          <p
            class="text-sm text-(--color-down)"
            role="alert"
            aria-live="assertive"
          >
            {t.saveErr}: {saveErr}
          </p>
        )}

        {/* Simulate result */}
        {sim && (
          <div class="mt-3 p-4 rounded-lg bg-(--color-accent)/5 border border-(--color-accent)/20">
            <p class="text-xs font-mono font-bold uppercase tracking-wider text-(--color-accent) mb-3">
              {t.simResult} · {sim.exit_reason}
            </p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.fillsCount}</p>
                <p class="font-mono font-bold">{totalFills}</p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.safetyUsed}</p>
                <p class="font-mono font-bold">{sim.safety_orders_used}</p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.avgEntry}</p>
                <p class="font-mono font-bold">
                  ${sim.avg_entry_price.toFixed(4)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.netPnl}</p>
                <p class={`font-mono font-bold ${netPnlColor}`}>
                  {sim.net_pnl_usdt >= 0 ? "+" : ""}$
                  {sim.net_pnl_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.grossPnl}</p>
                <p class="font-mono font-bold">
                  {sim.gross_pnl_usdt >= 0 ? "+" : ""}$
                  {sim.gross_pnl_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.fees}</p>
                <p class="font-mono font-bold">
                  ${sim.total_fees_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.drawdown}</p>
                <p class="font-mono font-bold text-(--color-down)">
                  −{sim.peak_drawdown_pct.toFixed(2)}%
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.duration}</p>
                <p class="font-mono font-bold">
                  {sim.duration_hours}
                  {t.hours}
                </p>
              </div>
            </div>
            {sim.warnings.length > 0 && (
              <div class="mt-3 p-2 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-xs">
                <p class="font-bold text-(--color-warning) mb-1">{t.warns}</p>
                <ul class="list-disc pl-5 space-y-0.5">
                  {sim.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
