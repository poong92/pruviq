# PRUVIQ v0.1.0 Unified Site Audit Report

> Generated: 2026-02-18 | 6 Expert Agents | Benchmark: CoinGecko, TradingView, Investing.com

## Scorecard Summary

| Dimension | Score | Gap Priority |
|-----------|-------|-------------|
| Trust Signals | 4/10 | **CRITICAL** |
| SEO/Indexing | 6/10 | **CRITICAL** |
| i18n Completeness | 5/10 | **HIGH** |
| Frontend Quality | 6/10 | HIGH |
| UI/UX Polish | 6/10 | HIGH |
| Content Depth | 8/10 | Medium |
| Localization Quality | 8.5/10 | Low |
| Legal Compliance | 7/10 | Medium |
| Data Accuracy | 9.5/10 | Low |

---

## P0 CRITICAL (Fix This Week)

### P0-1. Privacy/Terms Pages Have NO i18n, NO Korean Versions
- **Source**: QA Tester
- **Impact**: Korean users see English-only legal pages = compliance + trust failure
- **Files**: `src/pages/privacy.astro`, `src/pages/terms.astro`
- **Action**: Create `src/pages/ko/privacy.astro`, `src/pages/ko/terms.astro` with Korean translations
- **Effort**: Medium (translation + 2 new pages)

### P0-2. Google Cannot Index the Site
- **Source**: Content/Competitive Analyst
- **Impact**: `site:pruviq.com` returns ZERO results. All SEO work is wasted
- **Files**: Check `public/robots.txt`, Google Search Console
- **Action**: Submit all URLs to Google Search Console, verify robots.txt not blocking
- **Effort**: Low (operational task)

### P0-3. Learn Page Content Completely Hardcoded
- **Source**: QA Tester
- **Impact**: Adding Korean learn page requires duplicating entire HTML, not just translations
- **Files**: `src/pages/learn/index.astro`, `src/pages/ko/learn/index.astro`
- **Action**: Extract all text to i18n keys in en.ts/ko.ts
- **Effort**: Medium

### P0-4. API URL Inconsistent Across Components
- **Source**: Frontend Engineer
- **Impact**: Some components use `https://api.pruviq.com`, others use empty string fallback
- **Files**: `StrategyDemo.tsx`, `CoinChart.tsx`, `PerformanceDashboard.tsx`, `StrategyBuilder.tsx`
- **Action**: Create shared `const API_BASE_URL` or env variable, use consistently
- **Effort**: Low

### P0-5. Exchange Fee Data Duplicated in 3 Places
- **Source**: Frontend Engineer
- **Impact**: Fee rate changes require editing 3 files (risk of inconsistency)
- **Files**: `FeeCalculator.tsx`, `fees.astro`, `ko/fees.astro`
- **Action**: Extract exchange data to single JSON/TS source, import everywhere
- **Effort**: Medium

### P0-6. Live Performance Not Linked from Homepage
- **Source**: Content/Competitive Analyst
- **Impact**: "Skin in the game" (real money trading) is PRUVIQ's biggest differentiator but invisible to homepage visitors
- **Files**: `src/pages/index.astro`
- **Action**: Add trust-anchor block with live trading proof + link to /performance
- **Effort**: Low

### P0-7. "COMING SOON" Blog Copy Still in Codebase
- **Source**: Content/Competitive Analyst
- **Impact**: 17 articles are live but i18n keys still contain "coming soon" fallback. Undermines credibility
- **Files**: `src/i18n/en.ts` (lines ~189-192), `src/i18n/ko.ts`
- **Action**: Remove `blog.coming_soon`, `blog.coming_desc`, `blog.coming_cta`, `blog.coming_cta2`
- **Effort**: Low

---

## P1 HIGH (Fix This Month)

### P1-1. Simulate Page Extensive Hardcoding
- **Source**: QA Tester
- **Impact**: Meta tags, labels, strategy cards all hardcoded English in simulate pages
- **Files**: `src/pages/simulate/index.astro`, `src/pages/ko/simulate/index.astro`
- **Action**: Move all text to i18n keys
- **Effort**: Medium

### P1-2. Hero Subtitle Audience Conflict
- **Source**: Content/Competitive Analyst
- **Impact**: "for quant & algorithmic traders" limits audience, contradicts beginner_note
- **Files**: `src/i18n/en.ts:13`, `src/i18n/ko.ts:15`
- **Before**: "Crypto backtesting for quant & algorithmic traders."
- **After**: "The only backtesting tool that publishes its failures."
- **Effort**: Low

### P1-3. Nav Item "Simulate" Should Be "Backtest"
- **Source**: Content/Competitive Analyst
- **Impact**: Users search for "backtest" not "simulate". Internal jargon in nav
- **Files**: `src/i18n/en.ts:4`, `src/i18n/ko.ts:7`
- **Effort**: Low

