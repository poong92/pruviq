---
title: "Why Most Backtests Are Lies"
description: "Look-ahead bias, overfitting, and the gap between backtested +2000% and live -30%. How to spot fake results."
date: "2026-02-13"
category: "quant"
tags: ["backtesting", "overfitting", "look-ahead-bias"]
---

## The Fantasy vs Reality Gap

Every crypto bot on Twitter shows a backtest with insane returns. +500%. +2,000%. "Proven profitable."

Then you run it live and lose 30% in a week.

This isn't bad luck. The backtest was a lie from the start.

## The Three Lies of Crypto Backtests

### 1. Look-Ahead Bias

The most common and most dangerous.

```
Backtest thinks: "The candle closed bearish, volume spiked → SHORT"
Reality at 10:01: "The candle is still forming. I can't see the close."
```

If your backtest uses the *current* candle's data to make decisions, it's using information that doesn't exist yet in live trading. This alone can turn a losing strategy into a "winning" one.

**PRUVIQ's rule:** Only use the *previous* completed candle for signals. The current candle is only used for entry price.

### 2. Overfitting

You test 50 parameter combinations and pick the best one. Of course it looks good — you optimized it to fit historical data perfectly.

But markets change. What worked in 2024 Q1 might fail in 2024 Q3.

**How to detect it:**
- Does it work across multiple time periods? (2023, 2024, 2025)
- Does it work on out-of-sample data?
- Is the win rate suspiciously high? (>75% on a single signal = suspicious)

### 3. Ignoring Real Trading Costs

Backtests assume perfect fills at exact prices. Live trading has:
- **Slippage** — you don't get the price you want
- **Funding rates** — holding futures costs money
- **Partial fills** — your order might not fully execute
- **Latency** — signals arrive faster than execution

A strategy that backtests at +50% might be +5% or negative after costs.

## Our Most Important Lesson

We learned this the hard way. A momentum strategy backtested at +400%. We ran it through rigorous validation. It had a negative expectancy — the math didn't work.

The problem? A one-candle indexing error. The backtest was using `current` instead of `previous` candle data. One line of code. One killed strategy.

## How to Verify a Backtest

Ask these questions:

| Question | Red Flag |
|----------|----------|
| Which candle data is used for signals? | Current candle = look-ahead bias |
| How many parameter combinations were tested? | Many = likely overfit |
| Is out-of-sample testing shown? | No = probably only works on training data |
| Are trading costs included? | No = unrealistic returns |
| Does the backtest code match live code? | Different = apples to oranges |

## The Rule

> If you can't prove a strategy works on data it has never seen, don't trade it with real money.

This is the foundation of everything PRUVIQ builds. Every strategy goes through out-of-sample validation before it touches a live exchange.

---

*This is educational content. Not financial advice.*
