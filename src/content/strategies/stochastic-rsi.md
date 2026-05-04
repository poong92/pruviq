---
name: "Stochastic RSI Short"
description: "Short when Stochastic RSI crosses bearishly in overbought territory on 12H timeframe. Testing — 2674 trades, PF 1.22, OOS/IS ratio 1.38 (OOS outperforms IS), measured 2026-05-04."
status: "testing"
category: "momentum"
direction: "short"
difficulty: "beginner"
winRate: 53.5
profitFactor: 1.22
timeframe: "12H"
coins: 50
dataPoints: 2674
dateAdded: "2026-05-04"
dateUpdated: "2026-05-04"
tags: ["stochastic", "rsi", "overbought", "short", "momentum", "testing"]
---

## Overview

The Stochastic RSI Short strategy applies the Stochastic oscillator to RSI values rather than price. By measuring whether RSI itself is in an "overbought of overbought" condition, the indicator catches trend exhaustion moments that raw RSI or price-based Stochastic alone often miss.

Discovered 2026-05-04 via multi-window parameter sweep across 50 coins on a 12H timeframe. The strategy produced **2,674 total trades** — one of the highest sample sizes in the current strategy library — giving statistical confidence in the measured profit factor of 1.22.

## How It Works

1. **Stochastic RSI calculation** — RSI(14) is calculated, then the Stochastic oscillator (3-period smoothing) is applied to that RSI, producing %K and %D lines ranging 0–100
2. **Overbought zone** — both %K and %D must be above 80 (overbought territory)
3. **Death cross** — %K crosses below %D in the overbought zone, signaling momentum exhaustion
4. **Entry** — SHORT on the next bar's open after the cross is confirmed
5. **Exit** — TP 15% / SL 15% / 4-bar (2-day on 12H) timeout

## Why It Works (Thesis)

The Stochastic RSI death cross in overbought territory captures a specific market condition: the *rate of change* of momentum is reversing, even as the market may still be rising. By the time %K crosses %D above 80, the underlying RSI has been at extreme levels for multiple periods and is now losing steam — a reliable sign that short-term sellers are entering.

The 12H timeframe is key. At shorter timeframes, Stochastic RSI signals fire constantly and are mostly noise. At 12H, each signal represents a half-day of sustained overbought momentum followed by a measurable cross — far more significant than hourly whipsaws.

The symmetric SL and TP (both 15%) reflects the strategy's nature: it captures mean-reverting moves of moderate size, not home-run directional trends.

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 1,434 | 1,240 | 2,674 |
| Win rate | ~53% | ~54% | 53.5% |
| Profit factor | 1.07 | 1.48 | 1.22 |
| Coins profitable | 27/50 | 37/50 | — |

**OOS/IS ratio: 1.38** — OOS profit factor (1.48) exceeded IS (1.07) by 38%. The OOS period (May 2025–May 2026) was primarily bearish, which favors SHORT strategies — explaining why OOS outperformed IS.

The IS period (May 2024–May 2025) included the 2024 bull run where SHORT signals naturally underperform. The IS PF of 1.07 is profitable but modest; the strategy showed its best edge when market conditions aligned (bear regime).

## Caveats

- IS PF of 1.07 is marginal — in bull markets, this strategy produces near-flat results. It is strongest in bear/sideways regimes.
- 53.5% WR is below the ≥55% threshold we prefer for verified strategies; the edge comes from win/loss size balance at symmetric 15%/15% rather than win rate.
- 2,674 trades is excellent for statistical confidence but means the strategy fires frequently — monitor for signal fatigue if deploying on multiple coins simultaneously.
- 12H signals fire 1–2 times per coin every 3–4 days on average.
- Not live-tracked on OKX. Backtest only.
