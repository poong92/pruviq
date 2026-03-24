# PRUVIQ Full-Site Design Audit Report
> Date: 2026-03-24 | Method: Playwright screenshots (48 captures) + code inspection
> Scope: Production (pruviq.com) + Local preview (localhost:4332)
> Reference: TradingView, Toss, Linear design standards
> AS-IS Audit baseline: 6.0/10 (2026-03-21)

---

## Executive Summary

**Current Score: 7.2/10** (up from 6.0 baseline)

Major improvements since AS-IS audit: Hero H1 sizing fixed (text-4xl md:text-6xl lg:text-7xl), button system formalized (btn-primary/ghost/lg/md/sm), design tokens comprehensive, hero gradient background added. However, significant issues remain across mobile, spacing, and visual hierarchy.

### Issue Count by Severity
| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 8 |
| MEDIUM | 12 |
| LOW | 9 |
| **Total** | **32** |

---

## CRITICAL Issues (3)

### C1. Mobile Home (EN+KO): Massive dead space below fold
- **Pages**: `/` mobile, `/ko/` mobile
- **Evidence**: `prod_mobile-en-home.png`, `prod_mobile-ko-home.png`
- **Problem**: After "How It Works" section + CTA buttons, approximately 60-70% of the total page height is pure black empty space. The page renders roughly 20,000px tall on mobile but content ends around 7,000px.
- **Impact**: Users see infinite black void when scrolling. Feels unfinished, abandoned. Bounce risk extremely high.
- **Root cause**: Footer is at the bottom of a very tall container with no content filling the gap. Desktop has similar issue but less pronounced.
- **Fix**: Either add more content sections (social proof, testimonials, comparison table) or fix the container height to hug content.

### C2. Sticky "Start Free" popup overlaps footer content
- **Pages**: All pages (production + local)
- **Evidence**: `prod_desktop_leaderboard.png` (bottom-right), `prod_desktop_about.png`, `prod_desktop_coins-btc.png`
- **Problem**: A blue "Start Free" floating button appears in the bottom-right corner and overlaps footer text. On the leaderboard page specifically, it covers the PRUVIQ address/description in the footer. On the about page, it obscures the "PRUVIQ Project (Seoul, Korea)" text.
- **Impact**: Footer links and legal text are unreadable/unclickable when the popup is present.
- **Fix**: Add `bottom` offset to the popup so it sits above the footer when scrolled to bottom, or auto-hide when footer is in viewport.

### C3. Ranking page: "Rankings temporarily unavailable" error state on local
- **Pages**: `/strategies/ranking/` (local preview)
- **Evidence**: `local_desktop_ranking.png`
- **Problem**: Local preview shows "Rankings temporarily unavailable -- Daily rankings update at 09:00 KST. Try refreshing or check back shortly." with a Refresh button. The Best 3 / Worst 3 sections show data but the main ranking table below shows this error.
- **Impact**: If PR #643 deploys with this state, users see a broken ranking page. Production currently shows full data.
- **Note**: This may be a build-time data fetch issue. Verify SSR/SSG data is populated before merging PR #643.

---

## HIGH Issues (8)

### H1. Home page: Content gap between "How It Works" and footer (Desktop)
- **Pages**: `/` desktop, `/ko/` desktop
- **Evidence**: `prod_desktop_home.png`, `local_desktop_home.png`
- **Problem**: Below the "How It Works" section with 3 step cards + CTA buttons, there is a large empty dark section before the footer. Desktop shows roughly 40% dead space.
- **Reference**: Linear.app, Resend.com fill every viewport with content sections (social proof, feature details, testimonials, comparison).
- **Fix**: Add 2-3 content sections: social proof stats, feature highlights, comparison table (KO version already has comparison table -- port to EN).

### H2. H1 size inconsistency across pages
- **Pages**: Multiple
- **Evidence**: Code grep + screenshots
- **Problem**: While Home correctly uses `text-4xl md:text-6xl lg:text-7xl`, many other pages still use the old `text-3xl md:text-4xl`:
  - `/about` (EN+KO): `text-3xl md:text-4xl`
  - `/ko/404`: `text-3xl md:text-4xl`
  - `/privacy`, `/terms`: `text-3xl md:text-4xl`
  - Blog post `[id]`: `text-3xl md:text-4xl`
  - Strategy `[id]`: `text-3xl md:text-4xl`
  - Compare sub-pages H2s: `text-3xl md:text-4xl`
- **TO-BE Spec says**: Page H1 = `text-3xl md:text-5xl`, Section H2 = `text-2xl md:text-4xl`
- **Fix**: Update About, Privacy, Terms, Blog [id], Strategy [id] H1s to `text-3xl md:text-5xl`. Keep Home hero at current size.

