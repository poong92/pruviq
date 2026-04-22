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

import { useEffect } from "preact/hooks";
import { useSimConfig, DEFAULT_TOP_N } from "../../../hooks/useSimConfig";
import { useSimShortcuts } from "../../../hooks/useSimShortcuts";
import { useTranslations, type Lang } from "../../../i18n/index";
import { emit } from "../../../lib/events";
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

  useEffect(() => {
    emit("sim.view", { lang });
  }, [lang]);

  // 2026-04-22: scroll the results card into view on preset click AND on
  // Standard-mode slider commit (onChange). Mobile users previously saw
  // no feedback because results lived ~1000px below the fold. Now every
  // action that changes the result scrolls the result into view.
  const getResultsElement = (): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    return (
      document.querySelector<HTMLElement>(
        "[data-testid='sim-v1-results-ok']",
      ) ||
      document.querySelector<HTMLElement>(
        "[data-testid='sim-v1-results-loading']",
      ) ||
      document.getElementById("sim-v1-results-anchor")
    );
  };

  const scrollResultsIntoView = () => {
    const el = getResultsElement();
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  };

  // Only scroll if the results card is currently offscreen. Used for
  // Standard-mode slider commits — repeatedly auto-scrolling while the
  // user is reading the results would be hostile.
  const scrollResultsIntoViewIfOffscreen = () => {
    const el = getResultsElement();
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const inView =
      rect.top >= 0 && rect.bottom <= (window.innerHeight || 0) + 100;
    if (inView) return;
    scrollResultsIntoView();
  };

  const handlePresetSelect = (id: string) => {
    emit("sim.preset_click", { preset: id });
    setPreset(id);
    // Delay so results-loading state paints first, THEN scroll. 150ms is
    // short enough that users don't perceive lag but long enough for
    // Preact to commit the state transition.
    setTimeout(scrollResultsIntoView, 150);
  };

  const handleSkillChange = (mode: typeof config.mode) => {
    emit("sim.skill_switch", { mode });
    setMode(mode);
  };

  return (
    <div class="mx-auto max-w-6xl px-4 py-8 sm:py-10" data-testid="sim-v1-root">
      {/* 2026-04-22: internal <header> h1 removed. The Astro page already
          renders an h1 above this mount; the second h1 was confusing and
          broke heading hierarchy. Subtitle text preserved as a lede para
          so context isn't lost.                                          */}
      <p class="mx-auto mb-6 max-w-2xl text-balance text-center text-sm leading-relaxed text-zinc-400 sm:mb-8 sm:text-base">
        {t("simV2.hero.subtitle")}
      </p>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkillSwitcher
          mode={config.mode}
          lang={lang}
          onChange={handleSkillChange}
          expertQuery={buildExpertQuery(config)}
        />
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

      {/* 2026-04-22: PresetGrid moved ABOVE TrustGapPanel. Trust gap is
          the brand signature, but a user needs to DO something first. The
          previous order (TrustGap → PresetGrid) buried the actionable
          clickable cards under a 3-column chart. The new order:
          PresetGrid (action) → TrustGap (context) → Results (outcome).   */}
      <div class="mb-8">
        <PresetGrid
          activePresetId={config.presetId}
          lang={lang}
          onSelect={handlePresetSelect}
        />
      </div>

      <div class="mb-8">
        <TrustGapPanel lang={lang} />
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
            onSL={(n) => {
              setSL(n);
              // Slider drag fires rapid updates; debounce the scroll by
              // deferring to after the React commit. Only scroll if the
              // results card is NOT already visible in the viewport.
              setTimeout(scrollResultsIntoViewIfOffscreen, 250);
            }}
            onTP={(n) => {
              setTP(n);
              setTimeout(scrollResultsIntoViewIfOffscreen, 250);
            }}
            onChange={(patch) => {
              setStandard(patch);
              setTimeout(scrollResultsIntoViewIfOffscreen, 250);
            }}
          />
        </div>
      )}

      {/* Scroll anchor — placed right ABOVE ResultsPanel so the scroll
          handler can target the whole results region, including loading
          skeletons before the ok card is rendered.                       */}
      <div id="sim-v1-results-anchor" class="mb-8">
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

// 2026-04-22 (fix after UX re-review): serialize sim state using the
// EXACT keys that SimulatorPage.tsx (the Expert builder) reads on mount:
//   sl, tp, dir, preset, coins (NOT topN), start (NOT from), end (NOT to),
//   coin. The previous implementation used useSimConfig's internal
//   persistence keys (topN/from/to/lev/fee), which don't match the
//   builder reader — so 4 of 8 handed-off fields silently dropped.
// Leverage + fee are NOT read by the Expert builder (it has its own
// defaults), so we intentionally omit them to avoid false-preservation
// claims. Default values also omitted to keep URLs short.
function buildExpertQuery(
  config: ReturnType<typeof useSimConfig>["config"],
): string {
  const p = new URLSearchParams();
  if (config.presetId) p.set("preset", config.presetId);
  if (config.direction) p.set("dir", config.direction);
  if (config.sl) p.set("sl", String(config.sl));
  if (config.tp) p.set("tp", String(config.tp));
  if (config.topN !== DEFAULT_TOP_N) p.set("coins", String(config.topN));
  if (config.coin && config.coin !== "BTC") p.set("coin", config.coin);
  if (config.startDate) p.set("start", config.startDate);
  if (config.endDate) p.set("end", config.endDate);
  return p.toString();
}
