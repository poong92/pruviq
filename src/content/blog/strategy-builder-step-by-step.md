---
title: "How to Use PRUVIQ's Strategy Builder: A Step-by-Step Guide"
description: "Design, backtest, and iterate no-code crypto trading strategies using PRUVIQ's Strategy Builder. Practical workflow, examples, and robustness checks to move from idea to conviction."
date: "2026-02-27"
category: "education"
tags: ["strategy-builder", "backtesting", "how-to", "pruviq", "trading"]
---

Building a trading strategy is an iterative process: idea → rules → backtest → iterate → validation → live test. PRUVIQ's Strategy Builder is designed to remove the friction between idea and evidence: no code, fast cross-coin backtests, and transparent metrics so you can judge whether a hypothesis is real or just curve-fit noise.

This guide walks you through a practical, repeatable workflow to design, test, and improve a strategy using the Builder. It assumes you have a basic trading idea (mean-reversion, breakout, trend-following) and want to validate it quickly and honestly.

Why this matters

- Speed: run a full backtest across 500+ coins in seconds and find where a signal generalizes.
- Honesty: the Builder uses completed candles, realistic fees/slippage, and multi-coin testing to reduce the gap between backtest and live trading.
- Iteration: parameter sweeps and presets let you iterate without rewriting code.

If you prefer to jump straight in, open the Strategy Builder (or the Simulate page) and follow the steps below: /builder → /simulate.

## What the Strategy Builder gives you

- Visual rule composer: pick indicators (RSI, EMA, Bollinger, ATR, MACD, Stochastic, Volume, ADX) and combine them with AND / OR logic and comparison operators.
- Entry & exit configuration: time filters, entry confirmation, stop-loss, take-profit, and trailing exits.
- Position sizing options: fixed dollar, percent of equity, or ATR-based sizing.
- Cross-coin backtests: run the same rules across many coins to measure robustness and sample size.
- Presets & sharing: start from a preset, tweak, and save your own preset for later.
- Metrics and charts: trades table, equity curve, distribution, win rate, profit factor, max drawdown, and tradelist with entry/exit markers.

The Builder is shipped in the Simulate page. If you haven't used it, open /simulate and look for "Create new strategy".

## Before you start: the prep checklist

1. Define a clear hypothesis: e.g., "RSI(14) below 30 on the 1h chart combined with price above EMA(50) produces short-term mean reversion entries on liquid altcoins." Keep it single-minded.
2. Pick a timeframe and capital assumptions: timeframe (1m/5m/1h/daily), starting capital, leverage limits, and per-trade risk. Document them—this is your experiment spec.
3. Choose the coin universe or leave it broad: start with a focused universe (top 50 by volume) to validate quickly; later expand to 500+ coins for robustness testing.
4. Decide which variables you'll sweep: SL %, TP %, RSI threshold, timeframe for confirmation.

Documenting these choices before running a test prevents accidental overfitting during optimization.

## Step-by-step: build, run, and interpret

### 1) Start with a simple rule (minimum viable strategy)

Complex strategies are tempting but fragile. Begin with one clean rule for entry and one clear rule for exit. Example (in Builder terms):

- Entry: RSI(14) < 30 AND Close > EMA(50)
- Exit: TakeProfit = 2.0× risk, StopLoss = 1.0× risk (fixed price or ATR-based)

The Builder UI lets you add an "Indicator" condition and chain additional conditions with AND/OR. Keep the logic readable and testable.

### 2) Choose realistic execution and costs

Select the order type the strategy would use in live trading (market or limit), and set realistic slippage and fees. PRUVIQ simulates fees and slippage—make conservative assumptions. Always use completed candles for signal calculation and use the next candle's open/close as your fill price when simulating.

Tip: The platform's default fees and slippage are reasonable, but if you plan to trade a specific exchange, mirror that exchange's maker/taker fees.

### 3) Configure position sizing and risk rules

Good sizing rules reduce tail risk. In the Builder choose:

- Fixed dollar sizing (e.g., $50 per trade) OR
- Percent of equity (e.g., 1% per trade) OR
- ATR-based sizing (risk = x × ATR)

Set max open positions and per-coin limits. These constraints are part of the realistic simulation—don’t ignore them.

### 4) Select coins and the historical window

Start with a focused subset (top liquidity) to get fast feedback, then expand to 500+ coins to test generality. Use at least 1–2 years of history where possible: different market regimes expose weak strategies.

Example flow:
- Quick check: top 30 coins, last 1 year → see if the idea shows promise
- Robustness test: 500+ coins, 2+ years → confirm sample size and drawdown behavior

### 5) Run the backtest and read the key metrics

When the Builder finishes, focus on these numbers:

