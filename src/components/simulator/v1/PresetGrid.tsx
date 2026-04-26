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
        <h2 class="text-lg font-semibold text-(--color-text)">
          {t("simV2.presets.heading")}
        </h2>
        <p class="text-xs text-(--color-text-muted) sm:text-sm">{t("simV2.presets.sub")}</p>
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
            ? "border-[--color-accent] bg-[--color-accent]/5 ring-2 ring-[--color-accent]/40"
            : p.verified
              ? "border-[--color-accent]/40 bg-(--color-bg-card)/60 hover:border-[--color-accent] hover:bg-[--color-accent]/5"
              : "border-(--color-border) bg-(--color-bg-card)/60 hover:border-(--color-border-hover) hover:bg-(--color-bg-card)";

          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(p.id)}
              data-testid={`sim-v1-preset-${p.id}`}
              class={`group relative flex min-h-[240px] flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition hover:shadow-lg hover:shadow-[--color-accent]/10 ${borderClass}`}
            >
              {p.verified && (
                <span
                  aria-hidden="true"
                  class="absolute -top-[1px] left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[--color-accent] to-transparent"
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
                    class="inline-flex items-center gap-1 rounded bg-[--color-accent]/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[--color-accent-bright] ring-1 ring-[--color-accent]/40"
                    title={t("simV2.presets.verified_tooltip")}
                  >
                    ✓ {t("simV2.presets.verified")}
                  </span>
                ) : (
                  <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-mono text-(--color-text-muted)">
                    {lang === "ko" ? "백테스트만" : "Backtest only"}
                  </span>
                )}
              </div>
              <div class="flex items-center gap-2 text-(--color-text)">
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
                  lang={lang}
                />
              </div>
              {/* 2026-04-22: tagline shown on mobile too — the exact persona
                  (first-time retail on phone) that needed the one-line
                  explanation the most was being silenced by hidden sm:block. */}
              <p class="text-xs leading-snug text-(--color-text-muted)">{tagline}</p>
              {/* 2026-04-22: honest per-preset metrics row. Numbers here
                  are measured against api.pruviq.com/simulate at registry
                  default SL/TP, so a card click reproduces these exactly.
                  Keeping metrics ON the card is the trust contract — users
                  see what they'll get BEFORE clicking. */}
              <dl class="mt-1 grid grid-cols-3 gap-x-2 gap-y-1 rounded-md bg-(--color-bg)/40 px-2 py-1.5 text-center font-mono text-[11px] tabular-nums">
                <div>
                  <dt class="text-[10px] uppercase tracking-wide text-(--color-text-tertiary)">
                    PF
                  </dt>
                  <dd
                    class={`font-semibold ${p.metrics.pf >= 1.2 ? "text-(--color-up)" : p.metrics.pf >= 1.05 ? "text-[--color-accent-bright]" : "text-(--color-text-secondary)"}`}
                  >
                    {p.metrics.pf.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt class="text-[10px] uppercase tracking-wide text-(--color-text-tertiary)">
                    {lang === "ko" ? "수익률" : "Return"}
                  </dt>
                  <dd
                    class={`font-semibold ${p.metrics.totalReturn >= 0 ? "text-(--color-up)" : "text-(--color-down)"}`}
                  >
                    {p.metrics.totalReturn >= 0 ? "+" : ""}
                    {p.metrics.totalReturn.toFixed(0)}%
                  </dd>
                </div>
                <div>
                  <dt class="text-[10px] uppercase tracking-wide text-(--color-text-tertiary)">
                    MDD
                  </dt>
                  <dd class="font-semibold text-(--color-down)">
                    {p.metrics.mdd.toFixed(0)}%
                  </dd>
                </div>
              </dl>
              <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--color-border) pt-2 font-mono text-xs text-(--color-text-muted) tabular-nums">
                <span>
                  {t("simV2.defaults.sl_label")}{" "}
                  <span class="text-(--color-down)">{p.defaults.sl}%</span>
                </span>
                <span>
                  {t("simV2.defaults.tp_label")}{" "}
                  <span class="text-(--color-up)">{p.defaults.tp}%</span>
                </span>
                <span class="text-(--color-text-tertiary)">
                  {p.metrics.trades.toLocaleString()}
                  {lang === "ko" ? " 거래" : " trades"}
                </span>
                {p.liveTracked && (
                  <span
                    class="ml-auto inline-flex items-center gap-1 rounded bg-(--color-verified-subtle) px-1.5 py-0.5 text-[10px] font-mono font-medium text-(--color-verified) ring-1 ring-(--color-verified-border)"
                    title={
                      lang === "ko"
                        ? "실거래 진행 중 — TrustGap 패널에서 백테 vs 라이브 갭 확인"
                        : "Currently live-tracked on OKX — see TrustGap panel for backtest vs live delta"
                    }
                  >
                    ● {lang === "ko" ? "실거래" : "Live"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
