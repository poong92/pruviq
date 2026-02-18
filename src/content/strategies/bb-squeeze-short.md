---
name: "BB Squeeze SHORT"
description: "Bollinger Band Squeeze detects volatility compression then enters short when expansion begins. Our only verified strategy with 2+ years of backtested data."
status: "verified"
category: "volatility"
direction: "short"
difficulty: "intermediate"
winRate: 68.6
profitFactor: 2.22
maxDrawdown: 26.7
totalPnl: "+$794"
timeframe: "1H"
dataPoints: 2898
coins: 535
dateAdded: "2026-01-10"
tags: ["bollinger-bands", "squeeze", "volatility", "verified"]
---

## Overview

BB Squeeze SHORT is a volatility expansion strategy that detects when Bollinger Bands compress inside Keltner Channels (the "squeeze"), then enters a short position when the bands expand. The core idea: after extreme compression, markets tend to make large directional moves.

## How It Works

1. **Detect Squeeze** — Bollinger Bands contract inside Keltner Channel
2. **Wait for Expansion** — BB width must increase >= 10% from squeeze state
3. **Volume Confirmation** — Volume must be >= 2.0x the 20-period average
4. **Enter Short** — Only during allowed hours (excludes 7 low-edge UTC hours)
5. **Risk Management** — SL 10%, TP 8%, max hold 48 hours

## Key Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Stop Loss | 10% | C5 OOS verified, 54% reduction in SL hit rate |
| Take Profit | 8% | Optimal R:R per MFE analysis, +24.3% PnL improvement |
| Volume Filter | 2.0x | Filters fake signals, verified across 2+ years |
| Time Filter | 7 hours blocked | UTC [2,3,10,20,21,22,23] — statistically negative hours |
| Max Hold | 48 hours | Beyond this, edge degrades to noise |
| BB Expansion | >= 10% | Confirms genuine volatility expansion |

## Backtest Results (2+ Years, 535 Coins)

- **Total Trades**: 2,898
- **Win Rate**: 68.6%
- **Profit Factor**: 2.22
- **Average Win**: +4.8%
- **Average Loss**: -5.2%
- **SL Hit Rate**: 7.5%
- **TP Hit Rate**: 42%
- **TIMEOUT Rate**: 50.5%

## Why SHORT Only?

We tested both LONG and SHORT variants. The results were definitive:

- **BB Squeeze SHORT**: +$794, 59.3% win rate
- **BB Squeeze LONG**: -$26, 51.0% win rate
- **Momentum LONG**: -$14,115, 37.5% win rate

In the current crypto market structure (2024-2026), short-side mean reversion has a consistent edge. Long strategies showed no statistical significance.

## What We Learned

1. **TP expansion beats SL reduction** — Increasing TP from 6% to 8% improved PnL by 24.3%, while reducing SL made things worse
2. **Time filtering matters** — 7 blocked hours remove ~30% of losing trades
3. **Volume is not optional** — Without the 2.0x filter, false signals dominate
4. **48-hour timeout is optimal** — Tested 30+ early exit variations, all underperformed

## Simulation Assumptions

All results include realistic trading costs: **0.04% futures fee per side** (0.08% round-trip) and **0.02% estimated slippage** per trade. Position sizing: $60 per trade with 5x leverage. These costs are deducted from every simulated trade — no cherry-picking.

## Status: VERIFIED

Simulation-verified across 535 coins, 2+ years of hourly data. Default configuration: $60 per trade, 5x leverage, hourly scans. You can adjust parameters and run your own simulation.
