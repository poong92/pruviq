// Phase 1 Quick Start orchestrator. Composes D7 leaf components over the
// D4 useSimConfig hook. Renders as a single page body (mounted from
// /simulate/v2/index.astro and /ko/simulate/v2/index.astro).
//
// Structure:
//   Hero (title + subtitle, 2 CTAs)
//   SkillSwitcher (Quick active; Standard/Expert "coming soon")
//   TrustGapPanel (Backtest vs Live summary)
//   PresetGrid (7 cards)
//   ResultsPanel (live /simulate fetch, metrics summary)
//   OKXConnectCTA (funnel to /dashboard)

import { useSimConfig } from "../../../hooks/useSimConfig";
import { useTranslations, type Lang } from "../../../i18n/index";
import OKXConnectCTA from "./OKXConnectCTA";
import PresetGrid from "./PresetGrid";
import ResultsPanel from "./ResultsPanel";
import SkillSwitcher from "./SkillSwitcher";
import TrustGapPanel from "./TrustGapPanel";

interface Props {
  lang: Lang;
}

export default function SimulatorV2({ lang }: Props) {
  const t = useTranslations(lang);
  const { config, setMode, setPreset } = useSimConfig();

  return (
    <div class="mx-auto max-w-6xl px-4 py-10" data-testid="sim-v2-root">
      <header class="mb-8 text-center">
        <h1
          class="mx-auto max-w-3xl text-balance text-3xl font-bold leading-tight text-zinc-100 sm:text-4xl md:text-5xl"
          data-testid="sim-v2-hero-title"
        >
          {t("simV2.hero.title")}
        </h1>
        <p class="mx-auto mt-3 max-w-2xl text-balance text-sm leading-relaxed text-zinc-400 sm:text-base">
          {t("simV2.hero.subtitle")}
        </p>
      </header>

      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SkillSwitcher mode={config.mode} lang={lang} onChange={setMode} />
        <div class="text-xs text-zinc-500">
          {lang === "ko"
            ? "URL이 저장됩니다 — 공유 가능"
            : "URL preserves state — shareable"}
        </div>
      </div>

      <div class="mb-8">
        <TrustGapPanel lang={lang} />
      </div>

      <div class="mb-8">
        <PresetGrid
          activePresetId={config.presetId}
          lang={lang}
          onSelect={setPreset}
        />
      </div>

      <div class="mb-8">
        <ResultsPanel config={config} lang={lang} />
      </div>

      <div class="mb-4">
        <OKXConnectCTA lang={lang} presetId={config.presetId} />
      </div>
    </div>
  );
}
