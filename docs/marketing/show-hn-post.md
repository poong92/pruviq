# Show HN Post Draft

**Title**: Show HN: PRUVIQ – Free no-code crypto strategy backtester (535+ coins, 2yr data)

**URL**: https://pruviq.com

**Text**:

Hi HN,

I built PRUVIQ, a free crypto strategy backtesting tool. You combine technical indicators (Bollinger Bands, RSI, MACD, EMA, Stochastic, ADX, ATR, etc.) with visual AND/OR logic, then test across 535+ crypto futures with 2+ years of real 1H candle data. No account needed, no paywall.

What makes this different:

- **No code required**: Visual strategy builder with drag-and-drop conditions
- **Massive coin coverage**: Tests on all 535 Binance USDT perpetual futures simultaneously in ~3 seconds
- **Honest results**: I publish 5 strategies including 2 that lost money. One (BB Squeeze SHORT) runs on a real $3K Binance Futures account with every trade published publicly
- **Realistic simulation**: Includes fees (0.04%), slippage, position sizing, leverage, time-based exits

Tech stack:
- Frontend: Astro 5 + Preact (interactive islands), Tailwind CSS 4, deployed on Cloudflare Pages
- Backend: Python FastAPI on Mac Mini M4 Pro, 575 coin datasets in memory, vectorized NumPy signal detection
- Data: 1H OHLCV from Binance, updated daily via rsync

The biggest insight from building this: 4/5 strategies I tested failed, and every LONG strategy I tried (88+ variations) lost money in crypto futures. The structural advantage lies in shorting.

Site: https://pruviq.com
Live performance: https://pruviq.com/performance
Strategy comparison: https://pruviq.com/strategies/compare