### H3. Section H2 sizes are too small per TO-BE spec
- **Pages**: Home (EN+KO)
- **Evidence**: `prod_desktop_home.png`
- **Problem**: Home page H2s (e.g., "How It Works") use `text-3xl md:text-4xl`. TO-BE spec says section H2 should be `text-2xl md:text-4xl`. These are actually correct or close, but visually they look undersized compared to the hero H1 -- the jump from H1 (text-7xl = 72px) to H2 (text-4xl = 36px) is too steep.
- **Fix**: Consider `text-3xl md:text-5xl` for major section H2s on the home page specifically.

### H4. Stats bar on Home: Low contrast, small text
- **Pages**: `/` desktop + mobile, `/ko/` desktop + mobile
- **Evidence**: `prod_desktop_home.png`, `prod_mobile-en-home.png`
- **Problem**: The "572+ | 2,898+ | 9.4M+ | 36+" stats bar below the hero uses small mono text with gray labels. On mobile, it truncates to show only 2 stats (572+ and 2,898+) with the others invisible.
- **Reference**: Neon.tech, Dub.co use large bold numbers (text-3xl+) with subtle labels below.
- **Fix**: Increase stat numbers to `text-2xl md:text-4xl font-bold`, labels to `text-sm`. Ensure all 4 stats are visible on mobile (2x2 grid).

### H5. GNB dropdown: 13px text too small
- **Pages**: All pages with Strategies dropdown
- **Evidence**: Layout.astro line 442, 446
- **Problem**: The Strategies dropdown menu items (Daily Ranking, Weekly Rankings) use `text-[13px]` which is below the 15px minimum body text the design system targets. Main nav uses `text-[15px]` (correct).
- **Fix**: Change dropdown items from `text-[13px]` to `text-sm` (15px per design system).

### H6. Simulate page: Empty state feels broken
- **Pages**: `/simulate/` (EN+KO), desktop + mobile
- **Evidence**: `prod_desktop_simulate.png`
- **Problem**: "Run a backtest to see results" in a bordered box with gray text. Below it, the "How it works" sample result section shows blurred stats with "Run a backtest to see your results" text. This double-empty-state makes the page feel broken.
- **Reference**: Cal.com, Linear hero sections are interactive immediately. TradingView shows sample data.
- **Fix**: Show a pre-loaded demo result (e.g., BB Squeeze SHORT on BTC) by default instead of empty state.

### H7. Mobile Home: Stats bar truncated
- **Pages**: `/` mobile, `/ko/` mobile
- **Evidence**: `prod_mobile-en-home.png`, `prod_mobile-ko-home.png`
- **Problem**: Only 2 of 4 stats are visible on mobile viewport (390px). "9.4M+" and "36+" are cut off or hidden.
- **Fix**: Use a 2x2 grid layout for stats on mobile, or a horizontal scroll snap.

### H8. Blog page: Dense list with no visual rhythm
- **Pages**: `/blog/`
- **Evidence**: `prod_desktop_blog.png`
- **Problem**: Blog lists all 34+ articles in a single dense column with minimal visual differentiation. No featured post, no category filters visible, no images/thumbnails.
- **Reference**: Linear changelog, Vercel blog use featured hero post + grid layout.
- **Fix**: Add a featured post hero at top, then 2-column card grid with optional category chips.

---

## MEDIUM Issues (12)

### M1. About page: H1 uses old sizing + inline style override
- **File**: `src/pages/about.astro:33`, `src/pages/ko/about.astro:33`
- **Problem**: `style="letter-spacing: -0.03em;"` overrides the global h1 `-0.04em`. Should use class-based approach.
- **Fix**: Remove inline style, let global.css h1 rule handle it. Update to `text-3xl md:text-5xl`.

### M2. Leaderboard: Only 2 strategy cards in "Best" section
- **Pages**: `/leaderboard/`
- **Evidence**: `prod_desktop_leaderboard.png`
- **Problem**: "This Week's Best 3" shows only 2 cards (ATR Breakout S SHORT and ATR Breakout BOTH). The "3" implies 3 should be shown. Warning badge says low statistical reliability.
- **Fix**: Either show 3 or rename to "This Week's Best" without the number.

### M3. Ranking page: Card metric labels need tooltips
- **Pages**: `/strategies/ranking/`, `/ko/strategies/ranking/`
- **Evidence**: `prod_desktop_ranking.png`
- **Problem**: "PF" (Profit Factor) label in strategy cards is jargon. Casual users (Casey persona) won't understand.
- **Fix**: Add `<Tooltip>` on PF showing "Profit Factor: gross profit / gross loss. Above 1.5 = good."