### P1-4. Nav Restructure: Add Strategies, Demote Fees
- **Source**: Content/Competitive Analyst
- **Impact**: Strategies (differentiator) not in nav. Fees (monetization) too prominent
- **Files**: `src/layouts/Layout.astro:37-42`
- **Suggested**: Market / Backtest / Strategies / Learn (Fees to footer)
- **Effort**: Low

### P1-5. CTA Button Lacks Hover/Press Feedback
- **Source**: UI/UX Designer
- **Impact**: No visual feedback on primary CTAs = feels unresponsive
- **Files**: Hero CTA, blog CTAs across pages
- **Action**: Add `hover:scale-[1.02]`, `active:scale-[0.98]` + color transition
- **Effort**: Low

### P1-6. Mobile Touch Targets < 44px
- **Source**: UI/UX Designer
- **Impact**: Fails Apple HIG minimum. Hard to tap on mobile
- **Files**: Various button/link components
- **Action**: Audit all interactive elements, ensure min 44x44px touch area
- **Effort**: Medium

### P1-7. No Loading States on Interactive Components
- **Source**: UI/UX Designer
- **Impact**: Backtest button, chart loading show no feedback
- **Files**: `StrategyDemo.tsx`, `StrategyBuilder.tsx`, `CoinChart.tsx`
- **Action**: Add skeleton/spinner states during API calls
- **Effort**: Medium

### P1-8. Blog Index English Page Ignores i18n
- **Source**: QA Tester
- **Impact**: Blog listing page has hardcoded text instead of i18n keys
- **Files**: `src/pages/learn/index.astro`
- **Effort**: Low-Medium

### P1-9. CoinChart.tsx = 640 Lines Doing Too Much
- **Source**: Frontend Engineer
- **Impact**: Unmaintainable. Fetching, rendering, formatting all in one component
- **Files**: `src/components/CoinChart.tsx`
- **Action**: Split into CoinChartContainer + ChartRenderer + priceFormatter
- **Effort**: High

### P1-10. 13+ `any` Type References
- **Source**: Frontend Engineer
- **Impact**: Type safety lost, runtime errors possible
- **Files**: `CoinChart.tsx`, `StrategyBuilder.tsx`, `StrategyDemo.tsx`
- **Action**: Replace with proper TypeScript interfaces
- **Effort**: Medium

### P1-11. Hardcoded '#111' Colors Instead of CSS Variables
- **Source**: Frontend Engineer + UI/UX Designer
- **Impact**: Theme inconsistency, dark mode issues
- **Files**: `CoinChart.tsx`, `MetricBox` (if exists)
- **Action**: Replace with `var(--color-bg)` / `var(--color-text)` CSS variables
- **Effort**: Low

### P1-12. Mobile Menu Missing Focus Trap
- **Source**: UI/UX Designer
- **Impact**: Accessibility failure. Tab key escapes mobile menu overlay
- **Files**: `src/layouts/Layout.astro` (mobile nav)
- **Action**: Add focus trap + Escape key handler for mobile menu
- **Effort**: Medium

### P1-13. Meta Titles Weak for Key Pages
- **Source**: Content/Competitive Analyst
- **Impact**: "Trading IQ - PRUVIQ" (blog) and "Strategy Library - PRUVIQ" (strategies) are not search queries
- **Files**: `src/i18n/en.ts` meta section, `src/i18n/ko.ts`
- **Better**: "Crypto Trading Education - PRUVIQ", "Crypto Trading Strategies - PRUVIQ"
- **Effort**: Low

### P1-14. KO Blog Missing Content Rows
- **Source**: Strategy Content Expert
- **Impact**: Korean SL/TP optimization guide missing SL 8% row and TP 4%/12% rows. TP8 decision process missing 2 expert verdicts
- **Files**: `src/content/blog-ko/sl-tp-optimization-guide.md`, `src/content/blog-ko/tp8-decision-process.md`
- **Effort**: Low

---

## P2 MEDIUM (Next Quarter)

### P2-1. Governing Law Section Has No Jurisdiction
- **Source**: Content/Competitive Analyst
- **Impact**: Terms Section 11 says "applicable laws" with no country. Legally weak
- **Files**: `src/pages/terms.astro:148-150`
- **Action**: Specify jurisdiction (Republic of Korea or other)
- **Effort**: Low

### P2-2. No Author Credentials on Any Content
- **Source**: Content/Competitive Analyst
- **Impact**: "Built by a Trader" claim unverifiable. CoinGecko/TradingView show names
- **Action**: Add pseudonym + role + one verifiable credential (GitHub, years of experience)
- **Effort**: Decision-dependent

### P2-3. No Publication Dates in Blog Listing
- **Source**: Content/Competitive Analyst
- **Impact**: Cannot tell if platform is active. Competitors show "Updated Feb 2026"
- **Files**: Blog listing pages
- **Effort**: Low

