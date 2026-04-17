import { useState, useEffect, useCallback } from "preact/hooks";
import { API_BASE_URL } from "../config/api";
import { COINS_ANALYZED } from "../config/site-stats";

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
    disclaimer:
      "Signals are based on completed 1H candles. Not financial advice.",
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
      setError(
        lang === "ko" ? "시그널 데이터 사용 불가" : "Signal data unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

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
    return `${prefix}/simulate?strategy=${s.strategy}&symbol=${s.coin}&dir=${s.direction}&sl=${s.sl_pct}&tp=${s.tp_pct}`;
  }

  if (loading) {
    return (
      <div class="py-8">
        <div class="flex flex-col items-center gap-4 mb-8">
          <div class="flex gap-1.5">
            <span
              class="w-2 h-2 rounded-full bg-[--color-accent] animate-pulse"
              style={{ animationDelay: "0s" }}
            ></span>
            <span
              class="w-2 h-2 rounded-full bg-[--color-accent] animate-pulse"
              style={{ animationDelay: "0.2s" }}
            ></span>
            <span
              class="w-2 h-2 rounded-full bg-[--color-accent] animate-pulse"
              style={{ animationDelay: "0.4s" }}
            ></span>
          </div>
          <div class="text-center">
            <p class="text-base font-semibold mb-1">
              {lang === "ko" ? "시그널 스캔 중" : "Scanning Signals"}
            </p>
            <p class="text-sm text-[--color-text-muted]">
              {lang === "ko" ? (
                <>
                  전략 조건을{" "}
                  <span class="font-mono text-[--color-accent]">
                    {COINS_ANALYZED}
                  </span>
                  개 코인에서 분석 중...
                </>
              ) : (
                <>
                  Analyzing strategy conditions across{" "}
                  <span class="font-mono text-[--color-accent]">
                    {COINS_ANALYZED}
                  </span>{" "}
                  coins...
                </>
              )}
            </p>
          </div>
        </div>
        <div class="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              class="flex items-center justify-between p-4 rounded-lg border border-[--color-border]"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-bg-card) 25%, var(--color-bg-elevated) 50%, var(--color-bg-card) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            >
              <div class="flex items-center gap-4">
                <div class="w-12 h-6 rounded bg-[--color-bg-elevated]"></div>
                <div>
                  <div class="w-24 h-4 rounded bg-[--color-bg-elevated] mb-1"></div>
                  <div class="w-40 h-3 rounded bg-[--color-bg-elevated]"></div>
                </div>
              </div>
              <div class="w-16 h-4 rounded bg-[--color-bg-elevated]"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="text-center py-16">
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-[--color-bg-card] border border-[--color-border] flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p class="text-lg font-semibold mb-2">{t.warming_up}</p>
        <p class="text-sm text-[--color-text-muted] mb-4">{t.check_back}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchSignals();
          }}
          class="text-sm font-mono text-[--color-accent] hover:underline cursor-pointer"
        >
          {lang === "ko" ? "다시 시도 →" : "Try again →"}
        </button>
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
          class={`text-center p-3 rounded-lg border transition-all cursor-pointer ${
            filter === "all"
              ? "border-[--color-accent] bg-[--color-accent]/10 shadow-[0_0_12px_rgba(var(--accent-rgb,99,102,241),0.3)]"
              : "border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent]/50"
          }`}
        >
          <p class="text-2xl font-bold font-mono">{signals.length}</p>
          <p class="text-xs text-[--color-text-muted]">{t.active}</p>
        </button>
        <button
          onClick={() => setFilter("verified")}
          aria-pressed={filter === "verified"}
          class={`text-center p-3 rounded-lg border transition-all cursor-pointer ${
            filter === "verified"
              ? "border-[--color-up] bg-[--color-up]/10 shadow-[0_0_12px_rgba(34,171,148,0.3)]"
              : "border-[--color-border] bg-[--color-bg-card] hover:border-[--color-up]/50"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-[--color-up]">
            {verifiedCount}
          </p>
          <p class="text-xs text-[--color-text-muted]">{t.verified}</p>
        </button>
        <button
          onClick={() => setFilter("short")}
          aria-pressed={filter === "short"}
          class={`text-center p-3 rounded-lg border transition-all cursor-pointer ${
            filter === "short"
              ? "border-[--color-down] bg-[--color-down]/10 shadow-[0_0_12px_rgba(242,54,69,0.3)]"
              : "border-[--color-border] bg-[--color-bg-card] hover:border-[--color-down]/50"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-[--color-down]">
            {shortCount}
          </p>
          <p class="text-xs text-[--color-text-muted]">{t.short}</p>
        </button>
        <button
          onClick={() => setFilter("long")}
          aria-pressed={filter === "long"}
          class={`text-center p-3 rounded-lg border transition-all cursor-pointer ${
            filter === "long"
              ? "border-[--color-accent] bg-[--color-accent]/10 shadow-[0_0_12px_rgba(79,142,247,0.3)]"
              : "border-[--color-border] bg-[--color-bg-card] hover:border-[--color-accent]/50"
          }`}
        >
          <p class="text-2xl font-bold font-mono text-[--color-accent]">
            {longCount}
          </p>
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
                <span class="text-[10px] bg-[--color-up]/20 text-[--color-up] px-1.5 py-0.5 rounded">
                  {t.verified.toLowerCase()}
                </span>
              )}
            </div>
            <div class="grid gap-2">
              {sigs.map((s, i) => (
                <div
                  key={`${s.strategy}-${s.coin}-${i}`}
                  class={`flex items-center justify-between p-4 rounded-lg border transition-colors group border-l-4 ${
                    s.status === "verified"
                      ? "border-l-[--color-up]"
                      : "border-l-[--color-border]"
                  } ${
                    s.direction === "long"
                      ? "border-[--color-accent]/20 bg-[--color-accent]/5 hover:border-[--color-accent]/40"
                      : "border-[--color-down]/20 bg-[--color-down]/5 hover:border-[--color-down]/40"
                  }`}
                >
                  <div class="flex items-center gap-4">
                    <span
                      class={`text-xs font-mono font-bold px-2 py-1 rounded ${
                        s.direction === "short"
                          ? "bg-[--color-down]/20 text-[--color-down]"
                          : "bg-[--color-accent]/20 text-[--color-accent]"
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
                    class="text-xs font-mono font-bold px-3 py-1.5 rounded border border-[--color-accent]/40 bg-[--color-accent]/10 text-[--color-accent] hover:bg-[--color-accent]/20 transition-colors"
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
          <p>
            {t.no_signals.replace("{filter}", filter !== "all" ? filter : "")}
          </p>
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
