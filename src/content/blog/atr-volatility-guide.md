---
title: "ATR (Average True Range): Measuring Volatility That Matters"
description: "How ATR works, why it's essential for position sizing and stop-loss placement, and how to use it in crypto trading strategies."
date: "2026-02-20"
category: "education"
tags: ["atr", "volatility", "risk-management", "stop-loss", "position-sizing"]
---

## What Is ATR?

ATR (Average True Range) measures volatility — how much an asset's price typically moves in one period. Unlike indicators that try to predict direction, ATR tells you about the **magnitude** of moves.

```
True Range = MAX of:
  1. Current High - Current Low
  2. |Current High - Previous Close|
  3. |Current Low - Previous Close|

ATR = Average of True Range over N periods (default: 14)
```

The "true" part accounts for gaps — when the current bar opens far from the previous close.

## Why ATR Matters

### 1. Stop-Loss Placement
The most practical use of ATR. Instead of arbitrary fixed stops:

```
Fixed stop:    SL at -5% (ignores current volatility)
ATR-based:     SL at 2 × ATR below entry (adapts to market)
```

If ATR is 3%, your stop is 6% away. If ATR shrinks to 1%, your stop tightens to 2%. This prevents getting stopped out by normal noise while still protecting against real moves.

### 2. Position Sizing
ATR normalizes risk across different assets:

```
Risk per trade: $100
ATR for BTC: $2,000  → Position size: $100 / $2,000 = 0.05 BTC
ATR for DOGE: $0.01  → Position size: $100 / $0.01 = 10,000 DOGE
```

Both positions have the same dollar risk despite vastly different prices and volatilities.

### 3. Volatility Filter
High ATR = volatile market. Low ATR = quiet market.

```
ATR expanding  → Breakout potential, wider stops needed
ATR contracting → Range-bound, tighter stops possible
ATR at extreme → Potential exhaustion / reversal
```

## ATR in Crypto

### Why It's Especially Useful
- Crypto volatility varies wildly (BTC can go from 1% daily moves to 10%)
- Different coins have completely different volatility profiles
- A "5% stop" makes sense for one coin but is way too tight for another
- ATR normalizes everything

### Typical Crypto ATR Values (1H timeframe)
```
BTC:      $500 - $3,000  (depends on market regime)
ETH:      $20 - $150
Large Alts: 1-4% of price
Small Alts: 2-8% of price
```

### ATR and BB Squeeze
ATR is closely related to the Bollinger Band Squeeze:
- When ATR is low → Bollinger Bands are narrow → Squeeze forming
- When ATR expands → Bands widen → Breakout happening
- ATR expansion is the mechanism behind the squeeze breakout

## Common ATR Strategies

### ATR Trailing Stop
Move your stop-loss with price, maintaining an ATR distance:
```
Long:  Trailing stop = Highest close - (multiplier × ATR)
Short: Trailing stop = Lowest close + (multiplier × ATR)
```
Common multipliers: 1.5x, 2x, 3x. Higher = wider stop = fewer whipsaws but more drawdown.

### ATR Channel Breakout
```
Upper channel: Close + (multiplier × ATR)
Lower channel: Close - (multiplier × ATR)
```
When price breaks above the upper channel, momentum is strong. Similar logic to Keltner Channels.

### Volatility-Adjusted Entries
Only enter trades when ATR is within a specific range:
- **ATR too low**: No momentum, signals may be weak
- **ATR too high**: Stops are expensive, risk/reward may be poor
- **ATR in sweet spot**: Good balance of movement and manageable risk

## ATR Parameters

| Parameter | Default | Use Case |
|-----------|---------|----------|
| **Period 14** | Standard | Most common, good for daily/4H |
| **Period 7** | Faster | More responsive, more noise |
| **Period 21** | Slower | Smoother, better for swing trading |

Shorter periods react faster to volatility changes. Longer periods give a more stable reading.

## Common Mistakes

1. **Using ATR as a directional indicator**: ATR measures magnitude, not direction. High ATR can mean up OR down
2. **Fixed ATR multipliers**: 2× ATR works differently for BTC vs small alts. Calibrate per asset
3. **Ignoring ATR regime**: What's "normal" ATR changes over time. Compare current ATR to historical average

## Key Takeaway

> ATR is the most underrated tool in a crypto trader's kit. It won't tell you which direction to trade, but it will tell you how much room to give your trades and how much risk you're taking. Every strategy should incorporate volatility awareness.

Explore ATR-based strategies in [PRUVIQ's Strategy Builder](/simulate).

[Open Strategy Builder →](/simulate)

---

*This is educational content. Not financial advice. Always backtest before trading.*
