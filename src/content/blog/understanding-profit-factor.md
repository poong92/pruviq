---
title: "Understanding Profit Factor in Backtesting"
description: "Profit Factor is the single most useful number in a backtest report. Learn what PF means, what counts as strong vs marginal, and how to use it in PRUVIQ rankings."
date: "2026-03-19"
category: "quant"
tags: ["profit-factor", "backtesting", "metrics", "risk-management"]
---

## What Profit Factor Is

Profit Factor (PF) is the ratio of gross profit to gross loss across all trades in a backtest:

```
Profit Factor = Gross Profit / Gross Loss

Example:
  Total winning trades: $3,200
  Total losing trades:  $1,600
  PF = 3200 / 1600 = 2.0
```

A PF of 2.0 means you made $2 for every $1 you lost. It's the most compressed single-number summary of a strategy's edge — combining win rate and average win size into one figure.

## The PF Scale

```
PF < 1.0   → Losing strategy (losses exceed gains)
PF 1.0–1.5 → Marginal (needs review; small edge easily wiped by costs)
PF 1.5–2.0 → Acceptable (viable if costs are accounted for)
PF 2.0–3.0 → Strong (reliable edge with room to absorb slippage)
PF > 3.0   → Exceptional (rare; verify for overfitting)
```

**The 2.0 threshold matters** because real trading adds costs: exchange fees (~0.16% round-trip), slippage (~0.1% per side), and funding rates. A strategy with PF 1.3 may be profitable on paper but negative after costs. PF 2.0+ gives you enough buffer to survive real execution conditions.

## Why PF Is More Useful Than Win Rate

Win rate alone is misleading:

```
Strategy A: 80% win rate, average win $10, average loss $80
→ Net expectancy per trade: (0.8 × $10) + (0.2 × -$80) = -$8.00
→ PF ≈ 0.5 (losing strategy despite 80% win rate)

Strategy B: 40% win rate, average win $60, average loss $20
→ Net expectancy per trade: (0.4 × $60) + (0.6 × -$20) = +$12.00
→ PF = 2.0 (strong strategy despite only 40% win rate)
```

A strategy can win on most trades and still lose money. PF captures the complete picture because it accounts for both frequency and magnitude of wins and losses.

## PF in PRUVIQ Rankings

PRUVIQ's daily strategy rankings sort by Profit Factor as the primary metric. The ranking table shows:

| Column | What It Tells You |
|--------|------------------|
| PF | Overall edge quality |
| Win Rate | How often trades close profitable |
| Total Trades | Statistical reliability (N < 30 is unreliable) |
| MDD | Worst drawdown experienced during the period |
| Sharpe | Risk-adjusted return quality |

When using the rankings, focus on **PF combined with trade count**. A PF of 4.0 on 8 trades means nothing statistically. A PF of 2.2 on 340 trades is a meaningful signal.

## Common Mistakes When Reading PF

**1. Ignoring trade count**
PF on fewer than 30 trades has wide confidence intervals — it could be luck. Aim for 100+ trades for reliable conclusions.

**2. Ignoring the time period**
A PF of 2.5 over 2 weeks in a bull run may drop to 0.9 in a bear market. Check PF across multiple market regimes.

**3. Using PF without MDD context**
A PF of 2.5 with a 45% max drawdown may not be survivable in practice. PF tells you edge quality, not risk management quality. Both matter.

**4. Trusting very high PF blindly**
PF above 5.0 on any meaningful sample is almost always a sign of overfitting or look-ahead bias. Verify the backtest logic before celebrating.

## Key Takeaway

> Profit Factor is the most compact signal of whether a strategy has a real edge. PF > 2.0 with 100+ trades is the minimum bar worth taking seriously. Below that, real trading costs will likely erase the edge.

Check the live PF rankings for 500+ coins and strategies in [PRUVIQ's Rankings](/rankings).

[View Strategy Rankings →](/rankings)

---

*This is educational content. Not financial advice.*
