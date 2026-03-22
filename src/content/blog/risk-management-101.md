---
title: "Risk Management: The Only Edge That Lasts"
description: "Position sizing, stop losses, and why managing risk matters more than finding the perfect entry. Practical guide for futures traders."
date: "2026-02-12"
category: "education"
tags: ["risk-management", "position-sizing", "stop-loss"]
---

## The Uncomfortable Truth

Most traders spend 90% of their time on entries and 10% on risk management. It should be the opposite.

A mediocre strategy with great risk management will survive. A great strategy with poor risk management will blow up. It's not a matter of *if*, but *when*.

## The Math of Ruin

| Loss | Gain Needed to Recover |
|------|----------------------|
| -10% | +11.1% |
| -25% | +33.3% |
| -50% | +100% |
| -75% | +300% |
| -90% | +900% |

A 50% drawdown requires a 100% gain just to break even. In crypto with 5x leverage, a 10% adverse move = 50% loss on your position. This is why most leveraged traders get wiped out.

## PRUVIQ's Risk Framework

### 1. Position Sizing

```
Account: $10,000
Position: $200 (2% of account)
Leverage: 5x
Exposure: $1,000 (10% of account)
```

No single trade can ruin the account. Even 10 consecutive stop-losses only cost ~$60 (about 2% of the account, since each individual SL loss is capped).

### 2. Hard Stop-Loss on Every Trade

No exceptions. No "let it ride." No moving the stop.

The stop-loss is set *before* entry and managed by the exchange, not by the bot. If the bot crashes, the stop-loss still triggers.

### 3. Daily Loss Limit

If the account loses 7% in a single day, all new entries are paused. This prevents spiral losses during extreme market events.

### 4. Maximum Drawdown

If the account drops 20% from peak, the system is halted for review. No automated recovery attempts. Manual review required.

## The Kelly Criterion (Simplified)

How much of your account should you risk per trade?

```
Kelly % = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
          ÷ Avg Win

Example (with leverage):
Win Rate: 55%, Avg Win: 6%, Avg Loss: 10%
Kelly = (0.55 × 6) - (0.45 × 10) ÷ 6
Kelly ≈ -0.2% → negative!
```

Wait — negative Kelly? That means with these raw numbers, the strategy shouldn't be traded at all?

Not exactly. Kelly assumes infinite trades and perfect execution. In practice, strategies with near-zero or slightly negative Kelly can still be profitable with careful position sizing and trade filtering. But it's a warning: **the edge is thin**.

This is why PRUVIQ uses small position sizes and extensive filtering. The strategy doesn't have a massive edge — it has a *consistent, small* edge that compounds over many trades.

## Common Mistakes

1. **Risking too much per trade** — 10% per trade means 5 losses = 50% drawdown
2. **No stop-loss** — "it'll come back" is the most expensive sentence in trading
3. **Averaging down** — adding to losers doubles your risk, not your edge
4. **Ignoring correlation** — 100 SHORT positions in a bull run = 100x the same bet
5. **Leverage without limits** — 20x feels great until a 5% move liquidates you

## The Bottom Line

> Risk management isn't about avoiding losses. It's about ensuring no single loss — or series of losses — can end your ability to trade.

The best traders aren't the ones with the highest win rate. They're the ones still trading after 5 years.

## The Math Behind Position Sizing

Position sizing is not guesswork — it is mathematics. Three main approaches exist, each with trade-offs.

### Kelly Criterion (Full Kelly)

The Kelly formula tells you the theoretically optimal bet size to maximize long-term growth:

```
Kelly % = W - (1 - W) / R
Where:
  W = Win rate (probability of winning)
  R = Win/Loss ratio (average win ÷ average loss)

Example:
  Win rate: 55%, Avg win: $60, Avg loss: $100
  R = 60/100 = 0.6
  Kelly = 0.55 - (0.45 / 0.6) = 0.55 - 0.75 = -0.20
```

A negative Kelly means the strategy has negative expected value at these parameters — do not trade it. A positive Kelly (say 0.15) means you should risk 15% of your account per trade. But here is the problem: **full Kelly is extremely aggressive**. It assumes perfect knowledge of your win rate and ratio, which you never have in live trading. One wrong estimate and you are oversizing massively.

