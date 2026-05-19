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
  last_fill_at?: number;
  hours_since_last_fill?: number;
  // Real-mode safety gates (#2071 schema, surfaced in UI here)
  paper_mode: number;
  daily_loss_limit_usdt: number;
  auto_recycle: number;
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
  // 1 = paper (simulated fills), 0 = real (live OKX orders)
  paper_mode: number;
  daily_loss_limit_usdt: number;
  auto_recycle: number;
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
  symbol: "BTC-USDT-SWAP",
  direction: "long",
  position_size_usdt: 50,
  leverage: 1,
  price_step_pct: 2,
  size_multiplier: 1,
  max_safety_orders: 5,
  tp_pct: 3,
  stop_scaling_price: 0,
  // Paper-mode by default. Real-mode (paper_mode=0) is the explicit
  // opt-in required for live OKX orders; backend validate also enforces
  // daily_loss_limit > 0 + stop_scaling_price > 0 + env gate
  // OKX_DCA_REAL_ENABLED before any real fill.
  paper_mode: 1,
  daily_loss_limit_usdt: 0,
  auto_recycle: 0,
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
    pauseAll: "Pause all active",
    pauseAllConfirm: "Pause %d active bot(s)? Existing fills stay open.",
    pauseAllResult: "Paused %d bot(s).",
    pauseAllErr: "Failed to pause all bots",
    pvNextTrigger: "Next trigger",
    pvTp: "TP",
    pvAway: "away",
    pvWouldFire: "Would fire now",
    pvHalted: "Scaling halted",
    pvMark: "Mark",
    pvAvg: "Avg",
    pvUnrealized: "Unrealized",
    pvOpenFills: "open fill(s)",
    historyShow: "▶ Fills history",
    historyHide: "▼ Hide history",
    historyEmpty: "No fills recorded for this bot yet.",
    historyHeader: ["#", "When", "Kind", "Price", "Size", "Status"],
    cumPreviewOk: "If all safeties fire, total notional: %s USDT",
    cumPreviewWarn:
      "If all safeties fire, total notional: %s USDT — approaching the 50,000 cap",
    cumPreviewBlock:
      "If all safeties fire, total notional: %s USDT — exceeds the 50,000 cap. Save will be rejected.",
    staleWarn: "No fills in %dh — config check?",
    staleHint:
      "Active but quiet. Common causes: price_step_pct too tight (market hasn't moved %), or symbol has low volatility today.",
    activateConfirmTitle: "Activate %s?",
    activateConfirmBody:
      "Paper-mode (simulated fills). If all safety orders fire, total notional could reach %s USDT.\n\n• %s · ×%s leverage · step %s%\n• Max %s safety orders · TP %s%\n\nThe loop starts ticking within ~60s and writes a base fill at the mark price.",
    none: "No DCA bots yet — define one below and run a backtest first.",
    active: "ACTIVE",
    activate: "Activate",
    deactivate: "Deactivate",
    deleteBtn: "Delete",
    deleteConfirm: "Delete this DCA bot?",
    editBtn: "Edit",
    editing: "Editing: %s",
    editCancel: "Cancel edit",
    updateBtn: "Update bot",
    new: "New DCA Bot",
    name: "Name",
    symbol: "Symbol",
    symbolHelp:
      "OKX swap format: BASE-USDT-SWAP (e.g. BTC-USDT-SWAP, ETH-USDT-SWAP)",
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
    paperMode: "Paper mode (simulated fills, safe)",
    realModeToggle: "Switch to REAL mode (live OKX orders, funds at risk)",
    realModeWarn:
      "⚠ Real mode places LIVE orders on OKX with real funds. Required: server env OKX_DCA_REAL_ENABLED=true + daily_loss_limit_usdt > 0 + stop_scaling_price > 0.",
    realModeBlocker:
      "Real-mode save blocked: set daily_loss_limit_usdt > 0 AND stop_scaling_price > 0 first.",
    envBannerTitle: "⚠ Real-mode env gate DISABLED",
    envBannerBody:
      "Active real-mode bot detected but server env OKX_DCA_REAL_ENABLED is not set. Bots will skip every tick silently — no orders, no fills. SSH the server and add OKX_DCA_REAL_ENABLED=true to /etc/pruviq/env, then `systemctl restart pruviq-api`.",
    dailyLossLimit: "Daily loss limit (USDT, 0 = off; real-mode requires > 0)",
    autoRecycle: "Auto-recycle after TP (re-arm a fresh cycle)",
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
    pauseAll: "모든 활성 봇 일괄 중단",
    pauseAllConfirm: "활성 봇 %d개를 모두 중단할까요? 기존 체결은 유지됩니다.",
    pauseAllResult: "봇 %d개를 중단했습니다.",
    pauseAllErr: "일괄 중단 실패",
    pvNextTrigger: "다음 트리거",
    pvTp: "익절",
    pvAway: "남음",
    pvWouldFire: "지금 발사 조건",
    pvHalted: "추가 매수 중단됨",
    pvMark: "현재가",
    pvAvg: "평단",
    pvUnrealized: "미실현",
    pvOpenFills: "열린 체결",
    historyShow: "▶ 체결 히스토리",
    historyHide: "▼ 히스토리 숨김",
    historyEmpty: "이 봇의 체결 기록이 아직 없습니다.",
    historyHeader: ["#", "시각", "종류", "가격", "크기", "상태"],
    cumPreviewOk: "모든 안전 매수 발사 시 총 노출: %s USDT",
    cumPreviewWarn:
      "모든 안전 매수 발사 시 총 노출: %s USDT — 50,000 한도에 근접",
    cumPreviewBlock:
      "모든 안전 매수 발사 시 총 노출: %s USDT — 50,000 한도 초과. 저장이 거부됩니다.",
    staleWarn: "%d시간 체결 없음 — 설정 점검?",
    staleHint:
      "활성 상태인데 조용합니다. 흔한 원인: price_step_pct가 너무 좁음 (시장이 % 만큼 움직이지 않음), 또는 오늘 종목 변동성 낮음.",
    activateConfirmTitle: "%s 활성화?",
    activateConfirmBody:
      "Paper-mode (모의 체결). 모든 안전 매수가 발사되면 총 노출이 %s USDT까지 도달할 수 있습니다.\n\n• %s · 레버리지 ×%s · step %s%\n• 최대 안전 매수 %s회 · TP %s%\n\n약 60초 안에 루프가 마크 가격으로 기준 체결을 기록합니다.",
    none: "DCA 봇이 없습니다 — 아래에서 정의 후 먼저 백테스트를 돌려보세요.",
    active: "활성",
    activate: "활성화",
    deactivate: "비활성화",
    deleteBtn: "삭제",
    deleteConfirm: "이 DCA 봇을 삭제할까요?",
    editBtn: "편집",
    editing: "편집 중: %s",
    editCancel: "편집 취소",
    updateBtn: "봇 업데이트",
    new: "새 DCA 봇",
    name: "이름",
    symbol: "심볼",
    symbolHelp:
      "OKX 스왑 형식: BASE-USDT-SWAP (예: BTC-USDT-SWAP, ETH-USDT-SWAP)",
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
    paperMode: "Paper 모드 (모의 체결, 안전)",
    realModeToggle: "REAL 모드 전환 (실거래 — 자금 위험)",
    realModeWarn:
      "⚠ Real 모드는 OKX에 실주문을 보내고 실제 자금이 움직입니다. 필수: 서버 env OKX_DCA_REAL_ENABLED=true + daily_loss_limit_usdt > 0 + stop_scaling_price > 0.",
    realModeBlocker:
      "Real 모드 저장 차단: daily_loss_limit_usdt > 0 AND stop_scaling_price > 0 먼저 설정.",
    envBannerTitle: "⚠ Real-mode env gate 비활성",
    envBannerBody:
      "Real 모드 봇이 활성화돼 있지만 서버 env OKX_DCA_REAL_ENABLED 미설정 — 봇이 매 tick silent skip 중 (주문 0건). SSH 접속 후 /etc/pruviq/env에 OKX_DCA_REAL_ENABLED=true 추가 → `systemctl restart pruviq-api`.",
    dailyLossLimit: "일일 손실 한도 (USDT, 0 = 미사용; 실거래는 > 0 필수)",
    autoRecycle: "익절 후 자동 재가동 (새 사이클 자동 시작)",
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
  // When set, the builder form is editing this bot (PUT instead of POST).
  // Cleared on save success or cancel. PUT is rejected by the backend if
  // the bot is active, so the Edit button only renders on inactive rows.
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [bots, setBots] = useState<DcaBot[]>([]);
  const [unauthed, setUnauthed] = useState(false);
  // Server-side OKX_DCA_REAL_ENABLED env state. null = unknown (loading or
  // endpoint not yet deployed), true/false otherwise. Banner only renders
  // when this is explicitly false AND at least one bot is real-mode + active.
  const [realModeEnvEnabled, setRealModeEnvEnabled] = useState<boolean | null>(
    null,
  );
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

  // Bot history drawer — expanded set + fetched fills cache.
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  const [botFills, setBotFills] = useState<
    Record<
      string,
      Array<{
        id: number;
        order_num: number;
        fill_price: number;
        fill_size_usdt: number;
        filled_at: number;
        status: string;
      }>
    >
  >({});

  // Cross-bot previews — map bot_id → {next_trigger, tp, distances}.
  // Populated only for active bots; null for inactive.
  const [previews, setPreviews] = useState<
    Record<
      string,
      {
        mark_price: number;
        next_trigger_price: number;
        tp_price: number;
        weighted_avg_entry: number;
        distance_to_trigger_pct: number;
        distance_to_tp_pct: number;
        would_fire_next_safety: boolean;
        scaling_halted: boolean;
        running: boolean;
        open_fills_count: number;
        direction: "long" | "short";
      }
    >
  >({});

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

  // Real-mode env gate status (#2090 endpoint). Public, no auth. Fetched
  // once on mount + every 5 min so a server-side env change reaches the
  // banner without a hard reload.
  useEffect(() => {
    let cancelled = false;
    const fetchEnvStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/dca-bots/real-mode-status`, {
          signal: AbortSignal.timeout(6_000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          real_mode_env_enabled: boolean;
        };
        if (!cancelled) {
          setRealModeEnvEnabled(!!data.real_mode_env_enabled);
        }
      } catch {
        // silent — banner won't render while we don't know
      }
    };
    void fetchEnvStatus();
    const id = setInterval(() => void fetchEnvStatus(), 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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

  // Cross-bot previews — only fetch if there's ≥1 active bot to avoid
  // pointless ticker calls. Re-runs when bots list changes so flipping
  // a bot active immediately starts populating its row.
  const hasActive = bots.some((b) => b.is_active);
  useEffect(() => {
    if (!hasActive) {
      setPreviews({});
      return;
    }
    const fetchPreviews = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/dca-bots/previews`, {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          previews: { bot_id: string; preview?: Record<string, unknown> }[];
        };
        const map: Record<string, never> = {};
        for (const p of data.previews ?? []) {
          if (p.preview) {
            (map as Record<string, unknown>)[p.bot_id] = p.preview;
          }
        }
        setPreviews(map as unknown as typeof previews);
      } catch {
        // silent — preview is best-effort
      }
    };
    void fetchPreviews();
    const id = setInterval(() => void fetchPreviews(), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActive, bots.length]);

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
      // Edit mode: PUT to /dca-bots/:id. Backend rejects edits on active
      // bots; we only render Edit on inactive rows so this should rarely
      // race with an activation.
      const url = editingBotId
        ? `${API_BASE_URL}/dca-bots/${encodeURIComponent(editingBotId)}`
        : `${API_BASE_URL}/dca-bots`;
      const method = editingBotId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
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
      if (editingBotId) {
        setEditingBotId(null);
        setDraft(DEFAULT_DRAFT);
      }
      setTimeout(() => setSaving("idle"), 2000);
    } catch (e) {
      setSaving("error");
      setSaveErr(e instanceof Error ? e.message : String(e));
    }
  }

  function handleEdit(bot: DcaBot) {
    setDraft({
      name: bot.name,
      symbol: bot.symbol,
      direction: bot.direction,
      position_size_usdt: bot.position_size_usdt,
      leverage: bot.leverage,
      price_step_pct: bot.price_step_pct,
      size_multiplier: bot.size_multiplier,
      max_safety_orders: bot.max_safety_orders,
      tp_pct: bot.tp_pct,
      stop_scaling_price: bot.stop_scaling_price,
      paper_mode: bot.paper_mode ?? 1,
      daily_loss_limit_usdt: bot.daily_loss_limit_usdt ?? 0,
      auto_recycle: bot.auto_recycle ?? 0,
    });
    setEditingBotId(bot.id);
    setSaving("idle");
    setSaveErr("");
    setTimeout(() => {
      const el = document.getElementById("dca-builder-form");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function handleCancelEdit() {
    setEditingBotId(null);
    setDraft(DEFAULT_DRAFT);
    setSaveErr("");
  }

  async function handleActivate(id: string) {
    const bot = bots.find((b) => b.id === id);
    if (bot) {
      // Mirrors backend validate_dca_params cumulative calc so the
      // confirm dialog shows the same exposure the API would compute.
      const base = Number(bot.position_size_usdt) || 0;
      const m = Number(bot.size_multiplier) || 1;
      const n = Number(bot.max_safety_orders) || 0;
      const cumulative =
        Math.abs(m - 1) < 1e-9
          ? base * (n + 1)
          : (base * (Math.pow(m, n + 1) - 1)) / (m - 1);
      const title = t.activateConfirmTitle.replace("%s", bot.name);
      const body = t.activateConfirmBody
        .replace("%s", cumulative.toFixed(0))
        .replace("%s", bot.symbol)
        .replace("%s", String(bot.leverage))
        .replace("%s", String(bot.price_step_pct))
        .replace("%s", String(bot.max_safety_orders))
        .replace("%s", String(bot.tp_pct));
      if (!window.confirm(`${title}\n\n${body}`)) return;
    }
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
  async function handlePauseAll() {
    const activeCount = bots.filter((b) => b.is_active).length;
    if (activeCount === 0) return;
    if (!window.confirm(t.pauseAllConfirm.replace("%d", String(activeCount))))
      return;
    try {
      const res = await fetch(`${API_BASE_URL}/dca-bots/pause-all`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { paused: number };
      await reload();
      window.alert(t.pauseAllResult.replace("%d", String(data.paused ?? 0)));
    } catch (e) {
      window.alert(`${t.pauseAllErr}: ${e instanceof Error ? e.message : e}`);
    }
  }
  async function handleDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    await fetch(`${API_BASE_URL}/dca-bots/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await reload();
  }
  async function toggleHistory(id: string) {
    const next = new Set(expandedBots);
    if (next.has(id)) {
      next.delete(id);
      setExpandedBots(next);
      return;
    }
    next.add(id);
    setExpandedBots(next);
    // Lazy-fetch on first expansion only
    if (!botFills[id]) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/dca-bots/${encodeURIComponent(id)}/fills`,
          { credentials: "include", signal: AbortSignal.timeout(10_000) },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          fills: (typeof botFills)[string];
        };
        setBotFills((m) => ({ ...m, [id]: data.fills ?? [] }));
      } catch {
        // silent — drawer just stays empty
      }
    }
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

  // Real-mode env gate banner — only when server env is OFF AND owner
  // has at least one active real-mode bot. Catches the silent-zombie
  // case where paper_mode=0 + OKX_DCA_REAL_ENABLED unset = every tick
  // skipped with no UI signal otherwise.
  const showEnvBanner =
    realModeEnvEnabled === false &&
    bots.some((b) => b.paper_mode === 0 && b.is_active === 1);

  return (
    <div class="space-y-5">
      {showEnvBanner && (
        <div
          class="rounded-xl border border-(--color-down)/50 bg-(--color-down)/10 p-4 text-sm"
          role="alert"
        >
          <div class="font-bold text-(--color-down) mb-1">
            {t.envBannerTitle}
          </div>
          <div class="font-mono text-xs leading-relaxed text-(--color-text)">
            {t.envBannerBody}
          </div>
        </div>
      )}
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
                <span
                  aria-hidden="true"
                  class={
                    loopHealth.healthy
                      ? "inline-block w-1.5 h-1.5 rounded-full bg-(--color-up) motion-safe:animate-pulse"
                      : "inline-block w-1.5 h-1.5 rounded-full border border-(--color-down)"
                  }
                />
                {loopHealth.healthy ? t.loopHealthy : t.loopStale}
                <span class="text-(--color-text-muted)">
                  · {Math.round(loopHealth.seconds_ago)}s
                </span>
              </span>
            )}
          </div>
          <div class="flex items-center gap-2">
            {bots.some((b) => b.is_active) && (
              <button
                type="button"
                class="text-xs font-bold text-(--color-down) hover:bg-(--color-down)/10 border border-(--color-down)/30 rounded-lg px-3 min-h-[44px]"
                onClick={handlePauseAll}
                aria-label={t.pauseAll}
              >
                ⏸ {t.pauseAll}
              </button>
            )}
            <span class="text-xs text-(--color-text-muted)">{t.subtitle}</span>
          </div>
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
              const pv = previews[b.id];
              const fmtP = (n: number) =>
                n >= 1000
                  ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : n >= 1
                    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : n.toLocaleString(undefined, { maximumFractionDigits: 8 });
              return (
                <li
                  key={b.id}
                  class="p-3 rounded-lg border border-(--color-border) bg-(--color-bg)/40"
                >
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="min-w-0">
                      <p class="font-bold text-sm truncate">{b.name}</p>
                      <p class="text-xs font-mono text-(--color-text-muted)">
                        <span class={dirColor}>
                          {b.direction.toUpperCase()}
                        </span>{" "}
                        · {b.symbol} · ×{b.leverage} · step {b.price_step_pct}%
                        · TP {b.tp_pct}%
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      {b.is_active &&
                        typeof b.hours_since_last_fill === "number" &&
                        b.hours_since_last_fill > 24 && (
                          <span
                            class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-(--color-warning)/10 border border-(--color-warning)/30 text-(--color-warning)"
                            title={t.staleHint}
                            role="status"
                          >
                            ⚠{" "}
                            {t.staleWarn.replace(
                              "%d",
                              String(Math.floor(b.hours_since_last_fill)),
                            )}
                          </span>
                        )}
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
                        <>
                          <button
                            type="button"
                            class="text-xs text-(--color-text-muted) hover:text-(--color-accent) underline min-h-[44px] px-2"
                            onClick={() => handleEdit(b)}
                          >
                            {t.editBtn}
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm min-h-[44px]"
                            onClick={() => handleActivate(b.id)}
                          >
                            {t.activate}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        class="text-xs text-(--color-down) hover:underline min-h-[44px] px-2"
                        onClick={() => handleDelete(b.id)}
                      >
                        {t.deleteBtn}
                      </button>
                    </div>
                  </div>
                  {b.is_active && pv && (
                    <div class="mt-2 pt-2 border-t border-(--color-border)/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div>
                        <span class="text-(--color-text-muted)">
                          {t.pvNextTrigger}:{" "}
                        </span>
                        <span class="font-bold">
                          ${fmtP(pv.next_trigger_price)}
                        </span>
                        <span class="text-(--color-text-muted)">
                          {" "}
                          ({pv.distance_to_trigger_pct.toFixed(2)}% {t.pvAway})
                        </span>
                      </div>
                      <div>
                        <span class="text-(--color-text-muted)">
                          {t.pvTp}:{" "}
                        </span>
                        <span class="font-bold text-(--color-up)">
                          ${fmtP(pv.tp_price)}
                        </span>
                        <span class="text-(--color-text-muted)">
                          {" "}
                          ({pv.distance_to_tp_pct.toFixed(2)}% {t.pvAway})
                        </span>
                      </div>
                      <div>
                        <span class="text-(--color-text-muted)">
                          {t.pvMark}:{" "}
                        </span>
                        <span class="font-bold">${fmtP(pv.mark_price)}</span>
                        {pv.weighted_avg_entry > 0 && (
                          <>
                            {" "}
                            <span class="text-(--color-text-muted)">
                              · {t.pvAvg}:{" "}
                            </span>
                            <span class="font-bold">
                              ${fmtP(pv.weighted_avg_entry)}
                            </span>
                            {(() => {
                              const upl =
                                pv.direction === "long"
                                  ? ((pv.mark_price - pv.weighted_avg_entry) /
                                      pv.weighted_avg_entry) *
                                    100
                                  : ((pv.weighted_avg_entry - pv.mark_price) /
                                      pv.weighted_avg_entry) *
                                    100;
                              const cls =
                                upl > 0
                                  ? "text-(--color-up)"
                                  : upl < 0
                                    ? "text-(--color-down)"
                                    : "text-(--color-text-muted)";
                              const sign = upl > 0 ? "+" : "";
                              return (
                                <span class={`ml-2 font-bold ${cls}`}>
                                  ({t.pvUnrealized} {sign}
                                  {upl.toFixed(2)}%)
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </div>
                      <div>
                        <span class="text-(--color-text-muted)">
                          {pv.open_fills_count} {t.pvOpenFills}
                        </span>
                        {pv.would_fire_next_safety && (
                          <span class="ml-2 text-(--color-warning) font-bold">
                            ⚡ {t.pvWouldFire}
                          </span>
                        )}
                        {pv.scaling_halted && (
                          <span class="ml-2 text-(--color-down) font-bold">
                            ⛔ {t.pvHalted}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div class="mt-2 pt-2 border-t border-(--color-border)/40">
                    <button
                      type="button"
                      class="text-xs text-(--color-text-muted) hover:text-(--color-accent) min-h-[44px] px-1"
                      onClick={() => toggleHistory(b.id)}
                      aria-expanded={expandedBots.has(b.id)}
                    >
                      {expandedBots.has(b.id) ? t.historyHide : t.historyShow}
                    </button>
                    {expandedBots.has(b.id) && (
                      <div class="mt-2">
                        {(botFills[b.id] ?? []).length === 0 ? (
                          <p class="text-xs italic text-(--color-text-muted)">
                            {t.historyEmpty}
                          </p>
                        ) : (
                          <div class="overflow-x-auto">
                            <table class="w-full text-xs font-mono">
                              <thead>
                                <tr class="border-b border-(--color-border) bg-(--color-bg)/30 text-left">
                                  {t.historyHeader.map((h) => (
                                    <th key={h} class="p-2 font-bold">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(botFills[b.id] ?? []).map((f) => {
                                  const dt = new Date(
                                    f.filled_at * 1000,
                                  ).toLocaleString();
                                  const kind =
                                    f.status === "tp_closed"
                                      ? "TP"
                                      : f.order_num === 0
                                        ? "BASE"
                                        : `SAFETY ${f.order_num}`;
                                  return (
                                    <tr
                                      key={f.id}
                                      class="border-b border-(--color-border)/40"
                                    >
                                      <td class="p-2 text-(--color-text-muted)">
                                        {f.order_num}
                                      </td>
                                      <td class="p-2 whitespace-nowrap">
                                        {dt}
                                      </td>
                                      <td class="p-2">{kind}</td>
                                      <td class="p-2 text-right">
                                        ${fmtP(f.fill_price)}
                                      </td>
                                      <td class="p-2 text-right">
                                        {f.fill_size_usdt.toFixed(2)}
                                      </td>
                                      <td class="p-2 text-(--color-text-muted)">
                                        {f.status}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Builder form */}
      <div
        id="dca-builder-form"
        class={`card-enterprise rounded-2xl p-5 md:p-6 space-y-4 ${editingBotId ? "ring-2 ring-(--color-accent)/40" : ""}`}
      >
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h3 class="font-bold text-lg">
            {editingBotId
              ? t.editing.replace(
                  "%s",
                  bots.find((b) => b.id === editingBotId)?.name ?? "",
                )
              : t.new}
          </h3>
          {editingBotId && (
            <button
              type="button"
              class="text-xs text-(--color-text-muted) hover:text-(--color-down) underline min-h-[44px] px-2"
              onClick={handleCancelEdit}
            >
              {t.editCancel}
            </button>
          )}
        </div>

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

        {/* Real-mode safety gates (#2071 schema). Paper-mode permits 0/0;
            real-mode (paper_mode=0) backend rejects on validate. */}
        <label class="block">
          <span class="text-sm font-bold">{t.dailyLossLimit}</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft.daily_loss_limit_usdt}
            onInput={(e) =>
              setDraft((d) => ({
                ...d,
                daily_loss_limit_usdt: Number(
                  (e.target as HTMLInputElement).value,
                ),
              }))
            }
            class="mt-1 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>

        <label class="flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={!!draft.auto_recycle}
            onInput={(e) =>
              setDraft((d) => ({
                ...d,
                auto_recycle: (e.target as HTMLInputElement).checked ? 1 : 0,
              }))
            }
            class="w-5 h-5"
          />
          <span class="text-sm">{t.autoRecycle}</span>
        </label>

        {/* paper_mode toggle — explicit opt-in for real OKX orders.
            Backend additionally enforces OKX_DCA_REAL_ENABLED env gate +
            daily_loss_limit > 0 + stop_scaling_price > 0 before any
            real fill. We surface the same checks on the frontend so the
            owner sees the warning + the missing prerequisites before
            submitting. */}
        <div class="rounded-lg border border-(--color-border) p-3 space-y-2">
          <label class="flex items-center gap-2 min-h-[44px]">
            <input
              type="checkbox"
              checked={!draft.paper_mode}
              onInput={(e) =>
                setDraft((d) => ({
                  ...d,
                  paper_mode: (e.target as HTMLInputElement).checked ? 0 : 1,
                }))
              }
              class="w-5 h-5"
            />
            <span class="text-sm font-bold">
              {draft.paper_mode ? t.paperMode : t.realModeToggle}
            </span>
          </label>
          {!draft.paper_mode && (
            <>
              <p class="text-xs text-(--color-down) font-mono">
                {t.realModeWarn}
              </p>
              {(draft.daily_loss_limit_usdt <= 0 ||
                draft.stop_scaling_price <= 0) && (
                <p
                  class="text-xs text-(--color-down) font-bold font-mono"
                  role="alert"
                >
                  {t.realModeBlocker}
                </p>
              )}
            </>
          )}
        </div>

        {/* Live cumulative-exposure preview — mirrors backend
            validate_dca_params formula so owners see the cap math before
            hitting Save. */}
        {(() => {
          const base = Number(draft.position_size_usdt) || 0;
          const m = Number(draft.size_multiplier) || 1;
          const n = Number(draft.max_safety_orders) || 0;
          if (base <= 0 || n < 0 || m <= 0) return null;
          const cum =
            Math.abs(m - 1) < 1e-9
              ? base * (n + 1)
              : (base * (Math.pow(m, n + 1) - 1)) / (m - 1);
          const fmt = cum.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          });
          const over = cum > 50_000;
          const warn = !over && cum > 40_000;
          const text = over
            ? t.cumPreviewBlock.replace("%s", fmt)
            : warn
              ? t.cumPreviewWarn.replace("%s", fmt)
              : t.cumPreviewOk.replace("%s", fmt);
          const cls = over
            ? "bg-(--color-down)/10 border-(--color-down)/40 text-(--color-down)"
            : warn
              ? "bg-(--color-warning)/10 border-(--color-warning)/40 text-(--color-warning)"
              : "bg-(--color-bg-elevated) border-(--color-border) text-(--color-text-secondary)";
          return (
            <div
              class={`text-xs font-mono p-2.5 rounded-lg border ${cls}`}
              role={over ? "alert" : "status"}
              aria-live={over ? "assertive" : "polite"}
            >
              {text}
            </div>
          );
        })()}

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
            disabled={
              saving === "saving" ||
              (!draft.paper_mode &&
                (draft.daily_loss_limit_usdt <= 0 ||
                  draft.stop_scaling_price <= 0))
            }
          >
            {saving === "saving"
              ? t.saving
              : saving === "saved"
                ? t.saved
                : editingBotId
                  ? t.updateBtn
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
