/**
 * Strategy one-line descriptions for display in ranking/signals.
 * Source: backend/src/strategies/registry.py
 */
export const STRATEGY_DESCRIPTIONS: Record<string, { en: string; ko: string }> =
  {
    "bb-squeeze-short": {
      en: "Bollinger Band squeeze breakout — enters on volatility expansion",
      ko: "볼린저 밴드 스퀴즈 돌파 — 변동성 확장 시 진입",
    },
    "bb-squeeze-long": {
      en: "Bollinger Band squeeze breakout (long direction)",
      ko: "볼린저 밴드 스퀴즈 돌파 (롱 방향)",
    },
    "atr-breakout": {
      en: "ATR band breakout with EMA trend filter — PF 1.45, Sharpe 7.34",
      ko: "ATR 밴드 돌파 + EMA 추세 필터 — PF 1.45, Sharpe 7.34",
    },
    "momentum-long": {
      en: "20-candle high breakout with volume confirmation",
      ko: "20캔들 고점 돌파 + 거래량 확인",
    },
    "hv-squeeze": {
      en: "Historical volatility squeeze with candle color filter",
      ko: "역사적 변동성 스퀴즈 + 캔들 색상 필터",
    },
    "rsi-divergence": {
      en: "RSI divergence — enters when price and RSI disagree",
      ko: "RSI 다이버전스 — 가격과 RSI 불일치 시 진입",
    },
    "macd-cross": {
      en: "MACD line crosses signal with zero-line filter",
      ko: "MACD 시그널 교차 + 제로라인 필터",
    },
    "donchian-breakout": {
      en: "Turtle Trading channel breakout — stable in bull & bear markets",
      ko: "터틀 트레이딩 채널 돌파 — 상승/하락장 모두 안정",
    },
    "mean-reversion": {
      en: "Price reverts to 20-period SMA after extreme deviation",
      ko: "극단적 이탈 후 20기간 SMA로 회귀",
    },
    supertrend: {
      en: "ATR-based dynamic support/resistance — enters on direction flip",
      ko: "ATR 기반 동적 지지/저항 — 방향 전환 시 진입",
    },
    "keltner-squeeze": {
      en: "BB exits Keltner Channel — strong in Fear & Greed regimes",
      ko: "BB가 켈트너 채널 이탈 — 공포/탐욕 구간에서 강함",
    },
    "stochastic-rsi": {
      en: "Stochastic RSI golden/death cross in oversold/overbought zones",
      ko: "스토캐스틱 RSI 골든/데드 크로스 — 과매도/과매수 구간",
    },
    "ma-cross": {
      en: "EMA 50/200 golden cross — most stable strategy (bull + bear)",
      ko: "EMA 50/200 골든크로스 — 가장 안정적 전략 (상승+하락장)",
    },
    "adx-trend": {
      en: "ADX + DMI crossover — enters only when trend strength confirmed",
      ko: "ADX + DMI 교차 — 추세 강도 확인 후 진입",
    },
    ichimoku: {
      en: "Ichimoku Cloud — Tenkan/Kijun cross with cloud filter",
      ko: "일목균형표 — 전환/기준선 교차 + 구름 필터",
    },
    "heikin-ashi": {
      en: "Heikin Ashi trend — N consecutive candles with no opposing wick",
      ko: "하이킨 아시 추세 — N개 연속 캔들 (반대 꼬리 없음)",
    },
    "volume-profile": {
      en: "Mean reversion to Volume Profile POC — OOS 6/6 PASS",
      ko: "거래량 프로파일 POC 회귀 — OOS 6/6 통과",
    },
  };

export function getStrategyDescription(
  strategyId: string,
  lang: "en" | "ko" = "en",
): string {
  const desc = STRATEGY_DESCRIPTIONS[strategyId];
  if (!desc) return "";
  return desc[lang] || desc.en;
}
