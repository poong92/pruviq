---
title: "Position Sizing with Kelly Criterion for Crypto Trading"
description: "How to calculate optimal position size using Kelly Criterion. Practical guide with real trading examples and the math behind bankroll management."
date: "2026-02-15"
category: "quant"
tags: ["kelly-criterion", "position-sizing", "risk-management", "math"]
---

How much should you risk per trade? Too little and you barely grow. Too much and one losing streak wipes you out. Kelly Criterion gives a mathematically optimal answer.

## What Is the Kelly Criterion?

The Kelly Criterion is a formula that tells you what fraction of your capital to bet on each trade, given your win rate and payoff ratio. It was developed by John Kelly at Bell Labs in 1956 and is used by professional gamblers, traders, and investors.

**The formula**:

```
Kelly % = W - (1 - W) / R

Where:
W = Win probability (e.g., 0.70 for 70% win rate)
R = Win/Loss ratio (average win ÷ average loss)
```

## A Real Example

Using our BB Squeeze SHORT strategy's backtested numbers:

- **Win rate (W)**: 70.4%
- **Average win**: 5.2% of position
- **Average loss**: 7.8% of position
- **Win/Loss ratio (R)**: 5.2 / 7.8 = 0.667

```
Kelly % = 0.704 - (1 - 0.704) / 0.667
Kelly % = 0.704 - 0.444
Kelly % = 0.26 (26% of capital per trade)
```

**Full Kelly says risk 26% per trade.** But in practice, no one uses full Kelly.

## Why Full Kelly Is Dangerous

Full Kelly optimizes for maximum long-term growth rate, but the ride is brutal:

- **Expected drawdowns**: 50-90% drawdowns are mathematically normal at full Kelly
- **Assumption of perfect edge**: Your actual win rate and payoff ratio have estimation error
- **No margin of safety**: Any overestimation of your edge leads to massive losses

**The solution: Fractional Kelly**

Most practitioners use 1/4 to 1/2 Kelly:

| Fraction | Our Example | Risk per Trade |
|----------|------------|---------------|
| Full Kelly | 26% | Extremely risky |
| 1/2 Kelly | 13% | Aggressive |
| 1/4 Kelly | 6.5% | Moderate |
| 1/10 Kelly | 2.6% | Conservative |
| 1/20 Kelly | 1.3% | Very conservative |

## What We Actually Use

We use approximately **1/20 Kelly** (2% of capital per trade):

- Capital: $3,000
- Position: $60 (2% of capital)
- Leverage: 5x
- Effective exposure: $300 per trade

**Why so conservative?**

1. **Multiple simultaneous positions**: We can have up to 100 positions open. If each risked 6.5% (1/4 Kelly), 15 simultaneous positions would risk 97.5% of capital.

2. **Estimation uncertainty**: Our backtested win rate (70.4%) differs from live (54.69% in first 7 days). The real edge is somewhere between. Conservative sizing protects against this uncertainty.

3. **Correlation risk**: In crypto, when BTC drops, most altcoins drop together. Simultaneous losses across 50 positions are not independent events.

4. **Survival priority**: The first rule of trading is to survive. A 50% drawdown requires a 100% gain to recover. A 20% drawdown only requires 25%.

## Position Sizing with Leverage

A critical mistake: forgetting that leverage multiplies both exposure and risk.

```
# Without leverage
Position size = $60
Risk if 10% SL hit = $6 (0.2% of $3,000 capital)

# With 5x leverage
Position size = $60, but controls $300
Risk if 10% SL hit = $30 (1% of $3,000 capital)
```

**Kelly must account for leverage**:

```
Effective Kelly position = Kelly % / Leverage
= 26% / 5 = 5.2% of capital per position

At 1/20 Kelly with 5x leverage:
= 5.2% / 20 = 0.26% per position
→ $3,000 * 0.026 = ~$78 per position
```

Our $60 per position is slightly below this, giving extra margin of safety.

## Practical Position Sizing Framework

Here's a step-by-step approach:

### Step 1: Calculate Your Edge

Use at least 500 trades of data (backtest or live):
- Win rate
- Average win %
- Average loss %

### Step 2: Apply Kelly Formula

```
Kelly % = W - (1-W) / R
```

### Step 3: Choose Your Fraction

- **Aggressive (1/4 Kelly)**: You're confident in your edge, have limited positions, low correlation
- **Moderate (1/10 Kelly)**: Multiple positions, some correlation, moderate confidence
- **Conservative (1/20 Kelly)**: Many simultaneous positions, high correlation (crypto), uncertain edge

### Step 4: Account for Leverage

Divide by your leverage multiplier.

### Step 5: Verify with Maximum Drawdown

Run a Monte Carlo simulation with your position size:
- Simulate 10,000 random sequences of trades
- Check: What's the worst-case drawdown?
- If max drawdown > 30%, reduce position size

## The Mathematical Edge of Survival

Consider two traders:

**Trader A** (aggressive): 10% per trade, 70% win rate
- After 10 consecutive losses (probability: 0.0006%): -65% drawdown
- Needs +186% to recover

**Trader B** (conservative): 2% per trade, 70% win rate
- After 10 consecutive losses: -18% drawdown
- Needs +22% to recover

Both have the same edge. But Trader B survives any streak the market throws at them. In our backtest, we found stretches of 10 consecutive losing days. At 2% per trade, these periods are uncomfortable but survivable.

## Key Takeaways

1. **Kelly Criterion gives the mathematically optimal bet size**, but full Kelly is too aggressive for real trading
2. **Use fractional Kelly** — 1/10 to 1/20 is appropriate for crypto with multiple positions
3. **Always account for leverage** when calculating position sizes
4. **Correlation matters** — 50 crypto positions are not 50 independent bets
5. **Survival beats optimization** — a small consistent edge with proper sizing beats a large edge with reckless sizing

---

*PRUVIQ uses 1/20 Kelly sizing with $60 positions at 5x leverage. See our [risk management approach](/blog/risk-management-101) and [live results](https://t.me/PRUVIQ).*
