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
}

export default function SkillSwitcher({ mode, lang, onChange }: Props) {
  const t = useTranslations(lang);
  const builderHref = getLocalizedPath("/simulate/builder/", lang);

  return (
    <div
      role="tablist"
      aria-label={t("simV2.skill.label")}
      class="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1"
      data-testid="sim-v1-skill-switcher"
    >
      {SIMULATOR_SKILL_MODES.map((m) => {
        const meta = SKILL_MODE_META[m];
        const active = mode === m;
        const baseClass = `relative min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition ${
          active
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
            : "text-zinc-300 hover:bg-zinc-800"
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
              <span aria-hidden="true" class="text-xs text-zinc-500">
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
  );
}
