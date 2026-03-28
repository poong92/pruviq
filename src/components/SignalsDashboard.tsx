import { useState, useEffect, useCallback } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Signal {
  strategy: string;
  strategy_name: string;
  coin: string;
  direction: "long" | "short";
  signal_time: string;
  entry_price: number;
  status: string;
  sl_pct: number;
  tp_pct: number;
}

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    active: "Active",
    verified: "Verified",
    short: "Short",
    long: "Long",
    warming_up: "Signal scanner is warming up...",
    check_back: "Check back in a few minutes.",
    signal: "signal",
    signals: "signals",
    no_signals: "No {filter} signals right now.",
    signals_update: "Signals update every hour at candle close.",
    updated: "Updated {time} · Refreshes every 5 min",
    loading: "loading...",
    disclaimer: "Signals are based on completed 1H candles. Not financial advice.",
    verify: "Verify →",
    just_now: "just now",
    hours_ago: "{n}h ago",
  },
  ko: {
    active: "활성",
    verified: "검증됨",
    short: "숏",
    long: "롱",
    warming_up: "시그널 스캐너 준비 중...",
    check_back: "잠시 후 다시 확인하세요.",
    signal: "시그널",
    signals: "시그널",
    no_signals: "현재 {filter} 시그널이 없습니다.",
    signals_update: "시그널은 매시간 캔들 마감 시 업데이트됩니다.",
    updated: "업데이트 {time} · 5분마다 갱신",
    loading: "로딩 중...",
    disclaimer: "시그널은 완성된 1시간 캔들 기반입니다. 투자 조언이 아닙니다.",
    verify: "검증 →",
    just_now: "방금",
    hours_ago: "{n}시간 전",
  },
} as const;

export default function SignalsDashboard({ lang = "en" }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "short" | "long">(
    "all",
  );
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/signals/live?top_n=30`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: Signal[] = await res.json();
      setSignals(data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError(lang === "ko" ? "시그널 데이터 사용 불가" : "Signal data unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 5 * 60 * 1000); // 5min refresh
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const filtered = signals.filter((s) => {
    if (filter === "verified") return s.status === "verified";
    if (filter === "short") return s.direction === "short";
    if (filter === "long") return s.direction === "long";
    return true;
  });

  const verifiedCount = signals.filter((s) => s.status === "verified").length;
  const shortCount = signals.filter((s) => s.direction === "short").length;
  const longCount = signals.filter((s) => s.direction === "long").length;

  // Group by strategy
  const byStrategy: Record<string, Signal[]> = {};
  for (const s of filtered) {
    if (!byStrategy[s.strategy_name]) byStrategy[s.strategy_name] = [];
    byStrategy[s.strategy_name].push(s);
  }

  const t = i18n[lang];
  const prefix = lang === "ko" ? "/ko" : "";

  function timeAgo(isoString: string): string {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return t.just_now;
      return t.hours_ago.replace("{n}", String(hours));
    } catch {
      return "";
    }
  }

  function buildSimUrl(s: Signal): string {
    const strategy = s.strategy;
    const coin = s.coin.replace("USDT", "/USDT:USDT");
    return `${prefix}/simulate?strategy=${strategy}&coin=${coin}&direction=${s.direction}`;
  }

  if (loading) {
    return (
      <div class="space-y-4 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            class="h-20 rounded-lg bg-[--color-bg-card] border border-[--color-border]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div class="text-center py-16 text-[--color-text-muted]">
        <p class="text-lg mb-2">{t.warming_up}</p>
        <p class="text-sm">{t.check_back}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div class="grid grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          class={`text-center p-3 rounded-lg border transition-colors cursor-pointer ${
            filter === "all"
              ? "border-[--color-accent] bg-[--color-accent]/10"
              : "border-[--color-border] bg-[--color-bg-card]"
          }`}
        >
          <p class="text-2xl font-bold font-mono">{signals.length}</p>
          <p class="text-xs text-[--color-text-muted]">{t.active}</p>
        </button>
        <button
          onClick={() => setFilter("verified")}
          aria-pressed={filter === "verified"}
          class={`text-center p-3 rounded-lg border transition-colors cursor-pointer ${
            filter === "verified"
              ? "border-green-500 bg-green-500/10"
              : "border-[--color-border] bg-[--color-bg-card]"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-green-400">
            {verifiedCount}
          </p>
          <p class="text-xs text-[--color-text-muted]">{t.verified}</p>
        </button>
        <button
          onClick={() => setFilter("short")}
          aria-pressed={filter === "short"}
          class={`text-center p-3 rounded-lg border transition-colors cursor-pointer ${
            filter === "short"
              ? "border-red-500 bg-red-500/10"
              : "border-[--color-border] bg-[--color-bg-card]"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-red-400">{shortCount}</p>
          <p class="text-xs text-[--color-text-muted]">{t.short}</p>
        </button>
        <button
          onClick={() => setFilter("long")}
          aria-pressed={filter === "long"}
          class={`text-center p-3 rounded-lg border transition-colors cursor-pointer ${
            filter === "long"
              ? "border-blue-500 bg-blue-500/10"
              : "border-[--color-border] bg-[--color-bg-card]"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-blue-400">{longCount}</p>
          <p class="text-xs text-[--color-text-muted]">{t.long}</p>
        </button>
      </div>

      {/* Signal list grouped by strategy */}
      <div class="space-y-6">
        {Object.entries(byStrategy).map(([strategyName, sigs]) => (
          <div key={strategyName}>
            <div class="flex items-center gap-2 mb-3">
              <h3 class="font-mono text-sm font-bold text-[--color-text-secondary]">
                {strategyName}
              </h3>
              <span class="text-xs bg-[--color-bg-card] border border-[--color-border] px-2 py-0.5 rounded font-mono">
                {sigs.length} {sigs.length > 1 ? t.signals : t.signal}
              </span>
              {sigs[0]?.status === "verified" && (
                <span class="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                  {t.verified.toLowerCase()}
                </span>
              )}
            </div>
            <div class="grid gap-2">
              {sigs.map((s, i) => (
                <div
                  key={`${s.strategy}-${s.coin}-${i}`}
                  class="flex items-center justify-between p-4 rounded-lg border border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent]/30 transition-colors group"
                >
                  <div class="flex items-center gap-4">
                    <span
                      class={`text-xs font-mono font-bold px-2 py-1 rounded ${
                        s.direction === "short"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {s.direction.toUpperCase()}
                    </span>
                    <div>
                      <p class="font-semibold">{s.coin}</p>
                      <p class="text-xs text-[--color-text-muted]">
                        Entry $
                        {s.entry_price < 1
                          ? s.entry_price.toFixed(6)
                          : s.entry_price.toFixed(2)}
                        {" · "}SL {s.sl_pct}% / TP {s.tp_pct}%
                        {s.signal_time && ` · ${timeAgo(s.signal_time)}`}
                      </p>
                    </div>
                  </div>
                  <a
                    href={buildSimUrl(s)}
                    class="text-xs font-mono text-[--color-accent] opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                  >
                    {t.verify}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div class="text-center py-12 text-[--color-text-muted]">
          <p>{t.no_signals.replace("{filter}", filter !== "all" ? filter : "")}</p>
          <p class="text-sm mt-1">{t.signals_update}</p>
        </div>
      )}

      {/* Footer */}
      <div class="mt-8 pt-4 border-t border-[--color-border] flex items-center justify-between text-xs text-[--color-text-muted]">
        <p>{t.updated.replace("{time}", lastUpdate || t.loading)}</p>
        <p>{t.disclaimer}</p>
      </div>
    </div>
  );
}
