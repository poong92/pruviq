// Phase 1 + 2 orchestrator for /simulate. Composes leaf components over
// the useSimConfig hook.
//
// Structure:
//   Hero (title + subtitle)
//   SkillSwitcher (Quick / Standard live; Expert → /simulate/builder Phase 3)
//   TrustGapPanel (Backtest vs Live summary)
//   PresetGrid (7 cards, each with inline Entry Visualizer)
//   StandardControls (only when mode = "standard")
//   ResultsPanel (live /simulate fetch, metrics summary)
//   OKXConnectCTA (funnel to /dashboard)

import { useSimConfig } from "../../../hooks/useSimConfig";
import { useSimShortcuts } from "../../../hooks/useSimShortcuts";
import { useTranslations, type Lang } from "../../../i18n/index";
import MobileStickyCTA from "./MobileStickyCTA";
import OKXConnectCTA from "./OKXConnectCTA";
import PresetGrid from "./PresetGrid";
import ResultsPanel from "./ResultsPanel";
import SkillSwitcher from "./SkillSwitcher";
import StandardControls from "./StandardControls";
import TrustGapPanel from "./TrustGapPanel";

interface Props {
  lang: Lang;
}

export default function SimulatorV1({ lang }: Props) {
  const t = useTranslations(lang);
  const { config, setMode, setPreset, setSL, setTP, setStandard, reset } =
    useSimConfig();

  useSimShortcuts({
    currentPresetId: config.presetId,
    setPreset,
    setMode,
    reset,
  });

  return (
    <div class="mx-auto max-w-6xl px-4 py-8 sm:py-10" data-testid="sim-v1-root">
      <header class="mb-6 text-center sm:mb-8">
        <h1
          class="mx-auto max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-zinc-100 sm:text-4xl md:text-5xl"
          data-testid="sim-v1-hero-title"
        >
          {t("simV2.hero.title")}
        </h1>
        <p class="mx-auto mt-3 max-w-2xl text-balance text-sm leading-relaxed text-zinc-400 sm:text-base">
          {t("simV2.hero.subtitle")}
        </p>
      </header>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkillSwitcher mode={config.mode} lang={lang} onChange={setMode} />
        <div class="flex items-center gap-3 text-xs text-zinc-400">
          <details class="group relative">
            <summary
              class="cursor-pointer select-none rounded border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              data-testid="sim-v1-shortcuts-toggle"
            >
              ⌨ {lang === "ko" ? "단축키" : "Shortcuts"}
            </summary>
            <div class="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-300 shadow-xl">
              <Shortcut
                keys="← / →"
                label={lang === "ko" ? "프리셋 이동" : "cycle presets"}
              />
              <Shortcut
                keys="1-7"
                label={lang === "ko" ? "N번 프리셋" : "jump to Nth preset"}
              />
              <Shortcut
                keys="Q / S"
                label={lang === "ko" ? "퀵 / 스탠다드" : "Quick / Standard"}
              />
              <Shortcut
                keys="E"
                label={lang === "ko" ? "엑스퍼트 빌더" : "Expert builder"}
              />
              <Shortcut keys="R" label={lang === "ko" ? "리셋" : "reset"} />
            </div>
          </details>
          <span
            class="hidden sm:inline"
            title={
              lang === "ko"
                ? "URL이 저장됩니다 — 공유 가능"
                : "URL preserves state — shareable"
            }
          >
            {lang === "ko" ? "URL 공유 가능" : "URL shareable"}
          </span>
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

      {config.mode === "standard" && (
        <div class="mb-8">
          <StandardControls
            lang={lang}
            sl={config.sl}
            tp={config.tp}
            values={{
              topN: config.topN,
              leverage: config.leverage,
              feePct: config.feePct,
              startDate: config.startDate,
              endDate: config.endDate,
            }}
            onSL={setSL}
            onTP={setTP}
            onChange={setStandard}
          />
        </div>
      )}

      <div class="mb-8">
        <ResultsPanel config={config} lang={lang} />
      </div>

      <div class="mb-4">
        <OKXConnectCTA lang={lang} presetId={config.presetId} />
      </div>
      <MobileStickyCTA lang={lang} presetId={config.presetId} />
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div class="flex items-center justify-between py-1">
      <kbd class="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200">
        {keys}
      </kbd>
      <span class="ml-3 text-zinc-400">{label}</span>
    </div>
  );
}
