---
title: "SHORT vs LONG — Which Side Won Over 1 Year?"
description: "We ran the same strategies in both directions across 50 coins for 365 days. SHORT dominated, but the last 30 days tell a different story. Here's the data."
date: "2026-04-03"
category: "quant"
tags: ["short", "long", "backtest", "strategy", "crypto", "performance"]
---

Same strategy. Same coins. Same parameters. Only difference: direction. Over 1 year, SHORT won decisively. But blindly picking sides is still a losing move.

## The Scoreboard (365 Days, Top 50 Coins)

| Strategy | SHORT Return | LONG Return | Gap | SHORT Sharpe | LONG Sharpe |
|----------|-------------|-------------|-----|-------------|-------------|
| ATR Breakout 1H | +21.07% | -9.34% | 30.41pp | 0.62 | -0.41 |
| BB Squeeze 1H | +20.68% | — | — | 0.80 | — |
| MACD Cross 4H | +14.27% | — | — | 1.04 | — |
| MA Cross 1H | — | -14.65% | — | — | -2.06 |

ATR Breakout is the clearest mirror test. Same indicator, same SL/TP (10%/8%), same 50 coins. SHORT made +21.07%. LONG lost -9.34%. That's a 30pp gap from direction alone.

## The 1-Year Rankings Tell the Same Story

From the daily rankings API (365d period, top 50 coins):

**Top 3 (winners):**

| Rank | Strategy | Direction | Return | PF | MDD |
|------|----------|-----------|--------|-----|-----|
| 1 | ATR Breakout 1H | SHORT | +9.20% | 1.22 | 8.11% |
| 2 | Keltner Squeeze 6H | LONG | +2.22% | 1.19 | 3.21% |
| 3 | MACD Cross 4H | SHORT | +14.27% | 1.18 | 16.42% |

**Bottom 3 (losers):**

| Rank | Strategy | Direction | Return | PF | MDD |
|------|----------|-----------|--------|-----|-----|
| 1 | MA Cross 1H | LONG | -14.65% | 0.69 | 18.59% |
| 2 | ATR Breakout 1H | LONG | -16.08% | 0.70 | 18.40% |
| 3 | MA Cross 6H | LONG | -2.25% | 0.73 | 4.26% |

Winners: 2 SHORT, 1 LONG. Losers: all 3 LONG. Out of 47 total strategies, only 13 had a win rate above 50%.

## But Then the Last 30 Days Happened

The regime flipped. 30-day top 3:

| Strategy | Direction | Win Rate | PF | Sharpe |
|----------|-----------|----------|-----|--------|
| Keltner Squeeze LONG 6H | LONG | 54.17% | 1.78 | 3.19 |
| SuperTrend 1H | SHORT | 63.49% | 1.76 | 5.55 |
| Keltner Squeeze LONG 1H | LONG | 59.60% | 1.75 | 3.86 |

21 out of 43 strategies beat 50% win rate in the last 30 days (vs. 13/47 over 1 year). The market got friendlier to LONG positions.

## The Actual Lesson

Over the past year, SHORT had a structural edge. The crypto market trended down or sideways long enough for short strategies to collect. LONG strategies bled through drawdowns.

But the 30-day data shows regimes change. The same MA Cross LONG that lost -14.65% over a year was the worst 30-day performer at -3.18%. Consistency in failure, but direction bias alone doesn't explain it.

What matters:
- **Same strategy, opposite results** depending on direction (ATR Breakout: +21% SHORT vs -9% LONG)
- **Regime shifts are real** — 1-year winners aren't guaranteed 30-day winners
- **SHORT isn't magic** — it worked in this market condition. Next year could reverse

Don't pick a side. Pick a strategy that matches the current regime.

Test both directions yourself on the [PRUVIQ Simulator](https://pruviq.com/simulate).
