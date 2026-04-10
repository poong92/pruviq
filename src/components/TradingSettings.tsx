/**
 * Trading Settings — configure auto-trading parameters.
 * Fetches/saves settings from /settings/trading API.
 */
import { useState, useEffect } from "preact/hooks";

interface Props {
  lang?: "en" | "ko";
}

const API_BASE = "https://api.pruviq.com";
const OKX_OAUTH_BASE = "https://www.okx.com/account/oauth";

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
    coins: "Coins",
    coinsDesc: "Select which coins to trade",
    positionSize: "Position Size (USDT)",
    positionSizeDesc: "Amount per trade ($10 — $500)",
    leverage: "Leverage",
    leverageDesc: "1x — 125x (higher = more risk)",
    marginMode: "Margin Mode",
    maxPositions: "Max Concurrent Positions",
    maxTrades: "Max Daily Trades",
    lossLimit: "Daily Loss Limit (USDT)",
    lossLimitDesc: "Trading pauses if daily loss exceeds this",
    executionMode: "Execution Mode",
    modes: {
      manual: "Manual — I'll execute myself",
      alert: "Alert — Notify me, I click to execute",
      auto: "Auto — Execute automatically",
    },
    masterSwitch: "Enable Auto-Trading",
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
  },
  ko: {
    title: "자동매매 설정",
    strategies: "전략",
    strategiesDesc: "팔로우할 전략을 선택하세요",
    coins: "코인",
    coinsDesc: "거래할 코인을 선택하세요",
    positionSize: "포지션 크기 (USDT)",
    positionSizeDesc: "1회 거래 금액 ($10 — $500)",
    leverage: "레버리지",
    leverageDesc: "1x — 125x (높을수록 위험)",
    marginMode: "마진 모드",
    maxPositions: "최대 동시 포지션",
    maxTrades: "일일 최대 거래 수",
    lossLimit: "일일 손실 한도 (USDT)",
    lossLimitDesc: "일일 손실이 이 금액을 초과하면 거래 중지",
    executionMode: "실행 방식",
    modes: {
      manual: "수동 — 직접 실행",
      alert: "알림 — 알림 후 클릭으로 실행",
      auto: "자동 — 시그널 시 자동 실행",
    },
    masterSwitch: "자동매매 활성화",
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
  },
};

interface Settings {
  strategies: string[];
  coins: string[];
  position_size_usdt: number;
  leverage: number;
  td_mode: string;
  max_concurrent: number;
  max_daily_trades: number;
  daily_loss_limit_usdt: number;
  execution_mode: string;
  enabled: boolean;
}