### P2-4. No GDPR/Cookie Disclosure
- **Source**: Content/Competitive Analyst
- **Impact**: Cloudflare Analytics active, no EU data disclosure
- **Files**: `src/pages/privacy.astro`, `src/pages/terms.astro`
- **Effort**: Medium

### P2-5. Telegram Community Size Not Shown
- **Source**: Content/Competitive Analyst
- **Impact**: "Telegram" link vs "Join 847 traders" - missed social proof
- **Files**: `src/layouts/Layout.astro:237`
- **Effort**: Low

### P2-6. No Product Hunt / Trustpilot Presence
- **Source**: Content/Competitive Analyst
- **Impact**: Zero third-party review signals. CoinGecko has 4.5 stars on Trustpilot
- **Action**: Submit to Product Hunt, Trustpilot
- **Effort**: Operational

### P2-7. hero.beginner_note Contradicts Quant Positioning
- **Source**: Content/Competitive Analyst
- **Impact**: Hero says "for quants" then immediately explains backtesting for beginners
- **Files**: `src/pages/index.astro:25-27`, `src/i18n/en.ts:19`
- **Action**: Move beginner note to /strategies page
- **Effort**: Low

### P2-8. KO Demo Labels Hybrid (Korean + English)
- **Source**: Content/Competitive Analyst
- **Impact**: '손절 (STOP LOSS)' looks uncertain. TradingView KO uses pure Korean
- **Files**: `src/i18n/ko.ts:207`
- **Effort**: Low

### P2-9. StrategyBuilder.tsx Too Large (914 Lines, 8+ useState)
- **Source**: Frontend Engineer
- **Impact**: Hard to maintain, no input validation
- **Files**: `src/components/StrategyBuilder.tsx`
- **Action**: Extract custom hooks, add validation
- **Effort**: High

### P2-10. Missing SEO Articles for High-Value Keywords
- **Source**: Content/Competitive Analyst
- **Impact**: No article targets "free crypto backtesting" or "BB Squeeze strategy backtest"
- **Action**: Write 2 articles using existing data
- **Effort**: Medium

---

## Preserve These Strengths (Do NOT Change)

1. **Radical Transparency** - Publishing 4 killed strategies with data. No competitor does this
2. **Real Money Proof** - $3,000 Binance Futures live trading. Unprecedented at free tier
3. **Failure Stories** - "$14,115 lost from look-ahead bias" more credible than any success claim
4. **Backtest Methodology Transparency** - Terms warn about look-ahead bias and overfitting by name
5. **Korean Localization Quality** - 8.5/10, idiomatic, not machine-translated
6. **Complete Strategy Kill History** - Changelog documents every version with data
7. **Data Accuracy** - A- grade, all fee rates verified, strategy stats correct for v1.7.0
8. **Legal Disclaimers** - Backtesting-specific warnings exceed competitor generics

---

## Implementation Priority Order

### Sprint 1 (This Week): Quick Wins + Critical Fixes
1. P0-2: Google Search Console indexing (ops)
2. P0-7: Remove "COMING SOON" blog keys (5 min)
3. P0-4: Centralize API_BASE_URL (30 min)
4. P0-6: Add performance link to homepage (1 hr)
5. P1-2: Rewrite hero subtitle (15 min)
6. P1-3: Rename Simulate → Backtest in nav (5 min)
7. P1-5: Add CTA hover/press feedback (30 min)
8. P1-11: Fix hardcoded colors (30 min)
9. P1-13: Fix meta titles (15 min)
10. P1-14: Fix KO blog missing rows (1 hr)

### Sprint 2 (Next 2 Weeks): i18n + Quality
11. P0-1: Korean privacy/terms pages (4 hrs)
12. P0-3: Learn page i18n extraction (3 hrs)
13. P0-5: Centralize exchange fee data (2 hrs)
14. P1-1: Simulate page i18n (2 hrs)
15. P1-4: Nav restructure (1 hr)
16. P1-6: Mobile touch targets audit (2 hrs)
17. P1-7: Loading states (3 hrs)
18. P1-8: Blog index i18n (1 hr)
19. P1-12: Mobile menu focus trap (2 hrs)

### Sprint 3 (Next Month): Code Quality + Content
20. P1-9: Split CoinChart.tsx (4 hrs)
21. P1-10: Fix `any` types (3 hrs)
22. P2-1: Governing law jurisdiction (15 min)
23. P2-2: Author credentials decision
24. P2-3: Blog publication dates (1 hr)
25. P2-9: Refactor StrategyBuilder.tsx (6 hrs)
26. P2-10: Write 2 SEO articles (4 hrs each)

### Ongoing / Operational
27. P2-4: GDPR disclosure
28. P2-5: Show Telegram member count
29. P2-6: Product Hunt launch
30. P2-7: Fix beginner note placement
31. P2-8: KO demo label cleanup
