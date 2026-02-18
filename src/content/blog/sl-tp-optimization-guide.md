---
title: "SL/TP Optimization: How We Found the Right Stop-Loss and Take-Profit"
description: "The data-driven process behind choosing SL 10% and TP 8%. Why most traders set their stops wrong, and how backtesting 2,898 trades revealed the optimal ratio."
date: "2026-02-18"
category: "education"
tags: ["stop-loss", "take-profit", "risk-reward", "optimization", "backtesting"]
---

## The Most Important Decision in Trading

You found a signal. You entered a trade. Now what?

Two numbers determine whether that trade makes or loses money:
- **Stop-Loss (SL)**: Where you exit if you're wrong
- **Take-Profit (TP)**: Where you exit if you're right

Most traders set these by gut feeling: "2% SL, 6% TP, 1:3 risk-reward." Sounds great on paper. But have you tested it?

## What We Learned from 2,898 Trades

PRUVIQ's verified BB Squeeze SHORT strategy has been backtested across 535 coins over 2+ years. Here's what the data says about SL/TP:

### SL: Tight Stops Kill Profits

| SL Level | SL Hit Rate | Total PnL Impact |
|----------|-------------|-------------------|
| 5% | 24.1% | Worst |
| 7% | 17.5% | Baseline |
| 8% | 11.2% | Better |
| **10%** | **8.0%** | **Best** |
| 12% | 6.3% | Marginal gain, more risk |

**Finding**: Going from SL 7% to SL 10% reduced unnecessary stop-outs by 54%. Many trades that would hit a 7% SL reversed and became profitable.

In crypto, volatility is high. A tight stop means you're right about direction but wrong about timing — and you get stopped out before the move happens.

### TP: Bigger is (Sometimes) Better

| TP Level | TP Hit Rate | Total PnL Impact |
|----------|-------------|-------------------|
| 4% | 51.2% | High hit rate, small wins |
| 6% | 42.0% | Baseline |
| **8%** | **37.0%** | **+24.3% PnL improvement** |
| 10% | 28.5% | Too aggressive |
| 12% | 22.1% | Rarely reached |

**Finding**: TP 8% improved total PnL by +24.3% over TP 6%, despite a lower hit rate. The bigger wins more than compensated for the missed exits.

### The Optimal Ratio

```
Current verified settings: SL 10% / TP 8%
Risk-Reward Ratio: 1:0.8

This is NOT the classic 1:2 or 1:3 ratio.
But it's what the data says works for this strategy on this market.
```

The "ideal" 1:3 R:R ratio is a myth for many strategies. What matters is:
```
Expected Value = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
```

With 68.6% win rate, even a 1:0.8 R:R produces positive expected value:
```
EV = (0.686 × 8%) - (0.314 × 10%) = 5.49% - 3.14% = +2.35% per trade
```

## The Process: How We Optimize

### Step 1: Grid Search
Test every combination of SL (4-15%) and TP (4-15%) on the full dataset. That's 144 combinations × 535 coins = 77,040 simulations.

### Step 2: Avoid Overfitting
Split data into periods:
- **2024**: Training data
- **2025**: First validation
- **2026**: Out-of-sample test

If a parameter works in all three periods, it's likely robust. If it only works in one period, it's overfit.

### Step 3: Consider Timeout
Not every trade hits SL or TP. In our strategy, trades have a 48-hour maximum holding period. What happens to timeout trades matters:

| Config | Timeout Win Rate | Timeout Avg PnL |
|--------|-----------------|-----------------|
| SL 10% / TP 6% | 37% | -1.20% |
| SL 10% / TP 8% | 47% | -0.39% |

TP 8% improved timeout outcomes by 67%. Why? Higher TP means more profit is captured before timeout, even on partial moves.

### Step 4: Stress Test
Run the optimal parameters through:
- **Worst market conditions**: Feb 2026 crash, Aug 2025 selloff
- **Low volatility periods**: Summer 2024, Jan 2025
- **High volatility periods**: Major liquidation events

The parameters must work across all conditions, not just favorable ones.

## Common SL/TP Mistakes

1. **"Tight stops are safer"**: Wrong. Tight stops in volatile markets guarantee you get stopped out constantly. You're trading noise, not signal.

2. **"1:3 R:R or nothing"**: The ideal ratio depends on your win rate. A 75% win rate strategy with 1:0.5 R:R is better than a 30% strategy with 1:3.

3. **"Same stops for all coins"**: Different coins have different volatility. A 5% move in BTCUSDT is rare; in a small-cap, it's Tuesday. Percentage-based stops partially solve this, but volatility-adjusted stops (ATR-based) can be even better.

4. **"Set and forget"**: Market conditions change. The optimal SL/TP in a trending market may differ from a ranging market.

## Try It Yourself

PRUVIQ's [Strategy Builder](/builder) lets you test different SL/TP combinations on any strategy across 535+ coins. Adjust the sliders and see the impact instantly.

The [Interactive Demo](/strategies/bb-squeeze-short) on the BB Squeeze page shows a 5×5 SL/TP grid with pre-computed results. Move the sliders to see how your changes affect win rate, profit factor, and total return.

[Open Strategy Builder →](/builder)

---

*This is educational content based on our backtesting results. Not financial advice. Past performance does not guarantee future results.*