export default function TradingSettings({ lang = "en" }: Props) {
  const t = labels[lang];
  const [connected, setConnected] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [settings, setSettings] = useState<Settings>({
    strategies: [],
    coins: [],
    position_size_usdt: 100,
    leverage: 1,
    td_mode: "isolated",
    max_concurrent: 3,
    max_daily_trades: 20,
    daily_loss_limit_usdt: 200,
    execution_mode: "manual",
    enabled: false,
  });
  const [dailyStats, setDailyStats] = useState({
    trades_today: 0,
    pnl_today: 0,
  });

  useEffect(() => {
    // Check for admin key in localStorage or URL param
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("admin_key");
    if (urlKey) {
      localStorage.setItem("pruviq_admin_key", urlKey);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("admin_key");
      window.history.replaceState({}, "", url.toString());
    }
    const adminKey = localStorage.getItem("pruviq_admin_key") || "";

    fetch(`${API_BASE}/auth/okx/status`, {
      credentials: "include",
      headers: adminKey ? { "x-admin-key": adminKey } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setIsAdmin(d.admin || false);
        if (d.connected && d.admin) {
          return fetch(`${API_BASE}/settings/trading`, {
            credentials: "include",
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

  // Non-admin: Coming Soon
  if (!isAdmin) {
    const comingSoon =
      lang === "ko"
        ? {
            title: "자동매매 — 준비 중",
            desc: "전략 선택, 포지션 설정, 원클릭 자동 실행 기능이 곧 출시됩니다.",
            features: [
              "7개 검증 전략 자동 실행",
              "포지션 크기 + 레버리지 설정",
              "실시간 포지션 모니터링",
              "OAuth 보안 — API 키 불필요",
            ],
            notify: "출시 알림 받기",
          }
        : {
            title: "Auto-Trading — Coming Soon",
            desc: "Strategy selection, position configuration, and one-click auto-execution launching soon.",
            features: [
              "7 verified strategies auto-execution",
              "Position size + leverage config",
              "Real-time position monitoring",
              "OAuth security — no API keys",
            ],
            notify: "Get notified at launch",
          };
    return (
      <div class="card-enterprise rounded-xl p-8 text-center">
        <div class="w-16 h-16 rounded-2xl bg-[--color-accent]/10 flex items-center justify-center mx-auto mb-4">
          <svg
            class="w-8 h-8 text-[--color-accent]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h3 class="text-xl font-bold mb-2">{comingSoon.title}</h3>
        <p class="text-sm text-[--color-text-muted] mb-4">{comingSoon.desc}</p>
        <ul class="space-y-2 mb-6 text-left max-w-xs mx-auto">
          {comingSoon.features.map((f) => (
            <li class="flex items-center gap-2 text-sm text-[--color-text-secondary]">
              <svg
                class="w-4 h-4 text-[--color-up] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        <a
          href="https://t.me/PRUVIQ"
          target="_blank"
          rel="noopener"
          class="btn btn-primary btn-md"
        >
          {comingSoon.notify} →
        </a>
      </div>
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

      {/* Master switch */}
      <div class="card-enterprise rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 class="font-bold">{t.masterSwitch}</h3>
          <p class="text-xs text-[--color-text-muted]">{t.executionMode}</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
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

      {/* Execution mode */}
      <div class="card-enterprise rounded-xl p-5">
        <h3 class="font-bold mb-3">{t.executionMode}</h3>
        <div class="space-y-2">
          {(["manual", "alert", "auto"] as const).map((mode) => (
            <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-[--color-bg]/50 cursor-pointer">
              <input
                type="radio"
                name="execution_mode"
                checked={settings.execution_mode === mode}
                onChange={() =>
                  setSettings((s) => ({ ...s, execution_mode: mode }))
                }
                class="accent-[--color-accent]"
              />
              <span class="text-sm">{t.modes[mode]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Strategies */}
      <div class="card-enterprise rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-bold">{t.strategies}</h3>
            <p class="text-xs text-[--color-text-muted]">{t.strategiesDesc}</p>
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          {STRATEGIES.map((s) => (
            <label
              class={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${
                settings.strategies.includes(s.id)
                  ? "border-[--color-accent]/40 bg-[--color-accent]/5"
                  : "border-transparent"
              }`}
            >
              <input
                type="checkbox"
                checked={settings.strategies.includes(s.id)}
                onChange={() => toggleStrategy(s.id)}
                class="accent-[--color-accent]"
              />
              <span class="text-sm">{s.name}</span>
              <span class="text-[10px] font-mono text-[--color-up] bg-[--color-up]/10 px-1.5 rounded">
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
        <div class="flex flex-wrap gap-2">
          {TOP_COINS.map((coin) => (
            <button
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

      {/* Position settings */}
      <div class="card-enterprise rounded-xl p-5 space-y-4">
        <div>
          <label class="font-bold text-sm block mb-1">{t.positionSize}</label>
          <p class="text-xs text-[--color-text-muted] mb-2">
            {t.positionSizeDesc}
          </p>
          <input
            type="number"
            min={10}
            max={500}
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

        <div>
          <label class="font-bold text-sm block mb-1">{t.leverage}</label>
          <p class="text-xs text-[--color-text-muted] mb-2">{t.leverageDesc}</p>
          <div class="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              value={settings.leverage}
              onInput={(e) =>
                setSettings((s) => ({
                  ...s,
                  leverage: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="flex-1 accent-[--color-accent]"
            />
            <span class="font-mono font-bold text-lg w-12 text-right">
              {settings.leverage}x
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="font-bold text-sm block mb-1">{t.maxPositions}</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.max_concurrent}
              onInput={(e) =>
                setSettings((s) => ({
                  ...s,
                  max_concurrent: Number((e.target as HTMLInputElement).value),
                }))
              }
              class="w-full p-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm font-mono"
            />
          </div>
          <div>
            <label class="font-bold text-sm block mb-1">{t.maxTrades}</label>
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
