/**
 * Term.tsx — Shared inline tooltip abbreviation component
 * Extracted from ResultsCard.tsx for reuse across components.
 */

export const termDefs: Record<string, { en: string; ko: string }> = {
  SL: {
    en: "Stop Loss: Exit when loss reaches X%",
    ko: "손절: 손실이 X%에 달하면 포지션 청산",
  },
  TP: {
    en: "Take Profit: Exit when gain reaches X%",
    ko: "익절: 수익이 X%에 달하면 포지션 청산",
  },
  PF: {
    en: "Profit Factor: Gross profit / Gross loss (>1.5 is good)",
    ko: "수익 팩터: 총 이익 / 총 손실 (1.5 이상 양호)",
  },
  MDD: {
    en: "Max Drawdown: Largest peak-to-trough decline",
    ko: "최대 드로다운: 최고점 대비 최대 하락폭",
  },
  WR: {
    en: "Win Rate: % of trades that were profitable",
    ko: "승률: 수익 거래 비율 (%)",
  },
  Sharpe: {
    en: "Sharpe Ratio: Risk-adjusted return (>1.0 is good)",
    ko: "샤프 비율: 위험 조정 수익률 (1.0 이상 양호)",
  },
  Sortino: {
    en: "Sortino Ratio: Like Sharpe but penalizes only downside",
    ko: "소르티노 비율: 하방 변동성만 반영한 샤프 비율",
  },
  Calmar: {
    en: "Calmar Ratio: Annual return / Max Drawdown",
    ko: "칼마 비율: 연간 수익률 / 최대 드로다운",
  },
  OOS: {
    en: "Out-of-Sample: Testing on unseen data",
    ko: "아웃오브샘플: 학습에 사용되지 않은 데이터로 검증",
  },
  PnL: {
    en: "Profit and Loss: Total profit or loss",
    ko: "손익: 총 수익 또는 손실",
  },
};

export default function Term({
  abbr,
  lang,
}: {
  abbr: string;
  lang?: "en" | "ko";
}) {
  const def = termDefs[abbr];
  if (!def) return <span>{abbr}</span>;
  const title = lang === "ko" ? def.ko : def.en;
  return (
    <abbr
      title={title}
      style={{
        textDecoration: "underline dotted",
        cursor: "help",
        textDecorationColor: "var(--color-text-muted)",
      }}
    >
      {abbr}
    </abbr>
  );
}
