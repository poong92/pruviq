# PRUVIQ AS-IS UX/Design Audit
> Date: 2026-03-21 | Auditor: Persona Expert Agent | Method: 14 screenshots visual analysis
> Scoring: Casey(80%)/Tim/Quinn/Sam weighted average

---

## Scoring Summary

| Page | Casey | Tim | Quinn | Sam | Weighted | Priority |
|------|-------|-----|-------|-----|----------|----------|
| Home (EN) | 5/10 | 6/10 | 7/10 | 4/10 | 5.4/10 | P0 |
| Simulate (EN) | 7/10 | 8/10 | 7/10 | 5/10 | 6.8/10 | P1 |
| Strategies/Ranking | 5/10 | 7/10 | 6/10 | 6/10 | 5.6/10 | P0 |
| Leaderboard/Weekly | 3/10 | 4/10 | 3/10 | 3/10 | 3.2/10 | P0 |
| Market | 7/10 | 8/10 | 7/10 | 5/10 | 6.8/10 | P2 |
| Coins | 6/10 | 8/10 | 7/10 | 5/10 | 6.2/10 | P2 |
| Learn | 6/10 | 7/10 | 8/10 | 5/10 | 6.2/10 | P2 |
| Performance | 7/10 | 8/10 | 9/10 | 6/10 | 7.2/10 | P3 |
| Fees | 8/10 | 7/10 | 7/10 | 6/10 | 7.4/10 | P3 |
| Compare (TV) | 7/10 | 8/10 | 7/10 | 5/10 | 6.8/10 | P2 |
| Home (Mobile) | 4/10 | 5/10 | 6/10 | 3/10 | 4.2/10 | P0 |
| Simulate (Mobile) | 6/10 | 7/10 | 7/10 | 4/10 | 6.0/10 | P1 |
| Home (KO) | 5/10 | 6/10 | 7/10 | 4/10 | 5.4/10 | P1 |
| Simulate (KO) | 7/10 | 8/10 | 7/10 | 5/10 | 6.8/10 | P1 |

**Overall Weighted: 6.0/10** (target: 9.5/10)

---

## Page-by-Page Issues

### 1. Home (EN Desktop) -- 5.4/10

**Issue 1 [CRITICAL]: Hero lacks visual anchor / product preview**
- H1 "Test Any Crypto Strategy on 569 Coins in 3 Seconds." is text-3xl/4xl -- too small for hero
- No product screenshot, no animation, no visual proof
- Compare: Linear/Resend/Neon all show product UI in hero ATF
- Casey impact: Cannot understand what this tool does visually in 3 seconds

**Issue 2 [HIGH]: Stats bar below hero is low-contrast, small text**
- 569 / 2,898+ / 9.0M+ / $0 stats are in small mono text with gray labels
- Lost in the dark background, no visual hierarchy
- Compare: Dub/Neon logo bars create social proof; stats need bigger treatment

**Issue 3 [HIGH]: Massive dead space below fold**
- After the hero + stats section, enormous empty black space before footer
- Page feels unfinished; no "How it works" section, no testimonials, no comparison
- Recent PRs added some sections but still visually sparse

**Issue 4 [MEDIUM]: CTA hierarchy unclear**
- Blue "Try Simulator Free" button exists but competes with stats grid
- No secondary CTA distinction (ghost vs filled)
- "Try Simulator Free" text appears in sticky bar AND hero -- redundant without differentiation

### 2. Simulate (EN Desktop) -- 6.8/10

**Issue 1 [MEDIUM]: "Run a backtest to see results" empty state is low-energy**
- Large gray box saying "Run a backtest to see results" -- feels broken, not inviting
- Should show a sample result or animation instead
- Casey: "Is this page broken?"

**Issue 2 [MEDIUM]: 3-step cards are informational but not clickable**
- Step 1/2/3 cards explain process but don't guide action
- Compare: Cal.com hero IS the product -- interactive immediately

**Issue 3 [LOW]: Market scenario cards could be more visual**
- Breakout/Reversals/Range/Trend/Hedging have small icons
- Could benefit from color coding or mini-charts

