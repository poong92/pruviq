---
name: "BB Squeeze LONG"
description: "Long-side variant of BB Squeeze. Killed due to negative expected value (-$26) and only 51% win rate."
status: "killed"
category: "volatility"
direction: "long"
difficulty: "intermediate"
winRate: 51.0
profitFactor: 0.98
totalPnl: "-$26"
timeframe: "1H"
coins: 577
dateAdded: "2026-01-10"
dateKilled: "2026-02-05"
tags: ["bollinger-bands", "squeeze", "long", "killed"]
---

## Overview

BB Squeeze LONG was the mirror image of our successful SHORT strategy. Same setup, same indicators, opposite direction. The hypothesis: if squeeze expansion works for shorts, it should work for longs too.

It didn't.

## Results

- **Win Rate**: 51.0% (barely above coin flip)
- **Profit Factor**: 0.98 (net negative after fees)
- **Total PnL**: -$26

## Why It Failed

The BB Squeeze signal is direction-neutral — it detects volatility expansion, not direction. But in the current crypto market:

- **Shorts benefit from mean reversion** — after a squeeze, overextended rallies tend to reverse
- **Longs fight against the macro trend** — in a bear/sideways market, long breakouts frequently fail
- **Asymmetric risk** — crypto drops faster than it rises (liquidation cascades)

## Lesson Learned

Same indicator, opposite direction, completely different results. Market structure matters more than signal quality. In crypto 2024-2026, the short side has a structural edge that the long side simply doesn't have.

## Status: KILLED

Killed alongside Momentum LONG on 2026-02-05. The combined analysis of 6 experts unanimously confirmed: SHORT only is the correct configuration for the current regime.
