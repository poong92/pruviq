/**
 * StandardPanel.tsx — Standard mode (Your Parameters)
 *
 * Simplified builder: preset selection + key parameter sliders.
 * No condition rows or indicator toggle — just the essentials.
 *
 * Accessible params (6-expert consensus):
 *  - Preset strategy selector
 *  - SL: 5-20% slider
 *  - TP: 3-15% slider
 *  - Leverage: 1/3/5x dropdown
 *  - Coins: All / Top 100 / Top 50
 *  - Test period: 3-24 months
 *  - Direction: SHORT / LONG
 */

import { COLORS } from "./simulator-types";
import type { PresetItem } from "./simulator-types";

interface Props {
  lang: "en" | "ko";
  // Presets
  presets: PresetItem[];
  activePreset: string | null;
  onSelectPreset: (id: string | null) => void;
  presetLoading: boolean;
  // Params
  direction: "short" | "long" | "both";
  setDirection: (d: "short" | "long" | "both") => void;
  slPct: number;
  setSlPct: (v: number) => void;
  tpPct: number;
  setTpPct: (v: number) => void;
  leverage: number;
  setLeverage: (v: number) => void;
  coinMode: "all" | "top" | "select";
  setCoinMode: (v: "all" | "top" | "select") => void;
  topN: number;
  setTopN: (v: number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  // Run
  isRunning: boolean;
  onRun: () => void;
  coinsLoaded: number;
}

const L = {
  en: {
    strategy: "Strategy",
    params: "Parameters",
    direction: "Direction",
    short: "SHORT",
    long: "LONG",
    sl: "Stop Loss",
    tp: "Take Profit",
    leverage: "Leverage",
    coins: "Coins",
    all: "All",
    period: "Test Period",
    months: "months",
    run: "Run Backtest",
    running: "Running...",
    runOn: "Simulate on {n} Coins",
    custom: "Custom",
  },
  ko: {
    strategy: "전략",
    params: "파라미터",
    direction: "방향",
    short: "숏 (하락)",
    long: "롱 (상승)",
    sl: "손절",
    tp: "익절",
    leverage: "레버리지",
    coins: "코인",
    all: "전체",
    period: "테스트 기간",
    months: "개월",
    run: "백테스트 실행",
    running: "실행 중...",
    runOn: "{n}개 코인으로 시뮬레이션",
    custom: "커스텀",
  },
};

const LEVERAGE_OPTIONS = [1, 3, 5];

const COIN_OPTIONS = [
  { value: "all", labelKey: "all" },
  { value: "top", topN: 100, label: "Top 100" },
  { value: "top", topN: 50, label: "Top 50" },
];

function getMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export default function StandardPanel({
  lang,
  presets,
  activePreset,
  onSelectPreset,
  presetLoading,
  direction,
  setDirection,
  slPct,
  setSlPct,
  tpPct,
  setTpPct,
  leverage,
  setLeverage,
  coinMode,
  setCoinMode,
  topN,
  setTopN,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRunning,
  onRun,
  coinsLoaded,
}: Props) {
  const t = L[lang] || L.en;

  // Calculate current coin count
  const currentCoinCount = coinMode === "all" ? coinsLoaded : topN;

  // Derive period months from startDate
  const now = new Date();
  const start = new Date(startDate);
  const diffMonths = Math.max(
    1,
    Math.round((now.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  );

  const handlePeriodChange = (months: number) => {
    setStartDate(getMonthsAgo(months));
    setEndDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div class="mb-3 border border-[--color-border] rounded-lg overflow-hidden">
      {/* Strategy Selector */}
      <div
        class="px-4 py-3 border-b border-[--color-border]"
        style={{
          background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)`,
        }}
      >
        <div
          class="text-xs font-mono uppercase mb-2 flex items-center gap-1.5"
          style={{ color: COLORS.accent }}
        >
          {t.strategy}
          {presetLoading && (
            <span class="spinner" style={{ width: "10px", height: "10px" }} />
          )}
        </div>
        <div class="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPreset(p.id)}
              class={`px-3 py-1.5 text-xs font-mono rounded-md transition-all border
                ${activePreset === p.id ? "font-bold" : "text-[--color-text-muted] border-[--color-border] hover:border-[--color-accent]/30 hover:text-[--color-text]"}`}
              style={
                activePreset === p.id
                  ? {
                      background: COLORS.accent,
                      color: "#fff",
                      borderColor: COLORS.accent,
                      boxShadow: `0 0 8px ${COLORS.accentGlow}`,
                    }
                  : undefined
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div class="px-4 py-3 space-y-4">
        <div
          class="text-xs font-mono uppercase"
          style={{ color: COLORS.accent }}
        >
          {t.params}
        </div>

        {/* Direction */}
        <div>
          <label class="text-[11px] text-[--color-text-muted] font-mono mb-1 block">
            {t.direction}
          </label>
          <div class="flex gap-1.5">
            {(["short", "long", "both"] as const).map((d) => (
              <button
                key={d}
                data-testid={`std-dir-${d}`}
                onClick={() => setDirection(d)}
                class={`flex-1 py-2 rounded-md text-xs font-mono font-bold transition-all border
                  ${direction === d ? "" : "text-[--color-text-muted] border-[--color-border] hover:text-[--color-text]"}`}
                style={
                  direction === d
                    ? d === "both"
                      ? {
                          background:
                            "linear-gradient(90deg, rgba(239,68,68,0.15), rgba(0,255,136,0.15))",
                          borderColor: "#888",
                          color: "#fff",
                        }
                      : {
                          background:
                            d === "short" ? COLORS.redBg : COLORS.greenBg,
                          color: d === "short" ? COLORS.red : COLORS.green,
                          borderColor:
                            d === "short" ? COLORS.red : COLORS.green,
                        }
                    : undefined
                }
              >
                {d === "short" ? t.short : d === "long" ? t.long : "BOTH"}
              </button>
            ))}
          </div>
        </div>

        {/* SL Slider */}
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="text-[11px] text-[--color-text-muted] font-mono">
              {t.sl}
            </label>
            <span
              class="text-xs font-mono font-bold"
              style={{ color: COLORS.red }}
            >
              {slPct}%
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="20"
            step="1"
            value={slPct}
            onInput={(e) =>
              setSlPct(Number((e.target as HTMLInputElement).value))
            }
            class="w-full accent-[#f04251] h-1.5"
          />
          <div class="flex justify-between text-[9px] text-[--color-text-muted] mt-0.5">
            <span>3%</span>
            <span>10%</span>
            <span>20%</span>
          </div>
        </div>

        {/* TP Slider */}
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="text-[11px] text-[--color-text-muted] font-mono">
              {t.tp}
            </label>
            <span
              class="text-xs font-mono font-bold"
              style={{ color: COLORS.green }}
            >
              {tpPct}%
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="15"
            step="1"
            value={tpPct}
            onInput={(e) =>
              setTpPct(Number((e.target as HTMLInputElement).value))
            }
            class="w-full accent-[#00c073] h-1.5"
          />
          <div class="flex justify-between text-[9px] text-[--color-text-muted] mt-0.5">
            <span>2%</span>
            <span>8%</span>
            <span>15%</span>
          </div>
        </div>

        {/* Leverage */}
        <div>
          <label class="text-[11px] text-[--color-text-muted] font-mono mb-1 block">
            {t.leverage}
          </label>
          <div class="flex gap-1.5">
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                class={`flex-1 py-2 rounded-md text-xs font-mono font-bold transition-all border
                  ${leverage === lev ? "" : "text-[--color-text-muted] border-[--color-border] hover:text-[--color-text]"}`}
                style={
                  leverage === lev
                    ? {
                        background: COLORS.accentBg,
                        color: COLORS.accent,
                        borderColor: COLORS.accent,
                      }
                    : undefined
                }
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* Coins */}
        <div>
          <label class="text-[11px] text-[--color-text-muted] font-mono mb-1 block">
            {t.coins}
          </label>
          <div class="flex gap-1.5">
            {COIN_OPTIONS.map((opt, i) => {
              const isActive =
                opt.value === "all"
                  ? coinMode === "all"
                  : coinMode === "top" && topN === opt.topN;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (opt.value === "all") {
                      setCoinMode("all");
                    } else {
                      setCoinMode("top");
                      setTopN(opt.topN!);
                    }
                  }}
                  class={`flex-1 py-2 rounded-md text-xs font-mono font-bold transition-all border
                    ${isActive ? "" : "text-[--color-text-muted] border-[--color-border] hover:text-[--color-text]"}`}
                  style={
                    isActive
                      ? {
                          background: COLORS.accentBg,
                          color: COLORS.accent,
                          borderColor: COLORS.accent,
                        }
                      : undefined
                  }
                >
                  {opt.value === "all"
                    ? `${t.all} (${coinsLoaded})`
                    : opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Period */}
        <div>
          <label class="text-[11px] text-[--color-text-muted] font-mono mb-1 block">
            {t.period}:{" "}
            <span class="font-bold text-[--color-text]">
              {diffMonths} {t.months}
            </span>
          </label>
          <input
            type="range"
            min="3"
            max="24"
            step="3"
            value={diffMonths}
            onInput={(e) =>
              handlePeriodChange(Number((e.target as HTMLInputElement).value))
            }
            class="w-full h-1.5"
          />
          <div class="flex justify-between text-[9px] text-[--color-text-muted] mt-0.5">
            <span>3</span>
            <span>12</span>
            <span>24</span>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <div class="px-4 py-3 border-t border-[--color-border]">
        <button
          data-testid="run-simulate"
          onClick={onRun}
          disabled={isRunning}
          class={`w-full py-3 rounded-lg font-mono text-sm font-bold transition-all
            ${isRunning ? "cursor-not-allowed opacity-60" : "hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"}`}
          style={
            isRunning
              ? { background: COLORS.disabled, color: COLORS.disabledText }
              : {
                  background: COLORS.accent,
                  color: "#fff",
                  boxShadow: `0 0 12px ${COLORS.accentGlow}`,
                }
          }
        >
          {isRunning
            ? t.running
            : currentCoinCount > 0
              ? t.runOn?.replace("{n}", String(currentCoinCount)) || t.run
              : t.run}
        </button>
      </div>
    </div>
  );
}
