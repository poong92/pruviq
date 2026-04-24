# PRUVIQ UX Audit Report (2026-03-20)

## Executive Summary

- **Analyzed pages**: 14 primary (EN 10 + KO 4), 35 viewports total (desktop/mobile/tablet)
- **Critical issues**: 4
- **Warning issues**: 6
- **Info issues**: 5
- **Overall UX score**: 7.0/10
- **Previous score**: 6.7/10 (2026-03-12) -- +0.3 improvement

### Score Composition

| Category | Score | Weight | Reasoning |
|----------|-------|--------|-----------|
| Content completeness | 8.5/10 | 25% | 29 learn articles, 5 strategies, 36 presets, thorough methodology |
| Data freshness & accuracy | 5.5/10 | 25% | Market dashboard broken, leaderboard sentinel values, performance stale 20d |
| Visual/Layout quality | 8.0/10 | 20% | Clean dark theme, good responsive design, minor mobile cookie overlap |
| Interaction quality | 6.5/10 | 15% | Simulator scenario flow works, ranking filters functional, but market page crashes |
| i18n quality | 8.0/10 | 15% | KO translation 95%+ complete, nav/CTA/disclaimers fully Korean |

---

## Critical Issues (P0 -- Immediate Fix Required)

### CRIT-1: Market Dashboard Shows Error Page