- Trades (sample size): more trades → more confidence
- Win rate: tells you frequency of winners (not the whole story)
- Profit factor: gross profits / gross losses (higher is better; beware extremely high values)
- Expectancy per trade: average net P&L per trade
- Max drawdown: largest simulated equity drop (risk control)
- Equity curve and monthly returns: look for smoothness and regime-specific collapses

Interpretation rules:
- If profit factor < 1.2 or trades < 200, don't get excited.
- A strategy that only works on a few coins or a single regime is likely overfit.

### 6) Iterate with parameter sweeps (but avoid blind optimization)

The Builder supports sweeping parameters (e.g., RSI threshold 25–35, SL 0.5%–2%). Run a grid or randomized sweep but use a strict validation protocol:

- Reserve an out-of-sample period (last 6 months) from the start
- Optimize on older data only, then validate on the reserved period
- Keep the number of free parameters small; prefer coarse, meaningful buckets over fine-grained tuning

Blindly tuning until you get great backtest numbers is the quickest path to failure.

### 7) Run robustness checks

Do several automated checks:

- Out-of-sample validation (OOS): confirm performance on unseen data
- Walk-forward validation: re-optimize on rolling windows and measure stability
- Monte Carlo / trade-shuffle: randomize trade order or returns to test sensitivity
- Slippage / fee sensitivity: increase costs and verify the strategy survives

If any single check breaks the strategy completely, treat it as low-confidence.

### 8) Move from backtest to forward testing

If the strategy passes the robustness checks:
- Paper trade or forward-simulate with small capital for a period (weeks to months)
- Log every signal and fill, and compare live fills to simulated fills
- Only scale after the live results are consistent with simulation

Forward testing is the true filter between hypothesis and a deployable strategy.

## Example: quick mean-reversion recipe (builder-ready)

This example shows a minimal, copy-paste friendly rule you can enter into the Builder.

Hypothesis: short-term mean reversion on 1h time frame for liquid altcoins.

Builder settings (example):
- Timeframe: 1 hour
- Universe: Top 100 coins by 24h volume
- Entry rule: RSI(14) < 30 AND Close > EMA(50)
- Exit: StopLoss = 1.0% (or ATR(14) × 1.5), TakeProfit = 2.0% (or risk × 2.0)
- Position sizing: 1% of equity per trade, max open positions = 3
- Fees/Slippage: default or exchange-specific values

Run a quick test on 1 year of data. If the sample size is small, expand the universe or timeframe. Interpret results with the metrics described above.

Note: the numbers above are illustrative. Treat them as a starting point and validate with your own tests.

## How to read a single trade (quick P&L example)

When reviewing the trades table, open a single trade and verify these fields:

- Entry price and timestamp (which candle was used for the signal)
- Exit price and timestamp (TP/SL or time exit)
- Commission and slippage applied
- Position size used (in USD or quote currency)

Quick P&L math (builder shows these values):
- Raw P&L = (ExitPrice - EntryPrice) × PositionSize
- Net P&L = Raw P&L - Fees - Slippage
- Percent return = Net P&L / EquityAtEntry

Check that the simulated fill price matches your live order expectation (market fills vs limit fills). Small differences in fill assumptions compound across many trades, so inspect several trades manually during validation.

## Saving, presets, and collaboration

Once you have a repeatable rule, save it as a preset. Presets let you:

- Re-run tests quickly with identical parameters
- Share a preset link with teammates or paste it into a ticket
- Use a preset as a starting point for a family of strategies (SL/TP variations, timeframe changes)

Naming convention tip: include the hypothesis & date in the preset name, e.g., `RSI-meanrev-1h-top100-20260227` so you can track versions over time.

## Common pitfalls and how to avoid them

- Overfitting during optimization: fix an OOS period first and never touch it until final validation.
- Small sample size: expand your universe before claiming a strategy works.
- Ignoring costs: always simulate realistic fees and slippage; they kill marginal edges.
- Using the current candle for signals: always use completed candles for signals and the next candle for simulated fills.

## Useful internal links and next steps

- Simulate / Strategy Builder: /simulate (or /builder)
- Backtesting best practices: /blog/how-to-backtest-crypto-strategy
- PRUVIQ Strategies (examples & transparency): /strategies
- Coin market context and volumes: /market and /coins

## Conclusion

PRUVIQ's Strategy Builder turns ideas into verified experiments. The disciplined workflow above—simple hypothesis, realistic execution, robust validation, and forward testing—separates a fragile backtest from a repeatable edge.

Start small, document every choice, and use cross-coin backtests and out-of-sample validation to guard against overfitting. When you find a robust setup, save it as a preset, run it again, and consider forward-testing with small capital.

Open the Builder now (/simulate) and try the example recipe. If you'd like, save the preset and compare it to PRUVIQ's verified strategies in /strategies.

---
*This post is educational content and not financial advice.*
