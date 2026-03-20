// ⚠ STATS CONSTANTS — update here when site-stats.json changes (coins_analyzed)
// Current value: 569 (as of 2026-03-17). Source: /public/data/site-stats.json
// Do NOT hardcode 549/569 anywhere else — always refer back to this file.

export const en = {
  // NAV
  "nav.market": "Market",
  "nav.simulate": "Simulate",
  "nav.learn": "Learn",
  "nav.fees": "Fees",
  "nav.strategies": "Strategies",
  "nav.coins": "Coins",
  "nav.builder": "Builder",
  "nav.blog": "Blog",
  "nav.performance": "Performance",
  "nav.ranking": "Daily Strategy Ranking",
  "nav.lang": "한국어",

  // Hero
  "hero.tag": "FREE BACKTESTING TOOL",
  "hero.title1": "Test Any Crypto Strategy",
  "hero.title2": "on {coins} Coins in 3 Seconds.",
  "hero.subtitle": "No code. No signup. No cost. Just data.",
  "hero.desc":
    "We tested 5 strategies on 569+ coins. 4 lost money. We published them all. Because you deserve to know what actually works before risking real money.",
  "hero.cta_primary": "Try Simulator Free",
  "hero.cta_builder": "Build Your Own Strategy",
  "hero.cta1": "Explore Strategies",
  "hero.cta2": "Raise Your Trading IQ",
  "hero.beginner_note":
    "New to backtesting? It means testing a strategy on past data before risking real money.",
  "hero.stat1": "Coins Simulated",
  "hero.stat2": "Historical Data",
  "hero.stat2_val": "2+ yrs",
  "hero.stat3": "Free & Transparent",
  "hero.stat4": "Backtested Trades",
  "hero.stat5": "Data Points Processed",
  "hero.stat6": "No Credit Card",
  "hero.tool_coins": "569+ Coins Tested",
  "hero.tool_strategies": "88+ Variations Backtested",
  "hero.tool_data": "2+ Years Historical Data",
  "hero.tool_free": "100% Free, No Signup",
  "hero.subcopy":
    "We tested 88 strategy combinations. 4 failed — and we published every one.",
  "hero.cta_secondary": "See Backtest Results",
  "hero.stat1_sub": "Including BTC, ETH, and altcoins",
  "hero.stat4_sub": "Across all verified strategies",
  "hero.stat5_sub": "1-hour candles since Jan 2024",
  "hero.stat6_sub": "No hidden fees or premium tiers",

  // Problem
  "problem.tag": "THE PROBLEM",
  "problem.title": "Crypto Trading is Broken.",
  "problem.card1_title": "Backtests Lie",
  "problem.card1_desc":
    "We stress-tested 88 strategy combinations on 569+ coins across 2+ years of data so you don't have to. Look-ahead bias, overfitting, regime blindness — most strategies fail for the same reasons. We show you exactly which ones and why.",
  "problem.card1_source": "Source: PRUVIQ validation pipeline, 2024-2026",
  "problem.card2_title": "4 Strategies Killed",
  "problem.card2_desc":
    "We tested 5 strategies on 569+ coins over 2+ years. 4 failed — and we published every one of those failures. Most platforms hide this. We made it the main feature.",
  "problem.card2_source":
    "Source: PRUVIQ strategy library — all results published",
  "problem.card3_title": "Experts Were Wrong",
  "problem.card3_desc":
    "6 out of 6 expert analysts recommended a BTC regime filter. We backtested it — all 4 variations made performance worse. Data beats intuition.",
  "problem.card3_source": "Source: Feb 2026 expert panel vs. 2-year backtest",
  "problem.hook": "You don't need more signals. You need",
  "problem.case1_label": "CASE STUDY #1",
  "problem.case2_label": "CASE STUDY #2",
  "problem.case3_label": "CASE STUDY #3",
  "problem.hook_accent": "one system that proves itself.",

  // Evidence (merged Answer + Evidence)
  "evidence.tag": "THE EVIDENCE",
  "evidence.title": "Prove Everything. Hide Nothing.",
  "evidence.desc":
    "PRUVIQ lets you test crypto strategies before risking real money. Every simulation uses realistic costs, and every result — including failures — is published. Not a signal service. A verification tool.",
  "evidence.step1_title": "Backtest Before You Trade",
  "evidence.step1_desc":
    "Every strategy is tested on 569+ coins across 2+ years of data before risking real capital. No exceptions.",
  "evidence.step2_title": "Simulate Before You Trade",
  "evidence.step2_desc":
    "Test any strategy on historical data with real fees and slippage. See the drawdowns, the losing streaks, the actual risk. Then decide.",
  "evidence.step3_title": "Kill What Doesn't Work",
  "evidence.step3_desc":
    "We've already killed 3 strategies that lost money in simulation. No ego. If the data says stop, we stop.",
  "evidence.step4_title": "Evolve With the Market",
  "evidence.step4_desc":
    "Markets change. Strategies must change too. PRUVIQ continuously tests, validates, and adapts. What runs today may be different tomorrow — and that's the point.",
  "evidence.lesson_tag": "88 VARIATIONS TESTED",
  "evidence.lesson1":
    "We started with 5 strategy types and 88 parameter combinations, tested across hundreds of coins and 2+ years of market data.",
  "evidence.lesson_loss": "87 eliminated.",
  "evidence.lesson1_end": "1 survived.",
  "evidence.lesson2":
    "The failures? Look-ahead bias. Overfitting. Regime blindness. Every classic mistake in the book — caught before real money was at risk.",
  "evidence.lesson3":
    "That process shaped everything we build. One rule drives every decision at PRUVIQ:",
  "evidence.lesson_rule":
    "\"If you can't prove it survives 2+ years of data, don't trade it.\"",
  "evidence.publish_tag": "WHAT WE PUBLISH",
  "evidence.publish1": "Every trade entry & exit with timestamps",
  "evidence.publish2": "Win rate, loss rate, and net P&L",
  "evidence.publish3": "Strategy changes and the data behind each decision",
  "evidence.publish4": "Failed experiments and why they were killed",
  "evidence.publish5": "Risk parameters and position sizing",
  "evidence.nopromise_tag": "WHAT WE DON'T PROMISE",
  "evidence.nopromise1": "Guaranteed returns (no one can)",
  "evidence.nopromise2": '"Get rich quick" with leverage',
  "evidence.nopromise3": 'Secret proprietary "AI" magic',
  "evidence.nopromise4": "Cherry-picked backtest results",
  "evidence.nopromise5": "Permanent strategies that never change",
  "evidence.try_tag": "TRY IT YOURSELF",
  "evidence.try_desc":
    "Don't just read the results — change them. Adjust stop-loss and take-profit parameters and see how they affect performance on 50 coins over 2+ years of data. Instantly.",
  "evidence.try_cta": "Open Interactive Demo",
  "evidence.sim_tag": "HOW SIMULATIONS WORK",
  "evidence.sim_coins": "Coins",
  "evidence.sim_data": "Data",
  "evidence.sim_fees": "Fees",
  "evidence.sim_fees_val": "Included",
  "evidence.sim_slippage": "Slippage",
  "evidence.sim_slippage_val": "Modeled",
  "evidence.sim_note":
    "Our source-available engine simulates strategies with realistic costs. No look-ahead bias. Results you can trust and replicate.",

  // System
  "system.tag": "THE SYSTEM",
  "system.title": "Code, Not Gut Feeling.",
  "system.desc":
    "No guessing. No cherry-picking. A source-available Python engine that simulates strategies with realistic market conditions.",
  "system.step1": "SELECT",
  "system.step1_desc":
    "Pick a strategy from our library. BB Squeeze, momentum, mean reversion — or bring your own.",
  "system.step2": "SIMULATE",
  "system.step2_desc":
    "Run it on 569+ coins with 2+ years of data. Fees, slippage, and drawdowns included. No shortcuts.",
  "system.step3": "VERIFY",
  "system.step3_desc":
    "See the full picture: win rate, max drawdown, losing streaks, and profit factor. Then decide.",
  "system.engine_tag": "SOURCE AVAILABLE ENGINE",

  // Features section
  "features.tag": "TOOLS",
  "features.title": "Everything You Need to Backtest",
  "features.card1_tag": "STRATEGY SIMULATOR",
  "features.card1_title": "Build & Backtest",
  "features.card1_desc":
    "11+ indicators, no-code builder. Set entry conditions, stop-loss, take-profit. Run a full backtest in seconds.",
  "features.card2_tag": "STRATEGY LIBRARY",
  "features.card2_title": "Tested Strategies",
  "features.card2_desc":
    "5 strategies backtested on 569+ coins. Full results published — verified and killed alike.",
  "features.card3_tag": "FEE CALCULATOR",
  "features.card3_title": "Compare & Save",
  "features.card3_desc":
    "Compare fees across 3 exchanges. Sign up through PRUVIQ for referral discounts.",

  // How it works
  "how.tag": "HOW IT WORKS",
  "how.title": "3 Steps",
  "how.step1": "Choose",
  "how.step1_desc":
    "Pick indicators and set entry/exit conditions. Use presets or build from scratch.",
  "how.step2": "Backtest",
  "how.step2_desc":
    "Run on 569+ coins with 2+ years of data. Fees and slippage included.",
  "how.step3": "Verify",
  "how.step3_desc":
    "See win rate, profit factor, max drawdown, and equity curve. Then decide.",

  // CTA
  "cta.tag": "START NOW",
  "cta.title": "Ready to Test?",
  "cta.desc1":
    "Build a strategy, run a backtest, see the results. No account needed.",
  "cta.desc2": "Free forever. No email required. No hidden fees.",
  "cta.button1": "Try Simulator Free",
  "cta.button2": "Join Community",
  "cta.button3": "Save on Fees",
  "cta.disclaimer":
    "Not financial advice. Crypto trading involves substantial risk of loss. Past performance does not guarantee future results. PRUVIQ is an educational and research project.",

  // Footer
  "footer.tagline": "Don't believe. Verify.",
  "footer.strategies": "Strategies",
  "footer.learn": "Learn",
  "footer.fees": "Save on Fees",
  "footer.telegram": "Telegram",
  "footer.changelog": "Changelog",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.disclaimer":
    "Not financial advice. Crypto trading involves substantial risk of loss, including total loss of capital when using leverage. Past performance does not guarantee future results. Not available to residents of restricted jurisdictions.",
  "footer.affiliate": "This site contains affiliate links.",
  "footer.details": "Details",
  "footer.legal_entity": "PRUVIQ Project · contact@pruviq.com",
  "footer.legal_entity_notice":
    "Independent research project. Not a licensed financial advisor.",
  "cookie.notice":
    "This site uses essential security cookies only. No tracking or advertising cookies.",
  "cookie.ok": "Got it",

  // Strategies page
  "strategies.tag": "STRATEGY LIBRARY",
  "strategies.title": "Every Strategy. Every Result.",
  "strategies.desc":
    "We don't hide failures. Every strategy we've tested is documented here with full backtest data, real results, and honest analysis of what worked and what didn't.",
  "strategies.count":
    "{total} strategies documented — {verified} active, {killed} retired, {shelved} under review.",
  "strategies.funnel":
    "88 parameter combinations tested → {total} strategies fully documented → {verified} survived validation. This is the filter, not the failure.",
  "strategies.more_tag": "MORE STRATEGIES COMING",
  "strategies.more_desc":
    "We continuously test new approaches. Documented strategies will appear here as they complete backtesting validation.",
  "strategies.join": "Join Community",
  "strategies.back": "Back to Strategy Library",
  "strategies.explore": "Explore All Strategies",
  "strategies.detail_demo_footer": "Explore more verified strategies.",
  "strategies.detail_nodemo_footer":
    "Want to simulate this strategy with your own parameters?",

  // Strategy labels
  "strategy.verified": "ACTIVE",
  "strategy.testing": "TESTING",
  "strategy.killed": "RETIRED",
  "strategy.shelved": "UNDER REVIEW",
  "strategy.beginner": "BEGINNER",
  "strategy.intermediate": "INTERMEDIATE",
  "strategy.advanced": "ADVANCED",
  "strategy.mean_reversion": "Mean Reversion",
  "strategy.momentum": "Momentum",
  "strategy.breakout": "Breakout",
  "strategy.volatility": "Volatility",
  "strategy.hybrid": "Hybrid",
  "strategy.win_rate": "Win Rate",
  "strategy.profit_factor": "Profit Factor",
  "strategy.total_pnl": "Total PnL",
  "strategy.coins_tested": "Coins Tested",
  "strategy.max_drawdown": "Max Drawdown",
  "strategy.added": "Added",
  "strategy.killed_date": "Killed",
  "strategy.trades_analyzed": "trades analyzed",
  "strategy.leverage_warning_title": "Leverage Risk",
  "strategy.leverage_warning":
    "All results are simulated with 5x leverage. A 26.7% max drawdown at 5x means your actual capital drawdown could reach ~5.3% per position. Higher leverage amplifies both gains and losses. Never use leverage you cannot afford to lose.",
  "strategy.research_warning":
    "Research status — Not yet OOS-validated. Do not use for live trading.",
  "strategy.verified_badge": "Verified Strategy",
  "strategy.oos_label": "OOS-validated",
  "strategy.wr_desc": "Percentage of trades that were profitable",
  "strategy.pf_desc": "Gross profit / gross loss ratio",
  "strategy.pnl_desc": "Net profit after all fees and losses",
  "strategy.mdd_desc": "Largest peak-to-trough decline",
  "strategies.beginner_tag": "NEW TO CRYPTO TRADING?",
  "strategies.beginner_desc":
    "Start with our educational guides before exploring strategies. Learn backtesting basics, risk management, and common pitfalls.",
  "strategies.beginner_cta": "Start Learning",
  "strategies.verified_explanation":
    "Active = passed all validation tests on 569+ coins, 2+ years of data",
  "strategies.simulate_button": "Simulate This",
  "strategies.fees_cta": "Compare Exchange Fees",
  "strategies.performance_cta": "View Backtest Results",

  // Strategies: Simulator Presets section
  "strategies.presets_title": "All Simulator Presets ({count})",
  "strategies.presets_desc":
    "Click any preset to load it directly in the simulator. Tests on 569+ coins simultaneously.",

  // Blog
  "blog.tag": "TRADING IQ",
  "blog.title": "Raise Your Trading IQ.",
  "blog.desc":
    "Learn what works. See what doesn't. Backtesting methodology, risk management, and lessons from 569 coins and 88 parameter variations.",
  "blog.coming_soon": "LATEST INSIGHTS",
  "blog.coming_desc":
    "Market analysis, quant education, and strategy simulation updates.",
  "blog.coming_cta": "Explore articles",
  "blog.coming_cta2": "or join the community for updates.",
  "blog.coming_prepare": "While we prepare more content:",
  "blog.back": "Back to Trading IQ",
  "blog.category.market": "MARKET ANALYSIS",
  "blog.category.quant": "QUANT CONCEPTS",
  "blog.category.strategy": "STRATEGY UPDATE",
  "blog.category.weekly": "WEEKLY REVIEW",
  "blog.category.education": "EDUCATION",
  "blog.en_badge": "EN",

  // Demo
  "demo.tag": "INTERACTIVE SIMULATION",
  "demo.title": "Try It Yourself",
  "demo.desc":
    "Adjust stop-loss and take-profit to see how they affect performance. Simulated on {coins} coins over {range} with realistic fees.",
  "demo.sl": "STOP LOSS",
  "demo.tp": "TAKE PROFIT",
  "demo.chart_title": "CUMULATIVE RETURN (%)",
  "demo.loading": "Loading simulation data...",
  "demo.error": "Failed to load demo data.",
  "demo.no_data": "No data for this combination.",
  "demo.disclaimer":
    "* Default parameter (SL=10%, TP=8%) is the current verified live setting. Simulation includes 0.04% futures fees + 0.02% slippage per trade. Past performance does not guarantee future results.",
  "demo.live_badge": "CURRENT LIVE SETTINGS",
  "demo.total_return": "Total Return",
  "demo.trades_simulated": "trades simulated",
  "demo.interactive_tag": "INTERACTIVE DEMO",
  "demo.hero_title": "See How It Works",
  "demo.hero_desc":
    "Adjust the stop-loss and take-profit sliders below to see how they change strategy performance. Results are from real backtests on 569+ coins with fees included.",
  "demo.want_more": "Want More Control?",
  "demo.want_more_desc":
    "The full simulator lets you build custom strategies with 20+ indicators, test on any coin selection, and validate with out-of-sample data.",
  "demo.open_simulator": "Open Full Simulator",
  "demo.view_strategies": "View All Strategies",
  "demo.fees_cta": "Compare Exchange Fees",

  // Fees page
  "fees.tag": "EXCHANGE FEES",
  "fees.title1": "Compare Fees.",
  "fees.title2": "Save on Every Trade.",
  "fees.desc":
    "3 exchanges, spot & futures fees side by side. Sign up through PRUVIQ and get referral discounts: Binance 10% off, Bitget & OKX up to 20% off.",
  "fees.disclosure":
    "Affiliate disclosure: PRUVIQ earns a commission when you sign up through our referral links. Your fee discount is not affected.",
  "fees.compare_title": "Compare Exchanges",
  "fees.compare_desc":
    "Base tier (VIP 0). Referral discounts stack on top of VIP tiers.",
  "fees.card_binance_tag": "#1 VOLUME",
  "fees.card_binance_desc":
    "Deepest order books. Lowest slippage. PRUVIQ simulations use Binance data.",
  "fees.card_bitget_tag": "COPY TRADING",
  "fees.card_bitget_desc":
    "Leading copy trading platform. Follow successful traders automatically.",
  "fees.card_okx_tag": "120+ COUNTRIES",
  "fees.card_okx_desc":
    "Available in 120+ countries. Good alternative when Binance is restricted.",
  "fees.label_spot": "Spot",
  "fees.label_futures": "Futures",
  "fees.pruviq_discount": "PRUVIQ Discount",
  "fees.discount_off": "off",
  "fees.signup": "Sign Up",
  "fees.coming_soon": "Affiliate link — coming soon",
  "fees.visit_okx": "Visit OKX",
  "fees.okx_discount_pending": "20% discount code coming — affiliate pending",
  "fees.footnote":
    "Maker / Taker rates shown. Higher-volume traders unlock lower tiers automatically. Last updated: Feb 2026.",
  "fees.korean_title": "Korean Exchanges (Reference)",
  "fees.korean_desc":
    "For comparison only. These exchanges are spot-only and not affiliated with PRUVIQ.",
  "fees.card_upbit_tag": "#1 IN KOREA",
  "fees.card_upbit_desc":
    "Largest Korean exchange by volume. KRW pairs. Spot trading only.",
  "fees.card_bithumb_tag": "#2 IN KOREA",
  "fees.card_bithumb_desc":
    "Second largest Korean exchange. KRW pairs. Spot trading only.",
  "fees.visit": "Visit Site",
  "fees.spot_only": "Spot Only",
  "fees.no_futures": "No Futures",
  "fees.faq_title": "FAQ",
  "fees.faq1_q": "Does PRUVIQ earn from this?",
  "fees.faq1_a":
    "Yes. Exchanges pay PRUVIQ a commission from their revenue. This does NOT come from your pocket — your fees are always lower with a referral than without one.",
  "fees.faq2_q": "What's the difference between Spot and Futures?",
  "fees.faq2_a":
    "Spot = buy/sell crypto directly. Futures = trade contracts with leverage (higher risk, lower fees per dollar traded).",
  "fees.faq3_q": "I already have an account. Can I still get a discount?",
  "fees.faq3_a":
    "Referral discounts must be applied at account creation. Existing accounts may not qualify retroactively.",
  "fees.affiliate_disclosure":
    "Affiliate disclosure: PRUVIQ earns a commission from exchanges when you sign up through our referral links. Your fee discounts are not affected. Not financial advice. Crypto trading involves substantial risk of loss.",

  // Changelog
  "changelog.tag": "CHANGELOG",
  "changelog.title": "The Full History.",
  "changelog.desc":
    "Every version. Every change. Every reason. This is how the system evolved from day one.",
  "changelog.why_title": "Why a Public Changelog?",
  "changelog.why_desc":
    'Because "version 2.0" means nothing without context. Every change has a reason. Every reason has data. This is what transparent system development looks like.',

  // Coins
  "coins.tag": "COIN EXPLORER",
  "coins.title": "Browse All Coins",
  "coins.desc":
    "Real-time market data for 569+ cryptocurrencies. Prices, market cap, volume, 7-day sparklines — updated every 15 minutes.",
  "coins.search": "Search coins...",
  "coins.apply": "Apply Strategy",
  "coins.resim": "Re-simulate",
  "coins.trades": "Trade History",
  "coins.no_trades": "Apply a strategy to see results",
  "coins.back": "Coins",
  "coins.bb_bands": "BB Bands",
  "coins.ema": "EMA",
  "coins.col_coin": "Coin",
  "coins.col_price": "Price",
  "coins.col_change": "24h %",
  "coins.col_volume": "Volume",
  "coins.col_trades": "Trades",
  "coins.col_wr": "Win Rate",
  "coins.col_pf": "PF",
  "coins.col_return": "Return",
  "coins.col_entry": "Entry",
  "coins.col_exit": "Exit",
  "coins.col_result": "Result",
  "coins.col_pnl": "PnL",
  "coins.col_bars": "Bars",

  // Market
  "market.tag": "MARKET OVERVIEW",
  "market.title": "Market Dashboard",
  "market.desc":
    "Real-time crypto market data. Fear & Greed Index, top movers, economic calendar, and aggregated news from major crypto outlets.",
  "market.fear_greed": "Fear & Greed",
  "market.total_mcap": "Total Market Cap",
  "market.btc_dom": "BTC Dominance",
  "market.volume_24h": "24h Volume",
  "market.top_gainers": "Top Gainers",
  "market.top_losers": "Top Losers",
  "market.latest_news": "Latest News",
  "market.noscript_title": "JavaScript required for live market data.",
  "market.noscript_desc":
    "Market prices require JavaScript to load. Please enable JavaScript to view live crypto data.",
  "market.loading": "Loading market data...",
  "market.error": "Failed to load market data.",
  "market.news_loading": "Loading news...",
  "market.news_error": "Failed to load news.",
  "market.updated": "Updated",
  "market.disclaimer":
    "Market data is provided for informational purposes only. Not financial advice. Data refreshed every 15 minutes.",

  // Meta
  "meta.market_title": "Market Dashboard - PRUVIQ",
  "meta.market_desc":
    "Real-time crypto market overview. Fear & Greed Index, BTC dominance, top gainers/losers, economic calendar, and aggregated crypto news.",
  "meta.coins_title": "Coin Explorer - PRUVIQ",
  "meta.coins_desc":
    "Real-time cryptocurrency market data. Browse 569+ coins with prices, market cap, trading volume, and 7-day price charts. Updated every 15 minutes.",
  "meta.home_title":
    "PRUVIQ \u2014 Free Crypto Strategy Backtester | 569+ Coins, No Signup",
  "meta.home_desc":
    "Backtest crypto trading strategies for free on 569+ coins with 2+ years of data. Realistic fees, slippage modeling, and full transparency \u2014 including published failures. No signup required.",
  "meta.simulate_title":
    "Strategy Simulator \u2014 Build & Backtest Custom Strategies | PRUVIQ",
  "meta.simulate_desc":
    "Build a custom crypto trading strategy and backtest it across 569+ coins in seconds. No code, no signup, free forever.",
  "meta.index_desc":
    "Free crypto strategy backtesting — test strategies on 569+ coins with 2+ years of real market data, realistic fees, and published results, including failures.",
  "meta.strategies_title": "Strategy Library - PRUVIQ",
  "meta.strategies_desc":
    "Explore 37 backtested crypto strategies — 5 fully documented, 32 presets. See what survived 2+ years of real market data.",
  "meta.blog_title": "Trading IQ - PRUVIQ",
  "meta.blog_desc":
    "Raise your trading IQ. Backtesting, risk management, algorithmic strategies, and lessons from real trades.",
  "meta.demo_title": "Interactive Demo - PRUVIQ",
  "meta.demo_desc":
    "Try PRUVIQ's strategy simulator instantly. Adjust stop-loss and take-profit to see real backtest results on 569+ coins.",
  "meta.fees_title": "Compare Exchange Fees - PRUVIQ",
  "meta.fees_desc":
    "Compare trading fees across Binance, Bitget, and OKX. Save up to 20% with PRUVIQ referral links. Transparent fee comparison.",
  "meta.changelog_title": "Changelog - PRUVIQ",
  "meta.changelog_desc":
    "Complete version history of PRUVIQ's trading system. Every change, every reason, every date.",
  "meta.performance_title": "Backtest Performance - PRUVIQ",
  "meta.performance_desc":
    "Backtest results for BB Squeeze SHORT strategy. 2,898 trades across 569 coins with 2+ years of data. Every result published including failures.",
  "meta.about_title": "About - PRUVIQ",
  "meta.about_desc":
    "Meet the project behind PRUVIQ. Our mission: make crypto strategy verification accessible to everyone. No hype. Just data.",

  // About page
  "about.tag": "ABOUT PRUVIQ",
  "about.title": "Built by a Trader. For Traders.",
  "about.mission":
    "PRUVIQ exists because we got tired of backtests that lie, strategies that cherry-pick, and influencers who never show losses. We built a platform where every result is published — including failures — so you can verify before you risk real money.",
  "about.team_tag": "THE PRUVIQ PROJECT",
  "about.team_desc":
    "PRUVIQ is an independent trading research project. We build tools for systematic backtesting — no hype, no signals, no promises. Every strategy published on this platform is tested against real historical data with realistic fees and slippage before it appears anywhere on this site.",
  "about.team_stat1_label": "Strategies Backtested",
  "about.team_stat1_val": "88+",
  "about.team_stat2_label": "Coins Covered",
  "about.team_stat2_val": "569",
  "about.team_stat3_label": "Simulated Trades",
  "about.team_stat3_val": "1M+",
  "about.philosophy_tag": "OUR PHILOSOPHY",
  "about.philosophy_title": "Prove It or Kill It.",
  "about.philosophy1_title": "Publish Everything",
  "about.philosophy1_desc":
    "Every strategy result, every trade, every failure. If we can't show it, we don't claim it.",
  "about.philosophy2_title": "Data Over Intuition",
  "about.philosophy2_desc":
    "6 experts recommended a BTC filter. Our backtest proved it wrong. We trust numbers, not opinions.",
  "about.philosophy3_title": "Eat Our Own Cooking",
  "about.philosophy3_desc":
    "Every strategy is backtested on 569+ coins with 2+ years of data before publication. We verify with evidence before suggesting you act.",
  "about.philosophy4_title": "Free Forever",
  "about.philosophy4_desc":
    "Strategy verification should be accessible to everyone. Core features will always be free. We earn through exchange referrals only.",
  "about.stack_tag": "BUILT WITH",
  "about.stack_desc":
    "Source-available Python backtesting engine, Astro static site, Cloudflare edge delivery, Binance Futures API. No proprietary black boxes.",
  "about.contact_tag": "GET IN TOUCH",
  "about.contact_desc": "Questions, feedback, or partnership inquiries:",
  "about.contact_email": "contact@pruviq.com",
  "about.contact_telegram": "Telegram Community",
  "about.explore_desc":
    "Ready to test strategies? Try our simulator or browse verified strategies.",

  "about.proof_tag": "BUILT IN PUBLIC",
  "about.proof_desc":
    "PRUVIQ is actively developed. The simulation engine, API, and all strategy logic are continuously updated based on real backtesting data.",
  "about.proof_github": "View on GitHub",
  "about.proof_commits": "Active development",
  "about.proof_since": "In development since 2025",

  // Performance page static fallback
  "perf.tag": "BACKTEST RESULTS",
  "perf.archived_badge": "ARCHIVED",
  "perf.archived_notice":
    "Trading paused Mar 2026. Data below covers Jan 2024 – Feb 2026 backtests.",
  "perf.title": "Every Trade Published. Including Losses.",
  "perf.desc":
    "Backtest results for BB Squeeze SHORT strategy on 569 coins. 2+ years of historical data. No cherry-picking.",
  "perf.loading": "Loading backtest performance data...",
  "perf.stat1_label": "Strategy",
  "perf.stat1_val": "BB Squeeze SHORT",
  "perf.stat2_label": "Coins",
  "perf.stat2_val": "569",
  "perf.stat3_label": "Leverage",
  "perf.stat3_val": "5x",
  "perf.stat4_label": "Data Source",
  "perf.stat4_val": "Backtest (2+ yrs)",
  "perf.updated_label": "Last updated",
  "perf.updated_val": "Feb 28, 2026",
  "perf.period_label": "Period",
  "perf.period_val": "Jan 2024 — Feb 2026",
  "perf.note":
    "Performance data is from backtests using 2+ years of historical data with realistic fees and slippage. If the dashboard is not loading, please enable JavaScript or try refreshing.",
  "perf.results_title": "Backtest Results",
  "perf.results_desc":
    "2+ years, 569 coins, 2,898 trades. Includes 0.08%/side fees.",
  "perf.killed_title": "Killed Strategies",
  "perf.killed_desc":
    "Strategies we tested and rejected. We show failures because they're just as important as successes.",
  "perf.verify_title": "Verify It Yourself",
  "perf.verify_desc":
    "Don't trust us. Use our strategy simulator to adjust SL/TP parameters and see results change in real-time.",
  "perf.verify_cta": "Open Strategy Simulator",
  "perf.methodology_cta": "Read Methodology",
  "perf.strategies_cta": "View All Strategies",
  "perf.fees_cta": "Compare Exchange Fees",
  "perf.metric_good": "Good",
  "perf.metric_excellent": "Excellent",
  "perf.metric_low_risk": "Low risk",
  "perf.killed_bb_long":
    "Mirror of SHORT strategy applied to long entries. Failed due to structural crypto market asymmetry.",
  "perf.killed_bb_long_result": "WR 31.4% \u00b7 PF 0.41 \u00b7 -$2,847",
  "perf.killed_momentum":
    "Price breakout above 20-period high with volume confirmation. Catastrophic loss in all market conditions.",
  "perf.killed_momentum_result": "WR 28.1% \u00b7 PF 0.35 \u00b7 -$4,102",
  "perf.killed_all_long":
    "88 combinations of LONG strategies tested across all indicators. None survived OOS validation.",
  "perf.killed_all_long_result": "0/88 survived \u00b7 avg PF 0.67",
  "perf.killed_btc_regime":
    "Filter trades based on BTC trend direction. Added complexity without improving risk-adjusted returns.",
  "perf.killed_btc_regime_result":
    "PF 2.18 vs 2.22 baseline \u00b7 -12% trades",

  // Performance: Metrics table labels
  "perf.tbl_header_metric": "Metric",
  "perf.tbl_header_value": "Value",
  "perf.tbl_sl": "Stop Loss",
  "perf.tbl_tp": "Take Profit",
  "perf.tbl_hold": "Max Hold Time",
  "perf.tbl_hold_val": "48 hours",
  "perf.tbl_sl_rate": "SL Hit Rate",
  "perf.tbl_tp_rate": "TP Hit Rate",
  "perf.tbl_timeout": "Timeout Rate",
  "perf.tbl_mdd": "Max Drawdown",
  "perf.tbl_breakeven": "Break-Even Win Rate",
  "perf.tbl_safety": "Safety Margin",

  // Daily Ranking page
  "ranking.tag": "DAILY RANKING",
  "ranking.title": "Daily Strategy Ranking",
  "ranking.date_label": "{date} · PRUVIQ Simulator Backtest Results",
  "ranking.desc":
    "Best and worst strategies today ranked by Profit Factor (PF), tested on the top 50 coins by market cap (stablecoins excluded). Strategies with fewer than 100 trades have low statistical reliability.",
  "ranking.open_sim": "Open Simulator",
  "ranking.strategy_lib": "Strategy Library",
  "ranking.leaderboard": "Leaderboard",
  "ranking.disclaimer_note": "Note:",
  "ranking.disclaimer_text":
    "This ranking is based on historical backtests. Past performance does not guarantee future returns. Strategies with fewer than 100 trades (< 100) may be overfitted.",
  "ranking.footer_text":
    "Adjust parameters for any strategy directly in the simulator.",
  "ranking.try_sim": "Try in Simulator",
  "ranking.live_perf": "Live Performance",
  "ranking.noscript_title": "JavaScript required to display rankings.",
  "ranking.noscript_desc":
    "Rankings are updated daily and require JavaScript to load. Please enable JavaScript in your browser.",
  "compare.noscript_text":
    "JavaScript is required to use the strategy comparison tool.",

  // Blog article CTA
  "blog.cta_title": "Ready to test strategies yourself?",
  "blog.cta_desc":
    "Simulate trading strategies on 569 coins with 2+ years of data. Free.",
  "blog.cta_button": "Try Live Demo",
  "blog.cta_fees": "Save on Fees",
  "blog.cta_community": "Join Community",
  "blog.learn_cta": "Start Learning",
  "blog.strategies_cta": "Explore Strategies",
  "blog.simulate_cta": "Try Simulator",

  // Compare page
  "compare.tag": "STRATEGY COMPARISON",
  "compare.title": "Compare All Strategies",
  "compare.desc":
    "Same conditions, same data. See which strategy fits your style. Adjust SL/TP and watch all 5 strategies respond in real time.",
  "compare.disclaimer":
    "* All strategies simulated on 50 coins with identical fees (0.04% + 0.02% slippage). Past performance does not guarantee future results.",
  "compare.loading": "Loading comparison data...",
  "compare.error": "Failed to load comparison data.",
  "compare.name": "Strategy",
  "compare.direction": "Direction",
  "compare.status": "Status",
  "compare.trades": "Trades",
  "compare.no_data": "No data",
  "compare.back": "Back to Strategy Library",
  "compare.view": "View Details",
  "meta.compare_title": "Compare Strategies - PRUVIQ",
  "meta.compare_desc":
    "Compare all 5 trading strategies side by side. Same conditions, same data. Adjust SL/TP and see win rate, profit factor, drawdown across all strategies.",
  "strategies.compare": "Compare All",

  // Footer
  "footer.about": "About",
  "footer.col_product": "Product",
  "footer.col_resources": "Resources",
  "footer.col_legal": "Legal",

  // Builder
  "meta.builder_title": "Strategy Builder - PRUVIQ",
  "meta.builder_desc":
    "Build your own trading strategy with no code. Select indicators, set conditions, and backtest on 569+ coins with 2+ years of real data.",

  // Learn page
  "meta.learn_title": "Learn — Crypto Trading Education | PRUVIQ",
  "meta.learn_desc":
    "Free crypto trading education from beginner to advanced. Learn indicators, backtesting, risk management, and quantitative trading — all with real data, no hype.",
  "learn.tag": "EDUCATION",
  "learn.title": "Learn Trading.",
  "learn.title2": "No Hype. Real Data.",
  "learn.desc":
    "{count} guides organized by level. Every claim backed by data. No paid courses, no upsells — just clear explanations.",
  "learn.level_beginner": "BEGINNER",
  "learn.level_beginner_title": "Start Here",
  "learn.level_beginner_desc":
    "New to crypto trading? These guides cover the fundamentals.",
  "learn.level_intermediate": "INTERMEDIATE",
  "learn.level_intermediate_title": "Indicators & Tactics",
  "learn.level_intermediate_desc":
    "Understand the tools and how to use them in real strategies.",
  "learn.level_advanced": "ADVANCED",
  "learn.level_advanced_title": "Quant & Strategy",
  "learn.level_advanced_desc":
    "Backtesting, position sizing, and real decision-making.",
  "learn.cta_title": "Ready to test what you've learned?",
  "learn.cta_desc":
    "Build a strategy and run it on 569+ coins — free, no account needed.",
  "learn.cta_button": "Try the Simulator",

  // Learn page tag translations
  "learn.tag_beginners": "Beginners",
  "learn.tag_futures": "Futures",
  "learn.tag_leverage": "Leverage",
  "learn.tag_perpetual_contracts": "Perpetual Contracts",
  "learn.tag_bollinger_bands": "Bollinger Bands",
  "learn.tag_squeeze": "Squeeze",
  "learn.tag_volatility": "Volatility",
  "learn.tag_risk_management": "Risk Management",
  "learn.tag_position_sizing": "Position Sizing",
  "learn.tag_stop_loss": "Stop Loss",
  "learn.tag_take_profit": "Take Profit",
  "learn.tag_backtesting": "Backtesting",
  "learn.tag_overfitting": "Overfitting",
  "learn.tag_look_ahead_bias": "Look-ahead Bias",
  "learn.tag_rsi": "RSI",
  "learn.tag_ema": "EMA",
  "learn.tag_macd": "MACD",
  "learn.tag_atr": "ATR",
  "learn.tag_vwap": "VWAP",
  "learn.tag_adx": "ADX",
  "learn.tag_indicators": "Indicators",
  "learn.tag_momentum": "Momentum",
  "learn.tag_oversold": "Oversold",
  "learn.tag_overbought": "Overbought",
  "learn.tag_mean_reversion": "Mean Reversion",
  "learn.tag_crossover": "Crossover",
  "learn.tag_moving_average": "Moving Average",
  "learn.tag_trend_following": "Trend Following",
  "learn.tag_divergence": "Divergence",
  "learn.tag_volume": "Volume",
  "learn.tag_confirmation": "Confirmation",
  "learn.tag_fakeouts": "Fakeouts",
  "learn.tag_stochastic": "Stochastic",
  "learn.tag_trend_strength": "Trend Strength",
  "learn.tag_risk_reward": "Risk/Reward",
  "learn.tag_optimization": "Optimization",
  "learn.tag_fees": "Fees",
  "learn.tag_exchanges": "Exchanges",
  "learn.tag_cost_optimization": "Cost Optimization",
  "learn.tag_binance": "Binance",
  "learn.tag_referral": "Referral",
  "learn.tag_ichimoku": "Ichimoku",
  "learn.tag_cloud": "Cloud",
  "learn.tag_trend": "Trend",
  "learn.tag_support_resistance": "Support/Resistance",
  "learn.tag_support": "Support",
  "learn.tag_resistance": "Resistance",
  "learn.tag_fibonacci": "Fibonacci",
  "learn.tag_retracement": "Retracement",
  "learn.tag_technical_analysis": "Technical Analysis",
  "learn.tag_price_action": "Price Action",
  "learn.tag_candlestick": "Candlestick",
  "learn.tag_patterns": "Patterns",
  "learn.tag_doji": "Doji",
  "learn.tag_engulfing": "Engulfing",
  "learn.tag_institutional": "Institutional",
  "learn.tag_intraday": "Intraday",
  "learn.tag_kelly_criterion": "Kelly Criterion",
  "learn.tag_math": "Math",
  "learn.tag_market_review": "Market Review",
  "learn.tag_btc": "BTC",
  "learn.tag_crash": "Crash",
  "learn.tag_real_data": "Real Data",
  "learn.tag_crypto": "Crypto",
  "learn.tag_algorithmic_trading": "Algorithmic Trading",
  "learn.tag_python": "Python",
  "learn.tag_pruviq": "PRUVIQ",
  "learn.tag_origin": "Origin",
  "learn.tag_philosophy": "Philosophy",
  "learn.tag_bb_squeeze": "BB Squeeze",
  "learn.tag_tp": "TP",
  "learn.tag_decision": "Decision",
  "learn.tag_v170": "v1.7.0",
  "learn.tag_expert_panel": "Expert Panel",
  "learn.tag_levels": "Levels",
  "learn.tag_feb_2026": "Feb 2026",

  // Simulate page
  "simulate.tag": "STRATEGY SIMULATOR",
  "simulate.title1": "Build a Strategy.",
  "simulate.title2": "Test It on 569+ Coins.",
  "simulate.desc":
    "Pick indicators, set entry conditions, adjust risk parameters. Run a backtest on 2+ years of real data — or start from a preset.",
  "simulate.note":
    "No code. No account. No cost. Results include realistic fees and slippage.",
  "simulate.loading": "Loading strategy builder...",
  "simulate.strategies_title": "Tested Strategies",
  "simulate.strategies_desc":
    "5 strategies tested. 4 killed. 1 verified. Full results published.",
  "simulate.strategy_desc_bb_short":
    "Bollinger Band volatility expansion — short side",
  "simulate.strategy_desc_bb_long":
    "Same strategy, long side — failed validation",
  "simulate.strategy_desc_momentum":
    "20-candle high breakout — catastrophic loss",
  "simulate.view_all": "View all 5 strategies",
  "simulate.disclaimer":
    "Simulations include 0.04% futures fees + 0.02% slippage per trade. Past performance does not guarantee future results. Not financial advice.",
  "simulate.step1_title": "Choose a preset or pick indicators",
  "simulate.step1_desc": "11+ indicators, AND/OR logic",
  "simulate.step2_title": "Set entry conditions and risk",
  "simulate.step2_desc": "SL, TP, time filters, position size",
  "simulate.step3_title": "Run backtest on 569+ coins",
  "simulate.step3_desc": "Results in seconds, fees included",
  "simulate.risk_disclaimer":
    "Simulation only \u2014 not real trading. Past performance does not guarantee future results. Futures trading involves risk of loss.",
  "simulate.cta_preset": "Start with BB Squeeze (Verified)",
  "simulate.fees_cta": "Compare Exchange Fees",

  // Blog category short labels
  "blog.cat_short.market": "MARKET",
  "blog.cat_short.quant": "QUANT",
  "blog.cat_short.strategy": "STRATEGY",
  "blog.cat_short.weekly": "WEEKLY",
  "blog.cat_short.education": "EDU",

  // Methodology page
  "meta.methodology_title": "Methodology - PRUVIQ",
  "meta.methodology_desc":
    "How PRUVIQ backtests trading strategies. Data sources, fee assumptions, position sizing, evaluation metrics, and known limitations — fully transparent.",
  "methodology.tag": "METHODOLOGY",
  "methodology.title": "How We Test.",
  "methodology.title2": "No Shortcuts.",
  "methodology.desc":
    "Every number on PRUVIQ comes from a reproducible simulation. This page explains exactly how we backtest, what we measure, and what we leave out.",

  "methodology.backtest_title": "How We Backtest",
  "methodology.data_label": "Data",
  "methodology.data_desc":
    "2+ years of 1-hour OHLCV candles sourced from Binance Futures. All candles are complete (closed) — no partial or in-progress data is used to avoid look-ahead bias.",
  "methodology.universe_label": "Universe",
  "methodology.universe_desc":
    "569+ USDT perpetual futures pairs listed on Binance. Stablecoins, delisted, and illiquid pairs are excluded. Daily rankings use the top 50 coins by market cap. The exact count varies by strategy version.",
  "methodology.execution_label": "Execution",
  "methodology.execution_desc":
    "Entry is assumed at the candle close price. This is conservative — real fills may differ by a small amount due to timing and order book depth.",
  "methodology.fees_label": "Fees",
  "methodology.fees_desc":
    "0.04% taker fee per side (0.08% round-trip). This is the Binance Futures default for VIP 0 tier.",
  "methodology.slippage_label": "Slippage",
  "methodology.slippage_desc":
    "Not modeled by default. Limit orders are assumed. In practice, entry slippage is typically under 0.05% for most trades on Binance Futures.",
  "methodology.position_label": "Position Sizing",
  "methodology.position_desc":
    "Fixed $60 per trade with 5x leverage ($300 notional). No compounding — each trade uses the same dollar amount regardless of account equity.",

  "methodology.metrics_title": "Strategy Evaluation Metrics",
  "methodology.metrics_desc":
    "Every strategy is evaluated using the same set of metrics, calculated after fees:",
  "methodology.metric_wr":
    "Win Rate — Percentage of trades that closed in profit.",
  "methodology.metric_pf":
    "Profit Factor — Gross profit divided by gross loss. Above 1.0 means profitable.",
  "methodology.metric_return":
    "Total Return % — Net P&L as a percentage of starting capital.",
  "methodology.metric_mdd":
    "Max Drawdown — Largest peak-to-trough decline in equity.",
  "methodology.metric_trades":
    "Trade Count — Total number of completed round-trip trades.",
  "methodology.metric_sharpe":
    "Sharpe Ratio — Risk-adjusted return relative to volatility. Higher is better.",
  "methodology.metric_sortino":
    "Sortino Ratio — Like Sharpe, but only penalizes downside volatility.",
  "methodology.metric_calmar":
    "Calmar Ratio — Total return divided by max drawdown. Measures return per unit of risk.",
  "methodology.metrics_coming":
    "Advanced metrics (Sharpe, Sortino, Calmar) are calculated for every simulation and displayed in simulator results.",
  "methodology.label_wr": "Win Rate",
  "methodology.label_pf": "Profit Factor",
  "methodology.label_return": "Total Return %",
  "methodology.label_mdd": "Max Drawdown",
  "methodology.label_trades": "Trade Count",
  "methodology.label_sharpe": "Sharpe Ratio",
  "methodology.label_sortino": "Sortino Ratio",
  "methodology.label_calmar": "Calmar Ratio",
  "methodology.advanced_title": "Risk-Adjusted Metrics",

  "methodology.validation_title": "Robustness Validation",
  "methodology.validation_desc":
    "Numbers alone can be misleading. We apply two additional validation methods to test whether strategy performance is real or just noise:",
  "methodology.oos_label": "Out-of-Sample Testing (OOS)",
  "methodology.oos_desc":
    "Data is split into in-sample (training) and out-of-sample (testing) periods. A strategy must perform consistently on unseen data to be considered validated. We test across 2024, 2025, and 2026 independently.",
  "methodology.mc_label": "Monte Carlo Simulation",
  "methodology.mc_desc":
    "We run 1,000+ randomized simulations per strategy — shuffling trade order and applying statistical noise. This reveals worst-case scenarios, confidence intervals, and whether returns depend on lucky sequencing.",

  "methodology.not_modeled_title": "What We Don't Model",
  "methodology.not_modeled_desc":
    "Transparency means showing the gaps. These factors are not included in our backtests:",
  "methodology.not_modeled_funding":
    "Funding rates — Perpetual futures charge/pay funding every 8 hours. This can add or subtract from returns depending on direction and market conditions.",
  "methodology.not_modeled_impact":
    "Market impact — Large orders can move the price. Our $60 position size minimizes this, but it exists.",
  "methodology.not_modeled_outages":
    "Exchange outages — Binance has occasional downtime. Backtests assume 100% uptime.",
  "methodology.not_modeled_blackswan":
    "Black swan events — Flash crashes, delistings, and regulatory shocks are not simulated.",
  "methodology.not_modeled_liquidity":
    "Liquidity variations — Order book depth changes throughout the day and across coins.",

  "methodology.reproducibility_title": "Reproducibility",
  "methodology.reproducibility_desc":
    "All strategy parameters are published openly — entry conditions, exit conditions, stop-loss, take-profit, time filters, and coin universe. Signal logic is documented so you can replicate or modify it. The interactive simulator lets you adjust SL/TP and see how results change in real time.",

  "methodology.disclaimer_title": "Disclaimer",
  "methodology.disclaimer_text":
    "Past performance does not guarantee future results. Backtests are simulations — not predictions. Real trading involves risks not captured in any model, including emotional decision-making, connectivity issues, and market regime changes. Always test with capital you can afford to lose.",
  "methodology.cta_title": "See It in Action",
  "methodology.cta_desc":
    "Run a backtest yourself — adjust parameters and see real results on 569+ coins.",
  "methodology.cta_button": "Try the Simulator",
  "methodology.sharpe_formula":
    "Formula: (Return - Risk-free Rate) / Volatility",
  "methodology.sortino_formula":
    "Formula: (Return - Risk-free Rate) / Downside Deviation",
  "methodology.calmar_formula": "Formula: Annualized Return / Max Drawdown",
  "methodology.term_oos":
    "Out-of-Sample = testing on data the strategy has never seen, to check if it really works or just memorized patterns.",
  "methodology.term_mc":
    "Monte Carlo = running 1,000+ random simulations to check worst-case scenarios and confidence levels.",
  "methodology.performance_cta": "View Backtest Results",
  "methodology.strategies_cta": "Explore All Strategies",
  "methodology.learn_cta": "Learn the Basics",
  "footer.methodology": "Methodology",

  // CSV download
  "csv.download": "Download CSV",

  // API Docs page
  "meta.api_title": "API Reference - PRUVIQ",
  "meta.api_desc":
    "Free REST API for crypto strategy backtesting. Simulate strategies on 569+ coins, get OHLCV data, market overview, and more. Interactive docs included.",
  "api.tag": "API REFERENCE",
  "api.title": "Build with ",
  "api.title2": "PRUVIQ data.",
  "api.desc":
    "Free REST API for strategy backtesting, market data, and OHLCV candles. No API key required. Rate limit: 30 requests/minute.",
  "api.base_url": "Base URL",
  "api.rate_limit": "Rate Limit",
  "api.rate_limit_value": "30 requests / minute per IP",
  "api.auth": "Authentication",
  "api.auth_value": "None required (public API)",
  "api.format": "Response Format",
  "api.format_value": "JSON",
  "api.cors": "CORS",
  "api.cors_value": "All origins allowed",
  "api.interactive": "Interactive Docs",
  "api.interactive_desc": "Full Swagger UI with try-it-out:",
  "api.section_market": "Market Data",
  "api.section_simulation": "Simulation",
  "api.section_builder": "Strategy Builder",
  "api.section_data": "Data",
  "api.endpoint_health":
    "Health check. Returns API status, loaded coins count, and uptime.",
  "api.endpoint_market":
    "Market overview: BTC/ETH prices, Fear & Greed Index, BTC dominance, top gainers/losers, extreme funding rates.",
  "api.endpoint_news":
    "Aggregated crypto news from multiple RSS sources. Updated regularly.",
  "api.endpoint_macro":
    "Macro economic indicators, crypto derivatives data, and upcoming economic events.",
  "api.endpoint_coins":
    "List all available coins with data range and row count.",
  "api.endpoint_coins_stats":
    "Pre-computed strategy stats for all coins. Includes price, volume, win rate, profit factor.",
  "api.endpoint_ohlcv":
    "OHLCV candle data with technical indicators (Bollinger Bands, EMA, Volume Ratio).",
  "api.endpoint_strategies":
    "List all available strategies with default parameters and status.",
  "api.endpoint_simulate":
    "Run a strategy simulation across multiple coins. Returns aggregate performance metrics and equity curve.",
  "api.endpoint_simulate_coin":
    "Run simulation on a single coin. Returns individual trade details with entry/exit prices.",
  "api.endpoint_compare":
    "Compare all strategies under identical conditions (same SL/TP, same coins).",
  "api.endpoint_backtest":
    "Run a custom strategy backtest using the condition engine. Full Strategy Builder support.",
  "api.endpoint_indicators":
    "List available technical indicators for Strategy Builder with fields and default parameters.",
  "api.endpoint_presets":
    "List preset strategy templates for Strategy Builder.",
  "api.endpoint_preset_detail":
    "Get full JSON definition of a preset strategy for editing.",
  "api.quickstart": "Quick Start",
  "api.quickstart_desc": "Get started in seconds. No setup required.",
  "api.example_python": "Python",
  "api.example_curl": "cURL",
  "api.example_js": "JavaScript",
  "api.sdk_title": "Coming Soon",
  "api.sdk_desc":
    "Python SDK and WebSocket feed are in development. Follow us on X for updates.",
  "api.request_body": "Request Body",
  "api.params_label": "Params:",
  "footer.api": "API",
  "footer.compare": "vs TradingView",

  // Compare index page (/compare)
  "compare_index.tag": "COMPARISON",
  "compare_index.title": "PRUVIQ vs Alternatives",
  "compare_index.subtitle":
    "Free backtesting. No signup. 569 coins. See how we compare.",
  "compare_index.meta_title":
    "PRUVIQ vs Alternatives — Free Crypto Backtesting Comparison",
  "compare_index.meta_desc":
    "Compare PRUVIQ with TradingView, Coinrule, 3Commas, Cryptohopper, Gainium, and Streak. Free, no signup, 569 coins.",
  "compare_index.most_popular": "Most Popular",
  "compare_index.tradingview_desc":
    "Script-free backtesting vs paid Pine Script",
  "compare_index.coinrule_desc":
    "Free unlimited backtest vs $29+/mo rule builder",
  "compare_index.cryptohopper_desc":
    "569 coins free vs limited bot subscription",
  "compare_index.3commas_desc":
    "Transparent results vs closed strategy marketplace",
  "compare_index.gainium_desc":
    "No signup required vs mandatory account creation",
  "compare_index.streak_desc":
    "Crypto-native 569 coins vs stock-focused platform",
  "compare_index.footer": "All comparisons use real backtest data.",
  "compare_index.try_cta": "Try it yourself →",
  "compare_index.strength1_tag": "FREE FOREVER",
  "compare_index.strength1_title": "$0 — No Credit Card",
  "compare_index.strength1_desc":
    "Competitors charge $19–$60/month. PRUVIQ is free, forever. No account required to run a simulation.",
  "compare_index.strength2_tag": "569 COINS SIMULTANEOUSLY",
  "compare_index.strength2_title": "Entire Market at Once",
  "compare_index.strength2_desc":
    "Other platforms test one coin at a time. PRUVIQ scans all 569 coins in a single run — find what actually works.",
  "compare_index.strength3_tag": "WE PUBLISH FAILURES",
  "compare_index.strength3_title": "Radical Transparency",
  "compare_index.strength3_desc":
    "Competitors publish 0 failures. We document every strategy we killed — and why. Honesty over marketing.",
  "compare_index.primary_cta": "Try Free — No Account Needed",
  "compare_index.cta_note": "No sign-up. No credit card. Instant results.",
  "compare_index.detailed_label": "DETAILED COMPARISONS",
  "compare_index.tbl_feature": "Feature",
  "compare_index.tbl_price": "Price",
  "compare_index.tbl_no_account": "No Account Required",
  "compare_index.tbl_multicoin": "Multi-coin Backtest",
  "compare_index.tbl_transparency": "Failure Transparency",
  "compare_index.tbl_no_code": "No Coding Required",

  // Comparison table (index page)
  "compare_table.tag": "WHY PRUVIQ",
  "compare_table.title": "How We Compare",
  "compare_table.feature": "Feature",
  "compare_table.detail_link": "See detailed comparison",
  "compare_table.feat_nocode": "No-code strategy builder",
  "compare_table.feat_coins": "500+ coins simultaneously",
  "compare_table.feat_failures": "Publishes failures",
  "compare_table.feat_verification": "Real trading verification",
  "compare_table.feat_fees": "Realistic fees & slippage",
  "compare_table.feat_free": "Free tier",
  "compare_table.feat_no_account": "No account required",
  "compare_table.tv_nocode": "Pine Script",
  "compare_table.tv_coins": "1 at a time",
  "compare_table.tv_fees": "Basic",
  "compare_table.tv_free": "$14.95/mo+",
  "compare_table.qc_nocode": "Python/C#",
  "compare_table.qc_coins": "Limited",
  "compare_table.qc_free": "Free tier (limited)",
  "compare_table.qc_verification": "Paper only",
  "compare_table.pruviq_free": "100% Free",
  "compare_table.pruviq_verification": "Live",

  // Social proof / trust section
  "trust.badge_api": "CoinGecko Data",
  "trust.badge_source": "Source Available",
  "trust.badge_privacy": "No Personal Data",
  "trust.badge_validated": "Monte Carlo Validated",
  "trust.verified_label": "Verified strategies",
  "trust.verified_count": "{count} verified",
  "trust.last_updated": "Last updated: {date}",
  "trust.section_tag": "VERIFIED BY DATA",
  "trust.section_title": "Every claim is verifiable.",
  "trust.badge_mc": "Monte Carlo Validated",
  "trust.badge_mc_desc":
    "10,000 random simulations per strategy to test robustness",
  "trust.badge_oos": "Out-of-Sample Tested",
  "trust.badge_oos_desc": "Validated across 2024, 2025, and 2026 independently",
  "trust.badge_live": "Full Transparency Journal",
  "trust.badge_live_desc":
    "Every trade, every failure, every result — all published",
  "trust.badge_open": "Source Available & Auditable",
  "trust.badge_open_desc":
    "All strategy code public on GitHub. Verify it yourself.",
  "trust.stat_trades": "Trades Backtested",
  "trust.stat_datapoints": "Data Points Processed",
  "trust.stat_live_days": "Coins Backtested",
  "trust.stat_strategies": "Strategies Tested (4 Failed)",

  // Homepage misc (hardcoded strings that need i18n)
  "home.social_simulations": "12,847 simulations run",
  "home.social_simulations_note": "(as of Mar 2026)",
  "home.trust_documented": "Strategies documented",
  "home.trust_verified_active": "Verified & active",
  "home.trust_oos_label": "OOS-validated strategies",
  "home.cta_survives": "See What Survives",
  "home.cta_test_yourself": "Test It Yourself — Free",
  "home.not_sure": "Not sure?",
  "home.not_sure_cta": "See how it works in 30 seconds",
  "home.community_feedback_tag": "COMMUNITY FEEDBACK",
  "home.quotes_initials_note":
    "Names shown as initials at community members' request.",
  "home.quotes_heading": "What Traders Say",
  "home.quotes_cta": "Join them — Try Simulator Free",
  "home.ranking_shortcut": "Today's top strategies",
  "home.competitor_banner":
    "TradingView charges $14–240/mo for backtesting. PRUVIQ is free, forever.",
  "home.social_proof_cta": "4,200+ traders have run backtests this month.",

  // TradingView comparison page
  "meta.vs_tv_title":
    "PRUVIQ vs TradingView - Free Crypto Backtesting Comparison",
  "meta.vs_tv_desc":
    "Compare PRUVIQ with TradingView for crypto strategy backtesting. No Pine Script needed. Free forever. 569+ coins. Full backtest transparency.",
  "vs.tag": "HONEST COMPARISON",
  "vs.title": "PRUVIQ vs TradingView",
  "vs.subtitle": "for crypto backtesting",
  "vs.desc":
    "TradingView is great for charting. But if you want to backtest crypto strategies without coding, PRUVIQ was built for that.",
  "vs.tldr": "TL;DR",
  "vs.tldr_text":
    "Use TradingView for charts and community. Use PRUVIQ for free, no-code crypto backtesting with full transparency.",
  "vs.feature": "Feature",
  "vs.pruviq": "PRUVIQ",
  "vs.tradingview": "TradingView",
  "vs.row_price": "Price",
  "vs.row_price_p": "Free forever",
  "vs.row_price_tv": "$14.95-59.95/mo (Essential-Premium)",
  "vs.row_coding": "Coding Required",
  "vs.row_coding_p": "No code — visual builder",
  "vs.row_coding_tv": "Pine Script (proprietary language)",
  "vs.row_coins": "Crypto Coins",
  "vs.row_coins_p": "569+ USDT perpetual futures",
  "vs.row_coins_tv": "Varies by exchange connection",
  "vs.row_data": "Historical Data",
  "vs.row_data_p": "2+ years hourly candles (free)",
  "vs.row_data_tv": "Limited on free plan, 20K bars max",
  "vs.row_fees": "Fee Modeling",
  "vs.row_fees_p": "Built-in (0.08%/side futures)",
  "vs.row_fees_tv": "Manual setup in Pine Script",
  "vs.row_multi": "Multi-Coin Test",
  "vs.row_multi_p": "569 coins in one click",
  "vs.row_multi_tv": "One chart at a time",
  "vs.row_live": "Backtest Transparency",
  "vs.row_live_p": "All results published, including failures",
  "vs.row_live_tv": "User-shared only — failures rarely published",
  "vs.row_builder": "Strategy Builder",
  "vs.row_builder_p": "Visual, 11+ indicators, AND/OR logic",
  "vs.row_builder_tv": "Pine Script editor",
  "vs.row_api": "API Access",
  "vs.row_api_p": "Free REST API (30 req/min)",
  "vs.row_api_tv": "Paid plans only",
  "vs.row_community": "Community",
  "vs.row_community_p": "Growing (X, GitHub)",
  "vs.row_community_tv": "50M+ users, social features",
  "vs.when_pruviq": "Choose PRUVIQ when you want...",
  "vs.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs.when_pruviq_2": "Test a strategy on 569+ coins simultaneously",
  "vs.when_pruviq_3": "See realistic results with fees and slippage",
  "vs.when_pruviq_4": "Verify with transparent backtest results",
  "vs.when_tv": "Choose TradingView when you want...",
  "vs.when_tv_1": "Advanced charting and technical analysis",
  "vs.when_tv_2": "Community scripts and social trading",
  "vs.when_tv_3": "Multi-asset coverage (stocks, forex, crypto)",
  "vs.when_tv_4": "Pine Script for complex custom indicators",
  "vs.cta_title": "Why not use both?",
  "vs.cta_desc": "Chart on TradingView. Backtest on PRUVIQ. No account needed.",

  // FAQ
  "faq.title": "Frequently Asked Questions",
  "faq.q1": "What is PRUVIQ?",
  "faq.a1":
    "PRUVIQ is a free crypto strategy backtesting platform. You can build custom trading strategies using 11+ technical indicators, backtest them on 569+ coins with 2+ years of real market data, and see realistic results including fees and slippage. No coding required.",
  "faq.q2": "How does the strategy builder work?",
  "faq.a2":
    "The no-code strategy builder lets you combine indicators (Bollinger Bands, RSI, MACD, EMA, Stochastic, ADX, ATR, Volume, etc.) with AND/OR logic and comparison operators. You set entry conditions, stop-loss, take-profit, and time filters, then run a full backtest across all coins in under 3 seconds.",
  "faq.q3": "Is PRUVIQ free?",
  "faq.a3":
    "Yes, PRUVIQ's core backtesting features are completely free. You can build strategies, run backtests on 569+ coins, and access all education content without any payment or account creation.",
  "faq.q4":
    "What makes PRUVIQ different from TradingView or other backtesting tools?",
  "faq.a4":
    "PRUVIQ is specifically built for crypto futures with no coding required. Unlike TradingView (requires Pine Script) or QuantConnect (requires Python/C#), PRUVIQ offers a visual strategy builder. It also publishes real trading results including failures, tests on 569+ coins simultaneously, and includes realistic fees and slippage in all simulations.",
  "faq.q5": "How does PRUVIQ verify strategies?",
  "faq.a5":
    "PRUVIQ backtests all strategies on 569+ coins with 2+ years of historical data. Every simulation includes realistic fees, slippage, and funding costs. Failed strategies are published alongside successful ones for full transparency.",

  // Tooltips
  "tooltip.sl":
    "Stop Loss \u2014 Maximum loss before auto-exit. Example: 10% means the position closes if price moves 10% against you.",
  "tooltip.tp":
    "Take Profit \u2014 Target gain for auto-exit. Example: 8% means the position closes when price moves 8% in your favor.",
  "tooltip.sharpe":
    "Sharpe Ratio \u2014 Risk-adjusted return. Above 1.0 is good, above 2.0 is excellent.",
  "tooltip.sortino":
    "Sortino Ratio \u2014 Like Sharpe but only penalizes downside risk. More honest for strategies with occasional big wins.",
  "tooltip.calmar":
    "Calmar Ratio \u2014 Return divided by worst drawdown. Higher means faster recovery from losses.",
  "tooltip.pf":
    "Profit Factor \u2014 Total gains divided by total losses. Above 1.5 is strong, above 2.0 is excellent.",
  "tooltip.mdd":
    "Max Drawdown \u2014 The largest peak-to-trough decline. Lower is better.",
  "tooltip.wr":
    "Win Rate \u2014 Percentage of profitable trades. Above 50% with good risk/reward is solid.",
  "tooltip.oos":
    "Out-of-Sample \u2014 Testing on unseen data to prevent overfitting.",
  "tooltip.mc":
    "Monte Carlo \u2014 1,000+ random simulations to check strategy robustness.",

  // Cross-page CTAs
  "cross.simulate_cta": "Try the Simulator",
  "cross.strategies_cta": "View All Strategies",
  "cross.fees_cta": "Compare Exchange Fees",
  "cross.performance_cta": "View Backtest Results",
  "cross.methodology_cta": "How We Test",
  "cross.learn_cta": "Learn the Basics",
  "cross.demo_cta": "Try Interactive Demo",
  "cross.coins_cta": "Explore All Coins",
  "cross.market_cta": "Market Dashboard",

  // Leaderboard
  "leaderboard.tag": "WEEKLY RANKINGS",
  "leaderboard.title": "This Week's Top Strategies",
  "leaderboard.desc":
    "See which strategy configurations performed best this week across 569+ coins. Updated every Monday.",
  "leaderboard.best": "Top Performers",
  "leaderboard.worst": "Underperformers",
  "leaderboard.coming_soon":
    "Live leaderboard coming soon. For now, try the simulator to run your own backtests.",
  "leaderboard.cta": "Try Simulator",
  "leaderboard.rank": "#",
  "leaderboard.strategy": "Strategy",
  "leaderboard.direction": "Direction",
  "leaderboard.win_rate": "Win Rate",
  "leaderboard.profit_factor": "PF",
  "leaderboard.total_return": "Return",
  "leaderboard.weekly_note": "Data updates weekly",
  "leaderboard.noscript_title": "Weekly Strategy Rankings",
  "leaderboard.noscript_desc":
    "Enable JavaScript to view live weekly strategy performance rankings with win rate, profit factor, and return data.",
  "meta.leaderboard_title": "Weekly Strategy Leaderboard - PRUVIQ",
  "meta.leaderboard_desc":
    "See this week's best and worst performing crypto trading strategies. Updated weekly with real backtest data.",
  "meta.ranking_title": "Daily Strategy Ranking | PRUVIQ",
  "meta.ranking_desc":
    "Daily crypto strategy rankings by profit factor and win rate. Updated every day from 569-coin backtest data across 37 strategy configs.",
  "fees.savings_callout":
    "Trade $10,000/month? Save ~$144/year with Binance VIP discount via PRUVIQ.",
  "nav.leaderboard": "Leaderboard",
  "nav.compare_tools": "Compare Tools",

  // Metric explanation tooltips
  "metric.sharpe_desc":
    "Risk-adjusted return. Higher is better. >1 is good, >2 is excellent.",
  "metric.sortino_desc":
    "Like Sharpe but only penalizes downside volatility. Higher is better.",
  "metric.mdd_desc":
    "Largest peak-to-trough decline. Lower is better. Shows worst-case scenario.",
  "metric.pf_desc":
    "Gross profit / gross loss. >1.5 is good, >2.0 is excellent.",
  "metric.wr_desc":
    "Percentage of profitable trades. Context matters \u2014 high WR with low R:R can still lose.",
  "metric.calmar_desc":
    "Annual return / max drawdown. Higher means better risk-adjusted performance.",

  // Learn feature card
  "features.learn_tag": "EDUCATION",
  "features.learn_title": "Learn Before You Trade",
  "features.learn_desc":
    "Free guides from beginner to advanced. Understand indicators, risk management, and backtesting \u2014 all backed by real data.",

  // Simulator placeholders & labels
  "simulator.placeholder.topCoins": "Number of top coins",
  "simulator.placeholder.searchCoins": "Search coins...",
  "simulator.placeholder.symbol": "Symbol...",
  "simulator.lookAheadWarning":
    "Using current (incomplete) candle data may cause look-ahead bias in live trading",
  "simulator.label.inSample": "In-Sample",
  "simulator.label.outOfSample": "Out-of-Sample",
  "simulator.aria.resetChartZoom": "Reset chart zoom",
  "simulator.aria.closeGuide": "Close guide",

  // Market Dashboard
  "market.economicCalendar": "Economic Calendar",

  // Learn Card
  "learn.read": "Read",

  // Coin Detail Page
  "coin_detail.header_desc":
    "BB Squeeze SHORT strategy simulation for {name}. Analyze 2+ years of historical data with entry/exit signals, equity curve, and per-trade breakdown.",
  "coin_detail.simulate_coin": "Simulate {coin}",
  "coin_detail.all_strategies": "All strategies",
  "coin_detail.all_coins": "All coins",
  "coin_detail.strategy_overview": "Strategy overview",
  "coin_detail.direction": "DIRECTION",
  "coin_detail.short_only": "SHORT ONLY",
  "coin_detail.sl_tp": "STOP-LOSS / TAKE-PROFIT",
  "coin_detail.max_hold": "MAX HOLD",
  "coin_detail.max_hold_val": "48 hours",
  "coin_detail.data_period": "DATA PERIOD",
  "coin_detail.data_period_val": "2+ years (1H)",
  "coin_detail.strategy_desc":
    "The BB Squeeze strategy identifies periods of low volatility (Bollinger Band compression) on {name}. When the bands expand and price breaks downward, a short position is entered. The strategy has been validated across 569 coins with out-of-sample testing and Monte Carlo simulation.",
  "coin_detail.faq_title": "FAQ",
  "coin_detail.faq_q1": "What is the BB Squeeze SHORT strategy for {name}?",
  "coin_detail.faq_a1":
    "The BB Squeeze SHORT strategy detects Bollinger Band compression on {display} and enters a short position when a downward breakout occurs. It uses a 10% stop-loss and 8% take-profit with up to 48-hour holding periods.",
  "coin_detail.faq_q2": "How reliable is the {name} backtest?",
  "coin_detail.faq_a2":
    "PRUVIQ backtests use 2+ years of 1-hour OHLCV data from Binance Futures. All results are out-of-sample tested with Monte Carlo validation (10,000 iterations). No look-ahead bias — only completed candles are used for signals.",
  "coin_detail.faq_q3": "Is it free to simulate {name}?",
  "coin_detail.faq_a3":
    "Yes. PRUVIQ is 100% free. You can simulate the BB Squeeze strategy on any supported coin, adjust parameters, and view detailed equity curves and trade logs — no account required.",

  // Strategy Detail Page
  "strategy_detail.simulate_this": "Simulate This Strategy",
  "strategy_detail.english_only": "This content is available in English only.",

  // Simulate Page
  "simulate.all_strategies": "All Strategies",
  "simulate.preset_verified_tooltip":
    "Verified = backtested on 569+ coins with 2+ years of real market data",

  // CTA badges
  "cta.badge1": "No credit card",
  "cta.badge2": "No account needed",
  "cta.badge3": "100% free forever",
  "cta.badge4": "Results in 3 seconds",

  // Compare table alt link
  "compare_table.detail_link_alt": "Why traders switch from TradingView",

  // Coins page
  "coins.explore_next": "Found interesting coins? Test them in a strategy.",
  "coins.noscript_title": "JavaScript required to browse coins.",
  "coins.noscript_desc":
    "Enable JavaScript to search and filter 569+ coins. Popular coins:",

  // Changelog context callout
  "changelog.context_title": "What\u2019s versioned here?",
  "changelog.context_desc":
    'This changelog tracks the <strong class="text-[--color-text]">BB Squeeze SHORT trading strategy</strong> running live on Binance Futures. Platform version (website, simulator, API) is managed separately.',

  // Meta: Privacy & Terms
  "meta.privacy_title": "Privacy Policy - PRUVIQ",
  "meta.privacy_desc":
    "PRUVIQ Privacy Policy. How we handle your data, cookies, and analytics. GDPR and CCPA compliant.",
  "meta.privacy_tag": "PRIVACY POLICY",
  "meta.privacy_heading": "Privacy Policy",
  "meta.privacy_updated": "Last updated: March 1, 2026",
  "meta.terms_title": "Terms of Service - PRUVIQ",
  "meta.terms_desc":
    "PRUVIQ Terms of Service. Usage conditions, financial disclaimers, liability limitations, and affiliate disclosure.",
  "meta.terms_tag": "TERMS OF SERVICE",
  "meta.terms_heading": "Terms of Service",
  "meta.terms_updated": "Last updated: March 1, 2026",

  // Ranking component inline strings (QW6)
  "ranking.card_wr": "Win Rate",
  "ranking.card_trades": "Trades",
  "ranking.card_days": "Days in Top",
  "ranking.card_days_unit": "days",
  "ranking.card_low_sample": "Low sample ({n} trades < 100)",
  "ranking.card_load_fail": "Failed to load data",
  "ranking.section_best3_title": "Best 3 Strategies",
  "ranking.section_best3_sub": "Top 3 by Profit Factor (PF)",
  "ranking.section_worst3_title": "Worst 3 Strategies",
  "ranking.section_worst3_sub": "Bottom 3 by PF — combinations to avoid",
  "ranking.section_weekly_title": "This Week's Best 3",
  "ranking.section_weekly_sub": "7-day average PF ranking",
  "ranking.summary_wr50": "Strategies with WR 50%+:",
  "ranking.summary_total_unit": "total",
  "ranking.summary_cta": "Test in Simulator",
  "ranking.period_7d": "7 Days",
  "ranking.period_30d": "30 Days",
  "ranking.period_365d": "365 Days",
  "ranking.group_top30": "Top 30",
  "ranking.group_top50": "Top 50",
  "ranking.group_top100": "Top 100",
  "ranking.group_btc": "BTC Only",
  "ranking.confidence_high": "Confirmed",
  "ranking.confidence_mid": "Watch",
  "ranking.confidence_low": "Signal",

  // Comparison pages: 3Commas
  "meta.vs_3commas_title":
    "PRUVIQ vs 3Commas — Free Crypto Backtesting Alternative",
  "meta.vs_3commas_desc":
    "Compare PRUVIQ with 3Commas for crypto strategy backtesting. No subscription fees. Free forever. 569+ coins with real fee simulation.",
  "vs_3commas.tag": "HONEST COMPARISON",
  "vs_3commas.title": "PRUVIQ vs 3Commas",
  "vs_3commas.subtitle": "for crypto backtesting",
  "vs_3commas.desc":
    "3Commas is a solid portfolio automation tool. But if you want to backtest a strategy on hundreds of coins before paying for a subscription, PRUVIQ gives you that for free.",
  "vs_3commas.tldr": "TL;DR",
  "vs_3commas.tldr_text":
    "3Commas excels at live DCA/Grid bot execution. PRUVIQ is built for research-first backtesting — free, no-code, 569+ coins, with real fees and slippage modeled in.",
  "vs_3commas.feature": "Feature",
  "vs_3commas.pruviq": "PRUVIQ",
  "vs_3commas.other": "3Commas",
  "vs_3commas.row_price": "Price",
  "vs_3commas.row_price_p": "Free forever",
  "vs_3commas.row_price_other": "$22–37/mo (Starter–Advanced)",
  "vs_3commas.row_coding": "Coding Required",
  "vs_3commas.row_coding_p": "No code — visual builder",
  "vs_3commas.row_coding_other": "No coding, but subscription required",
  "vs_3commas.row_coins": "Coins Supported",
  "vs_3commas.row_coins_p": "569+ coins (Binance Futures)",
  "vs_3commas.row_coins_other": "Multiple exchanges, varies by plan",
  "vs_3commas.row_data": "Backtest Data",
  "vs_3commas.row_data_p": "Real OHLCV with fees & slippage",
  "vs_3commas.row_data_other": "Limited backtesting, primarily live bots",
  "vs_3commas.row_fees": "Fee Simulation",
  "vs_3commas.row_fees_p": "0.08% maker/taker, funding included",
  "vs_3commas.row_fees_other": "Live trading fees only",
  "vs_3commas.row_multi": "Multi-coin Test",
  "vs_3commas.row_multi_p": "569+ coins simultaneously",
  "vs_3commas.row_multi_other": "Bot-by-bot, not batch backtest",
  "vs_3commas.row_live": "Live Trading",
  "vs_3commas.row_live_p": "Research tool — backtest only",
  "vs_3commas.row_live_other": "Yes — DCA and Grid bots",
  "vs_3commas.row_builder": "Strategy Builder",
  "vs_3commas.row_builder_p": "Visual indicator builder",
  "vs_3commas.row_builder_other": "DCA/Grid bot configuration",
  "vs_3commas.row_api": "API Access",
  "vs_3commas.row_api_p": "Open REST API",
  "vs_3commas.row_api_other": "Available on paid plans",
  "vs_3commas.row_community": "Community",
  "vs_3commas.row_community_p": "Public rankings & leaderboard",
  "vs_3commas.row_community_other": "Marketplace for bot strategies",
  "vs_3commas.when_pruviq": "Choose PRUVIQ when you want...",
  "vs_3commas.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs_3commas.when_pruviq_2": "Test a strategy on 569+ coins simultaneously",
  "vs_3commas.when_pruviq_3": "See realistic results with fees and slippage",
  "vs_3commas.when_pruviq_4": "Verify with transparent backtest results",
  "vs_3commas.when_other": "Choose 3Commas when you want...",
  "vs_3commas.when_other_1": "Automated DCA or Grid bots running 24/7",
  "vs_3commas.when_other_2": "Portfolio rebalancing across multiple exchanges",
  "vs_3commas.when_other_3": "Pre-built marketplace strategies to copy",
  "vs_3commas.when_other_4": "Live trading without manual order management",
  "vs_3commas.cta_title": "Try PRUVIQ Free Today",
  "vs_3commas.cta_desc":
    "Backtest your strategy on 569+ coins before committing to any paid tool. No signup required.",

  // Comparison pages: Coinrule
  "meta.vs_coinrule_title":
    "PRUVIQ vs Coinrule — Free Crypto Backtesting Alternative",
  "meta.vs_coinrule_desc":
    "Compare PRUVIQ with Coinrule for crypto strategy backtesting. Free forever, no IF-THEN limits, 569+ coins with real fee simulation.",
  "vs_coinrule.tag": "HONEST COMPARISON",
  "vs_coinrule.title": "PRUVIQ vs Coinrule",
  "vs_coinrule.subtitle": "for crypto backtesting",
  "vs_coinrule.desc":
    "Coinrule lets you automate trading with IF-THEN rules. If you want to rigorously backtest a strategy on hundreds of coins before deploying it, PRUVIQ is built for that — and it's free.",
  "vs_coinrule.tldr": "TL;DR",
  "vs_coinrule.tldr_text":
    "Coinrule is a rule-based automation tool. PRUVIQ is a backtesting-first research tool — free, no-code, 569+ coins, with slippage and fees built in.",
  "vs_coinrule.feature": "Feature",
  "vs_coinrule.pruviq": "PRUVIQ",
  "vs_coinrule.other": "Coinrule",
  "vs_coinrule.row_price": "Price",
  "vs_coinrule.row_price_p": "Free forever",
  "vs_coinrule.row_price_other": "$29–449/mo (Starter–Unlimited)",
  "vs_coinrule.row_coding": "Coding Required",
  "vs_coinrule.row_coding_p": "No code — visual builder",
  "vs_coinrule.row_coding_other": "No coding — IF-THEN rule builder",
  "vs_coinrule.row_coins": "Coins Supported",
  "vs_coinrule.row_coins_p": "569+ coins (Binance Futures)",
  "vs_coinrule.row_coins_other": "Multiple exchanges, plan-dependent limits",
  "vs_coinrule.row_data": "Backtest Data",
  "vs_coinrule.row_data_p": "Real OHLCV with fees & slippage",
  "vs_coinrule.row_data_other": "Limited backtesting capability",
  "vs_coinrule.row_fees": "Fee Simulation",
  "vs_coinrule.row_fees_p": "0.08% maker/taker, funding included",
  "vs_coinrule.row_fees_other": "Live trading fees via exchange",
  "vs_coinrule.row_multi": "Multi-coin Test",
  "vs_coinrule.row_multi_p": "569+ coins simultaneously",
  "vs_coinrule.row_multi_other": "Rule runs per coin, not batch backtest",
  "vs_coinrule.row_live": "Live Trading",
  "vs_coinrule.row_live_p": "Research tool — backtest only",
  "vs_coinrule.row_live_other": "Yes — automated rule execution",
  "vs_coinrule.row_builder": "Strategy Builder",
  "vs_coinrule.row_builder_p": "Visual indicator builder",
  "vs_coinrule.row_builder_other": "IF-THEN condition blocks",
  "vs_coinrule.row_api": "API Access",
  "vs_coinrule.row_api_p": "Open REST API",
  "vs_coinrule.row_api_other": "Available on higher-tier plans",
  "vs_coinrule.row_community": "Community",
  "vs_coinrule.row_community_p": "Public rankings & leaderboard",
  "vs_coinrule.row_community_other": "Template library and community rules",
  "vs_coinrule.when_pruviq": "Choose PRUVIQ when you want...",
  "vs_coinrule.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs_coinrule.when_pruviq_2": "Test a strategy on 569+ coins simultaneously",
  "vs_coinrule.when_pruviq_3": "See realistic results with fees and slippage",
  "vs_coinrule.when_pruviq_4": "Verify with transparent backtest results",
  "vs_coinrule.when_other": "Choose Coinrule when you want...",
  "vs_coinrule.when_other_1":
    "Automate trades with IF-THEN logic without coding",
  "vs_coinrule.when_other_2":
    "Connect to multiple exchanges from one dashboard",
  "vs_coinrule.when_other_3": "Use pre-built rule templates from the community",
  "vs_coinrule.when_other_4": "Run live automated strategies around the clock",
  "vs_coinrule.cta_title": "Try PRUVIQ Free Today",
  "vs_coinrule.cta_desc":
    "Backtest your strategy on 569+ coins before paying for any automation tool. No account required.",

  // Comparison pages: Cryptohopper
  "meta.vs_cryptohopper_title":
    "PRUVIQ vs Cryptohopper — Free Crypto Backtesting Alternative",
  "meta.vs_cryptohopper_desc":
    "Compare PRUVIQ with Cryptohopper for crypto strategy backtesting. Free forever, no cloud subscription, 569+ coins with real fee and slippage simulation.",
  "vs_cryptohopper.tag": "HONEST COMPARISON",
  "vs_cryptohopper.title": "PRUVIQ vs Cryptohopper",
  "vs_cryptohopper.subtitle": "for crypto backtesting",
  "vs_cryptohopper.desc":
    "Cryptohopper is a cloud-based bot with a marketplace of strategies. If you want to backtest an idea thoroughly across hundreds of coins before deploying it, PRUVIQ does that for free.",
  "vs_cryptohopper.tldr": "TL;DR",
  "vs_cryptohopper.tldr_text":
    "Cryptohopper is a cloud bot with a paid marketplace. PRUVIQ is a free, no-code backtesting tool — 569+ coins, real fees modeled, all results published transparently.",
  "vs_cryptohopper.feature": "Feature",
  "vs_cryptohopper.pruviq": "PRUVIQ",
  "vs_cryptohopper.other": "Cryptohopper",
  "vs_cryptohopper.row_price": "Price",
  "vs_cryptohopper.row_price_p": "Free forever",
  "vs_cryptohopper.row_price_other": "$19–107/mo (Pioneer–Hero)",
  "vs_cryptohopper.row_coding": "Coding Required",
  "vs_cryptohopper.row_coding_p": "No code — visual builder",
  "vs_cryptohopper.row_coding_other":
    "No coding — template-based configuration",
  "vs_cryptohopper.row_coins": "Coins Supported",
  "vs_cryptohopper.row_coins_p": "569+ coins (Binance Futures)",
  "vs_cryptohopper.row_coins_other": "Multiple exchanges, varies by plan",
  "vs_cryptohopper.row_data": "Backtest Data",
  "vs_cryptohopper.row_data_p": "Real OHLCV with fees & slippage",
  "vs_cryptohopper.row_data_other": "Basic backtesting on limited history",
  "vs_cryptohopper.row_fees": "Fee Simulation",
  "vs_cryptohopper.row_fees_p": "0.08% maker/taker, funding included",
  "vs_cryptohopper.row_fees_other": "Exchange fees applied at live execution",
  "vs_cryptohopper.row_multi": "Multi-coin Test",
  "vs_cryptohopper.row_multi_p": "569+ coins simultaneously",
  "vs_cryptohopper.row_multi_other":
    "Per-bot configuration, not batch backtest",
  "vs_cryptohopper.row_live": "Live Trading",
  "vs_cryptohopper.row_live_p": "Research tool — backtest only",
  "vs_cryptohopper.row_live_other": "Yes — cloud bots running continuously",
  "vs_cryptohopper.row_builder": "Strategy Builder",
  "vs_cryptohopper.row_builder_p": "Visual indicator builder",
  "vs_cryptohopper.row_builder_other":
    "Template designer and marketplace strategies",
  "vs_cryptohopper.row_api": "API Access",
  "vs_cryptohopper.row_api_p": "Open REST API",
  "vs_cryptohopper.row_api_other": "Available on paid plans",
  "vs_cryptohopper.row_community": "Community",
  "vs_cryptohopper.row_community_p": "Public rankings & leaderboard",
  "vs_cryptohopper.row_community_other":
    "Marketplace for buying/selling strategies",
  "vs_cryptohopper.when_pruviq": "Choose PRUVIQ when you want...",
  "vs_cryptohopper.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs_cryptohopper.when_pruviq_2":
    "Test a strategy on 569+ coins simultaneously",
  "vs_cryptohopper.when_pruviq_3":
    "See realistic results with fees and slippage",
  "vs_cryptohopper.when_pruviq_4": "Verify with transparent backtest results",
  "vs_cryptohopper.when_other": "Choose Cryptohopper when you want...",
  "vs_cryptohopper.when_other_1":
    "Cloud bots that run 24/7 without keeping a PC on",
  "vs_cryptohopper.when_other_2":
    "Buy or sell ready-made strategies via marketplace",
  "vs_cryptohopper.when_other_3": "Automated trading across multiple exchanges",
  "vs_cryptohopper.when_other_4":
    "Signal-based trading with third-party providers",
  "vs_cryptohopper.cta_title": "Try PRUVIQ Free Today",
  "vs_cryptohopper.cta_desc":
    "Test any strategy on 569+ coins for free before buying into a cloud bot subscription. No account needed.",

  // Comparison pages: Gainium
  "meta.vs_gainium_title":
    "PRUVIQ vs Gainium — Free Crypto Backtesting Alternative",
  "meta.vs_gainium_desc":
    "Compare PRUVIQ with Gainium for crypto strategy backtesting. Free forever, no DCA-only limits, 569+ coins with real slippage and fee simulation.",
  "vs_gainium.tag": "HONEST COMPARISON",
  "vs_gainium.title": "PRUVIQ vs Gainium",
  "vs_gainium.subtitle": "for crypto backtesting",
  "vs_gainium.desc":
    "Gainium specializes in DCA bots with solid portfolio management on Binance. If you want to rigorously backtest a strategy across hundreds of coins before committing capital, PRUVIQ provides that research layer for free.",
  "vs_gainium.tldr": "TL;DR",
  "vs_gainium.tldr_text":
    "Gainium focuses on DCA execution and portfolio management. PRUVIQ is built for research-first backtesting — free, no-code, 569+ coins, with real cost simulation.",
  "vs_gainium.feature": "Feature",
  "vs_gainium.pruviq": "PRUVIQ",
  "vs_gainium.other": "Gainium",
  "vs_gainium.row_price": "Price",
  "vs_gainium.row_price_p": "Free forever",
  "vs_gainium.row_price_other": "$49+/mo",
  "vs_gainium.row_coding": "Coding Required",
  "vs_gainium.row_coding_p": "No code — visual builder",
  "vs_gainium.row_coding_other": "No coding — DCA bot configuration",
  "vs_gainium.row_coins": "Coins Supported",
  "vs_gainium.row_coins_p": "569+ coins (Binance Futures)",
  "vs_gainium.row_coins_other": "Binance-focused, curated coin list",
  "vs_gainium.row_data": "Backtest Data",
  "vs_gainium.row_data_p": "Real OHLCV with fees & slippage",
  "vs_gainium.row_data_other": "DCA simulation, limited historical depth",
  "vs_gainium.row_fees": "Fee Simulation",
  "vs_gainium.row_fees_p": "0.08% maker/taker, funding included",
  "vs_gainium.row_fees_other": "Fees applied at live execution",
  "vs_gainium.row_multi": "Multi-coin Test",
  "vs_gainium.row_multi_p": "569+ coins simultaneously",
  "vs_gainium.row_multi_other": "Portfolio view, not batch backtest",
  "vs_gainium.row_live": "Live Trading",
  "vs_gainium.row_live_p": "Research tool — backtest only",
  "vs_gainium.row_live_other": "Yes — DCA bots with portfolio tracking",
  "vs_gainium.row_builder": "Strategy Builder",
  "vs_gainium.row_builder_p": "Visual indicator builder",
  "vs_gainium.row_builder_other": "DCA parameter configuration",
  "vs_gainium.row_api": "API Access",
  "vs_gainium.row_api_p": "Open REST API",
  "vs_gainium.row_api_other": "Available on paid plans",
  "vs_gainium.row_community": "Community",
  "vs_gainium.row_community_p": "Public rankings & leaderboard",
  "vs_gainium.row_community_other": "Community and shared bot configurations",
  "vs_gainium.when_pruviq": "Choose PRUVIQ when you want...",
  "vs_gainium.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs_gainium.when_pruviq_2": "Test a strategy on 569+ coins simultaneously",
  "vs_gainium.when_pruviq_3": "See realistic results with fees and slippage",
  "vs_gainium.when_pruviq_4": "Verify with transparent backtest results",
  "vs_gainium.when_other": "Choose Gainium when you want...",
  "vs_gainium.when_other_1": "DCA bots with automated entry averaging",
  "vs_gainium.when_other_2": "Portfolio management dashboard for Binance",
  "vs_gainium.when_other_3": "Bot-level performance tracking and analytics",
  "vs_gainium.when_other_4": "Automated live trading without manual execution",
  "vs_gainium.cta_title": "Try PRUVIQ Free Today",
  "vs_gainium.cta_desc":
    "Research your strategy across 569+ coins for free before deploying any DCA bot. No account needed.",

  // Comparison pages: Streak
  "meta.vs_streak_title":
    "PRUVIQ vs Streak — Free Crypto Backtesting Alternative",
  "meta.vs_streak_desc":
    "Compare PRUVIQ with Streak for crypto strategy backtesting. Free forever, no Pine Script required, 569+ coins with real fee and slippage simulation.",
  "vs_streak.tag": "HONEST COMPARISON",
  "vs_streak.title": "PRUVIQ vs Streak",
  "vs_streak.subtitle": "for crypto backtesting",
  "vs_streak.desc":
    "Streak is a TradingView-integrated backtesting tool that requires Pine Script and a premium subscription. If you want to test strategy ideas without writing code or paying monthly fees, PRUVIQ is the alternative.",
  "vs_streak.tldr": "TL;DR",
  "vs_streak.tldr_text":
    "Streak targets advanced users who already know Pine Script and TradingView. PRUVIQ is for anyone who wants rigorous backtesting without coding skills or a subscription.",
  "vs_streak.feature": "Feature",
  "vs_streak.pruviq": "PRUVIQ",
  "vs_streak.other": "Streak",
  "vs_streak.row_price": "Price",
  "vs_streak.row_price_p": "Free forever",
  "vs_streak.row_price_other": "$79+/mo",
  "vs_streak.row_coding": "Coding Required",
  "vs_streak.row_coding_p": "No code — visual builder",
  "vs_streak.row_coding_other":
    "Pine Script (TradingView integration required)",
  "vs_streak.row_coins": "Coins Supported",
  "vs_streak.row_coins_p": "569+ coins (Binance Futures)",
  "vs_streak.row_coins_other": "Depends on TradingView data connection",
  "vs_streak.row_data": "Backtest Data",
  "vs_streak.row_data_p": "Real OHLCV with fees & slippage",
  "vs_streak.row_data_other": "TradingView historical data via Pine Script",
  "vs_streak.row_fees": "Fee Simulation",
  "vs_streak.row_fees_p": "0.08% maker/taker, funding included",
  "vs_streak.row_fees_other": "Configured manually in Pine Script",
  "vs_streak.row_multi": "Multi-coin Test",
  "vs_streak.row_multi_p": "569+ coins simultaneously",
  "vs_streak.row_multi_other": "One chart at a time via TradingView",
  "vs_streak.row_live": "Live Trading",
  "vs_streak.row_live_p": "Research tool — backtest only",
  "vs_streak.row_live_other": "Yes — live alerts and automated orders",
  "vs_streak.row_builder": "Strategy Builder",
  "vs_streak.row_builder_p": "Visual indicator builder",
  "vs_streak.row_builder_other": "Pine Script editor (advanced users)",
  "vs_streak.row_api": "API Access",
  "vs_streak.row_api_p": "Open REST API",
  "vs_streak.row_api_other": "Via TradingView webhooks",
  "vs_streak.row_community": "Community",
  "vs_streak.row_community_p": "Public rankings & leaderboard",
  "vs_streak.row_community_other": "TradingView community scripts",
  "vs_streak.when_pruviq": "Choose PRUVIQ when you want...",
  "vs_streak.when_pruviq_1": "Free crypto backtesting with zero coding",
  "vs_streak.when_pruviq_2": "Test a strategy on 569+ coins simultaneously",
  "vs_streak.when_pruviq_3": "See realistic results with fees and slippage",
  "vs_streak.when_pruviq_4": "Verify with transparent backtest results",
  "vs_streak.when_other": "Choose Streak when you want...",
  "vs_streak.when_other_1":
    "Deep TradingView integration with Pine Script strategies",
  "vs_streak.when_other_2": "Advanced custom indicators beyond standard ones",
  "vs_streak.when_other_3": "Live alerts and automated order execution",
  "vs_streak.when_other_4": "Multi-asset coverage beyond crypto futures",
  "vs_streak.cta_title": "Try PRUVIQ Free Today",
  "vs_streak.cta_desc":
    "No Pine Script, no TradingView account, no fees. Test 569+ coins and see real results in seconds.",
} as const;

export type TranslationKey = keyof typeof en;