### 3. Strategies/Daily Ranking -- 5.6/10

**Issue 1 [CRITICAL]: "Failed to load data / Failed to fetch" error visible**
- Screenshot shows error state below the Best/Worst 3 cards
- Destroys trust immediately for all personas
- Must have graceful fallback

**Issue 2 [HIGH]: Best 3 / Worst 3 card metrics use jargon**
- "PF" (Profit Factor) -- Casey has no idea what this means
- Win Rate is OK, Trades count is OK, but PF needs tooltip or label

**Issue 3 [MEDIUM]: Tab navigation (Strategies / DAILY RANKING / WEEKLY RANKINGS) is functional but plain**
- No visual differentiation between active state and content area
- Compare: Could use a more engaging layout with summary stats above tabs

### 4. Leaderboard/Weekly Rankings -- 3.2/10

**Issue 1 [CRITICAL]: Empty state -- "Weekly data is being refreshed"**
- The entire main content area is a placeholder message
- No cached data shown, no skeleton loader, no alternative content
- Sam: "This site has nothing for me"

**Issue 2 [HIGH]: Page feels abandoned**
- Minimal content: title + description + empty box + 2 CTA buttons
- Footer takes up more space than content

**Issue 3 [MEDIUM]: No engagement hooks**
- No "subscribe for weekly updates" or notification option
- No historical weekly data to browse

### 5. Market Dashboard -- 6.8/10

**Issue 1 [MEDIUM]: Economic Calendar iframe is empty/blank**
- Large white/gray area where TradingView widget should load
- Creates dead space and looks broken

**Issue 2 [MEDIUM]: Macro Indicators section is data-heavy**
- S&P 500, NASDAQ, DXY, Treasury rates -- good for Tim/Quinn
- Casey: "What does DXY mean?"
- No explanatory tooltips

**Issue 3 [LOW]: News section is functional but generic**
- Aggregated from CoinDesk/CoinTelegraph -- adds value but not unique
- Good sticky bar CTA at bottom "Try Simulator" -- well placed

### 6. Coins Explorer -- 6.2/10

**Issue 1 [MEDIUM]: Table is data-dense -- intimidating for Casey**
- 50 coins visible with Price, 1h, 24h, 7d, Market Cap, Volume, sparklines
- Good for Tim, but Casey sees a wall of numbers

**Issue 2 [LOW]: Search + "Simulate a Strategy" CTA well placed**
- Red "Simulate a Strategy" button stands out -- good
- Download CSV is a nice touch for Quinn

**Issue 3 [LOW]: Sparkline charts are small but readable**
- 7-day trend visible -- good visual signal

### 7. Learn Center -- 6.2/10

**Issue 1 [MEDIUM]: Content hierarchy is dense**
- 4 category sections (Start Here, Indicators & Tactics, Quant & Strategy) stacked
- Each section has 2-column cards -- lots of scrolling
- Missing: reading time, difficulty level badges

**Issue 2 [MEDIUM]: Hero "Learn Trading. No Hype. Real Data." is strong copy**
- But visually plain -- just text on dark background
- Compare: Could add an illustration or infographic

**Issue 3 [LOW]: Bottom CTA section is good**
- "Ready to test what you've learned?" with Simulator + Demo + Strategies links

### 8. Performance -- 7.2/10

**Issue 1 [LOW]: This is PRUVIQ's strongest page conceptually**
- "Every Trade Published. Including Losses." -- powerful positioning
- Equity curve chart, killed strategies section -- builds trust
- Quinn: "This is exactly what I want to see"

**Issue 2 [MEDIUM]: Equity curve shows -$75.10, MDD 15.7%**
- Honest but could use better framing: "This is what we learned"
- The -$75 is small given $0 start -- context needed

**Issue 3 [LOW]: "Killed Strategies" section is unique and strong**
- BB Squeeze LONG (retired), Momentum Breakout LONG (retired)
- "88+ Variations: All Failed" -- radical transparency

### 9. Fees -- 7.4/10

