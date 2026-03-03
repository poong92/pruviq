---
name: "Momentum Breakout LONG"
description: "Enters long when price breaks above the 20-candle high with volume confirmation. Killed after failing 2-year validation — negative expectancy across 549 coins."
status: "killed"
category: "momentum"
direction: "long"
difficulty: "intermediate"
winRate: 37.5
profitFactor: 0.42
totalPnl: "Negative"
timeframe: "1H"
dataPoints: 8420
coins: 577
dateAdded: "2026-01-31"
dateKilled: "2026-02-05"
tags: ["momentum", "breakout", "long", "killed"]
---

## Overview

Momentum Breakout LONG was designed to capture strong upward moves by entering when price breaks above the 20-candle highest high with volume confirmation and an uptrend filter.

## How It Worked

1. **Breakout Detection** — Price closes above 20-candle high
2. **Volume Confirmation** — Volume >= 2.0x average
3. **Trend Filter** — EMA confirms uptrend
4. **Enter Long** — With 5% SL, 10% TP (R:R 1:2)

## Why It Failed

| Metric | Expected | Actual |
|--------|----------|--------|
| Win Rate | >50% | 37.5% |
| Break-even Win Rate | 71.4% | - |
| Profit Factor | >1.0 | 0.42 |
| Total PnL | Positive | Negative |

The strategy needed a 71.4% win rate to break even with its R:R profile. At 37.5%, it was mathematically guaranteed to lose money.

## Root Cause Analysis

1. **Look-ahead bias in initial simulation** — Early tests showed +400% returns due to a subtle coding error (using current candle data instead of previous)
2. **Crypto LONG structural weakness** — In the 2024-2026 bear/sideways market, momentum longs get caught in mean reversion repeatedly
3. **18 LONG strategies tested, ALL failed** — This wasn't a parameter problem. LONG momentum in crypto has no edge in the current regime

## Why It Was Killed

This failure was one of our most important lessons. But it was also one of our most valuable:

> "If you can't prove it survives 2+ years of out-of-sample data, don't trade it."

We now require minimum 2 years of backtest data across 500+ coins before any strategy is considered verified.

## Status: KILLED

Killed on 2026-02-05 after comprehensive 5-expert analysis confirmed negative expected value. The loss data is preserved in our Strategy Graveyard as a permanent reminder.
