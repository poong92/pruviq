---
title: "Take-Profit 6% to 8%: The Full Decision Process"
description: "10 expert agents analyzed our TP change. 7 said GO, 1 said WAIT, 2 had invalid methodology. Here's exactly how we made the call — with all the data."
date: "2026-02-15"
category: "strategy"
tags: ["tp", "decision", "bb-squeeze", "v1.7.0", "expert-panel"]
---

## The Question

Should we change BB Squeeze SHORT's take-profit from 6% to 8%?

This seems simple. It's not. A wrong decision here means leaving money on the table (if TP is too tight) or never hitting targets (if TP is too wide). The strategy was already verified across 549+ coins. We needed to get this right.

## The Data

We ran the full backtest: **2,898 trades across 535 coins over 2+ years** (Dec 2023 — Feb 2026).

| Metric | TP 6% | TP 8% | Change |
|--------|-------|-------|--------|
| Total PnL | $617 | $794 | **+28.6%** |
| Profit Factor | 2.01 | 2.22 | +10.4% |
| Win Rate | 70.4% | 68.6% | -1.8%p |
| Break-even WR | 62.5% | 55.6% | -6.9%p (more margin) |
| TP Hit Rate | 51.8% | 42.0% | -9.8%p |
| SL Hit Rate | 7.5% | 7.5% | 0% |
| TIMEOUT Rate | 40.7% | 50.5% | +9.8%p |
| TIMEOUT Avg PnL | -1.20% | -0.39% | **67% better** |

Key insight: **TP 8% reduces TP hits but the ones that hit are worth more.** And the timeouts become less painful because positions have more room to recover.

## The Expert Panel

We consulted 10 specialized agents. Each used a different methodology:

| Expert | Verdict | Reasoning |
|--------|---------|-----------|
| Backtester | GO | +28.6% PnL, 535 coins, 2yr+ |
| Strategy Analyst | GO | R:R improvement, 78/100 score |
| Risk Manager | GO | Break-even margin 2.4x wider |
| Execution Compliance | GO | Code reads config dynamically |
| Slippage Auditor | GO | MFE shows 42% reach TP8 |
| Validation Analyst | WAIT | p=0.36 (not statistically significant) |
| Market Regime Monitor | Limited | Only 238 BTC-correlated trades |
| Portfolio Correlation | INVALID | Methodology error in analysis |
| Anomaly Detector | GO | No anomalies in TP8 data |
| Data Quality Engineer | GO | Data integrity confirmed |

**Final tally: 7 GO / 1 WAIT / 2 INVALID**

## The Dissent

The Validation Analyst raised a valid concern: the improvement's p-value was 0.36, meaning there's a 36% chance the difference is random noise.

However, Monte Carlo simulation (10,000 runs) showed TP 8% outperformed TP 6% in **78% of simulations**. The improvement is consistent even if not "statistically significant" by strict academic standards.

We accepted this risk because:
1. The downside is small (win rate drops 1.8%p)
2. The upside is large (+28.6% PnL)
3. Break-even margin **widens** from 5.1%p to 12.2%p (more safety)

## The Most Important Lesson

Before this analysis, we also tested **BTC Regime Filters** — the idea that you should only trade when Bitcoin is trending a certain way.

**6 out of 6 expert analysts recommended this filter as their #1 priority.**

We backtested 4 different regime filter designs across the same 535 coins and 2+ years. Every single one made performance **worse**.

Expert intuition was unanimous and wrong. The data was clear.

This is why PRUVIQ exists. Don't believe the experts. Don't believe the signals. Don't believe the backtest screenshots.

**Pruv it.**

## What Changed

- **v1.7.0** deployed February 15, 2026
- Take-Profit: 6% → 8%
- GUNUSDT blacklisted (single coin responsible for -$378 loss due to implementation bug)
- All other parameters unchanged (SL 10%, 535 coins, $60 positions, 5x leverage)

## Links

- [BB Squeeze SHORT strategy details](/strategies/bb-squeeze-short)
- [Full changelog](/changelog)
- [Why Backtests Lie](/blog/why-backtests-lie)
