---
title: "Candlestick Patterns: Which Ones Actually Work in Crypto?"
description: "A data-driven look at candlestick patterns. Classic patterns like doji, hammer, and engulfing — do they predict crypto price moves?"
date: "2026-02-20"
category: "education"
tags: ["candlestick", "patterns", "price-action", "doji", "engulfing"]
---

## Candlestick Basics

Each candlestick shows four prices for one time period:

```
Bullish (green):          Bearish (red):
    ─── High                  ─── High
    │                         ┌──┐
    ┌──┐ ← Close             │  │ ← Open
    │  │                      │  │
    │  │ ← Open              └──┘ ← Close
    └──┘                         │
    │                         ─── Low
    ─── Low
```

The body shows open-to-close range. Wicks (shadows) show the high and low extremes.

## Single Candle Patterns

### Doji (Indecision)
```
    ─── High
    │
    ─ ← Open = Close (tiny body)
    │
    ─── Low
```
Open and close are nearly equal. Neither bulls nor bears won. Often signals a potential reversal — but only with context.

**In crypto reality**: Doji appears constantly on shorter timeframes. Standalone doji has near-zero predictive value. Only meaningful at extremes (after strong trends, at key levels).

### Hammer / Hanging Man
```
Hammer (bullish):     Hanging Man (bearish):
    ┌─┐                    ┌─┐
    └─┘                    └─┘
     │                      │
     │ (long lower wick)    │ (long lower wick)
     ─                      ─
```
Long lower wick, small body at the top. Hammer appears after a downtrend (bullish). Hanging man appears after an uptrend (bearish).

**In crypto reality**: Somewhat useful on daily timeframes. The long wick shows rejection of lower prices. Better when combined with volume and support levels.

### Shooting Star / Inverted Hammer
```
     ─
     │ (long upper wick)
    ┌─┐
    └─┘
```
Opposite of hammer. Long upper wick shows rejection of higher prices.

## Multi-Candle Patterns

### Engulfing
```
Bullish Engulfing:        Bearish Engulfing:
  ┌─┐                      ┌───┐
  │R│  ┌───┐               │ G │  ┌───┐
  └─┘  │ G │               └───┘  │ R │
       │   │                      │   │
       └───┘                      └───┘
```
Second candle completely "engulfs" the first. Bullish engulfing = green candle engulfs previous red. Signals reversal.

**In crypto reality**: One of the more reliable patterns when it occurs at key support/resistance on higher timeframes. Still requires confirmation.

### Morning Star / Evening Star
Three-candle reversal pattern:
```
Morning Star (bullish):    Evening Star (bearish):
┌───┐                              ┌───┐
│ R │                              │ G │
│   │  ┌─┐                        │   │  ┌─┐
└───┘  └─┘  ┌───┐          ┌───┐  └───┘  └─┘
             │ G │          │ R │
             └───┘          └───┘
```
1. Large candle in trend direction
2. Small-bodied candle (indecision)
3. Large candle in opposite direction

## What Backtesting Shows

We've run candlestick pattern recognition across 535+ coins on 1H timeframes:

| Pattern | Win Rate (standalone) | Verdict |
|---------|----------------------|---------|
| Doji | ~50% | No better than coin flip |
| Hammer | ~52% | Slight edge, needs confirmation |
| Engulfing | ~53% | Best standalone, still marginal |
| Morning/Evening Star | ~54% | Decent, but rare occurrence |
| Three White Soldiers | ~51% | Unreliable in crypto |

**The uncomfortable truth**: No single candlestick pattern produces a tradeable edge in crypto when used alone. The win rates are barely above random.

## When Patterns Add Value

Candlestick patterns work as **confirmation**, not signals:

1. **At key levels**: Hammer at support = meaningful. Hammer in the middle of nowhere = noise
2. **With volume**: Engulfing with 3x average volume = strong. Engulfing with low volume = weak
3. **On higher timeframes**: Daily doji at all-time high = noteworthy. 5-minute doji = meaningless
4. **After strong moves**: Reversal patterns need something to reverse

## How PRUVIQ Uses Candlestick Data

The BB Squeeze strategy uses a simple but effective candlestick element:

```
Bearish candle (close < open) = confirmation for SHORT entry
```

Not a complex pattern — just a basic directional filter. This simplicity often outperforms elaborate pattern recognition.

## Key Takeaway

> Candlestick patterns are a visual language for understanding buyer/seller dynamics, not prediction tools. They add value as confirmation at key levels with volume, but alone they're barely better than random. In crypto, simpler is usually better.

Test candlestick-based strategies in [PRUVIQ's Strategy Builder](/simulate).

[Open Strategy Builder →](/simulate)

---

*This is educational content. Not financial advice. Always backtest before trading.*
