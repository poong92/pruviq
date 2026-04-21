// 3-mode pill switcher (Quick / Standard / Expert).
// Phase 1 ships Quick fully; Standard/Expert show "Coming soon" tooltip
// and link hint but don't enable to stay within scope.

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
        const comingSoon = m !== "quick";
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(m)}
            data-testid={`sim-v1-skill-${m}`}
            disabled={comingSoon}
            title={
              comingSoon
                ? lang === "ko"
                  ? "준비 중"
                  : "Coming soon"
                : undefined
            }
            class={`relative min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
                : comingSoon
                  ? "cursor-not-allowed text-zinc-500"
                  : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {lang === "ko" ? meta.label.ko : meta.label.en}
            {comingSoon && (
              <span class="ml-1.5 align-middle text-[10px] text-zinc-500">
                ·soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
