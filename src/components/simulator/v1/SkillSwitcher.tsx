// 3-mode pill switcher (Quick / Standard / Expert).
// Phase 3: Quick + Standard are tabs on this page; Expert is a link to
// /simulate/builder/ (a separate route with indicator-level control).

import { getLocalizedPath } from "../../../i18n/index";
import {
  SIMULATOR_SKILL_MODES,
  SKILL_MODE_META,
  type SimulatorSkillMode,
} from "../../../config/simulator-tokens";
import { useTranslations, type Lang } from "../../../i18n/index";

interface Props {
  mode: SimulatorSkillMode;
  lang: Lang;
  onChange: (mode: SimulatorSkillMode) => void;
  // Current sim state to pass through to Expert builder, so users don't
  // lose their preset / SL / TP when clicking Expert ↗. Without this,
  // the previous design dropped the user back to the builder home page
  // blank. (2026-04-22)
  expertQuery?: string;
}

// Copy per mode — keeps the subtext colocated with the meta so we don't
// invent a second source of truth.
const MODE_SUBTEXT: Record<SimulatorSkillMode, { en: string; ko: string }> = {
  quick: {
    en: "Click a preset — run with verified defaults.",
    ko: "프리셋 클릭 — 검증 기본값으로 실행.",
  },
  standard: {
    en: "Adjust SL · TP · Top N · dates.",
    ko: "SL · TP · 상위 N · 기간 조정.",
  },
  expert: {
    en: "Full indicator + condition control ↗",
    ko: "지표 · 조건 수준 제어 ↗",
  },
};

export default function SkillSwitcher({
  mode,
  lang,
  onChange,
  expertQuery,
}: Props) {
  const t = useTranslations(lang);
  const builderBase = getLocalizedPath("/simulate/builder/", lang);
  const builderHref = expertQuery
    ? `${builderBase}?${expertQuery}`
    : builderBase;

  return (
    <div class="flex flex-col gap-1">
      <div
        role="tablist"
        aria-label={t("simV2.skill.label")}
        class="inline-flex rounded-lg border border-(--color-border) bg-(--color-bg-card)/60 p-1"
        data-testid="sim-v1-skill-switcher"
      >
        {SIMULATOR_SKILL_MODES.map((m) => {
          const meta = SKILL_MODE_META[m];
          const active = mode === m;
          const baseClass = `relative min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition ${
            active
              ? "bg-[--color-accent]/15 text-[--color-accent-bright] ring-1 ring-[--color-accent]/40"
              : "text-(--color-text-secondary) hover:bg-(--color-bg-elevated)"
          }`;
          const label = lang === "ko" ? meta.label.ko : meta.label.en;

          if (m === "expert") {
            return (
              <a
                key={m}
                href={builderHref}
                role="tab"
                aria-selected={false}
                data-testid={`sim-v1-skill-${m}`}
                class={`${baseClass} inline-flex items-center gap-1`}
              >
                {label}
                <span aria-hidden="true" class="text-xs text-(--color-text-muted)">
                  ↗
                </span>
              </a>
            );
          }
          return (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(m)}
              data-testid={`sim-v1-skill-${m}`}
              class={baseClass}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* 2026-04-22: one-line subtext for the active mode so users understand
          what clicking does. Previously Quick vs Standard toggle had zero
          explanation. */}
      <p class="px-1 text-[11px] leading-snug text-(--color-text-tertiary)">
        {lang === "ko" ? MODE_SUBTEXT[mode].ko : MODE_SUBTEXT[mode].en}
      </p>
    </div>
  );
}
