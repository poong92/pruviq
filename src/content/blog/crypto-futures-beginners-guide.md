---
title: "Crypto Perpetual Futures: Complete Beginner's Guide (2026)"
description: "Everything you need to know about crypto perpetual futures. How leverage works, what funding rates are, and how to avoid getting liquidated."
date: "2026-02-15"
category: "education"
tags: ["futures", "leverage", "beginners", "perpetual-contracts"]
---

Perpetual futures are the most traded instrument in crypto — over $100 billion in daily volume. But most beginners lose money because they don't understand how leverage, margin, and liquidation actually work.

## What Are Perpetual Futures?

A perpetual futures contract lets you bet on the price of a cryptocurrency going up (long) or down (short) without owning the actual asset. Unlike traditional futures, they have no expiry date — they trade "perpetually."

**Key difference from spot trading**: With spot, you buy 1 BTC at $70,000 and sell it later. With futures, you open a position that profits or loses based on price movement, amplified by leverage.

**Why they exist**: They allow traders to go short (profit when prices drop), use leverage (trade with borrowed money), and trade without holding the underlying asset.

## How Leverage Works

Leverage multiplies your exposure. With 5x leverage and $100 margin:

- You control a $500 position
- If the price moves +10%, you make $50 (50% on your $100)
- If the price moves -10%, you lose $50 (50% of your $100)
- At -20%, you've lost $100 (100% of your margin) and get **liquidated**

| Leverage | $100 Margin Controls | Liquidation Distance |
|----------|---------------------|---------------------|
| 1x | $100 | -100% (impossible for crypto) |
| 5x | $500 | -20% |
| 10x | $1,000 | -10% |
| 20x | $2,000 | -5% |
| 50x | $5,000 | -2% |
| 100x | $10,000 | -1% |

**The reality**: At 100x leverage, a 1% price move against you wipes out your entire margin. In crypto, 1% moves happen in minutes.

## What Is Funding Rate?

Since perpetual futures have no expiry, they need a mechanism to keep their price close to the spot price. This mechanism is the **funding rate**.

- **Positive funding rate**: Longs pay shorts (meaning the futures price is above spot — bullish sentiment)
- **Negative funding rate**: Shorts pay longs (futures below spot — bearish sentiment)
- **Payment frequency**: Every 8 hours on most exchanges (Binance: 00:00, 08:00, 16:00 UTC)
- **Typical rate**: 0.01% per 8 hours (~0.03% daily, ~10.95% annually)

**Why it matters**: If you hold a position for days or weeks, funding rates add up. A 0.03% daily funding rate costs ~1% per month. On a leveraged position, this can be significant.

## How Liquidation Works

When your unrealized loss approaches your margin, the exchange forcefully closes your position. This is liquidation.

**Isolated margin**: Each position has its own margin. If Position A gets liquidated, Position B is unaffected. Safer for managing risk.

**Cross margin**: All positions share one margin pool. More capital-efficient but riskier — one bad position can liquidate everything.

**Liquidation price example** (Isolated, 5x leverage, SHORT):
- Entry: $70,000
- Margin: $100 ($500 position)
- Liquidation at ~$84,000 (+20% move against you)

## The Most Common Mistakes

### Mistake 1: Using Too Much Leverage

Beginners see 100x leverage and think "I'll make 100x profits." What actually happens: a 1% move liquidates them.

**Our approach**: We use 5x leverage. This gives us a 20% buffer before liquidation, which is reasonable for hourly positions on altcoins.

### Mistake 2: No Stop-Loss

"It'll come back" is the most expensive sentence in trading. Without a stop-loss, a position can go from -5% to -100% in a single candle.

**Our approach**: Every position has a stop-loss set before entry. Currently 10% for our BB Squeeze strategy. No exceptions, no manual overrides.

### Mistake 3: Oversizing Positions

Putting 50% of your account into one trade means one bad trade wipes half your capital.

**Example**: $200 per position with $10,000 capital = 2% per trade. Even 10 consecutive losses only cost 20%.

### Mistake 4: Ignoring Fees

Futures trading fees compound quickly with leverage:

- Binance Futures: 0.02% maker / 0.04% taker (with BNB discount)
- 5x leverage: Effective fee = 0.1-0.2% of your margin per round trip
- 100 trades/month at 0.15% = 15% of capital gone to fees alone

**How to reduce fees**:
- Use limit orders (maker fee) instead of market orders (taker fee)
- Pay fees in BNB (25% discount on Binance)
- Use a [referral code for additional discounts](/fees)

## Getting Started Safely

1. **Start with paper trading**: Most exchanges offer testnet or paper trading. Practice here first.
2. **Use isolated margin**: Limit your risk per position.
3. **Keep leverage low**: 3-5x maximum for beginners. Even professional algo traders rarely use more than 10x.
4. **Set stop-losses immediately**: Before entering any position, know your maximum acceptable loss.
5. **Start small**: Your first 100 trades are tuition. Use minimum position sizes.
6. **Track everything**: Log every trade, every reason, every outcome. You can't improve what you don't measure.

## Choosing an Exchange

The exchange matters. Fees, liquidity, leverage options, and reliability all differ.

| Factor | Why It Matters |
|--------|---------------|
| Fees | At 100+ trades/month, a 0.01% fee difference = real money |
| Liquidity | Low liquidity = wider spreads = worse fills |
| API reliability | For algo trading, API downtime = missed trades |
| Coin selection | More coins = more strategy opportunities |

We use Binance Futures (highest liquidity, 500+ perpetual pairs). See our [full exchange comparison](/fees) for alternatives.

---

*PRUVIQ trades perpetual futures on 535 coins with 5x leverage. Every trade is published in real-time on [Telegram](https://t.me/PRUVIQ). See our [approach](/), [killed strategies](/strategies), and [version history](/changelog).*