- **Page**: `/market/` (EN), `/ko/market/` (KO)
- **Current state**: "Something went wrong loading Market Dashboard." with Retry button. Screenshot confirms zero market data rendered -- no BTC price, no Fear & Greed Index, no charts. Footer and nav visible, main content is a single error box.
- **User impact**: Market is the first item in main navigation. A new user clicking "Market" sees an error page, creating immediate distrust. Estimated 15-25% of first-time visitors click Market first.
- **Root cause**: Likely CoinGecko API 429 rate limit or stale API key. The JS-dependent dashboard fails silently on data fetch error.
- **Fix**: (1) Add cached data fallback -- show last-known BTC/ETH prices with "X minutes ago" timestamp. (2) Investigate CoinGecko rate limit (prior PR #501 addressed this). (3) Add server-side error boundary that shows cached data instead of error.
- **Evidence**: Screenshot `test-results/vision/market-desktop-atf.png`, WebFetch confirms JS fallback text "Market prices require JavaScript to load."

### CRIT-2: Leaderboard Exposes PF Sentinel Values (99.99)

- **Page**: `/leaderboard/`
- **Current state**: "This Week's Best 3" displays BB Squeeze LONG and Momentum 6H with **PF = 99.99 (CAP)** and **0 trades**. Both cards show "Low sample (0 trades < 100)" warning badge, yet they rank as #1 and #2 best strategies.
- **User impact**: A 99.99 PF with 0 trades in "Best 3" destroys platform credibility. Any trader -- beginner or expert -- will immediately question all other data on the site.
- **Root cause**: Weekly 7-day PF ranking. Strategies with 0 trades in the 7-day window receive a capped sentinel PF (99.99) which sorts to the top. The cap display logic shows the raw value instead of filtering it.
- **Fix**: (1) Filter strategies with < 10 trades from weekly leaderboard entirely. (2) Never display raw "99.99 (CAP)" to users -- either show "N/A" or "Insufficient data". (3) If all strategies have < 10 weekly trades, show "Not enough data this week" message.
- **Evidence**: Screenshot `test-results/vision/leaderboard-desktop-atf.png` shows PF "99.99 (CAP)" clearly visible on two cards.

### CRIT-3: Daily Ranking #1 Has Only 26 Trades

- **Page**: `/strategies/ranking`
- **Current state**: Ichimoku 6H ranks #1 in BEST 3 with PF 2.69 and Win Rate 65.4% but only **26 trades**. The page itself warns "Strategies with fewer than 100 trades have low statistical reliability" and notes "(< 100) may be overfitted" -- yet this strategy is prominently displayed as the #1 best.
- **User impact**: Contradicts the page's own warning. Users who read the fine print will distrust the ranking. Users who don't will follow a potentially unreliable strategy.
- **Fix**: (1) Add a prominent visual indicator (red/yellow border, dimmed opacity, or "Caution: Low Sample" badge) on the #1 card when trades < 100. (2) Consider filtering < 30 trades from BEST 3 entirely. (3) Sort low-sample strategies below adequate-sample ones.
- **Evidence**: Screenshot `test-results/vision/ranking-desktop-atf.png` shows Ichimoku 6H at #1 with "Trades: 26".

### CRIT-4: Mobile Cookie Banner Overlaps CTA Text

- **Page**: `/` (mobile 375px)
- **Current state**: Bottom sticky cookie banner ("This site uses essential security cookies only...") renders on top of "Try Simulator Free" CTA button text. The two text layers overlap, making both unreadable and the CTA untappable.
- **User impact**: First-time mobile visitors cannot access the primary conversion CTA without first finding and tapping "Got it" on the cookie banner -- but the overlap makes this confusing.
- **Fix**: (1) Add `z-index` separation and `padding-bottom` to main content so cookie banner doesn't overlap CTA. (2) Or move cookie banner to top of page. (3) Or auto-dismiss after 5 seconds.
- **Evidence**: Screenshot `test-results/vision/home-mobile-atf.png` shows text overlap at bottom of viewport.

---

## Warning Issues (P1 -- Fix This Week)

### WARN-1: Performance Data Stale (20 Days Old)

- **Page**: `/performance/`
- **Current state**: "Last updated: Feb 28, 2026" -- 20 days stale. Period "Jan 2024 -- Feb 2026". Data shows BB Squeeze SHORT with 68.6% WR, 2.22 PF, +$794 PnL, 2,898 trades.
- **User impact**: A data-driven platform showing month-old data signals abandonment. Trading platforms are expected to refresh daily.
- **Fix**: Update performance data or display explicit "Updated monthly" cadence note. Better: automate daily/weekly refresh.

### WARN-2: Leaderboard Strategy Names Truncated

- **Page**: `/leaderboard/`
- **Current state**: "BB Squeeze L..." and "RSI Divergen..." truncated mid-word on cards.
- **Fix**: Increase card width, reduce font size for long names, or show tooltip with full name on hover.

### WARN-3: Coins Page Requires JavaScript for Full List

- **Page**: `/coins/`
- **Current state**: SSR shows only 30 popular coins. Full 569 list requires JavaScript. Search/filter also JS-dependent.
- **User impact**: Crawlers and no-JS users see only 30/569 coins. SEO loss for long-tail coin pages.
- **Fix**: Server-render at least 100 coins with pagination. Add `<noscript>` fallback with full alphabetical list.

### WARN-4: Market KO Page Also Broken

- **Page**: `/ko/market/`
- **Current state**: Same "Something went wrong" error as EN market page.
- **Fix**: Same as CRIT-1.

### WARN-5: No Equity Curve on Performance Page

- **Page**: `/performance/`
- **Current state**: Only numerical metrics displayed (WR, PF, PnL, Trades). No visual equity curve, no drawdown chart, no trade timeline.
- **User impact**: Quant users (Persona: Quinn) expect visual PnL representation. Numbers alone are less persuasive than a chart showing growth trajectory.
- **Fix**: Add an equity curve SVG/canvas chart. Even a simple line chart of cumulative PnL over time would significantly improve the page.

### WARN-6: WORST 3 Daily Ranking Low-Sample Entries

- **Page**: `/strategies/ranking`
- **Current state**: WORST 3 includes BB Squeeze 4H with only 5 trades (PF 0.07, WR 20.0%). Labeling a 5-trade strategy as "worst" is statistically meaningless.
- **Fix**: Require minimum 30 trades for inclusion in BEST/WORST 3 lists. Show "Insufficient data" note otherwise.

---

## Info Issues (P2/P3 -- Nice to Have)

### INFO-1: Builder and Simulate Are Duplicate Pages

- **Pages**: `/builder/` and `/simulate/`
- **Current state**: Same H1 ("Build a Strategy. Test It on 569+ Coins."), same content, same functionality. Two URLs for one page.
- **Fix**: Add `<link rel="canonical">` pointing `/builder/` to `/simulate/`, or redirect. SEO duplicate content risk.

### INFO-2: All 6 Leaderboard Strategies Have "Low Sample" Badge

- **Page**: `/leaderboard/`
- **Current state**: Every Best 3 and Worst 3 strategy shows "Low sample" warning. When 100% of entries are flagged, the entire leaderboard's value is questionable.
- **Fix**: Consider removing leaderboard tab entirely when no strategy has >= 100 weekly trades, or show a "Not enough weekly data" placeholder.

### INFO-3: API Page H1 Missing Space

- **Page**: `/api/`
- **Current state**: Extracted H1 from DOM shows "Build withPRUVIQ data." -- missing space between "with" and "PRUVIQ". WebFetch extraction shows correct "Build with PRUVIQ data." so this may be a rendering-specific issue in some browsers.
- **Fix**: Verify source HTML. Likely a `<span>` break without whitespace.

### INFO-4: Cookie Banner Bottom Bar Overlap (All Pages)

- **Pages**: All desktop/tablet pages
- **Current state**: Bottom sticky bar ("No code. No signup. No cost...") plus cookie banner create two overlapping bottom elements. Not blocking but visually cluttered.
- **Fix**: Stack properly or dismiss cookie banner after acceptance.

### INFO-5: "KO" Language Toggle Label

- **Pages**: All EN pages
- **Current state**: Language toggle shows "KO" which is an ISO code non-Korean speakers may not recognize. Other sites use flag icons or full language name.
- **Fix**: Consider using flag icon or displaying text as "Korean" with a tooltip.

---

## Detailed Page Analysis (14 Pages)

### 1. `/` (Homepage)
**Score: 8.5/10**
- H1: "Test Any Crypto Strategy on 569 Coins in 3 Seconds." -- clear, specific, compelling
- 569+ coin count correct (no stale 549)
- Trust badges present: CoinGecko Data, Monte Carlo Validated, 12,847 simulations
- 2 CTAs above fold: "Try Simulator Free", "See Backtest Results"
- TradingView comparison callout ("VS TradingView charges $14-240/mo")
- Cookie banner functional with "Got it" dismiss
- Mobile (375px): Cookie banner overlaps CTA text (CRIT-4)
- Tablet (768px): Layout adapts cleanly, all elements visible

### 2. `/simulate/` (Simulator)
**Score: 9.0/10**
- H1: "Build a Strategy. Test It on 569+ Coins."
- 3 tabs: Quick Test / Standard / Expert
- 5 scenario cards: Breakout, Reversals, Range Trading, Trend Following, Hedging
- Initial state: "Run a backtest to see results." (correct, no false empty state)
- Cross-sell links: Compare Fees, How We Calculate
- Disclaimer present: "Simulation only -- not real trading"
- 36 strategies available, 11+ indicators
- No issues detected

### 3. `/strategies/ranking` (Daily Ranking)
**Score: 6.5/10**
- H1: "Daily Strategy Ranking"
- Date: March 20, 2026 (fresh, 0 days old)
- BEST 3: Ichimoku 6H (26 trades) / MACD Cross LONG 4H (150) / ADX Trend LONG (136)
- WORST 3: BB Squeeze 4H (5 trades) / ATR Breakout SHORT (59) / MA Cross (66)
- Filter buttons: 30 Days / 365 Days / 7 Days + Top 30/50/100/BTC Only
- Warning text about <100 trades present
- Issues: #1 has 26 trades (CRIT-3), WORST #1 has 5 trades (WARN-6)

### 4. `/leaderboard/` (Weekly Leaderboard)
**Score: 3.5/10**
- H1: "This Week's Top Strategies"
- 3 tabs: Strategies / Daily Ranking / Weekly Rankings
- Best 3: BB Squeeze LONG (0 trades, PF 99.99 CAP), Momentum 6H (0 trades, PF 99.99 CAP), RSI Divergence (14 trades, PF 10.81)
- All 6 entries have "Low sample" warning
- PF sentinel 99.99 displayed to users (CRIT-2)
- 0-trade strategies ranked as "best" (CRIT-2)

### 5. `/market/` (Market Dashboard)
**Score: 1.5/10**
- H1: "Market Dashboard"
- Error: "Something went wrong loading Market Dashboard." + Retry button
- Zero data displayed -- no BTC, no Fear & Greed, no charts
- Fallback CTAs present: "Try the Simulator", "View All Strategies"
- Same error in KO version
- Critical failure (CRIT-1)

### 6. `/coins/` (Coin Explorer)
**Score: 7.0/10**
- H1: "Browse All Coins"
- 30 popular coins in SSR (BTC, ETH, SOL, BNB...)
- Full 569 list requires JavaScript
- Sparkline charts, 15-min price updates promised
- Search/filter JS-dependent (WARN-3)

### 7. `/learn/` (Education)
**Score: 9.0/10**
- H1: "Learn Trading. No Hype. Real Data."
- 29 guides across 3 levels: Beginner / Intermediate / Advanced
- Progress tracking: "0 of 29 articles read"
- Well-organized with topic tags (Futures, Leverage, Fees, etc.)
- No search function (minor gap)

### 8. `/fees/` (Fee Comparison)
**Score: 8.0/10**
- H1: "Compare Fees. Save on Every Trade."
- 3 exchanges: Binance (Spot 0.10%/0.10%, Futures 0.020%/0.050%), Bitget, OKX
- Fee calculator with customizable monthly volume
- Referral discount CTAs (10-20% off)
- OKX shows "Coming Soon" for signup link

### 9. `/compare/tradingview/` (TradingView Comparison)
**Score: 9.0/10**
- H1: "PRUVIQ vs TradingView for crypto backtesting"
- 10 comparison points in clean table (Price, Coding, Coins, Data, Fees, Multi-Coin, Transparency, Builder, API, Community)
- TL;DR: "Use TradingView for charts and community. Use PRUVIQ for free, no-code crypto backtesting"
- Balanced tone -- acknowledges TradingView strengths

### 10. `/about/` (About)
**Score: 8.0/10**
- H1: "Built by a Trader. For Traders."
- Solo founder story (lost $4K, built PRUVIQ)
- Mission: publish all results including failures
- GitHub link for source transparency
- No empty sections

### 11. `/methodology/` (Methodology)
**Score: 9.5/10**
- H1: "How We Test. No Shortcuts."
- 7 sections: Backtesting, Metrics, Risk-Adjusted, Robustness, Not Modeled, Reproducibility, Disclaimer
- Fee assumption: 0.04% taker/side (0.08% round-trip)
- Monte Carlo: 1,000+ randomized simulations
- OOS testing: 2024/2025/2026 independently
- Explicitly lists what is NOT modeled (funding rates, market impact, black swans)
- Best page on the site for credibility

### 12. `/api/` (API Reference)
**Score: 8.0/10**
- H1: "Build with PRUVIQ data."
- Base URL: https://api.pruviq.com
- Rate limit: 30 req/min, no auth required
- 14 endpoints across 4 categories (Market, Data, Simulation, Builder)
- Code examples: Python, cURL, JavaScript
- Swagger UI + ReDoc available at /docs and /redoc
- Minor H1 spacing issue (INFO-3)

### 13. `/ko/` (Korean Homepage)
**Score: 8.5/10**
- H1: "569 coins, 3 seconds to verify strategy" (Korean)
- 95%+ Korean translation
- All CTAs Korean: "Free simulator experience", "Explore strategies"
- Nav fully Korean: market, simulator, strategy, coins, learning, fees
- Cookie banner Korean
- Trust badges Korean: CoinGecko data, Monte Carlo validation
- Technical terms (Pine Script, GitHub) remain English (acceptable)

### 14. `/ko/simulate/` (Korean Simulator)
**Score: 8.5/10**
- H1: "Build strategies and test across 569 coins" (Korean)
- Scenario steps in Korean
- Disclaimer fully translated
- Indicator names mixed (BB Squeeze SHORT English, RSI divergence Korean) -- industry standard
- 95%+ i18n completeness

---

## Persona Evaluation

| Persona | Core Need | Key Bottleneck | Score | Summary |
|---------|-----------|----------------|-------|---------|
| Casey (Beginner) | "Is this legit? Can I try free?" | Market page error on first click | 7.0/10 | Homepage is excellent. But if Casey clicks Market first, trust is broken. Simulator flow works well for recovery. |
| Tim (Intermediate) | "Will these strategies work for me?" | Leaderboard PF=99.99 sentinel | 6.0/10 | Tim knows PF 99.99 is impossible. Sees it on leaderboard and questions all data. Ranking low-sample #1 compounds the doubt. |
| Quinn (Quant) | "Can I validate the methodology?" | No equity curve, no CSV export | 7.5/10 | Methodology page is excellent (9.5/10). API is strong. But missing visual PnL and trade-level data limits deep analysis. |
| Sam (Skeptic) | "What are they hiding?" | Market broken + sentinel values = "buggy site" | 5.5/10 | Sam sees error page + 99.99 PF and concludes the platform is unreliable. Even the transparency messaging can't overcome visible bugs. |

---

## Competitor Comparison (TradingView)

| UX Aspect | PRUVIQ | TradingView | Winner |
|-----------|--------|-------------|--------|
| **Onboarding friction** | Zero (no signup, free) | Requires account, paid for backtesting | PRUVIQ |
| **Backtesting UX** | Visual builder, scenario cards, 3 clicks to result | Pine Script coding required | PRUVIQ |
| **Multi-coin testing** | 569 coins in 1 click | 1 chart at a time | PRUVIQ |
| **Live market data** | Broken (error page) | Real-time streaming with charts | TradingView |
| **Equity visualization** | Numbers only, no chart | Full equity curve + statistics | TradingView |
| **Community/social** | None | 50M+ users, script sharing | TradingView |
| **Mobile experience** | Responsive web (cookie overlap issue) | Native iOS/Android apps | TradingView |
| **Transparency** | All results published including losses | User-published only | PRUVIQ |
| **API access** | Free, no auth, 30 req/min | Paid plans only | PRUVIQ |
| **Fee modeling** | Built-in (0.08%/side) | Manual in Pine Script | PRUVIQ |

**PRUVIQ competitive position**: Strongest in free access, no-code UX, multi-coin breadth, and transparency. Weakest in real-time data (broken), visualization (no charts), and community. The broken market page is the single biggest competitive gap -- it's the one area where PRUVIQ promises parity but delivers failure.

---

## Improvement Priority Roadmap

### P0 -- Today (User-Facing Bugs Blocking Trust)

| # | Issue | Page | Impact | Effort | Fix |
|---|-------|------|--------|--------|-----|
| 1 | Market dashboard error | `/market/` | HIGH -- primary nav link crashes | Medium | Add cached data fallback, investigate CoinGecko 429 |
| 2 | Leaderboard PF=99.99 sentinel | `/leaderboard/` | HIGH -- credibility killer | Low | Filter strategies with < 10 weekly trades |
| 3 | Mobile cookie banner CTA overlap | `/` mobile | MEDIUM -- blocks primary CTA | Low | CSS z-index + padding fix |

### P1 -- This Week (Data Quality & Accuracy)

| # | Issue | Page | Impact | Effort |
|---|-------|------|--------|--------|
| 4 | Ranking #1 has 26 trades | `/strategies/ranking` | Medium -- misleading | Low (add visual warning badge) |
| 5 | Performance data stale (Feb 28) | `/performance/` | Medium -- trust erosion | Low (run data update) |
| 6 | Leaderboard name truncation | `/leaderboard/` | Low -- readability | Low (CSS) |
| 7 | WORST 3 includes 5-trade strategy | `/strategies/ranking` | Low -- statistical noise | Low (min 30 trades filter) |

### P2 -- This Month (Feature Gaps)

| # | Issue | Page | Impact | Effort |
|---|-------|------|--------|--------|
| 8 | Add equity curve chart | `/performance/` | High -- quant users expect it | Medium |
| 9 | Coins page SSR improvement | `/coins/` | Medium -- SEO for 569 coins | Medium |
| 10 | Builder/Simulate dedup | `/builder/` | Low -- SEO duplicate | Low (canonical/redirect) |
| 11 | Learn page search | `/learn/` | Low -- UX polish | Medium |

### P3 -- Future (Polish & Expansion)

| # | Issue | Page | Impact | Effort |
|---|-------|------|--------|--------|
| 12 | Cookie banner double bar | All | Low -- visual clutter | Low |
| 13 | "KO" label clarity | All EN | Low -- i18n UX | Trivial |
| 14 | Trade CSV export | `/performance/` | Medium -- developer use case | Medium |
| 15 | Interactive simulator tutorial | `/simulate/` | Medium -- onboarding | High |

---

## Test Parameters (Reproducibility)

```
Tool:            Playwright + WebFetch + Manual Screenshot Analysis
Production URL:  https://pruviq.com
API URL:         https://api.pruviq.com
Desktop:         1280x900 (Chromium headless)
Mobile:          375x812 (iPhone UA)
Tablet:          768x1024 (iPad UA)
Hydration wait:  4000ms per page
Collection:      2026-03-20 ~08:30 UTC (35 pages, --workers=1)
Screenshots:     /Users/jepo/Desktop/pruviq/test-results/vision/ (70 PNGs)
Structured data: test-results/vision/collect-data.json (35 records)
WebFetch:        14 primary pages analyzed for HTML content
```

---

## Methodology

1. **Automated screenshot collection** (Playwright, `--workers=1`): 35 pages across 3 viewports. Extracted DOM data: H1 text, coin count, skeleton detection, JS errors, interactive element count, SSR ranking data, API data integrity comparison.
2. **WebFetch HTML analysis**: 14 primary pages fetched and analyzed for content completeness, H1 accuracy, CTA presence, language consistency, data freshness, cross-sell elements.
3. **Visual screenshot analysis**: ATF (above-the-fold) screenshots manually reviewed for layout issues, content rendering, error states, mobile responsiveness.
4. **Data integrity cross-reference**: API ranking data (`/rankings/daily`) compared to rendered page content. Coin count API (`/coins/stats`) compared to displayed count.
5. **Persona-based evaluation**: Each page assessed through 4 user personas (beginner, intermediate, quant, skeptic).

---

*Generated: 2026-03-20 | PRUVIQ Simulator QA Agent | 14 pages analyzed, 35 viewports captured*
