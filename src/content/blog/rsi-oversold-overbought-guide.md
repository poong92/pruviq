---
title: "RSI: How to Use Oversold and Overbought Signals in Crypto"
description: "Practical guide to RSI (Relative Strength Index) in crypto futures. When it works, when it lies, and how to backtest it on 535+ coins."
date: "2026-02-18"
category: "education"
tags: ["rsi", "indicators", "oversold", "overbought", "mean-reversion"]
---

## What RSI Actually Measures

RSI (Relative Strength Index) is a momentum oscillator that measures the speed and magnitude of price changes. It outputs a number between 0 and 100.

```
RSI > 70  → "Overbought" — price may have risen too fast
RSI < 30  → "Oversold"   — price may have fallen too fast
RSI = 50  → Neutral momentum
```

Most traders learn RSI as a simple buy/sell signal: buy when oversold, sell when overbought. That's the textbook version. Reality is more nuanced.

## The Formula

RSI uses the ratio of average gains to average losses over a lookback period (default: 14 bars):

```
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```

On a 1-hour chart with period 14, RSI looks at the last 14 candles. If most were up, RSI is high. If most were down, RSI is low.

## When RSI Works in Crypto

RSI works best in **range-bound markets** — when price oscillates between support and resistance without a clear trend.

- **Oversold bounce**: In a range, RSI < 30 often precedes a short-term recovery
- **Overbought rejection**: RSI > 70 can signal exhaustion before a pullback
- **Divergence**: Price makes new highs but RSI makes lower highs → momentum is fading

## When RSI Fails

In **strong trends**, RSI stays overbought or oversold for extended periods. During a bull run, RSI > 70 for weeks is normal, not a sell signal. During a crash, RSI < 30 doesn't mean "buy the dip."

This is why RSI alone is not a trading signal. It needs context:
- **Trend direction** — is the market trending or ranging?
- **Volume confirmation** — is real money behind the move?
- **Multiple timeframes** — daily RSI vs. hourly RSI tell different stories

## RSI in PRUVIQ's Strategy Builder

PRUVIQ lets you combine RSI with other indicators to build custom strategies:

| RSI Field | Description | Example Use |
|-----------|-------------|-------------|
| `rsi` | Current RSI value (0-100) | Filter for RSI < 30 |
| `rsi_oversold` | True when RSI < 30 | Entry condition |
| `rsi_overbought` | True when RSI > 70 | Exit filter |

### Example: BB Squeeze + RSI Confirmation

Combine volatility compression with momentum:

```
Entry conditions:
  1. BB Squeeze detected (volatility compressed)
  2. BB expansion >= 10% (squeeze breaking out)
  3. RSI < 40 (momentum not overextended)
  4. Volume ratio >= 2.0 (real buying/selling)
```

This filters out squeeze breakouts where momentum is already exhausted.

## The Honest Assessment

We backtested RSI-only strategies across 535 coins over 2+ years:
- **RSI < 30 Buy**: Slightly profitable in ranges, destroyed in downtrends
- **RSI > 70 Sell**: Works in ranges, fails during bull runs
- **RSI + Trend filter**: Significantly better, but still not our best strategy

RSI is a **filter**, not a signal generator. It's most powerful when combined with volatility and volume indicators.

## Try It Yourself

Build a strategy using RSI in [PRUVIQ's Strategy Builder](/builder). Select the RSI indicator, set your conditions, and backtest on 535+ coins with 2+ years of data. Free.

[Open Strategy Builder →](/builder)

---

*This is educational content. Not financial advice. RSI is one of many tools — never rely on a single indicator.*
