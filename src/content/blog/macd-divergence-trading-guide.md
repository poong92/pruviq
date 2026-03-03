---
title: "MACD Explained: Crossovers, Divergence, and What Actually Works"
description: "A no-nonsense guide to MACD in crypto futures. How it works, when to trust it, and how to combine it with other indicators in backtesting."
date: "2026-02-18"
category: "education"
tags: ["macd", "divergence", "momentum", "indicators"]
---

## What MACD Is

MACD (Moving Average Convergence Divergence) measures the relationship between two EMAs. It consists of three components:

```
MACD Line  = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram  = MACD Line - Signal Line
```

When the MACD line is above the signal line, momentum is bullish. When below, bearish. The histogram shows the gap between them — growing histogram means accelerating momentum.

## The Three MACD Signals

### 1. Crossover
```
MACD crosses above Signal → Bullish
MACD crosses below Signal → Bearish
```

The most basic signal. Works in trending markets, generates whipsaws in ranges (same problem as EMA crossovers).

### 2. Zero Line Cross
```
MACD crosses above 0 → Trend turning bullish
MACD crosses below 0 → Trend turning bearish
```

Slower but more reliable than signal crossovers. A MACD above zero means the 12-period EMA is above the 26-period EMA.

### 3. Divergence (The Most Interesting One)
```
Price makes higher high, MACD makes lower high → Bearish divergence
Price makes lower low, MACD makes higher low  → Bullish divergence
```

Divergence suggests momentum is fading even while price continues. It's not a timing signal — divergence can persist for a long time before price reverses.

## MACD in Crypto: The Honest Truth

We've tested MACD-based strategies across 535 coins:

**What works:**
- MACD as a **momentum filter** — confirming other signals
- Histogram direction — showing whether momentum is accelerating or decelerating
- Zero-line position — quick trend direction check

**What doesn't work:**
- MACD crossover as standalone entry — too laggy, too many false signals
- Divergence trading alone — timing is unreliable
- Default parameters on all coins — different coins have different volatility profiles

## MACD in PRUVIQ's Strategy Builder

| MACD Field | Description | Example Use |
|------------|-------------|-------------|
| `macd` | MACD line value | Compare with signal |
| `signal` | Signal line value | Crossover detection |
| `histogram` | MACD - Signal | Momentum strength |
| `crossover` | True on bullish crossover | Entry trigger |

### Example: Squeeze + MACD Momentum

```
SHORT entry conditions:
  1. BB Squeeze detected → volatility compressed
  2. BB expansion >= 10% → squeeze breaking out
  3. MACD histogram < 0 → bearish momentum
  4. EMA fast < EMA slow → bearish trend
  5. Volume ratio >= 2.0 → confirmed move
```

Adding MACD histogram as a momentum filter can reduce false entries during ambiguous squeeze breakouts.

## Tuning MACD Parameters

Default MACD (12, 26, 9) was designed for daily stock charts in the 1970s. For crypto 1-hour charts, you might want:

- **Faster**: (8, 17, 9) — more responsive to crypto volatility
- **Slower**: (19, 39, 9) — fewer signals, more reliable

In the Strategy Builder, adjust these in the indicator parameter tuning panel.

## Key Takeaway

> MACD is a lagging indicator that confirms what already happened. Its power is in filtering — not predicting. Use the histogram for momentum strength, the zero line for trend direction, and divergence for early warning signs.

Build a MACD-based strategy in [PRUVIQ's Strategy Builder](/builder) and backtest it on real data.

[Open Strategy Builder →](/builder)

---

*This is educational content. Not financial advice.*
