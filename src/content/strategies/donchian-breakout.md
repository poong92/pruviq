---
name: "Donchian Breakout"
description: "Turtle Trading 20-period channel breakout. SHORT direction profitable in both bull (PF 1.27) and bear (PF 1.06) markets. Verified — stable across market regimes."
status: "verified"
category: "breakout"
direction: "both"
difficulty: "beginner"
profitFactor: 1.27
timeframe: "1H"
dateAdded: "2026-01-01"
dateUpdated: "2026-04-01"
tags: ["donchian", "breakout", "trend", "both", "turtle", "verified"]
---

## Overview

The Donchian Breakout strategy is the direct descendant of Richard Dennis's famous **Turtle Trading** system from the 1980s. It enters when price breaks above or below the 20-period channel — a signal that a new trend may be establishing.

SHORT direction has shown consistent profitability across both bull and bear market regimes, making it one of the more regime-stable strategies in the system.

## How It Works

1. **Channel calculation** — highest high and lowest low over the past 20 bars (look-ahead safe: uses bars up to but not including the signal bar)
2. **LONG signal** — current close breaks above the 20-bar high (upward momentum)
3. **SHORT signal** — current close breaks below the 20-bar low (downward momentum)
4. **Entry** — at the open of the next bar after the break
5. **Exit** — TP 10% / SL 8%

## Why It Works (Thesis)

The 20-period channel captures significant price movements that break out of consolidation zones. When price violates a multi-week high or low, it often signals the beginning of a directional move rather than random noise. The SHORT side outperforms because crypto assets frequently exhibit sharp, fast sell-offs — channel breaks to the downside tend to have stronger follow-through than upside breaks in a market prone to liquidation cascades.

Regime stability (profitable in both bull and bear periods) reflects the strategy's directional neutrality: it profits from volatility and trend, not from a specific market direction.

## Results

| Market regime | Profit factor (SHORT) |
|---------------|----------------------|
| Bull market | 1.27 |
| Bear market | 1.06 |

Profitable in both regimes — a key indicator of robustness.

## Default Parameters

| Parameter | Value |
|-----------|-------|
| Channel period | 20 bars |
| Exit period | 10 bars |
| Stop loss | 8% |
| Take profit | 10% |

## Caveats

- Lower profit factor in bear markets (1.06) — thin edge that could disappear with transaction costs in high-frequency trading.
- LONG direction not separately validated; use SHORT unless you've tested LONG on your specific coins.
- Classic trend-following: suffers during choppy, range-bound markets.
- Not live-tracked on OKX. Backtest only.
