// Design tokens for /simulate redesign (Phase 1).
//
// Purpose: single source of truth for risk colors, skill modes, and layout
// constants used across the new simulator UI. Keeping them here (not in
// global.css) makes them typed, tree-shakeable, and referenceable from
// TypeScript components (e.g. inline SVG fill colors).
//
// Boundaries:
// - Do not add component-specific styling here. Tokens only.
// - Do not reference from existing (legacy) simulator code. This file
//   powers the new components; legacy code keeps its own styling untouched.
// - Tailwind utility strings are allowed for convenience so components can
//   spread them directly (className={RISK_TOKENS[risk].badge}).

import type { PresetRisk } from "./simulator-presets";

export type SimulatorSkillMode = "quick" | "standard" | "expert";

export const SIMULATOR_SKILL_MODES: readonly SimulatorSkillMode[] = [
  "quick",
  "standard",
  "expert",
] as const;

export const DEFAULT_SKILL_MODE: SimulatorSkillMode = "quick";

export interface RiskToken {
  label: { en: string; ko: string };
  hex: string;
  badge: string;
  ring: string;
  dot: string;
}

export const RISK_TOKENS: Record<PresetRisk, RiskToken> = {
  low: {
    label: { en: "Low risk", ko: "저위험" },
    hex: "#10b981",
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    ring: "ring-1 ring-emerald-500/40",
    dot: "bg-emerald-500",
  },
  medium: {
    label: { en: "Medium risk", ko: "중위험" },
    hex: "#f59e0b",
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    ring: "ring-1 ring-amber-500/40",
    dot: "bg-amber-500",
  },
  high: {
    label: { en: "High risk", ko: "고위험" },
    hex: "#ef4444",
    badge: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    ring: "ring-1 ring-rose-500/40",
    dot: "bg-rose-500",
  },
};

export interface DirectionToken {
  label: { en: string; ko: string };
  arrow: "↑" | "↓" | "↕";
  hex: string;
}

export const DIRECTION_TOKENS = {
  long: {
    label: { en: "Long", ko: "롱" },
    arrow: "↑",
    hex: "#10b981",
  },
  short: {
    label: { en: "Short", ko: "숏" },
    arrow: "↓",
    hex: "#ef4444",
  },
  both: {
    label: { en: "Long/Short", ko: "롱/숏" },
    arrow: "↕",
    hex: "#a78bfa",
  },
} as const satisfies Record<"long" | "short" | "both", DirectionToken>;

// Layout constants shared across simulator components.
// Breakpoints align with Tailwind defaults so utility classes stay consistent.
export const SIM_LAYOUT = {
  cardMinHeight: 168,
  cardGap: 16,
  touchTargetMin: 44,
  maxContentWidth: 1280,
} as const;

// Skill-mode copy lives here so components don't duplicate strings.
// Full i18n keys still live in src/i18n; this is a tight fallback set
// used in ephemeral UI (skill switcher tooltips, ARIA labels) where
// spinning up an i18n key is overkill.
export const SKILL_MODE_META: Record<
  SimulatorSkillMode,
  { label: { en: string; ko: string }; summary: { en: string; ko: string } }
> = {
  quick: {
    label: { en: "Quick Start", ko: "퀵 스타트" },
    summary: {
      en: "Pick a preset, see proof. No setup.",
      ko: "프리셋 선택만으로 결과 확인. 설정 불필요.",
    },
  },
  standard: {
    label: { en: "Standard", ko: "스탠다드" },
    summary: {
      en: "Tune risk, date range, coins.",
      ko: "리스크·기간·코인 조정 가능.",
    },
  },
  expert: {
    label: { en: "Expert Builder", ko: "엑스퍼트 빌더" },
    summary: {
      en: "Full condition builder — indicators and logic.",
      ko: "전체 조건 빌더 — 지표·로직 직접 구성.",
    },
  },
};