### M4. Compare TradingView: Feature table is text-only
- **Pages**: `/compare/tradingview/`
- **Evidence**: `prod_desktop_compare-tradingview.png`
- **Problem**: Comparison table uses checkmark unicode characters in plain text. No visual differentiation (green check / red X).
- **Reference**: Standard SaaS comparison pages use colored icons.
- **Fix**: Use green `text-[--color-up]` for checkmarks, red `text-[--color-down]` for X marks.

### M5. Market page: Economic Calendar blank area
- **Pages**: `/market/`
- **Evidence**: `prod_desktop_market.png`
- **Problem**: Economic Calendar section shows a large empty gray area. TradingView widget may not load reliably.
- **Fix**: Add fallback content or skeleton loader. Consider removing if widget fails >20% of the time.

### M6. Learn page: No difficulty badges or reading time
- **Pages**: `/learn/`
- **Evidence**: `prod_desktop_learn.png`
- **Problem**: Article cards have no difficulty level or estimated reading time. Dense grid of 30+ articles with no progressive disclosure.
- **Fix**: Add `DifficultyBadge.astro` (beginner/intermediate/advanced) and reading time estimate.

### M7. Fees page: Long vertical scroll
- **Pages**: `/fees/`
- **Evidence**: `prod_desktop_fees.png`
- **Problem**: Page is very long with multiple sections (calculator, exchange comparison, referral steps, FAQ). No quick navigation or TOC.
- **Fix**: Add anchor-link TOC at top or sticky section navigation.

### M8. Changelog page: Timeline could be more visual
- **Pages**: `/changelog/`
- **Evidence**: `prod_desktop_changelog.png`
- **Problem**: Changelog entries are plain text blocks with version numbers. No visual timeline, no icons per change type.
- **Reference**: Linear changelog uses category labels (Feature, Fix, Improvement) with color coding.
- **Fix**: Add change-type badges (feat/fix/improve) with color coding.

### M9. Mobile Simulate: CTA buttons crowded at top
- **Pages**: `/simulate/` mobile
- **Evidence**: `prod_mobile-en-simulate.png`
- **Problem**: "Start with BB Squeeze (Verified)" blue CTA and "All Strategies" ghost button are side by side at the top. On 390px viewport, text in the primary CTA is long and may wrap.
- **Fix**: Stack buttons vertically on mobile or shorten CTA text.

### M10. KO About page: Breadcrumb uses English path "PRUVIQ > About"
- **Pages**: `/ko/about/`
- **Evidence**: `prod_desktop_ko-about.png`
- **Problem**: Breadcrumb shows "PRUVIQ > About" in English on the Korean page. Should use Korean label.
- **Fix**: Update breadcrumb to use i18n key for "About" ("소개").

### M11. Footer: 5-column layout is dense
- **Pages**: All pages
- **Evidence**: Multiple screenshots
- **Problem**: Footer has 5 columns (Product, Resources, Compare, Legal + PRUVIQ logo column). On mobile it stacks vertically and takes up significant space. The Compare column (6 competitor links) is promotional and may not need footer prominence.
- **Fix**: Consider consolidating Compare into Resources, or using an accordion on mobile.

### M12. Coins/BTC page: Referral banner visual hierarchy
- **Pages**: `/coins/BTC/`
- **Evidence**: `prod_desktop_coins-btc.png`
- **Problem**: "Start trading with reduced fees" Binance referral banner uses a bordered card style but the yellow "Don't Miss" CTA button has lower contrast than expected on dark background.
- **Fix**: Use `btn-primary` for the CTA or increase the yellow button contrast.

---

## LOW Issues (9)

### L1. No illustration or visual system
- **Pages**: All heroes
- **Problem**: All hero sections are text-only on dark background. No product screenshots, illustrations, or visual anchors.
- **Reference**: Linear shows product UI in hero, Resend shows email preview, Neon shows database visualization.

### L2. Section transitions are abrupt
- **Pages**: All pages with multiple sections
- **Problem**: Sections transition with no visual dividers, gradient fades, or spacing rhythm changes. Everything is flat #09090B.

### L3. Sticky bottom bar monotone
- **Pages**: All pages (desktop)
- **Problem**: "Test your strategy on 569+ coins" sticky bar is functional but visually identical to other dark sections.

### L4. KO version has more content than EN
- **Pages**: Home `/ko/` vs `/`
- **Problem**: KO home has comparison table, additional FAQ entries. EN version lacks these. Should be feature-parity.

