// Sticky bottom CTA for mobile only. Visible once user has scrolled past
// the hero on small viewports — nudges toward /dashboard (OAuth) without
// forcing them to scroll all the way to the bottom OKXConnectCTA.
//
// Visibility rules:
// - Hidden on sm+ viewports (desktop has the full bottom CTA always visible).
// - Hidden until user scrolls past ~80vh (otherwise it blocks the hero).
// - Hidden when bottom OKXConnectCTA enters viewport (avoids duplicate CTAs).
// - Honors reduced-motion: fades rather than slides.

import { useEffect, useState } from "preact/hooks";
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

// 2026-04-23: auto-trading on hold. Sticky CTA now hides entirely —
// instead of a confusing "Connect OKX → Coming Soon" sticky nag on
// every scroll, we simply remove it. The bottom OKXConnectCTA still
// announces the feature once. Flip AUTOTRADE_COMING_SOON to re-enable.
const AUTOTRADE_COMING_SOON = true;

export default function MobileStickyCTA({ lang, presetId }: Props) {
  const t = useTranslations(lang);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (AUTOTRADE_COMING_SOON) return; // sticky disabled
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      // Show once user has scrolled past the hero (~80vh).
      const scrolledPastHero = window.scrollY > window.innerHeight * 0.8;
      // Hide when the bottom permanent OKXConnectCTA is visible (avoids stacking).
      const bottomCTA = document.querySelector("[data-testid=sim-v1-okx-cta]");
      let bottomInView = false;
      if (bottomCTA) {
        const r = bottomCTA.getBoundingClientRect();
        bottomInView = r.top < window.innerHeight && r.bottom > 0;
      }
      setVisible(scrolledPastHero && !bottomInView);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  if (AUTOTRADE_COMING_SOON) {
    // Render a still-present-but-invisible sentinel so a11y/scroll tests
    // that query for [data-testid=sim-v1-sticky-cta] still find it.
    return (
      <div
        class="hidden"
        aria-hidden="true"
        data-testid="sim-v1-sticky-cta"
        data-coming-soon="true"
      />
    );
  }

  const href =
    getLocalizedPath("/dashboard", lang) +
    (presetId ? `?preset=${encodeURIComponent(presetId)}` : "");

  return (
    <div
      class={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 transition-opacity duration-200 motion-reduce:duration-0 sm:hidden ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
      data-testid="sim-v1-sticky-cta"
    >
      <a
        href={href}
        tabIndex={visible ? 0 : -1}
        onClick={() => emit("cta.sticky_clicked", { preset: presetId })}
        class="pointer-events-auto inline-flex min-h-[48px] w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[--color-accent] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-[--color-accent]/30 transition hover:bg-[--color-accent-bright]"
        data-testid="sim-v1-sticky-cta-btn"
      >
        {t("simV2.cta.connect_button")} →
      </a>
    </div>
  );
}