### Fractional Kelly (What Professionals Use)

Most professional traders use **half Kelly** or **quarter Kelly** — dividing the Kelly percentage by 2 or 4. This sacrifices some theoretical growth for dramatically reduced volatility and drawdown risk.

- Full Kelly: Maximum growth, but 50%+ drawdowns are common
- Half Kelly: ~75% of the growth rate, drawdowns cut roughly in half
- Quarter Kelly: ~50% of the growth rate, very smooth equity curve

For a strategy with 0.20 full Kelly, half Kelly would be 0.10 (risk 10% per trade) and quarter Kelly would be 0.05 (risk 5% per trade). Given the uncertainty in crypto markets, quarter Kelly is often the right choice.

### Fixed Fractional (The Simplest Approach)

If math is not your thing, fixed fractional is straightforward: risk a fixed percentage of your current account on every trade. The most common choice is **1-2% per trade**.

```
Account: $10,000
Risk per trade: 1% = $100
Stop-loss: 10%
Position size: $100 / 0.10 = $1,000
With 5x leverage: $200 margin
```

The beauty of fixed fractional is that it automatically scales — as your account grows, positions grow. As your account shrinks from losses, positions shrink, protecting you from ruin. It is not mathematically optimal, but it is robust to estimation errors and easy to implement. For a deeper exploration of these concepts with real examples, see our [Kelly Criterion guide](/blog/position-sizing-kelly-criterion).

## Maximum Drawdown: The Metric That Matters Most

Win rate gets the glory, but **Maximum Drawdown (MDD)** determines survival. MDD measures the largest peak-to-trough decline in your account equity — it tells you the worst pain you will experience.

### Why MDD Matters More Than Returns

A strategy returning 100% annually sounds amazing until you learn its MDD is 60%. During that 60% drawdown, you need a **150% gain** just to get back to your previous peak. The recovery math is brutal and non-linear:

| Drawdown | Gain Needed to Recover | Time to Recover (at 20% annual) |
|----------|----------------------|-------------------------------|
| 10% | 11.1% | ~7 months |
| 20% | 25.0% | ~15 months |
| 30% | 42.9% | ~2+ years |
| 50% | 100.0% | ~4+ years |
| 75% | 300.0% | ~9+ years |

### Historical Examples

- **BTC spot holders in 2022**: Peak at $69,000, bottom at $15,500 — a 77.5% drawdown. Recovery took until March 2024 (about 16 months from the bottom, but 27 months from the peak).
- **Leveraged altcoin traders in May 2024**: Many experienced 90%+ account drawdowns in a single week. At 5x leverage, a 20% drop in your asset means your entire margin is gone.
- **PRUVIQ's BB Squeeze strategy**: Our backtests show a portfolio-level MDD of ~33%. We set our hard limit at 20% — if the account drops 20% from peak, the system halts for manual review.

### Setting Your MDD Limit

Your MDD tolerance depends on your psychology and capital source. A general framework:

- **Conservative (pension/savings)**: Max 10% MDD → use 1x-2x leverage, tight stops
- **Moderate (risk capital)**: Max 20% MDD → use 3x-5x leverage, standard stops
- **Aggressive (small speculative account)**: Max 40% MDD → higher leverage acceptable, but accept the recovery math

The key insight: **choose your MDD limit before you start trading, not during a drawdown**. When you are down 30%, emotion makes every decision worse.

## Correlation Risk: The Hidden Killer

Most traders think they are diversified because they hold 10 different altcoin positions. They are not. In crypto, **correlation is the hidden killer** that turns diversification into an illusion.

### The Correlation Problem

During normal market conditions, altcoins have moderate correlation with BTC (roughly 0.5-0.7). During market crashes, this correlation spikes to 0.90+. This means when you need diversification most — during a crash — it disappears entirely.

**Real example**: On June 7, 2024, BTC dropped 4.2% in one hour. Among the top 50 altcoins, 48 dropped between 5-12% in the same hour. If you held 10 long positions across different altcoins, all 10 lost money simultaneously. Your "diversified" portfolio behaved like a single 10x-sized BTC long.

