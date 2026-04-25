# I Built a Free Crypto Strategy Backtester — Here's What I Learned Testing 5 Strategies on 535 Coins

*Target: Medium, dev.to, r/algotrading (educational angle)*
*Length: ~1,500 words*
*Tone: Technical but accessible, honest about failures*

---

Most trading strategy backtests are lies.

Not intentionally — but the gap between a backtest that *looks* profitable and one that *actually works* in live trading is enormous. I learned this the hard way.

Over the past few months, I built [PRUVIQ](https://pruviq.com) — a free, no-code crypto strategy backtesting platform. It lets you combine technical indicators (Bollinger Bands, RSI, MACD, EMA, and 7 more), set entry/exit conditions, and test them across 535+ cryptocurrency futures with 2+ years of real market data.

But the real story isn't the tool. It's what I found when I used it.

## The Uncomfortable Truth: 4 Out of 5 Strategies Failed

I tested 5 strategies rigorously:

| Strategy | Direction | Result | Status |
|----------|-----------|--------|--------|
| BB Squeeze SHORT | Short | +70.4% win rate, PF 2.55 | **Verified** (live trading) |
| BB Squeeze LONG | Long | 51% win rate, -$26 | **Killed** |
| Momentum Breakout LONG | Long | 37.5% win rate, -$14,115 | **Killed** |
| ATR Breakout | Long | 48.7% win rate, PF 0.91 | **Shelved** |
| HV Squeeze | Short | 58.1% win rate, PF 1.42 | **Shelved** |

Only **one strategy** — BB Squeeze SHORT — survived real-world testing. The rest were either immediately unprofitable or too marginal to justify the risk.

I publish all of this on the site, including the failures. Why? Because most backtesting platforms only show you the winners.

## What Makes Backtests Lie

Through building this system and running thousands of simulations, I identified the top reasons backtests deceive:

### 1. Look-Ahead Bias (The Silent Killer)

The most dangerous bug I encountered: using "current candle" data in conditions.

```
# WRONG: Using current candle's volume ratio
if curr['vol_ratio'] >= 2.0:  # This candle isn't complete yet!
    enter_trade()

# RIGHT: Using previous (completed) candle
if prev['vol_ratio'] >= 2.0:  # This candle is finalized
    enter_trade()
```

At 10:01, the current hourly candle (10:00-11:00) only has 1 minute of data. Using it in backtesting gives you information you'd never have in live trading. This single bug turned a +$794 strategy into a -20.6% disaster.

### 2. Fees and Slippage

I include 0.04% maker/taker fees on every trade. On 535 coins with 5x leverage, this adds up. A strategy showing +15% without fees often becomes -5% with them.

### 3. Survivorship Bias

Testing only on currently-listed coins ignores all the tokens that were delisted. I test on all 535 USDT perpetual futures available on Binance, not a cherry-picked subset.

### 4. Overfitting

The most subtle trap. I found a time filter that improved backtest results by +43% — but when I tested it out-of-sample across 2+ years, it was pure noise. The filter worked on historical data by accident.

**My rule**: Any parameter change must improve performance across at least 3 independent time periods.

## The One Strategy That Survived

BB Squeeze SHORT exploits a specific market pattern:

1. **Bollinger Bands compress** (low volatility)
2. **Bands expand** rapidly (volatility breakout)
3. If the expansion is **bearish** (EMA trend down + bearish candle), enter SHORT
4. Set SL at 10%, TP at 8%
5. Maximum hold: 48 hours

After 2+ years of backtesting on 535 coins:
- **2,898 trades** analyzed
- **70.4% win rate**
- **Profit Factor: 2.55**
- Maximum drawdown: 26.7%

I then put real money on it: $3,000 on Binance Futures. After 37 days and 1,317 live trades, the results are... roughly break-even. The live win rate dropped to 54.59%, profit factor to 1.01.

Why the gap? Mostly one bad coin (GUNUSDT, -$378) and some timeout issues during a Docker restart. Once I blacklisted that coin and fixed the bugs, the recent performance improved significantly: 61% win rate on the last 100+ trades.

## Building the Backtester

The technical stack:

- **Backend**: Python FastAPI on DigitalOcean droplet, 575 coin datasets pre-loaded into memory
- **Frontend**: Astro 5 + Preact (interactive strategy builder as islands)
- **Data**: Binance 1H OHLCV candles, 2+ years per coin, updated daily
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Tunnel (API)

The no-code builder lets you combine conditions with AND/OR logic:

```
Entry Conditions:
  AND:
    - BB Squeeze detected (20-period, 2.0 std)
    - Volume Ratio >= 2.0 (vs 20-period average)
    - EMA(9) < EMA(21) (bearish trend)
    - Hour NOT in [2, 3, 10, 20, 21, 22, 23] UTC

Exit:
    - Stop Loss: 10%
    - Take Profit: 8%
    - Timeout: 48 hours
```

Backtests run in under 3 seconds across all 535 coins thanks to vectorized NumPy operations for signal detection.

## What I'd Do Differently

1. **Start with SHORT strategies in crypto**. Long strategies failed systematically across 88+ parameter combinations. The funding rate structure and leverage liquidation patterns structurally favor shorts in crypto futures.

2. **Test on ALL coins, not a curated list**. Every time I filtered coins to "improve" results, I was overfitting.

3. **Live trade sooner with less capital**. The gap between backtest and live is information you can only get by trading. Start with $50 positions.

4. **Track every metric from day one**. Slippage, partial fills, API latency — these invisible costs compound.

## Try It Yourself

PRUVIQ is completely free. No account, no credit card. You can:

1. **Explore pre-built strategies** — see the actual results, including failures
2. **Build custom strategies** — combine 11+ indicators with visual logic
3. **Compare strategies side-by-side** — same conditions, same data
4. **See live performance** — real trades, real money, real losses

The site is at [pruviq.com](https://pruviq.com).

The philosophy behind the name: "Don't Believe. Verify." — borrowed from Bitcoin's core principle, applied to trading strategies.

Every strategy claim should be testable. Every backtest should be reproducible. Every failure should be visible.

---

*This is a personal project. I run real money on one of these strategies. I have no VC funding and no premium tier. The tool is free because I believe transparency makes everyone better.*

*Questions? I'm happy to discuss backtesting methodology, the BB Squeeze strategy, or anything about the technical implementation.*
