// 7 curated Quick Start preset cards.
// Click → setPreset via parent. Keyboard accessible; 44×44 min touch.

import { SIMULATOR_PRESETS } from "../../../config/simulator-presets";
import {
  RISK_TOKENS,
  DIRECTION_TOKENS,
} from "../../../config/simulator-tokens";
import { useTranslations, type Lang } from "../../../i18n/index";

interface Props {
  activePresetId: string | null;
  lang: Lang;
  onSelect: (presetId: string) => void;
}

export default function PresetGrid({ activePresetId, lang, onSelect }: Props) {
  const t = useTranslations(lang);

  return (
    <section aria-label={t("simV2.presets.heading")}>
      <div class="mb-4 flex items-baseline justify-between gap-3">
        <h2 class="text-lg font-bold text-zinc-100">
          {t("simV2.presets.heading")}
        </h2>
        <p class="text-sm text-zinc-400">{t("simV2.presets.sub")}</p>
      </div>
      <div
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="sim-v2-preset-grid"
      >
        {SIMULATOR_PRESETS.map((p) => {
          const risk = RISK_TOKENS[p.risk];
          const dir = DIRECTION_TOKENS[p.direction];
          const label = lang === "ko" ? p.labels.ko : p.labels.en;
          const tagline = lang === "ko" ? p.tagline.ko : p.tagline.en;
          const isActive = activePresetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(p.id)}
              data-testid={`sim-v2-preset-${p.id}`}
              class={`group relative flex min-h-[168px] flex-col gap-3 rounded-xl border p-4 text-left transition ${
                isActive
                  ? "border-emerald-400 bg-emerald-400/5 ring-2 ring-emerald-400/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900"
              }`}
            >
              <div class="flex items-start justify-between gap-2">
                <span
                  class={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono font-medium ${risk.badge}`}
                >
                  <span class={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
                  {lang === "ko" ? risk.label.ko : risk.label.en}
                </span>
                {p.verified && (
                  <span
                    class="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                    title={t("simV2.presets.verified_tooltip")}
                  >
                    ✓ {t("simV2.presets.verified")}
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
              <p class="text-xs leading-snug text-zinc-400">{tagline}</p>
              <div class="mt-auto flex gap-3 border-t border-zinc-800 pt-2 font-mono text-[11px] text-zinc-400">
                <span>
                  {t("simV2.defaults.sl_label")}{" "}
                  <span class="text-rose-400">{p.defaults.sl}%</span>
                </span>
                <span>
                  {t("simV2.defaults.tp_label")}{" "}
                  <span class="text-emerald-400">{p.defaults.tp}%</span>
                </span>
                <span>{p.defaults.coin}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