### Actual Diversification in Crypto

True diversification in crypto requires **directional diversity**, not just asset diversity:

- Mix long and short positions (our system runs both directions)
- Include uncorrelated strategies (momentum + mean-reversion tend to be negatively correlated)
- Size correlated positions as a group, not individually — if you have 5 altcoin longs, treat them as one position and size accordingly
- Consider exposure to BTC dominance: when BTC dominance rises, alts underperform regardless of individual merit

The lesson is painful but simple: in crypto, the only reliable diversification is **strategy diversification**, not coin diversification. This is one reason we [test and compare multiple strategies](/strategies) rather than relying on a single approach.

## Stop-Loss Strategies Compared

A stop-loss is not optional — it is the difference between a controlled loss and a blown account. But not all stop-loss methods are equal. Here are the four main approaches.

### 1. Fixed Percentage Stop

**How it works**: Set the stop at a fixed percentage below (for longs) or above (for shorts) the entry price. Example: 10% stop on a long entered at $100 triggers at $90.

**Pros**: Simple, consistent, easy to backtest. Works well for systematic strategies.
**Cons**: Ignores volatility. A 10% stop on a low-volatility coin (daily range 3%) gives plenty of room. The same 10% stop on a high-volatility coin (daily range 8%) gets triggered by normal noise.

**Best for**: Systematic/algo trading where consistency matters more than per-trade optimization.

### 2. ATR-Based Stop

**How it works**: Set the stop at a multiple of the Average True Range (ATR). Example: 2x ATR(14) on a coin with ATR of $5 means your stop is $10 from entry. For a detailed guide on ATR, see our [ATR volatility guide](/blog/atr-volatility-guide).

**Pros**: Automatically adjusts to volatility. Tight on calm coins, wide on volatile ones. Reduces false stop-outs.
**Cons**: Harder to calculate mentally. Position sizing becomes more complex since the dollar risk per trade varies.

**Best for**: Discretionary traders and strategies that trade across assets with different volatility profiles.

### 3. Trailing Stop

**How it works**: The stop moves in the direction of profit but never moves back. Example: a 5% trailing stop on a long that moves from $100 to $120 would be at $114 (5% below the $120 high).

**Pros**: Captures large trends. Lets winners run while protecting gains.
**Cons**: Gets whipsawed in choppy markets. A coin that rallies 15%, dips 6%, then rallies another 20% would stop you out during the dip, missing the second leg. The [SL/TP optimization guide](/blog/sl-tp-optimization-guide) explores these trade-offs in detail.

**Best for**: Trend-following strategies in strongly trending markets.

### 4. Time-Based Stop

**How it works**: Close the position after a fixed time regardless of profit/loss. Example: close after 24 hours if the trade has not moved beyond +2%.

**Pros**: Prevents capital from being tied up in dead trades. Eliminates the "it'll come back" mentality.
**Cons**: May exit profitable trades prematurely. Ignores the actual chart setup.

**Best for**: Mean-reversion strategies or when you want to enforce discipline about opportunity cost.

### Which Should You Use?

For beginners: start with **fixed percentage** (8-12% for crypto futures with 5x leverage). It is predictable and easy to manage. As you gain experience, consider ATR-based stops for better volatility adjustment. Use trailing stops only for trend-following strategies where you have backtested their impact.

## Building a Risk Framework: Template

Theory is useless without a concrete plan. Here is a risk framework template you can adapt to your own trading.

### The Risk Framework

```
═══════════════════════════════════════════
         MY RISK FRAMEWORK v1.0
═══════════════════════════════════════════

Account Size:        $________
Max Risk Per Trade:  ___% ($________)
Max Open Positions:  ___
Max Portfolio Heat:  ___%
Max Daily Loss:      ___% → pause all trading
Max Drawdown:        ___% → halt system, manual review
Leverage:            ___x (fixed, no adjustment mid-trade)
Margin Mode:         Isolated (always)
Stop-Loss Method:    Fixed / ATR / Trailing
Default Stop-Loss:   ___%
Position Sizing:     Fixed fractional ___%

═══════════════════════════════════════════
         RULES (NO EXCEPTIONS)
═══════════════════════════════════════════

□ Stop-loss set BEFORE entry — always
□ Never move a stop-loss further from entry
□ Never add to a losing position
□ If daily loss limit hit → no new trades until tomorrow
□ If MDD limit hit → stop everything, review for 48 hours
□ Log every trade: entry reason, exit price, result
□ Review weekly: win rate, PF, MDD, avg hold time
═══════════════════════════════════════════
```