**Issue 1 [LOW]: Best page for conversion -- clean, actionable**
- Fee Calculator is interactive, shows savings
- Binance/Bitget/OKX comparison is clear
- Sign Up buttons with discount % -- direct revenue path

**Issue 2 [MEDIUM]: OKX "Coming Soon" creates incomplete feel**
- Affiliate link not ready -- should hide or gray out differently

**Issue 3 [LOW]: FAQ section at bottom is good but short**
- Only 3 questions -- could add more trust-building Q&A

### 10. Compare (vs TradingView) -- 6.8/10

**Issue 1 [MEDIUM]: Feature table is comprehensive but text-heavy**
- No checkmarks/X marks -- all text values
- Compare: Typical SaaS comparison uses green checkmarks vs red X

**Issue 2 [LOW]: "Why not use both?" section is smart positioning**
- Non-confrontational, acknowledges TradingView's strengths
- Good CTA placement at bottom

**Issue 3 [LOW]: TL;DR box at top is effective**
- Monospace code-style box adds credibility

### 11. Home (Mobile) -- 4.2/10

**Issue 1 [CRITICAL]: Hero text is cramped**
- H1 wraps awkwardly on mobile viewport
- Stats bar becomes illegible
- Cookie banner was blocking CTA (fixed in PR #527 but still tight)

**Issue 2 [HIGH]: Content sections collapse poorly**
- Cards stack vertically but with no visual rhythm
- Long scroll with monotone dark sections

**Issue 3 [MEDIUM]: Navigation hamburger works but footer is massive**
- Footer with 5 columns takes up significant screen real estate on mobile

### 12. Simulate (Mobile) -- 6.0/10

**Issue 1 [MEDIUM]: 3-step cards stack nicely**
- Good adaptation from desktop 3-column to mobile stack
- But "Run a backtest to see results" empty state is even worse on mobile

**Issue 2 [MEDIUM]: Market scenario cards in 3+2 grid**
- Breakout/Reversals/Range in row 1, Trend/Hedging in row 2
- Cramped but functional

**Issue 3 [LOW]: Sticky bottom bar "Try Simulator Free" works well**
- Good mobile pattern for persistent CTA

### 13. Home (KO Desktop) -- 5.4/10

**Same structural issues as EN**, plus:
- Korean text "569개 코인, 3초 만에 전략 검증 완료" is well-translated
- Page length is notably longer with additional KO sections (FAQ, comparison table, quotes)
- KO version has MORE content than EN -- which is actually better
- Comparison table with PRUVIQ vs competitors is KO-only -- should be in EN too

### 14. Simulate (KO Desktop) -- 6.8/10

- Functionally identical to EN version
- Korean labels ("빠른 테스트", "스탠다드", "엑스퍼트") work well
- Market scenario Korean names ("돌파", "반전", "박스권", "추세", "헤징") are clear

---

## Cross-Cutting Issues (All Pages)

### Visual System
1. **No gradient or visual texture** -- every page is flat #09090B with bordered cards
2. **No hero visuals** on any page -- all text-only heroes
3. **Inconsistent H1 sizes** -- ranges from text-3xl to text-5xl across pages
4. **No illustration or iconography system** -- market scenario icons are the only custom visuals
5. **Sticky bar** at bottom of every page ("No code. No signup.") is valuable but visually monotone

### Typography
1. H1 too small (text-3xl md:text-4xl) -- should be text-4xl md:text-6xl minimum
2. Body text contrast is adequate (Zinc-400 on Zinc-950)
3. Mono font (Geist Mono) used well for data but overused in labels

### Spacing
1. Hero sections have adequate padding (py-16 to py-24)
2. Section transitions are abrupt -- no visual dividers or gradient fades
3. Footer is disproportionately large relative to some page content

### CTA System
1. Primary CTA (blue) is consistent but too small on many pages
2. Ghost buttons (bordered) blend into the dark background
3. No urgency or scarcity signals in any CTA
4. Sticky bottom bar is good but could be more prominent

### Mobile
1. Most pages are functional on mobile but not optimized
2. Touch targets meet 44px minimum (good -- enforced in CSS)
3. No mobile-specific CTAs or simplified views
