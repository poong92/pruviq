// Bottom CTA block: nudge user toward /dashboard (OAuth entry) after
// they've seen a real simulation result. Per plan: /simulate → /dashboard
// is the conversion funnel apex.

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

export default function OKXConnectCTA({ lang, presetId }: Props) {
  const t = useTranslations(lang);
  const href =
    getLocalizedPath("/dashboard", lang) +
    (presetId ? `?preset=${encodeURIComponent(presetId)}` : "");
  const trustHref = getLocalizedPath("/trust", lang);

  return (
    <section
      aria-label={t("simV2.cta.connect_heading")}
      class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center"
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
          class="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
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