### L5. Methodology page: Dense text blocks
- **Pages**: `/methodology/`
- **Problem**: Heavy text content with minimal visual breaks. Good content but hard to scan.

### L6. Market page: Macro indicator labels need tooltips
- **Pages**: `/market/`
- **Problem**: "DXY", "VIX" labels assume knowledge. Casey persona needs explanations.

### L7. Strategies page: "KILLED" badge text is small
- **Pages**: `/strategies/`
- **Problem**: Killed strategy warning text is small and might be missed.

### L8. Leaderboard: Warning badge text wrapping
- **Pages**: `/leaderboard/`
- **Problem**: Warning icon + text "All strategies have < 100 weekly trades..." wraps awkwardly in the yellow alert box.

### L9. Mobile ranking: Cards are very small
- **Pages**: `/strategies/ranking/` mobile
- **Evidence**: `prod_mobile-en-ranking.png`, `prod_mobile-ko-ranking.png`
- **Problem**: Strategy cards with Win Rate / PF / Trades are cramped on 390px viewport. Numbers are readable but dense.

---

## Button/CTA Audit

### System Compliance
The design system defines: `btn-primary`, `btn-ghost`, `btn-outline`, `btn-danger`, `btn-lg`, `btn-md`, `btn-sm`.

| Location | Current | Expected | Status |
|----------|---------|----------|--------|
| Home hero CTA | `btn-primary btn-lg` | `btn-primary btn-lg` | OK |
| Home ghost CTA | `btn-ghost btn-lg` | `btn-ghost btn-lg` | OK |
| Simulate hero CTA | `btn-primary` (inline) | `btn-primary btn-lg` | MISSING btn-lg |
| Ranking "Open Simulator" | `btn-ghost` | `btn-ghost btn-md` | OK |
| Ranking "Strategy Library" | `btn-ghost` | `btn-ghost btn-md` | OK |
| Leaderboard bottom CTAs | `btn-primary` + `btn-ghost` | Correct | OK |
| Fees sign-up buttons | Inline blue bg | Should use `btn-primary btn-md` | INLINE STYLE |
| Coins/BTC referral | Yellow CTA | Non-standard color | CUSTOM |
| Sticky bottom bar | `btn-primary btn-sm` | `btn-primary btn-md` | SIZE MISMATCH |
| "Start Free" popup | Inline blue | Should use `btn-primary btn-sm` | INLINE STYLE |
| Compare page bottom | `btn-primary` + `btn-ghost` | Correct | OK |

**Non-compliant buttons found**: 4 instances of inline-styled buttons that should use the button system classes.

---

## Font Size Hierarchy Audit

### Design System Definition
- `--text-xs`: 13px (captions, metadata)
- `--text-sm`: 15px (secondary body)
- Base: 16px (primary body)
- Nav main items: 15px (correct)
- Nav dropdown items: 13px (too small -- should be 15px)

### Actual Page Measurements
| Element | Spec | Actual | Verdict |
|---------|------|--------|---------|
| Hero H1 (Home) | text-4xl md:text-6xl lg:text-7xl | text-4xl md:text-6xl lg:text-7xl | PASS |
| Page H1 (About) | text-3xl md:text-5xl | text-3xl md:text-4xl | FAIL -- 1 step small |
| Section H2 (Home) | text-2xl md:text-4xl | text-3xl md:text-4xl | PASS (slightly large) |
| Card titles | text-xl font-semibold | Varies | INCONSISTENT |
| Body text | text-base (16px) | 16px | PASS |
| Nav items | 15px | 15px | PASS |
| Nav dropdown | 15px | 13px | FAIL |
| Stats numbers | text-2xl+ | text-base mono | FAIL -- too small |
| Footer links | text-sm | text-sm | PASS |

---

## GNB (Global Navigation Bar) Audit

### Structure
- Logo (left) | Market, Simulate, Strategies (dropdown), Coins, Learn, Fees | Language toggle (right)
- Strategies dropdown: Daily Ranking, Weekly Rankings (Leaderboard)

### Issues Found
1. **Dropdown text 13px** (H5 above) -- should be 15px minimum
2. **Language toggle**: `한국어 / KO` button is well-placed, correct size
3. **Active state**: Blue text + font-weight:500 -- functional but subtle. Linear uses underline + bold.
4. **Mobile hamburger**: Works correctly. Menu items stack vertically with 48px min-height touch targets (PASS).
5. **Dropdown alignment**: Appears correctly positioned below "Strategies" -- no overflow issues observed.

