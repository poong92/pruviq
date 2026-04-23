// Bottom CTA block — 2026-04-23: auto-trading on hold. Render as an
// informational "Coming Soon" panel instead of an active conversion CTA.
// Feature flip at AUTOTRADE_COMING_SOON below.

import {
  getLocalizedPath,
  useTranslations,
  type Lang,
} from "../../../i18n/index";
import { emit } from "../../../lib/events";

interface Props {
  lang: Lang;
  presetId: string | null;
}

// Flip to false once OKX integration is live.
const AUTOTRADE_COMING_SOON = true;

export default function OKXConnectCTA({ lang, presetId }: Props) {
  const t = useTranslations(lang);
  const trustHref = getLocalizedPath("/trust", lang);

  if (AUTOTRADE_COMING_SOON) {
    const heading =
      lang === "ko" ? "자동매매 — 곧 출시" : "Auto-trading — Coming Soon";
    const body =
      lang === "ko"
        ? "시뮬레이션 결과를 OKX에서 자동으로 실행하는 기능을 준비 중입니다. 현재는 백테스트 + 검증만 무료로 사용 가능합니다."
        : "We're building a way to auto-execute your simulation on OKX. For now, backtesting + verification stay fully free.";
    return (
      <section
        aria-label={heading}
        class="rounded-xl border border-[--color-border] bg-[--color-bg-card] p-6 text-center"
        data-testid="sim-v1-okx-cta"
      >
        <div class="mb-3 flex items-center justify-center gap-2">
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-[--color-accent]/10 text-[--color-accent-bright] border border-[--color-accent]/30"
            aria-label="Coming Soon"
          >
            ● {lang === "ko" ? "곧 출시" : "Coming Soon"}
          </span>
        </div>
        <h3 class="mb-2 text-xl font-bold text-zinc-100">{heading}</h3>
        <p class="mx-auto mb-5 max-w-xl text-sm leading-relaxed text-zinc-300">
          {body}
        </p>
        <div class="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            disabled
            aria-disabled="true"
            data-testid="sim-v1-cta-connect-btn"
            class="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[--color-border] bg-[--color-bg-elevated] px-6 py-3 text-sm font-semibold text-[--color-text-muted] cursor-not-allowed"
          >
            {t("simV2.cta.connect_button")} ·{" "}
            {lang === "ko" ? "준비중" : "Soon"}
          </button>
          <a
            href={trustHref}
            onClick={() => emit("cta.learn_more_clicked", { preset: presetId })}
            class="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-500"
          >
            {t("simV2.cta.learn_more")}
          </a>
        </div>
      </section>
    );
  }

  // Original enabled path — kept for when the feature launches.
  const href =
    getLocalizedPath("/dashboard", lang) +
    (presetId ? `?preset=${encodeURIComponent(presetId)}` : "");
  return (
    <section
      aria-label={t("simV2.cta.connect_heading")}
      class="rounded-xl border border-[--color-accent]/30 bg-[--color-accent]/5 p-6 text-center"
      data-testid="sim-v1-okx-cta"
    >
      <h3 class="mb-2 text-xl font-bold text-zinc-100">
        {t("simV2.cta.connect_heading")}
      </h3>
      <p class="mx-auto mb-5 max-w-xl text-sm leading-relaxed text-zinc-300">
        {t("simV2.cta.connect_body")}
      </p>
      <div class="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <a
          href={href}
          onClick={() => emit("cta.connect_clicked", { preset: presetId })}
          data-testid="sim-v1-cta-connect-btn"
          class="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[--color-accent] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[--color-accent-bright]"
        >
          {t("simV2.cta.connect_button")} →
        </a>
        <a
          href={trustHref}
          onClick={() => emit("cta.learn_more_clicked", { preset: presetId })}
          class="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-500"
        >
          {t("simV2.cta.learn_more")}
        </a>
      </div>
    </section>
  );
}
