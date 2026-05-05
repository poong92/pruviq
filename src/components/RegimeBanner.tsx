import { useEffect, useState } from "preact/hooks";

interface RegimeStrategy {
  id: string;
  name_en: string;
  name_ko: string;
  direction: string;
  timeframe: string;
  sl_pct: number;
  tp_pct: number;
  profit_factor: number;
  simulate_url_en: string;
  simulate_url_ko: string;
}

interface RegimeData {
  regime: string;
  regime_label_en: string;
  regime_label_ko: string;
  fng_index: number;
  fng_label: string;
  description_en: string;
  description_ko: string;
  recommended: RegimeStrategy[];
}

const REGIME_COLORS: Record<string, string> = {
  extreme_fear: "#ef4444",
  fear: "#f97316",
  neutral: "#eab308",
  greed: "#22c55e",
  extreme_greed: "#a855f7",
};

const FNG_BAR_WIDTH = (fng: number) => `${fng}%`;

export default function RegimeBanner({
  lang = "en",
  apiBase = "https://api.pruviq.com",
}: {
  lang?: string;
  apiBase?: string;
}) {
  const [data, setData] = useState<RegimeData | null>(null);
  const [error, setError] = useState(false);

  const isKo = lang === "ko";

  useEffect(() => {
    fetch(`${apiBase}/regime`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error || !data) return null;

  const color = REGIME_COLORS[data.regime] || "#eab308";
  const label = isKo ? data.regime_label_ko : data.regime_label_en;
  const desc = isKo ? data.description_ko : data.description_en;

  return (
    <div
      class="mb-8 rounded-xl border"
      style={`border-color: ${color}33; background: ${color}08`}
    >
      <div class="px-4 pt-4 pb-3">
        {/* Header row */}
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span
              class="font-mono text-[10px] uppercase tracking-widest"
              style={`color: ${color}`}
            >
              {isKo ? "시장 레짐" : "Market Regime"}
            </span>
            <span
              class="font-mono text-xs font-bold px-2 py-0.5 rounded"
              style={`color: ${color}; background: ${color}18`}
            >
              {label}
            </span>
          </div>
          <span class="font-mono text-xs" style={`color: ${color}`}>
            F&G <span class="font-bold">{data.fng_index}</span>
          </span>
        </div>

        {/* FnG progress bar */}
        <div
          class="h-1.5 rounded-full mb-3"
          style="background: var(--color-border)"
        >
          <div
            class="h-1.5 rounded-full transition-all duration-700"
            style={`width: ${FNG_BAR_WIDTH(data.fng_index)}; background: ${color}`}
          />
        </div>

        <p class="text-xs text-(--color-text-muted) mb-3 leading-relaxed">
          {desc}
        </p>

        {/* Recommended strategies */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.recommended.map((s) => {
            const name = isKo ? s.name_ko : s.name_en;
            const url = isKo ? s.simulate_url_ko : s.simulate_url_en;
            return (
              <a
                key={`${s.id}-${s.timeframe}`}
                href={url}
                class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-(--color-border) bg-(--color-bg-elevated) hover:border-[var(--regime-color)] transition-colors group"
                style={`--regime-color: ${color}`}
              >
                <div class="min-w-0">
                  <p class="text-xs font-semibold font-mono text-(--color-text) truncate group-hover:text-[var(--regime-color)] transition-colors">
                    {name}
                  </p>
                  <p class="text-[10px] font-mono text-(--color-text-muted)">
                    {s.timeframe} · SL{s.sl_pct}% / TP{s.tp_pct}% · PF{" "}
                    {s.profit_factor.toFixed(2)}
                  </p>
                </div>
                <span
                  class="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
                  style={`color: ${color}; background: ${color}18`}
                >
                  {isKo ? "시뮬" : "Sim"} →
                </span>
              </a>
            );
          })}
        </div>
      </div>
      <div class="px-4 py-2 border-t" style={`border-color: ${color}22`}>
        <p class="text-[10px] font-mono text-(--color-text-muted)">
          {isKo
            ? `Fear & Greed ${data.fng_index} (${data.fng_label}) 기반 · 검증된 전략만 표시 · 투자 조언 아님`
            : `Based on Fear & Greed ${data.fng_index} (${data.fng_label}) · Verified strategies only · Not investment advice`}
        </p>
      </div>
    </div>
  );
}