---

## Card / Spacing / Margin Audit

### Spacing Consistency
| Between | TO-BE Spec | Actual (Home) | Verdict |
|---------|-----------|---------------|---------|
| Hero -> Section 1 | py-24 md:py-32 | py-16 md:py-24 | FAIL -- 1 step small |
| Section -> Section | py-16 md:py-24 | Varies (py-12 to py-24) | INCONSISTENT |
| Card internal padding | p-6 md:p-8 | p-4 to p-6 | FAIL -- 1 step small |
| Page max-width | max-w-6xl | max-w-5xl to max-w-7xl | INCONSISTENT |

### Card Border Radius
- Design system: `--radius-lg: 14px` for cards
- Actual: Mix of `rounded-lg` (8px Tailwind default), `rounded-xl` (12px), and `rounded-[--radius-lg]` (14px)
- **Verdict**: Inconsistent. Need to standardize on `rounded-[--radius-lg]` or update Tailwind's `rounded-lg` mapping.

---

## Production vs Local (PR #643) Differences

| Page | Production | Local | Difference |
|------|-----------|-------|------------|
| Home | Content identical | Content identical | No visual diff |
| Simulate | Full data | Tooltip popup visible | Minor: tooltip state captured |
| Ranking | Full data displayed | "Rankings temporarily unavailable" error | **CRITICAL** -- local missing ranking data |
| Leaderboard | 2 Best + 2 Worst | Similar | Same |
| Other pages | Normal | Normal | No significant diff |

**PR #643 Risk**: The ranking page on local preview shows an error state. If PR #643 includes changes to the ranking data pipeline or build process, this could break production. Verify ranking data is populated in the SSG build before merging.

---

## Prioritized Fix Roadmap

### Phase 1: Critical (Do Before Next Deploy)
1. Fix mobile home dead space (C1)
2. Fix "Start Free" popup footer overlap (C2)
3. Verify ranking data in PR #643 build (C3)

### Phase 2: High (This Week)
4. Add content sections to EN home (H1)
5. Standardize H1 sizes across pages (H2)
6. Fix stats bar sizing and mobile truncation (H4, H7)
7. Fix GNB dropdown text size 13px -> 15px (H5)
8. Improve simulate empty state (H6)

### Phase 3: Medium (Next Sprint)
9. Add tooltips (PF, DXY, VIX) (M3, L6)
10. Visual comparison table (M4)
11. Learn page difficulty badges (M6)
12. Standardize button classes (Button audit)
13. Fix card border-radius inconsistency

### Phase 4: Low (Backlog)
14. Add product illustrations to heroes (L1)
15. Section transitions (L2)
16. EN/KO content parity (L4)
17. Blog layout improvement (H8)
18. Changelog visual upgrade (M8)

---

## Scoring Summary (Post-Audit)

| Page | AS-IS (3/21) | Current (3/24) | Target |
|------|-------------|----------------|--------|
| Home (EN Desktop) | 5.4 | 6.5 | 9.5 |
| Home (EN Mobile) | 4.2 | 4.5 | 9.0 |
| Home (KO Desktop) | 5.4 | 6.5 | 9.5 |
| Simulate (EN) | 6.8 | 7.2 | 9.5 |
| Strategies | 5.6 | 7.0 | 9.0 |
| Ranking | 5.6 | 7.5 | 9.0 |
| Leaderboard | 3.2 | 6.5 | 9.0 |
| Market | 6.8 | 7.0 | 9.0 |
| Coins/BTC | 6.2 | 7.0 | 9.0 |
| Learn | 6.2 | 6.5 | 9.0 |
| Fees | 7.4 | 7.5 | 9.0 |
| Compare TV | 6.8 | 7.0 | 9.0 |
| About | 6.5 | 7.0 | 9.0 |
| Blog | 6.0 | 6.5 | 9.0 |
| Methodology | 7.0 | 7.5 | 9.0 |
| Changelog | 6.5 | 7.0 | 9.0 |
| **Overall** | **6.0** | **7.2** | **9.5** |

---

## Screenshots Index
All captures saved to: `/Users/jepo/pruviq/docs/design-audit-20260324/`
- `prod_desktop_*.png` -- Production desktop (14 pages)
- `prod_desktop_ko-*.png` -- Production KO desktop (6 pages)
- `prod_mobile-*.png` -- Production mobile (6 pages)
- `local_desktop_*.png` -- Local preview desktop (14 pages)
- `local_desktop_ko-*.png` -- Local preview KO desktop (6 pages)
- `local_mobile-*.png` -- Local preview mobile (6 pages)
