---
name: "MA Cross (50/200 EMA)"
description: "Classic 50/200 EMA crossover. Lowest max drawdown (33.5%) of the 5 verified presets. 1,111 trades, PF 1.09, measured 2026-04-22."
status: "verified"
category: "momentum"
direction: "both"
difficulty: "beginner"
winRate: 47.79
profitFactor: 1.09
maxDrawdown: 33.5
timeframe: "4H"
coins: 235
dateAdded: "2026-04-22"
tags: ["moving-average", "ema", "momentum", "verified", "beginner"]
---

## Overview

The 50/200 EMA crossover is the oldest trend-following signal in trading. LONG when the 50 crosses above the 200 (golden cross), SHORT when below (death cross). This preset applies it to crypto 4H timeframe across 235 coins.

We kept it in the verified set despite its modest PF (1.09) because **it has the lowest max drawdown of the 5 verified presets (33.5% vs 42–47% for the others)**. Useful as a defensive component in a portfolio.

## How It Works

1. **Setup** — compute 50-period and 200-period EMAs on 4H bars
2. **Long entry** — 50 EMA crosses above 200 EMA
3. **Short entry** — 50 EMA crosses below 200 EMA
4. **Exit** — opposite cross OR TP 10% / SL 5%
5. **Position sizing** — equal weight per signal (no leverage adjustment)

## Why It Works (Thesis)

Simple. Robust. The long EMAs smooth out whipsaw. Signal frequency is low (1,111 trades over 2 years across 235 coins = ~0.1 trades / coin / week), which keeps commission drag minimal. Profit comes from a small number of big-move regimes; the other 90% of the time it's flat.

## Results (2-year backtest, measured 2026-04-22)

| Metric | Value |
|--------|-------|
| Total trades | 1,111 |
| Win rate | 47.79% |
| Profit factor | 1.09 |
| Sharpe | 0.54 |
| Total return | +85.06% |
| Max drawdown | 33.5% |

## Caveats

- Lowest edge of the 5 verified presets (PF 1.09). Use it for stability, not alpha.
- Classic signal — unlikely to have any unique edge left. Included because its *drawdown profile* complements the higher-PF presets.
- Not live-tracked. TrustGap applies.
