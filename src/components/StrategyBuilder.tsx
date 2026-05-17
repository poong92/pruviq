/**
 * StrategyBuilder — owner-configurable trading strategy form.
 *
 * Wires the existing /user-strategies CRUD + /validate backend (18 base
 * strategies, server-side risk-calculator + warnings) to a single-form UI.
 *
 * Flow:
 *   1. user picks base + tweaks position size / leverage / SL / TP
 *   2. onBlur of any numeric field → POST /user-strategies/validate
 *   3. server returns warnings + calculator (notional, fees, R:R, breakeven)
 *   4. Save & Activate → POST /user-strategies → /user-strategies/:id/activate
 *
 * Advanced toggle exposes regime filters (FnG, weekday/hour avoidance,
 * funding-rate gate, drawdown cap). Defaults match backend DEFAULT_STRATEGY.
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

type ExecMode = "auto" | "manual" | "approval";

interface RegimeFilters {
  fng_min?: number | null;
  avoid_weekdays_utc?: number[];
  avoid_hours_utc?: number[];
  require_positive_funding_for_short?: boolean;
}

interface StrategyDraft {
  name: string;
  base_strategy: string;
  exec_mode: ExecMode;
  position_size_usdt: number;
  leverage: number;
  sl_source: "follow_signal" | "custom_pct";
  sl_pct: number;
  tp_source: "follow_signal" | "custom_pct" | "trailing";
  tp_pct: number;
  trail_pct: number;
  max_concurrent_pos: number;
  max_daily_loss_usdt: number;
  max_drawdown_pct: number;
  regime_filters: RegimeFilters;
}

interface ValidateResponse {
  valid: boolean;
  hard_errors: string[];
  warnings: string[];
  disabled_fields: string[];
  calculator?: {
    notional_usdt: number;
    margin_required_usdt: number;
    sl_pct: number;
    tp_pct: number;
    gross_profit_usdt: number;
    gross_loss_usdt: number;
    fee_cost_usdt: number;
    net_profit_usdt: number;
    net_loss_usdt: number;
    risk_reward_ratio: number;
    breakeven_pct: number;
  };
}

interface SavedStrategy {
  id: string;
  name: string;
  base_strategy: string;
  is_active: number;
  [k: string]: unknown;
}

interface Props {
  lang?: "en" | "ko";
}

import { BASE_STRATEGIES } from "../config/base-strategies";

const DEFAULT_DRAFT: StrategyDraft = {
  name: "My Strategy",
  base_strategy: "bb-squeeze-short",
  exec_mode: "manual",
  position_size_usdt: 50,
  leverage: 1,
  sl_source: "follow_signal",
  sl_pct: 10,
  tp_source: "follow_signal",
  tp_pct: 8,
  trail_pct: 3,
  max_concurrent_pos: 3,
  max_daily_loss_usdt: 200,
  max_drawdown_pct: 0,
  regime_filters: {},
};

const i18n = {
  en: {
    title: "My Strategies",
    subtitle:
      "Configure your own trading strategies — backed by 18 verified base setups.",
    new: "New Strategy",
    none: "No saved strategies yet — create one below.",
    active: "ACTIVE",
    inactive: "inactive",
    activate: "Activate",
    deactivate: "Deactivate",
    multiActiveNote:
      "You can run multiple strategies in parallel — toggle each independently.",
    edit: "Edit",
    deleteBtn: "Delete",
    deleteConfirm: "Delete this strategy?",
    name: "Strategy name",
    nameHelp: "Up to 80 chars",
    base: "Base strategy",
    baseHelp: "Pick one of the 18 verified base setups",
    execMode: "Execution mode",
    execModes: {
      manual: "Manual — I'll execute each signal myself",
      approval: "Approval — Enqueue for me to approve",
      auto: "Auto — Execute automatically",
    },
    positionSize: "Position size (USDT)",
    positionSizeHelp: "Notional per trade in USDT",
    leverage: "Leverage",
    leverageHelp: "1× — 125× (higher = more liquidation risk)",
    slSource: "Stop-loss",
    slSourceFollow: "Use signal's SL",
    slSourceCustom: "Custom %",
    tpSource: "Take-profit",
    tpSourceFollow: "Use signal's TP",
    tpSourceCustom: "Custom %",
    tpSourceTrailing: "Trailing %",
    maxConcurrent: "Max concurrent positions",
    maxDailyLoss: "Daily loss limit (USDT)",
    maxDrawdown: "Max drawdown % (0 = off)",
    advanced: "Advanced — regime filters",
    advancedHide: "Hide advanced",
    fngMin: "Fear & Greed min (skip below)",
    fngMinPlaceholder: "0–100 (blank = off)",
    fundingGateShort: "SHORT only when funding rate > 0",
    save: "Save & Activate",
    saving: "Saving…",
    saved: "Saved!",
    saveErr: "Save failed",
    notConnected: "Connect OKX to manage your strategies.",
    calc: "Per-trade math",
    notional: "Notional",
    margin: "Margin required",
    profit: "Net profit (TP)",
    loss: "Net loss (SL)",
    rr: "Risk/Reward",
    breakeven: "Breakeven win-rate",
    warns: "Notes",
    errs: "Cannot save",
  },
  ko: {
    title: "내 전략",
    subtitle: "18개의 검증된 베이스 위에 본인 매매법을 정의하고 저장합니다.",
    new: "새 전략",
    none: "저장된 전략이 없습니다 — 아래에서 새로 만드세요.",
    active: "활성",
    inactive: "비활성",
    activate: "활성화",
    deactivate: "비활성화",
    multiActiveNote: "여러 전략을 동시에 운영할 수 있습니다 — 각각 토글하세요.",
    edit: "수정",
    deleteBtn: "삭제",
    deleteConfirm: "이 전략을 삭제할까요?",
    name: "전략 이름",
    nameHelp: "최대 80자",
    base: "베이스 전략",
    baseHelp: "18개 검증 전략 중 선택",
    execMode: "실행 방식",
    execModes: {
      manual: "수동 — 신호마다 직접 실행",
      approval: "승인 — 큐에 쌓고 내가 승인",
      auto: "자동 — 신호 발생 시 자동 실행",
    },
    positionSize: "포지션 크기 (USDT)",
    positionSizeHelp: "1회 거래 명목 금액",
    leverage: "레버리지",
    leverageHelp: "1× — 125× (높을수록 청산 위험 ↑)",
    slSource: "손절 (SL)",
    slSourceFollow: "신호의 SL 사용",
    slSourceCustom: "직접 % 입력",
    tpSource: "익절 (TP)",
    tpSourceFollow: "신호의 TP 사용",
    tpSourceCustom: "직접 % 입력",
    tpSourceTrailing: "트레일링 %",
    maxConcurrent: "최대 동시 포지션",
    maxDailyLoss: "일일 손실 한도 (USDT)",
    maxDrawdown: "최대 손실폭 % (0 = 미사용)",
    advanced: "고급 — 시장 레짐 필터",
    advancedHide: "고급 숨기기",
    fngMin: "Fear & Greed 최저값 (미만은 진입 안 함)",
    fngMinPlaceholder: "0–100 (비워두면 비활성)",
    fundingGateShort: "SHORT는 펀딩비 > 0일 때만",
    save: "저장하고 활성화",
    saving: "저장 중…",
    saved: "저장됨!",
    saveErr: "저장 실패",
    notConnected: "전략 관리를 위해 OKX를 연결하세요.",
    calc: "1회 거래 계산",
    notional: "명목",
    margin: "필요 증거금",
    profit: "순이익 (TP 도달)",
    loss: "순손실 (SL 도달)",
    rr: "손익비",
    breakeven: "손익분기 승률",
    warns: "참고 사항",
    errs: "저장 불가",
  },
} as const;

export default function StrategyBuilder({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;

  const [draft, setDraft] = useState<StrategyDraft>(DEFAULT_DRAFT);
  const [saved, setSaved] = useState<SavedStrategy[]>([]);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [unauthed, setUnauthed] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load saved strategies
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user-strategies`, {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 401) {
          setUnauthed(true);
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { strategies: SavedStrategy[] };
          setSaved(data.strategies ?? []);
        }
      } catch {
        /* silent — preserves dashboard render */
      }
    })();
  }, []);

  // Debounced validate on draft change
  useEffect(() => {
    if (unauthed) return;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/user-strategies/validate`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ params: draft, context: {}, lang }),
            signal: AbortSignal.timeout(8_000),
          });
          if (res.ok) setValidation((await res.json()) as ValidateResponse);
        } catch {
          /* validation is advisory — ignore network blips */
        }
      })();
    }, 400);
    return () => clearTimeout(handle);
  }, [draft, unauthed]);

  const calc = validation?.calculator;
  const warns = validation?.warnings ?? [];
  const errs = validation?.hard_errors ?? [];
  const disabled = useMemo(
    () => new Set(validation?.disabled_fields ?? []),
    [validation],
  );

  async function reloadSaved() {
    try {
      const res = await fetch(`${API_BASE_URL}/user-strategies`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { strategies: SavedStrategy[] };
        setSaved(data.strategies ?? []);
      }
    } catch {
      /* */
    }
  }

  async function handleSave() {
    if (errs.length > 0) return;
    setSaving("saving");
    setErrMsg("");
    try {
      const createRes = await fetch(`${API_BASE_URL}/user-strategies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!createRes.ok) {
        const detail = await createRes.text();
        throw new Error(detail || `HTTP ${createRes.status}`);
      }
      const { strategy } = (await createRes.json()) as {
        strategy: SavedStrategy;
      };
      const actRes = await fetch(
        `${API_BASE_URL}/user-strategies/${strategy.id}/activate`,
        { method: "POST", credentials: "include" },
      );
      if (!actRes.ok) throw new Error(`activate HTTP ${actRes.status}`);
      await reloadSaved();
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 2000);
    } catch (e) {
      setSaving("error");
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleActivate(id: string) {
    // Multi-active: do NOT pass exclusive=true. Other active strategies
    // keep running. Onboarding wizard uses exclusive=true for first bot.
    await fetch(`${API_BASE_URL}/user-strategies/${id}/activate`, {
      method: "POST",
      credentials: "include",
    });
    await reloadSaved();
  }

  async function handleDeactivate(id: string) {
    await fetch(`${API_BASE_URL}/user-strategies/${id}/deactivate`, {
      method: "POST",
      credentials: "include",
    });
    await reloadSaved();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    await fetch(`${API_BASE_URL}/user-strategies/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await reloadSaved();
  }

  if (unauthed) {
    return (
      <div class="card-enterprise rounded-xl p-5 text-sm text-(--color-text-muted)">
        {t.notConnected}
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Saved strategies */}
      <div class="card-enterprise rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-lg">{t.title}</h2>
          <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
        </div>
        {saved.length === 0 ? (
          <p class="text-sm text-(--color-text-muted) italic">{t.none}</p>
        ) : (
          <>
            <p class="text-xs text-(--color-text-muted) mb-2">
              {t.multiActiveNote}
            </p>
            <ul class="space-y-2">
              {saved.map((s) => (
                <li
                  key={s.id}
                  class="flex items-center justify-between p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40"
                >
                  <div class="min-w-0">
                    <p class="font-bold text-sm truncate">{s.name}</p>
                    <p class="text-xs font-mono text-(--color-text-muted)">
                      {s.base_strategy}
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {s.is_active ? (
                      <>
                        <span class="text-xs font-mono font-bold text-(--color-up) shrink-0">
                          ● {t.active}
                        </span>
                        <button
                          type="button"
                          class="text-xs text-(--color-text-muted) hover:text-(--color-down) underline min-h-[36px] px-2"
                          onClick={() => handleDeactivate(s.id)}
                          aria-label={`${t.deactivate} ${s.name}`}
                        >
                          {t.deactivate}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm min-h-[36px]"
                        onClick={() => handleActivate(s.id)}
                        aria-label={`${t.activate} ${s.name}`}
                      >
                        {t.activate}
                      </button>
                    )}
                    <button
                      type="button"
                      class="text-xs text-(--color-down) hover:underline min-h-[36px] px-2"
                      onClick={() => handleDelete(s.id)}
                    >
                      {t.deleteBtn}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Builder form */}
      <div class="card-enterprise rounded-2xl p-5 md:p-6 space-y-5">
        <h3 class="font-bold text-lg">{t.new}</h3>

        {/* Name + base */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 focus:outline-none focus:border-(--color-accent)"
              aria-label={t.name}
            />
            <span class="text-xs text-(--color-text-muted)">{t.nameHelp}</span>
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.base}</span>
            <select
              value={draft.base_strategy}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  base_strategy: (e.target as HTMLSelectElement).value,
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 focus:outline-none focus:border-(--color-accent)"
              aria-label={t.base}
            >
              {BASE_STRATEGIES.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <span class="text-xs text-(--color-text-muted)">{t.baseHelp}</span>
          </label>
        </div>

        {/* Execution mode */}
        <fieldset>
          <legend class="text-sm font-bold mb-2">{t.execMode}</legend>
          <div class="space-y-2">
            {(["manual", "approval", "auto"] as const).map((m) => (
              <label
                key={m}
                class="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-(--color-border) cursor-pointer"
              >
                <input
                  type="radio"
                  name="exec_mode"
                  checked={draft.exec_mode === m}
                  onChange={() => setDraft((d) => ({ ...d, exec_mode: m }))}
                  class="accent-(--color-accent)"
                />
                <span class="text-sm">{t.execModes[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Size + leverage */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-bold">{t.positionSize}</span>
            <input
              type="number"
              min={1}
              max={5000}
              step={1}
              value={draft.position_size_usdt}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  position_size_usdt: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
              aria-label={t.positionSize}
            />
            <span class="text-xs text-(--color-text-muted)">
              {t.positionSizeHelp}
            </span>
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.leverage}</span>
            <input
              type="number"
              min={1}
              max={125}
              step={1}
              value={draft.leverage}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  leverage: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
              aria-label={t.leverage}
            />
            <span class="text-xs text-(--color-text-muted)">
              {t.leverageHelp}
            </span>
          </label>
        </div>

        {/* SL/TP */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block">
              <span class="text-sm font-bold">{t.slSource}</span>
              <select
                value={draft.sl_source}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sl_source: (e.target as HTMLSelectElement)
                      .value as StrategyDraft["sl_source"],
                  }))
                }
                class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
                aria-label={t.slSource}
              >
                <option value="follow_signal">{t.slSourceFollow}</option>
                <option value="custom_pct">{t.slSourceCustom}</option>
              </select>
            </label>
            {draft.sl_source === "custom_pct" && !disabled.has("sl_pct") && (
              <input
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={draft.sl_pct}
                onInput={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sl_pct: Number((e.target as HTMLInputElement).value),
                  }))
                }
                class="mt-2 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
                aria-label="SL %"
                placeholder="%"
              />
            )}
          </div>
          <div>
            <label class="block">
              <span class="text-sm font-bold">{t.tpSource}</span>
              <select
                value={draft.tp_source}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tp_source: (e.target as HTMLSelectElement)
                      .value as StrategyDraft["tp_source"],
                  }))
                }
                class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
                aria-label={t.tpSource}
              >
                <option value="follow_signal">{t.tpSourceFollow}</option>
                <option value="custom_pct">{t.tpSourceCustom}</option>
                <option value="trailing">{t.tpSourceTrailing}</option>
              </select>
            </label>
            {(draft.tp_source === "custom_pct" ||
              draft.tp_source === "trailing") &&
              !disabled.has("tp_pct") && (
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={
                    draft.tp_source === "trailing"
                      ? draft.trail_pct
                      : draft.tp_pct
                  }
                  onInput={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    setDraft((d) =>
                      d.tp_source === "trailing"
                        ? { ...d, trail_pct: v }
                        : { ...d, tp_pct: v },
                    );
                  }}
                  class="mt-2 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
                  aria-label="TP %"
                  placeholder="%"
                />
              )}
          </div>
        </div>

        {/* Caps */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label class="block">
            <span class="text-sm font-bold">{t.maxConcurrent}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={draft.max_concurrent_pos}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_concurrent_pos: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.maxDailyLoss}</span>
            <input
              type="number"
              min={10}
              step={10}
              value={draft.max_daily_loss_usdt}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_daily_loss_usdt: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-bold">{t.maxDrawdown}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.max_drawdown_pct}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_drawdown_pct: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
            />
          </label>
        </div>

        {/* Advanced toggle */}
        <div>
          <button
            type="button"
            class="inline-flex items-center min-h-[44px] px-3 -mx-3 text-sm text-(--color-accent) hover:underline rounded-lg"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
            aria-controls="strategy-advanced-panel"
          >
            {showAdvanced ? `▼ ${t.advancedHide}` : `▶ ${t.advanced}`}
          </button>
          {showAdvanced && (
            <div
              id="strategy-advanced-panel"
              class="mt-3 space-y-3 p-4 rounded-lg bg-(--color-bg)/40 border border-(--color-border)"
            >
              <label class="block">
                <span class="text-sm font-bold">{t.fngMin}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder={t.fngMinPlaceholder}
                  value={draft.regime_filters.fng_min ?? ""}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    setDraft((d) => ({
                      ...d,
                      regime_filters: {
                        ...d.regime_filters,
                        fng_min: raw === "" ? null : Number(raw),
                      },
                    }));
                  }}
                  class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2"
                />
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    !!draft.regime_filters.require_positive_funding_for_short
                  }
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      regime_filters: {
                        ...d.regime_filters,
                        require_positive_funding_for_short: (
                          e.target as HTMLInputElement
                        ).checked,
                      },
                    }))
                  }
                  class="accent-(--color-accent)"
                />
                <span class="text-sm">{t.fundingGateShort}</span>
              </label>
            </div>
          )}
        </div>

        {/* Calculator */}
        {calc && (
          <div class="p-4 rounded-lg bg-(--color-accent)/5 border border-(--color-accent)/20">
            <p class="text-xs font-mono font-bold uppercase tracking-wider text-(--color-accent) mb-3">
              {t.calc}
            </p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.notional}</p>
                <p class="font-mono font-bold">
                  ${calc.notional_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.margin}</p>
                <p class="font-mono font-bold">
                  ${calc.margin_required_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.profit}</p>
                <p class="font-mono font-bold text-(--color-up)">
                  +${calc.net_profit_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.loss}</p>
                <p class="font-mono font-bold text-(--color-down)">
                  −${calc.net_loss_usdt.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.rr}</p>
                <p class="font-mono font-bold">
                  {calc.risk_reward_ratio.toFixed(2)}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--color-text-muted)">{t.breakeven}</p>
                <p class="font-mono font-bold">
                  {(calc.breakeven_pct * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warnings + hard errors */}
        {errs.length > 0 && (
          <div
            class="p-3 rounded-lg bg-(--color-down)/10 border border-(--color-down)/30 text-sm"
            role="alert"
            aria-live="assertive"
          >
            <p class="font-bold text-(--color-down) mb-1">{t.errs}</p>
            <ul class="list-disc pl-5 space-y-1">
              {errs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {warns.length > 0 && (
          <div class="p-3 rounded-lg bg-(--color-warning)/10 border border-(--color-warning)/30 text-sm">
            <p class="font-bold text-(--color-warning) mb-1">{t.warns}</p>
            <ul class="list-disc pl-5 space-y-1">
              {warns.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Save */}
        <button
          type="button"
          class={`btn btn-lg w-full ${saving === "saved" ? "bg-(--color-up) text-white" : "btn-primary"}`}
          onClick={handleSave}
          disabled={saving === "saving" || errs.length > 0}
        >
          {saving === "saving"
            ? t.saving
            : saving === "saved"
              ? t.saved
              : t.save}
        </button>
        {saving === "error" && (
          <p
            class="text-sm text-(--color-down) mt-2"
            role="alert"
            aria-live="assertive"
          >
            {t.saveErr}: {errMsg}
          </p>
        )}
      </div>
    </div>
  );
}
