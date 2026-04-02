---
title: "We Ran 52 Strategies for 1 Year. Here's the Data."
description: "1-year backtest results across 52 crypto trading strategies on 572 coins. Raw numbers: win rates, profit factors, drawdowns, and which strategies actually survived."
date: "2026-03-29"
category: "quant"
tags: ["backtest", "strategy", "performance", "crypto", "results"]
---

52 strategies. 572 coins. 365 days of data. No cherry-picking.

## The Top 3 (1-Year)

| Rank | Strategy | Direction | Win Rate | Profit Factor | Return | MDD | Sharpe |
|------|----------|-----------|----------|---------------|--------|-----|--------|
| 1 | Ichimoku 4H | SHORT | 54.36% | 1.49 | +12.57% | 6.02% | 1.66 |
| 2 | MACD Cross 4H | SHORT | 57.58% | 1.19 | +14.37% | 16.42% | 1.05 |
| 3 | BB Squeeze 1H | SHORT | 52.55% | 1.05 | +2.58% | 10.92% | 0.22 |

Ichimoku 4H wins on risk-adjusted return. Sharpe 1.66, MDD only 6.02%. MACD Cross has a higher raw return (+14.37%) but the drawdown is nearly 3x worse.

## The Bottom 3

| Rank | Strategy | Direction | Win Rate | PF | Return | MDD |
|------|----------|-----------|----------|----|--------|-----|
| 1 | BB Squeeze 6H | SHORT | 28.51% | 0.38 | -12.73% | 13.49% |
| 2 | BB Squeeze 4H | SHORT | 40.22% | 0.68 | -6.36% | 7.12% |
| 3 | MA Cross LONG 6H | LONG | 41.13% | 0.70 | -2.63% | 4.27% |

Same strategy (BB Squeeze), different timeframe, opposite result. 1H works. 6H doesn't. Timeframe matters more than the indicator itself.

## The Weekly Consistency Leaders

These stayed in the top 3 for the most days over the past week:

| Strategy | Days in Top | Sharpe | MDD |
|----------|------------|--------|-----|
| Keltner Squeeze 1H | 5 | 1.02 | 9.29% |
| Keltner Squeeze 4H | 4 | 1.49 | 4.49% |
| Ichimoku 4H | 4 | 1.66 | 6.02% |

## The Numbers That Matter

- **15 out of 52** strategies had a win rate above 50% over 1 year. That's 29%.
- Every strategy in the top 3 is **SHORT**. The market rewarded shorts over this period.
- The gap between #1 (Sharpe 1.66) and #3 (Sharpe 0.22) is massive. Rank alone doesn't tell the story.
- MDD range: 4.49% (Keltner 4H) to 16.42% (MACD Cross 4H). Risk profiles vary wildly even among winners.

## 30-Day Snapshot (Recent Regime)

The market shifted. Over the last 30 days, the top performers flipped to LONG:

| Strategy | Direction | Win Rate | PF | Sharpe |
|----------|-----------|----------|----|--------|
| SuperTrend LONG 1H | LONG | 58.10% | 1.95 | 6.48 |
| Keltner Squeeze LONG 1H | LONG | 61.89% | 1.99 | 3.03 |
| BB Squeeze LONG 1H | LONG | 62.08% | 1.93 | 4.60 |

23 of 41 active strategies beat 50% win rate in the last 30 days. The regime changed.

## So What

No single strategy works in all conditions. The 1-year winners are all shorts. The 30-day winners are all longs. Picking the "best strategy" without knowing the current market regime is guessing.

The data updates daily. Run your own test on the [PRUVIQ Simulator](https://pruviq.com/simulate).
