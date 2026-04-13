/**
 * Trading Settings — configure auto-trading parameters.
 * Fetches/saves settings from /settings/trading API.
 *
 * UX rules:
 * - manual mode → bot settings grayed out (irrelevant)
 * - alert/auto mode → Telegram Chat ID required
 * - Conflicting values → inline warnings (not blocking save)
 * - Empty strategies/coins → "all signals" warning shown
 */
import { useState, useEffect, useMemo } from "preact/hooks";

interface Props {
  lang?: "en" | "ko";
}

const API_BASE = "https://api.pruviq.com";
// Must match backend okx/config.py OKX_OAUTH_AUTHORIZE
const OKX_OAUTH_BASE = "https://www.okx.com/api/v5/oauth/authorize";

function OKXDirectConnectButton({
  lang,
  label,
}: {
  lang: string;
  label: string;
}) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/okx/init?lang=${lang}`);
      if (!resp.ok) throw new Error(`init failed: ${resp.status}`);
      const p = await resp.json();
      const qs = new URLSearchParams({
        client_id: p.client_id,
        response_type: p.response_type,
        access_type: p.access_type,
        scope: p.scope,
        redirect_uri: p.redirect_uri,
        state: p.state,
      }).toString();
      window.location.assign(`${OKX_OAUTH_BASE}?${qs}`);
    } catch (e) {
      console.error("OKX OAuth init failed:", e);
      setConnecting(false);
    }
  };

  return (
    <button
      class="btn btn-primary btn-md"
      onClick={handleConnect}
      disabled={connecting}
    >
      {connecting ? "Connecting..." : `${label} →`}
    </button>
  );
}

const STRATEGIES = [
  { id: "bb-squeeze-short", name: "BB Squeeze SHORT", status: "verified" },
  { id: "atr-breakout", name: "ATR Breakout", status: "verified" },
  { id: "donchian-breakout", name: "Donchian Breakout", status: "verified" },
  { id: "keltner-squeeze", name: "Keltner Squeeze", status: "verified" },
  { id: "ma-cross", name: "MA Cross", status: "verified" },
  { id: "ichimoku", name: "Ichimoku Cloud", status: "verified" },
  { id: "volume-profile", name: "Volume Profile", status: "verified" },
];

const TOP_COINS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "LTCUSDT",
  "DOGEUSDT",
  "MATICUSDT",
  "ATOMUSDT",
  "NEARUSDT",
  "APTUSDT",
];

const labels = {
  en: {
    title: "Auto-Trading Settings",
    strategies: "Strategies",
    strategiesDesc: "Select which strategies to follow",
    allStrategiesWarn: "No strategies selected = trades ALL signals",
    coins: "Coins",
    coinsDesc: "Select which coins to trade",
    allCoinsWarn: "No coins selected = trades ALL coins",
    positionSize: "Position Size",
    positionSizeDesc: "Amount per trade",
    positionModeFixed: "Fixed USDT",
    positionModePercent: "% of Balance",
    positionSizeUSDT: "Amount (USDT)",
    positionSizeUSDTDesc: "$1 — $5,000 per trade",
    positionSizePct: "Balance %",
    positionSizePctDesc: "1% — 20% of account balance per trade",
    leverage: "Leverage",
    leverageDesc: "1x — 125x",
    marginMode: "Margin Mode",
    marginIsolated: "Isolated (recommended)",
    marginCross: "Cross",
    maxPositions: "Max Concurrent Positions",
    maxPositionsDesc: "Hard cap on open positions at any time",
    maxTrades: "Max Daily Trades",
    maxTradesDesc: "Trading stops after this many trades today",
    lossLimit: "Daily Loss Limit (USDT)",
    lossLimitDesc: "Trading pauses if daily loss exceeds this",
    executionMode: "Execution Mode",
    modes: {
      manual: "Manual — I'll execute myself",
      alert: "Alert — Notify me via Telegram, I click to execute",
      auto: "Auto — Execute automatically when signal fires",
    },
    alertChatId: "Telegram Chat ID",
    alertChatIdDesc: "Send /start to @userinfobot to find your chat ID",
    alertChatIdRequired: "Required for alert and auto modes",
    autoModeAlertNote:
      "Auto mode also sends Telegram notifications on every trade",
    masterSwitch: "Enable Bot",
    masterSwitchDesc: "Bot only executes in Alert or Auto mode",
    manualModeNote: "Switch to Alert or Auto mode to enable the bot",
    save: "Save Settings",
    saving: "Saving...",
    saved: "Saved!",
    notConnected: "Connect your OKX account first to configure auto-trading.",
    connect: "Connect OKX",
    todayStats: "Today",
    trades: "trades",
    pnl: "P&L",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    warning:
      "Auto-trading executes real trades with real money. Start with small position sizes.",
    // Conflict warnings
    warnMaxConcurrentVsDaily:
      "Max positions > max daily trades — you'll never fill all slots",
    warnLossLimitVsPosition:
      "Daily loss limit may trigger after just 1 trade at current position size",
    warnHighLeverage:
      "Leverage above 10x significantly increases liquidation risk",
    warnHighPct: "Position % above 10% with leverage is high risk per trade",
    riskSection: "Risk Controls",
  },
  ko: {
    title: "자동매매 설정",
    strategies: "전략",
    strategiesDesc: "팔로우할 전략을 선택하세요",
    allStrategiesWarn: "전략 미선택 = 모든 시그널 거래",
    coins: "코인",
    coinsDesc: "거래할 코인을 선택하세요",
    allCoinsWarn: "코인 미선택 = 모든 코인 거래",
    positionSize: "포지션 크기",
    positionSizeDesc: "1회 거래 금액",
    positionModeFixed: "고정 USDT",
    positionModePercent: "잔고 %",
    positionSizeUSDT: "금액 (USDT)",
    positionSizeUSDTDesc: "1회 거래당 $1 — $5,000",
    positionSizePct: "잔고 비율 %",
    positionSizePctDesc: "계좌 잔고의 1% — 20% 사용",
    leverage: "레버리지",
    leverageDesc: "1x — 125x",
    marginMode: "마진 모드",
    marginIsolated: "격리 마진 (권장)",
    marginCross: "교차 마진",
    maxPositions: "최대 동시 포지션",
    maxPositionsDesc: "동시에 열 수 있는 포지션 최대 개수",
    maxTrades: "일일 최대 거래 수",
    maxTradesDesc: "오늘 이 횟수 이상 거래하지 않음",
    lossLimit: "일일 손실 한도 (USDT)",
    lossLimitDesc: "일일 손실이 이 금액을 초과하면 거래 중지",
    executionMode: "실행 방식",
    modes: {
      manual: "수동 — 직접 실행",
      alert: "알림 — 텔레그램 알림 후 클릭으로 실행",
      auto: "자동 — 시그널 발생 시 자동 실행",
    },
    alertChatId: "텔레그램 채팅 ID",
    alertChatIdDesc: "@userinfobot에게 /start 전송 후 확인",
    alertChatIdRequired: "알림/자동 모드에 필수입니다",
    autoModeAlertNote: "자동 모드에서도 매 거래마다 텔레그램 알림이 전송됩니다",
    masterSwitch: "봇 활성화",
    masterSwitchDesc: "알림 또는 자동 모드에서만 작동합니다",
    manualModeNote: "봇을 활성화하려면 알림 또는 자동 모드로 변경하세요",
    save: "설정 저장",
    saving: "저장 중...",
    saved: "저장됨!",
    notConnected: "자동매매 설정을 위해 먼저 OKX 계정을 연결하세요.",
    connect: "OKX 연결",
    todayStats: "오늘",
    trades: "거래",
    pnl: "수익",
    selectAll: "전체 선택",
    deselectAll: "전체 해제",
    warning:
      "자동매매는 실제 자금으로 실제 거래를 실행합니다. 작은 금액부터 시작하세요.",
    warnMaxConcurrentVsDaily:
      "최대 포지션 > 일일 최대 거래 수 — 슬롯을 모두 채울 수 없습니다",
    warnLossLimitVsPosition:
      "현재 포지션 크기에서 1회 거래 후 손실 한도에 도달할 수 있습니다",
    warnHighLeverage: "레버리지 10x 초과 시 청산 위험이 크게 증가합니다",
    warnHighPct:
      "레버리지와 함께 포지션 비율 10% 초과 시 1회 거래 리스크가 매우 높습니다",
    riskSection: "리스크 관리",
  },
};

interface Settings {
  strategies: string[];
  coins: string[];
  position_size_usdt: number;
  position_size_mode: "fixed" | "percent";
  position_size_pct: number;
  leverage: number;
  td_mode: string;
  max_concurrent: number;
  max_daily_trades: number;
  daily_loss_limit_usdt: number;
  execution_mode: string;
  enabled: boolean;
  alert_telegram_chat_id: string;
}

function WarnBadge({ msg }: { msg: string }) {
  return (
    <p class="text-xs text-yellow-500 flex items-center gap-1 mt-1">
      <span aria-hidden="true">⚠</span> {msg}
    </p>
  );
}

function InfoBadge({ msg }: { msg: string }) {
  return (
    <p class="text-xs text-[--color-text-muted] flex items-center gap-1 mt-1">
      <span aria-hidden="true">ℹ</span> {msg}
    </p>
  );
}

export default function TradingSettings({ lang = "en" }: Props) {
  const t = labels[lang];
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [settings, setSettings] = useState<Settings>({
    strategies: [],
    coins: [],
    position_size_usdt: 100,
    position_size_mode: "fixed" as const,
    position_size_pct: 5,
    leverage: 1,
    td_mode: "isolated",
    max_concurrent: 3,
    max_daily_trades: 20,
    daily_loss_limit_usdt: 200,
    execution_mode: "manual",
    enabled: false,
    alert_telegram_chat_id: "",
  });
  const [dailyStats, setDailyStats] = useState({
    trades_today: 0,
    pnl_today: 0,
  });

  // ── Derived state ──────────────────────────────────────────
  const isManualMode = settings.execution_mode === "manual";
  const needsTelegram =
    settings.execution_mode === "alert" || settings.execution_mode === "auto";
  const missingTelegram =
    needsTelegram && !settings.alert_telegram_chat_id.trim();

  // Conflict detection
  const conflicts = useMemo(() => {
    const warns: string[] = [];
    if (settings.max_concurrent > settings.max_daily_trades) {
      warns.push(t.warnMaxConcurrentVsDaily);
    }
    const posUsdt =
      settings.position_size_mode === "fixed"
        ? settings.position_size_usdt
        : null; // can't check percent without balance
    if (
      posUsdt !== null &&
      posUsdt * settings.leverage >= settings.daily_loss_limit_usdt
    ) {
      warns.push(t.warnLossLimitVsPosition);
    }
    if (settings.leverage > 10) {
      warns.push(t.warnHighLeverage);
    }
    if (
      settings.position_size_mode === "percent" &&
      settings.position_size_pct > 10 &&
      settings.leverage > 3
    ) {
      warns.push(t.warnHighPct);
    }
    return warns;
  }, [settings, t]);

  useEffect(() => {
    fetch(`${API_BASE}/auth/okx/status`, {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        if (d.connected) {
          return fetch(`${API_BASE}/settings/trading`, {
            credentials: "include",
            signal: AbortSignal.timeout(8000),
          });
        }
        setLoading(false);
        return null;
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d) {
          setSettings(d.settings);
          setDailyStats(d.daily_stats);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving("saving");
    try {
      const resp = await fetch(`${API_BASE}/settings/trading`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (resp.ok) {
        const d = await resp.json();
        setSettings(d.settings);
        setSaving("saved");
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => setSaving("idle"), 2000);
  };

  const toggleStrategy = (id: string) => {
    setSettings((s) => ({
      ...s,
      strategies: s.strategies.includes(id)
        ? s.strategies.filter((x) => x !== id)
        : [...s.strategies, id],
    }));
  };

  const toggleCoin = (coin: string) => {
    setSettings((s) => ({
      ...s,
      coins: s.coins.includes(coin)
        ? s.coins.filter((x) => x !== coin)
        : [...s.coins, coin],
    }));
  };

  if (loading) {
    return (
      <div class="text-center py-8 text-[--color-text-muted]">Loading...</div>
    );
  }

  if (!connected) {
    return (
      <div class="card-enterprise rounded-xl p-6 text-center">
        <p class="text-[--color-text-muted] mb-4">{t.notConnected}</p>
        <OKXDirectConnectButton lang={lang} label={t.connect} />
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Warning banner */}
      <div class="bg-[--color-down]/10 border border-[--color-down]/20 rounded-xl p-4 text-sm text-[--color-down]">
        {t.warning}
      </div>

      {/* Today's stats */}
      <div class="flex gap-4">
        <div class="card-enterprise rounded-xl p-4 flex-1 text-center">
          <p class="text-xs text-[--color-text-muted]">
            {t.todayStats} {t.trades}
          </p>
          <p class="text-2xl font-bold">{dailyStats.trades_today}</p>
        </div>
        <div class="card-enterprise rounded-xl p-4 flex-1 text-center">
          <p class="text-xs text-[--color-text-muted]">
            {t.todayStats} {t.pnl}
          </p>
          <p
            class={`text-2xl font-bold ${dailyStats.pnl_today >= 0 ? "text-[--color-up]" : "text-[--color-down]"}`}
          >
            ${dailyStats.pnl_today.toFixed(2)}
          </p>
        </div>
      </div>

      {/* ── Execution mode (first — drives everything else) ── */}
      <div class="card-enterprise rounded-xl p-5">
        <h3 class="font-bold mb-3">{t.executionMode}</h3>
        <div class="space-y-2">
          {(["manual", "alert", "auto"] as const).map((mode) => (
            <label
              key={mode}
              class={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                settings.execution_mode === mode
                  ? "bg-[--color-accent]/10 border border-[--color-accent]/30"
                  : "hover:bg-[--color-bg]/50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="execution_mode"
                checked={settings.execution_mode === mode}
                onChange={() =>
                  setSettings((s) => ({ ...s, execution_mode: mode }))
                }
                class="accent-[--color-accent] mt-0.5"
              />
              <span class="text-sm">{t.modes[mode]}</span>
            </label>
          ))}
        </div>

        {/* Telegram Chat ID — shown for alert AND auto */}
        {needsTelegram && (
          <div class="mt-4 pt-4 border-t border-[--color-border]">
            <label class="font-bold text-sm block mb-1">{t.alertChatId}</label>
            <p class="text-xs text-[--color-text-muted] mb-1">
              {t.alertChatIdDesc}
            </p>
            {settings.execution_mode === "auto" && (
              <InfoBadge msg={t.autoModeAlertNote} />
            )}
            <input
              type="text"
              placeholder="e.g. 123456789"
              value={settings.alert_telegram_chat_id}
              onInput={(e) =>
                setSettings((s) => ({
                  ...s,
                  alert_telegram_chat_id: (e.target as HTMLInputElement).value,
                }))
              }
              class={`w-full p-2 mt-2 rounded-lg bg-[--color-bg] border text-sm font-mono ${
                missingTelegram
                  ? "border-yellow-500"
                  : "border-[--color-border]"
              }`}
              aria-label={t.alertChatId}
            />
            {missingTelegram && <WarnBadge msg={t.alertChatIdRequired} />}
          </div>
        )}
      </div>

      {/* ── Master switch — disabled + note when manual ── */}
      <div
        class={`card-enterprise rounded-xl p-5 flex items-center justify-between ${isManualMode ? "opacity-50" : ""}`}
      >
        <div>
          <h3 class="font-bold">{t.masterSwitch}</h3>
          <p class="text-xs text-[--color-text-muted]">
            {isManualMode ? t.manualModeNote : t.masterSwitchDesc}
          </p>
        </div>
        <label
          class={`relative inline-flex items-center ${isManualMode ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            checked={settings.enabled && !isManualMode}
            disabled={isManualMode}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                enabled: (e.target as HTMLInputElement).checked,
              }))
            }
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-[--color-border] peer-checked:bg-[--color-up] rounded-full peer-focus:ring-2 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* ── Bot settings — grayed out when manual mode ── */}
      <div
        class={`space-y-6 transition-opacity ${isManualMode ? "opacity-40 pointer-events-none" : ""}`}
      >
        {/* Strategies */}
        <div class="card-enterprise rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-bold">{t.strategies}</h3>
              <p class="text-xs text-[--color-text-muted]">
                {t.strategiesDesc}
              </p>
            </div>
            <button
              class="text-xs text-[--color-accent] underline"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  strategies:
                    s.strategies.length === STRATEGIES.length
                      ? []
                      : STRATEGIES.map((x) => x.id),
                }))
              }
            >
              {settings.strategies.length === STRATEGIES.length
                ? t.deselectAll
                : t.selectAll}
            </button>
          </div>
          {settings.strategies.length === 0 && (
            <WarnBadge msg={t.allStrategiesWarn} />
          )}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {STRATEGIES.map((s) => (
              <label
                key={s.id}
                class={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                  settings.strategies.includes(s.id)
                    ? "border-[--color-accent]/40 bg-[--color-accent]/5"
                    : "border-transparent hover:bg-[--color-bg]/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.strategies.includes(s.id)}
                  onChange={() => toggleStrategy(s.id)}
                  class="accent-[--color-accent]"
                />
                <span class="text-sm">{s.name}</span>
                <span class="text-[10px] font-mono text-[--color-up] bg-[--color-up]/10 px-1.5 rounded ml-auto">
                  {s.status}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Coins */}
        <div class="card-enterprise rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-bold">{t.coins}</h3>
              <p class="text-xs text-[--color-text-muted]">{t.coinsDesc}</p>
            </div>
            <button
              class="text-xs text-[--color-accent] underline"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  coins:
                    s.coins.length === TOP_COINS.length ? [] : [...TOP_COINS],
                }))
              }
            >
              {settings.coins.length === TOP_COINS.length
                ? t.deselectAll
                : t.selectAll}
            </button>
          </div>
          {settings.coins.length === 0 && <WarnBadge msg={t.allCoinsWarn} />}
          <div class="flex flex-wrap gap-2 mt-2">
            {TOP_COINS.map((coin) => (
              <button
                key={coin}
                class={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
                  settings.coins.includes(coin)
                    ? "border-[--color-accent] bg-[--color-accent]/10 text-[--color-accent]"
                    : "border-[--color-border] text-[--color-text-muted] hover:border-[--color-accent]/40"
                }`}
                onClick={() => toggleCoin(coin)}
              >
                {coin.replace("USDT", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Position + Leverage + Margin */}
        <div class="card-enterprise rounded-xl p-5 space-y-5">
          {/* Position size */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="font-bold text-sm">{t.positionSize}</label>
              <div class="flex rounded-lg border border-[--color-border] overflow-hidden text-xs">
                {(["fixed", "percent"] as const).map((mode) => (
                  <button
                    key={mode}
                    class={`px-3 py-1 transition-colors ${
                      settings.position_size_mode === mode
                        ? "bg-[--color-accent] text-white"
                        : "text-[--color-text-muted] hover:bg-[--color-bg-elevated]"
                    }`}
                    onClick={() =>
                      setSettings((s) => ({ ...s, position_size_mode: mode }))
                    }
                  >
                    {mode === "fixed"
                      ? t.positionModeFixed
                      : t.positionModePercent}
                  </button>
                ))}
              </div>
            </div>
            {settings.position_size_mode === "fixed" ? (
              <div>
                <p class="text-xs text-[--color-text-muted] mb-2">
                  {t.positionSizeUSDTDesc}
                </p>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={settings.position_size_usdt}
                  onInput={(e) =>
                    setSettings((s) => ({
                      ...s,
                      position_size_usdt: Number(
                        (e.target as HTMLInputElement).value,
                      ),
                    }))
                  }
                  class="w-full p-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm font-mono"
                />
              </div>
            ) : (
              <div>
                <p class="text-xs text-[--color-text-muted] mb-2">
                  {t.positionSizePctDesc}
                </p>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={settings.position_size_pct}
                    onInput={(e) =>
                      setSettings((s) => ({
                        ...s,
                        position_size_pct: Number(
                          (e.target as HTMLInputElement).value,
                        ),
                      }))
                    }
                    class="flex-1 accent-[--color-accent]"
                  />
                  <span class="font-mono font-bold text-lg w-14 text-right">
                    {settings.position_size_pct}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Leverage */}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-sm">{t.leverage}</label>
              <span class="font-mono font-bold text-lg">
                {settings.leverage}x
              </span>
            </div>
            <p class="text-xs text-[--color-text-muted] mb-2">
              {t.leverageDesc}
            </p>
            <input
              type="range"
              min={1}
              max={125}
              value={settings.leverage}
              onInput={(e) =>
                setSettings((s) => ({
                  ...s,
                  leverage: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="w-full accent-[--color-accent]"
            />
            <div class="flex justify-between text-[10px] text-[--color-text-muted] mt-1">
              <span>1x</span>
              <span>25x</span>
              <span>50x</span>
              <span>75x</span>
              <span>125x</span>
            </div>
          </div>

          {/* Margin mode */}
          <div>
            <label class="font-bold text-sm block mb-2">{t.marginMode}</label>
            <div class="flex gap-3">
              {(["isolated", "cross"] as const).map((mode) => (
                <label
                  key={mode}
                  class={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                    settings.td_mode === mode
                      ? "border-[--color-accent] bg-[--color-accent]/10"
                      : "border-[--color-border] hover:border-[--color-accent]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="td_mode"
                    checked={settings.td_mode === mode}
                    onChange={() =>
                      setSettings((s) => ({ ...s, td_mode: mode }))
                    }
                    class="accent-[--color-accent]"
                  />
                  {mode === "isolated" ? t.marginIsolated : t.marginCross}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Risk controls */}
        <div class="card-enterprise rounded-xl p-5 space-y-4">
          <h3 class="font-bold">{t.riskSection}</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="font-bold text-sm block mb-1">
                {t.maxPositions}
              </label>
              <p class="text-xs text-[--color-text-muted] mb-2">
                {t.maxPositionsDesc}
              </p>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.max_concurrent}
                onInput={(e) =>
                  setSettings((s) => ({
                    ...s,
                    max_concurrent: Number(
                      (e.target as HTMLInputElement).value,
                    ),
                  }))
                }
                class="w-full p-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm font-mono"
              />
            </div>
            <div>
              <label class="font-bold text-sm block mb-1">{t.maxTrades}</label>
              <p class="text-xs text-[--color-text-muted] mb-2">
                {t.maxTradesDesc}
              </p>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.max_daily_trades}
                onInput={(e) =>
                  setSettings((s) => ({
                    ...s,
                    max_daily_trades: Number(
                      (e.target as HTMLInputElement).value,
                    ),
                  }))
                }
                class="w-full p-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label class="font-bold text-sm block mb-1">{t.lossLimit}</label>
            <p class="text-xs text-[--color-text-muted] mb-2">
              {t.lossLimitDesc}
            </p>
            <input
              type="number"
              min={50}
              max={5000}
              value={settings.daily_loss_limit_usdt}
              onInput={(e) =>
                setSettings((s) => ({
                  ...s,
                  daily_loss_limit_usdt: Number(
                    (e.target as HTMLInputElement).value,
                  ),
                }))
              }
              class="w-full p-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm font-mono"
            />
          </div>

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div class="space-y-1 pt-2 border-t border-[--color-border]">
              {conflicts.map((w) => (
                <WarnBadge key={w} msg={w} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <button
        class={`btn btn-lg w-full ${saving === "saved" ? "bg-[--color-up] text-white" : "btn-primary"}`}
        onClick={handleSave}
        disabled={saving === "saving"}
      >
        {saving === "idle" ? t.save : saving === "saving" ? t.saving : t.saved}
      </button>
    </div>
  );
}
