// Static "Backtest vs Live OKX" trust summary.
// Phase 1: hard-coded summary percentages (owner decision §21 item 4 = summary only).
// Future: wire to live-performance JSON feed.

import { useTranslations, type Lang } from "../../../i18n/index";

interface Props {
  lang: Lang;
}

// Source: /performance page live-vs-backtest summary block (owner approval
// to display these aggregate numbers on /simulate/v2 per §21 decision 4).
// When the live feed is instrumented in Phase 2 this component will read
// from /data/performance.json instead of constants.
const SUMMARY = {
  backtestPct: 54,
  livePct: 38,
  gapPct: 3,
};

export default function TrustGapPanel({ lang }: Props) {
  const t = useTranslations(lang);
  return (
    <section
      aria-label={t("simV2.trust.gap_heading")}
      class="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-zinc-900/60 p-5"
      data-testid="sim-v2-trust-gap"
    >
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-300">
        {t("simV2.trust.gap_heading")}
      </h3>
      <div class="grid grid-cols-3 gap-4">
        <Figure
          label={t("simV2.trust.gap_backtest")}
          value={`+${SUMMARY.backtestPct}%`}
          tone="neutral"
        />
        <Figure
          label={t("simV2.trust.gap_live")}
          value={`+${SUMMARY.livePct}%`}
          tone="good"
        />
        <Figure
          label={t("simV2.trust.gap_delta")}
          value={`${SUMMARY.gapPct}%`}
          tone="neutral"
          highlight
        />
      </div>
      <p class="mt-3 text-xs leading-relaxed text-zinc-400">
        {t("simV2.trust.gap_note")}
      </p>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  highlight?: boolean;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div
      class={`rounded-lg p-3 ${highlight ? "bg-emerald-500/10 ring-1 ring-emerald-400/30" : ""}`}
    >
      <div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div class={`font-mono text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
