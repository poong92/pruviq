/**
 * /og/strategies/[slug].png — Per-strategy dynamic OG image (EN).
 *
 * Delegates to the shared _strategy-og helper for layout + rendering.
 * Only locale-specific config (labels, fonts, tagline) is defined here.
 */
import {
  interRegular,
  interBold,
  getStrategyPaths,
  createOgHandler,
} from "../_strategy-og";
import type { LocaleConfig } from "../_strategy-og";

const EN_LOCALE: LocaleConfig = {
  statusLabels: {
    verified: "VERIFIED",
    testing: "IN REVIEW",
    killed: "KILLED",
    shelved: "SHELVED",
  },
  directionLabel: (dir) => dir.toUpperCase(),
  statLabels: { pf: "PF", wr: "WIN RATE", mdd: "MAX DD" },
  tagline: "Verify before you trade.",
  fontFamily: "Inter",
  fonts: [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" as const },
    { name: "Inter", data: interBold, weight: 700, style: "normal" as const },
  ],
};

export const getStaticPaths = getStrategyPaths;
export const GET = createOgHandler(EN_LOCALE);
