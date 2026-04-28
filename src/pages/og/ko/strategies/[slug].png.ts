/**
 * /og/ko/strategies/[slug].png — Korean-text dynamic OG (W3-1e).
 *
 * Delegates to the shared _strategy-og helper. Adds Pretendard fonts
 * so 한글 labels render natively instead of tofu blocks.
 */
import {
  interRegular,
  interBold,
  pretendardRegular,
  pretendardBold,
  getStrategyPaths,
  createOgHandler,
} from "../../_strategy-og";
import type { LocaleConfig } from "../../_strategy-og";

const DIRECTION_LABELS_KO: Record<string, string> = {
  long: "롱",
  short: "숏",
  both: "양방향",
};

const KO_LOCALE: LocaleConfig = {
  statusLabels: {
    verified: "검증 완료",
    testing: "검증 중",
    killed: "폐기",
    shelved: "보류",
  },
  directionLabel: (dir) => DIRECTION_LABELS_KO[dir] ?? dir.toUpperCase(),
  statLabels: { pf: "수익 팩터", wr: "승률", mdd: "최대 낙폭" },
  tagline: "트레이딩 전에 검증하세요.",
  fontFamily: "Pretendard, Inter",
  fonts: [
    { name: "Pretendard", data: pretendardRegular, weight: 400, style: "normal" as const },
    { name: "Pretendard", data: pretendardBold, weight: 700, style: "normal" as const },
    { name: "Inter", data: interRegular, weight: 400, style: "normal" as const },
    { name: "Inter", data: interBold, weight: 700, style: "normal" as const },
  ],
};

export const getStaticPaths = getStrategyPaths;
export const GET = createOgHandler(KO_LOCALE);
