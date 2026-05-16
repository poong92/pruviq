/**
 * GridBots — list of saved grid bots + builder form + simulate preview.
 *
 * Wires Phase E1 (CRUD) + E3 (simulate) endpoints:
 *   GET    /grid-bots
 *   POST   /grid-bots
 *   POST   /grid-bots/:id/activate
 *   POST   /grid-bots/:id/deactivate
 *   DELETE /grid-bots/:id
 *   POST   /grid-bots/simulate
 *
 * Live executor (Phase E2) is NOT yet shipped — activating only flips
 * is_active=1. Yellow banner is explicit about this so dog-fooders aren't
 * surprised when no orders appear on OKX after activation.
 */
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface GridBot {
  id: string;
  name: string;
  symbol: string;
  direction: "long" | "short" | "neutral";
  upper_price: number;
  lower_price: number;
  grid_count: number;
  investment_usdt: number;
  leverage: number;
  stop_loss_price: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

interface GridDraft {
  name: string;
  symbol: string;
  direction: "long" | "short" | "neutral";
  upper_price: number;
  lower_price: number;
  grid_count: number;
  investment_usdt: number;
  leverage: number;
  stop_loss_price: number;
}

interface GridSimResult {
  completed_cycles: number;
  open_positions: number;
  avg_open_entry: number;
  realised_pnl_usdt: number;
  unrealised_pnl_usdt: number;
  total_pnl_usdt: number;
  total_fees_usdt: number;
  peak_drawdown_pct: number;
  exit_reason: string;
  exit_price: number;
  duration_hours: number;
  warnings: string[];
  accuracy: string;
}

interface Props {
  lang?: "en" | "ko";
}

const DEFAULT_DRAFT: GridDraft = {
  name: "My Grid Bot",
  symbol: "BTC-USDT-SWAP",
  direction: "neutral",
  upper_price: 70000,
  lower_price: 60000,
  grid_count: 20,
  investment_usdt: 500,
  leverage: 1,
  stop_loss_price: 0,
};

const i18n = {
  en: {
    title: "Grid Bots",
    subtitle:
      "Range-bound limit-order grid — profits from variance within [lower, upper].",
    notConnected: "Connect OKX to manage Grid bots.",
    notLiveYet:
      "Execution loop (Phase E2) not yet shipped — activating only flags is_active. No real orders fire yet.",
    none: "No grid bots yet — define one below and run a backtest first.",
    active: "ACTIVE",
    activate: "Activate",
    deactivate: "Deactivate",
    deleteBtn: "Delete",
    deleteConfirm: "Delete this grid bot?",
    new: "New Grid Bot",
    name: "Name",
    symbol: "Symbol",
    direction: "Bias",
    long: "Long",
    short: "Short",
    neutral: "Neutral",
    upper: "Upper price",
    lower: "Lower price",
    gridCount: "Grid count",
    investment: "Investment (USDT)",
    leverage: "Leverage (1–10 max for grids)",
    stopLoss: "Stop-loss price (0 = off)",
    simulate: "Simulate on historical data",
    simulating: "Simulating…",
    save: "Save bot (inactive)",
    saving: "Saving…",
    saved: "Saved!",
    saveErr: "Save failed",
    simErr: "Simulation failed",
    simResult: "Backtest result",
    cycles: "Completed cycles",
    realised: "Realised P&L",
    unrealised: "Unrealised P&L",
    total: "Total P&L",
    fees: "Total fees",
    drawdown: "Peak drawdown",
    duration: "Duration",
    hours: "h",
    exitReason: "Exit reason",
    accuracy: "Sim accuracy",
    warns: "Warnings",
  },
  ko: {
    title: "Grid 봇",
    subtitle: "범위 내 지정가 격자 매매 — [하단, 상단] 사이 변동성에서 수익.",
    notConnected: "Grid 봇 관리를 위해 OKX를 연결하세요.",
    notLiveYet:
      "실행 루프(Phase E2) 미출시 — 활성화 시 is_active만 켜지고 실거래는 아직 안 됩니다.",
    none: "Grid 봇이 없습니다 — 아래에서 정의 후 백테스트부터 돌려보세요.",
    active: "활성",
    activate: "활성화",
    deactivate: "비활성화",
    deleteBtn: "삭제",
    deleteConfirm: "이 Grid 봇을 삭제할까요?",
    new: "새 Grid 봇",
    name: "이름",
    symbol: "심볼",
    direction: "편향",
    long: "롱",
    short: "숏",
    neutral: "중립",
    upper: "상단 가격",
    lower: "하단 가격",
    gridCount: "격자 개수",
    investment: "투자금 (USDT)",
    leverage: "레버리지 (Grid은 최대 10배)",
    stopLoss: "손절 가격 (0 = 미사용)",
    simulate: "과거 데이터로 시뮬레이션",
    simulating: "시뮬레이션 중…",
    save: "봇 저장 (비활성)",
    saving: "저장 중…",
    saved: "저장됨!",
    saveErr: "저장 실패",
    simErr: "시뮬레이션 실패",
    simResult: "백테스트 결과",
    cycles: "완료된 사이클",
    realised: "실현 손익",
    unrealised: "미실현 손익",
    total: "총 손익",
    fees: "총 수수료",
    drawdown: "최대 손실폭",
    duration: "기간",
    hours: "시간",
    exitReason: "종료 사유",
    accuracy: "시뮬 정확도",
    warns: "경고",
  },
} as const;

export default function GridBots({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [draft, setDraft] = useState<GridDraft>(DEFAULT_DRAFT);
  const [bots, setBots] = useState<GridBot[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveErr, setSaveErr] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simErr, setSimErr] = useState("");
  const [sim, setSim] = useState<GridSimResult | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/grid-bots`, {
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401) {
        setUnauthed(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { bots: GridBot[] };
        setBots(data.bots ?? []);
        setUnauthed(false);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSimulate() {
    setSimulating(true);
    setSimErr("");
    setSim(null);
    try {
      const res = await fetch(`${API_BASE_URL}/grid-bots/simulate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: draft, symbol: draft.symbol }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { result: GridSimResult };
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
      const res = await fetch(`${API_BASE_URL}/grid-bots`, {
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
  const [actionErr, setActionErr] = useState("");

  async function handleActivate(id: string) {
    setActionErr("");
    try {
      const res = await fetch(`${API_BASE_URL}/grid-bots/${id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      await reload();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function handleDeactivate(id: string) {
    setActionErr("");
    try {
      const res = await fetch(`${API_BASE_URL}/grid-bots/${id}/deactivate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      await reload();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function handleDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    setActionErr("");
    try {
      const res = await fetch(`${API_BASE_URL}/grid-bots/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      await reload();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    }
  }

  const totalPnlColor = useMemo(() => {
    if (!sim) return "";
    return sim.total_pnl_usdt >= 0
      ? "text-(--color-up)"
      : "text-(--color-down)";
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
      <div class="card-enterprise rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-bold text-lg">{t.title}</h2>
          <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
        </div>
        <div
          class="p-2.5 mb-3 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-xs"
          role="note"
        >
          ⚠️ {t.notLiveYet}
        </div>
        {bots.length === 0 ? (
          <p class="text-sm text-(--color-text-muted) italic">{t.none}</p>
        ) : (
          <ul class="space-y-2">
            {bots.map((b) => (
              <li
                key={b.id}
                class="flex items-center justify-between p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40"
              >
                <div class="min-w-0">
                  <p class="font-bold text-sm truncate">{b.name}</p>
                  <p class="text-xs font-mono text-(--color-text-muted)">
                    {b.symbol} · {b.direction} · ×{b.leverage} · grid{" "}
                    {b.grid_count} · ${b.lower_price.toFixed(0)}–$
                    {b.upper_price.toFixed(0)}
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
                        class="text-xs text-(--color-text-muted) hover:text-(--color-down) underline min-h-[36px] px-2"
                        onClick={() => handleDeactivate(b.id)}
                      >
                        {t.deactivate}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm min-h-[36px]"
                      onClick={() => handleActivate(b.id)}
                    >
                      {t.activate}
                    </button>
                  )}
                  <button
                    type="button"
                    class="text-xs text-(--color-down) hover:underline min-h-[36px] px-2"
                    onClick={() => handleDelete(b.id)}
                  >
                    {t.deleteBtn}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
          </label>
        </div>

        <fieldset>
          <legend class="text-sm font-bold mb-2">{t.direction}</legend>
          <div class="flex gap-3 flex-wrap">
            {(["long", "neutral", "short"] as const).map((d) => (
              <label
                key={d}
                class="inline-flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="grid_dir"
                  checked={draft.direction === d}
                  onChange={() => setDraft((s) => ({ ...s, direction: d }))}
                  class="accent-(--color-accent)"
                />
                <span class="text-sm">
                  {d === "long" ? t.long : d === "short" ? t.short : t.neutral}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label class="block">
            <span class="text-sm font-bold">{t.lower}</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={draft.lower_price}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  lower_price: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.upper}</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={draft.upper_price}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  upper_price: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.gridCount}</span>
            <input
              type="number"
              min={4}
              max={100}
              value={draft.grid_count}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  grid_count: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.investment}</span>
            <input
              type="number"
              min={50}
              max={50000}
              value={draft.investment_usdt}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  investment_usdt: Number((e.target as HTMLInputElement).value),
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
              max={10}
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
            <span class="text-sm font-bold">{t.stopLoss}</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={draft.stop_loss_price}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  stop_loss_price: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
            />
          </label>
        </div>

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

        {actionErr && (
          <p
            class="text-sm text-(--color-down)"
            role="alert"
            aria-live="assertive"
          >
            {actionErr}
          </p>
        )}
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

        {sim && (
          <div class="mt-3 p-4 rounded-lg bg-(--color-accent)/5 border border-(--color-accent)/20">
            <p class="text-xs font-mono font-bold uppercase tracking-wider text-(--color-accent) mb-3">
              {t.simResult} · {sim.exit_reason} · {t.accuracy}: {sim.accuracy}
            </p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.cycles}</p>
                <p class="font-mono font-bold">{sim.completed_cycles}</p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.realised}</p>
                <p class="font-mono font-bold">
                  {sim.realised_pnl_usdt >= 0 ? "+" : ""}$
                  {sim.realised_pnl_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.unrealised}</p>
                <p class="font-mono font-bold">
                  {sim.unrealised_pnl_usdt >= 0 ? "+" : ""}$
                  {sim.unrealised_pnl_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.total}</p>
                <p class={`font-mono font-bold ${totalPnlColor}`}>
                  {sim.total_pnl_usdt >= 0 ? "+" : ""}$
                  {sim.total_pnl_usdt.toFixed(2)}
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
              <div>
                <p class="text-xs text-(--color-text-muted)">Exit @</p>
                <p class="font-mono font-bold">${sim.exit_price.toFixed(2)}</p>
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
