/**
 * ModeSwitcher.tsx — 3-Tier Mode Selector (Quick Test / Standard / Expert)
 *
 * Design principles (from 6-expert consensus):
 * - Free switching: no locks, no progressive unlock
 * - "AI optimized" label makes Quick Test feel premium, not dumbed-down
 * - First visit: Quick Test default. Return visit: last used tab (localStorage)
 * - Subtle "advanced" label on Expert — aspirational, not intimidating
 *
 * Accessibility: ARIA tablist + arrow key navigation
 */

import { useRef } from "preact/hooks";
import { COLORS } from "./simulator-types";

export type SimMode = "quick" | "standard" | "expert";
export const SIM_MODE_KEY = "pruviq-sim-mode";
const VALID_MODES: SimMode[] = ["quick", "standard", "expert"];
export function isValidSimMode(v: string | null): v is SimMode {
  return VALID_MODES.includes(v as SimMode);
}

interface Props {
  mode: SimMode;
  setMode: (mode: SimMode) => void;
  lang: "en" | "ko";
  isFirstVisit?: boolean;
}

const L = {
  en: {
    quick: "Quick Test",
    quickSub: "AI optimized",
    standard: "Standard",
    standardSub: "Your parameters",
    expert: "Expert",
    expertSub: "Full control",
    bestStart: "Best Start",
    mostPopular: "Popular",
    advanced: "advanced",
    ariaLabel: "Simulator mode",
  },
  ko: {
    quick: "빠른 테스트",
    quickSub: "AI 최적화",
    standard: "스탠다드",
    standardSub: "내 파라미터",
    expert: "엑스퍼트",
    expertSub: "전체 제어",
    bestStart: "추천",
    mostPopular: "인기",
    advanced: "고급",
    ariaLabel: "시뮬레이터 모드",
  },
};

const ICONS: Record<SimMode, string> = {
  quick: "⚡",
  standard: "⚙",
  expert: "🔬",
};

export default function ModeSwitcher({
  mode,
  setMode,
  lang,
  isFirstVisit,
}: Props) {
  const t = L[lang] || L.en;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs: { key: SimMode; label: string; sub: string; badge?: string }[] = [
    {
      key: "quick",
      label: t.quick,
      sub: t.quickSub,
      badge: isFirstVisit ? t.bestStart : undefined,
    },
    {
      key: "standard",
      label: t.standard,
      sub: t.standardSub,
      badge: isFirstVisit ? undefined : t.mostPopular,
    },
    { key: "expert", label: t.expert, sub: t.expertSub },
  ];

  const handleKeyDown = (e: KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx + tabs.length - 1) % tabs.length;
    } else return;
    e.preventDefault();
    setMode(tabs[nextIdx].key);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t.ariaLabel}
      class="flex gap-1.5 mb-3 overflow-visible"
    >
      {tabs.map((tab, idx) => {
        const active = mode === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${tab.key}`}
            id={`tab-${tab.key}`}
            data-testid={`mode-${tab.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => setMode(tab.key)}
            onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, idx)}
            class={`relative flex-1 min-h-[44px] py-2.5 px-2 rounded-lg border transition-all text-center overflow-visible
              ${
                active
                  ? "border-[--color-accent]"
                  : "border-[--color-border] hover:border-[--color-text-muted]"
              }`}
            style={
              active
                ? {
                    background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)`,
                    boxShadow: `0 0 8px ${COLORS.accentGlow}`,
                  }
                : undefined
            }
          >
            {/* Badge */}
            {tab.badge && (
              <span
                aria-label={tab.badge}
                class="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap"
                style={{ background: COLORS.accent, color: "#fff" }}
              >
                <span aria-hidden="true">★ </span>
                {tab.badge}
              </span>
            )}

            {/* Icon + Label */}
            <div class="flex flex-col items-center gap-0.5">
              <span aria-hidden="true" class="text-base leading-none">
                {ICONS[tab.key]}
              </span>
              <span
                class={`font-mono text-xs font-bold ${active ? "" : "text-[--color-text-muted]"}`}
                style={active ? { color: COLORS.accent } : undefined}
              >
                {tab.label}
              </span>
              <span class="text-[11px] text-[--color-text-muted] leading-tight">
                {tab.sub}
              </span>
            </div>

            {/* Expert "advanced" label */}
            {tab.key === "expert" && !active && (
              <span
                aria-hidden="true"
                class="absolute top-0.5 right-1 text-[9px] opacity-70 font-mono whitespace-nowrap overflow-visible"
                style={{ color: COLORS.accentDim }}
              >
                {t.advanced}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