### Example: Filled In

```
Account Size:        $10,000
Max Risk Per Trade:  2% ($200)
Max Open Positions:  5
Max Portfolio Heat:  15%
Max Daily Loss:      5% → pause all trading
Max Drawdown:        20% → halt system, manual review
Leverage:            5x
Margin Mode:         Isolated
Stop-Loss Method:    Fixed percentage
Default Stop-Loss:   10%
Position Sizing:     Fixed fractional 2%
```

With these settings: each trade uses $200 margin at 5x = $1,000 exposure. A 10% stop means max loss is $100 per trade (1% of account). Five positions at max risk = 5% portfolio heat, well under the 15% limit. This framework kept the PRUVIQ system alive through multiple market corrections.

## Real Example: How We Apply Risk Rules at PRUVIQ

Theory is easy. Discipline is hard. Here is how our risk rules have worked in practice — including when they cost us money in the short term but saved us in the long term.

### Killed Strategies: Risk Rules in Action

We have [killed four strategies](/strategies) that failed our risk criteria. The most instructive example is **Momentum LONG**: it had a 37.5% win rate and a profit factor below 1.0. The Kelly Criterion produced a negative value, meaning the strategy had negative expected value. Despite showing occasional spectacular wins, the math said stop — so we stopped.

Another example: **BB Squeeze LONG** had a 51% win rate — barely above a coin flip. With a profit factor below 1.0 after fees, every trade eroded capital. Our risk framework flagged it: if a strategy cannot sustain a profit factor above 1.0 across 1,000+ simulated trades, it gets killed. No second chances, no "let me tweak one more parameter."

### MDD Limits in Practice

Our hard MDD limit is 20%. During the late-January 2026 correction, our simulated portfolio hit -16.8%. At that point, the system was one bad day from halting. Positions were reduced, and only the highest-conviction setups were taken. The portfolio recovered within 3 weeks — but if it had hit -20%, we would have paused entirely and reviewed the strategy parameters before resuming.

### The Cost of Discipline

Our risk framework means we miss trades. When portfolio heat is at the limit and a great setup appears, we skip it. When MDD is near the threshold, we reduce size and miss potential gains. Over a year, these missed opportunities probably cost 10-20% in unrealized returns. But they also prevent the 50%+ drawdowns that end most traders' careers. The math is clear: **survival beats optimization**. Explore more in our [backtest guide](/blog/how-to-backtest-crypto-strategy) and [why backtests lie](/blog/why-backtests-lie).

## FAQ

**How much should I risk per trade as a beginner?**
Start with 1% of your total account. If you have $5,000, risk $50 per trade maximum. Once you have 200+ trades of data and a proven positive expectancy, you can consider increasing to 2%. Never go above 2% unless you have a mathematically validated edge and the emotional discipline to handle drawdowns.

**Is a 50% win rate bad?**
Not necessarily — it depends on your risk-reward ratio. A 50% win rate with an average win of $200 and average loss of $100 gives a profit factor of 2.0, which is excellent. Win rate alone means nothing without context. What matters is **expectancy**: `(Win Rate × Avg Win) - (Loss Rate × Avg Loss)`. If that number is positive after fees, you have an edge. See our breakdown of [profit factor](/blog/understanding-profit-factor) for more.

**Should I use cross margin or isolated margin?**
Isolated margin, always, unless you are running a sophisticated hedged portfolio where cross margin is part of the strategy. Isolated margin caps your loss per position. Cross margin means one bad trade can liquidate your entire account. The capital efficiency gain from cross margin is not worth the catastrophic tail risk for the vast majority of traders.

---

*This is educational content. Not financial advice.*
