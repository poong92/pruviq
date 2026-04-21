// 7 curated Quick Start preset cards.
// Click → setPreset via parent. Keyboard accessible; 44×44 min touch.
//
// Verified preset hierarchy (design polish 2.5):
// Cards with `verified: true` get a stronger visual weight — emerald
// resting border + ribbon accent + "VERIFIED" label bar — because that
// badge is the primary trust signal. Unverified cards get a subdued
// "Backtest only" label to prevent reading as equivalent.

import { SIMULATOR_PRESETS } from "../../../config/simulator-presets";
import {
  RISK_TOKENS,
  DIRECTION_TOKENS,
} from "../../../config/simulator-tokens";
import { useTranslations, type Lang } from "../../../i18n/index";
import EntryVisualizer from "./EntryVisualizer";

interface Props {
  activePresetId: string | null;
  lang: Lang;
  onSelect: (presetId: string) => void;
}

export default function PresetGrid({ activePresetId, lang, onSelect }: Props) {
  const t = useTranslations(lang);

  return (
    <section aria-label={t("simV2.presets.heading")}>
      <div class="mb-4 flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h2 class="text-lg font-semibold text-zinc-100">
          {t("simV2.presets.heading")}
        </h2>
        <p class="text-xs text-zinc-400 sm:text-sm">{t("simV2.presets.sub")}</p>
      </div>
      <div
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="sim-v1-preset-grid"
      >
        {SIMULATOR_PRESETS.map((p) => {
          const risk = RISK_TOKENS[p.risk];
          const dir = DIRECTION_TOKENS[p.direction];
          const label = lang === "ko" ? p.labels.ko : p.labels.en;
          const tagline = lang === "ko" ? p.tagline.ko : p.tagline.en;
          const isActive = activePresetId === p.id;

          const borderClass = isActive
            ? "border-emerald-400 bg-emerald-400/5 ring-2 ring-emerald-400/40"
            : p.verified
              ? "border-emerald-500/40 bg-zinc-900/60 hover:border-emerald-400 hover:bg-emerald-500/5"
              : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900";

          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(p.id)}
              data-testid={`sim-v1-preset-${p.id}`}
              class={`group relative flex min-h-[240px] flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition hover:shadow-lg hover:shadow-emerald-500/5 ${borderClass}`}
            >
              {p.verified && (
                <span
                  aria-hidden="true"
                  class="absolute -top-[1px] left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                />
              )}
              <div class="flex items-start justify-between gap-2">
                <span
                  class={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono font-medium ${risk.badge}`}
                >
                  <span class={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
                  {lang === "ko" ? risk.label.ko : risk.label.en}
                </span>
                {p.verified ? (
                  <span
                    class="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/40"
                    title={t("simV2.presets.verified_tooltip")}
                  >
                    ✓ {t("simV2.presets.verified")}
                  </span>
                ) : (
                  <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-mono text-zinc-500">
                    {lang === "ko" ? "백테스트만" : "Backtest only"}
                  </span>
                )}
              </div>
              <div class="flex items-center gap-2 text-zinc-100">
                <span
                  class="text-xl"
                  style={{ color: dir.hex }}
                  aria-hidden="true"
                >
                  {dir.arrow}
                </span>
                <span class="text-base font-semibold leading-tight">
                  {label}
                </span>
              </div>
              <div class="overflow-hidden rounded-md">
                <EntryVisualizer
                  presetId={p.id}
                  direction={p.direction}
                  label={label}
                  compact
                />
              </div>
              <p class="hidden text-xs leading-snug text-zinc-400 sm:block">
                {tagline}
              </p>
              <div class="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800 pt-2 font-mono text-xs text-zinc-400 tabular-nums">
                <span>
                  {t("simV2.defaults.sl_label")}{" "}
                  <span class="text-rose-400">{p.defaults.sl}%</span>
                </span>
                <span>
                  {t("simV2.defaults.tp_label")}{" "}
                  <span class="text-emerald-400">{p.defaults.tp}%</span>
                </span>
                <span class="text-zinc-500">{p.defaults.coin}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
