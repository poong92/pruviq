# PRUVIQ TO-BE Design Specification
> Date: 2026-03-21 | Target: AS-IS 6.0/10 --> TO-BE 9.5/10
> Stack: Astro + Preact + Tailwind CSS v4 + CSS custom properties (dark theme only)
> References: Linear, Resend, Raycast, Vercel, Neon, Framer, Dub, Cal.com, Lemon Squeezy

---

## Table of Contents
1. [Design System Updates](#1-design-system-updates)
2. [Page-by-Page TO-BE Specs](#2-page-by-page-to-be-specs)
3. [Component Library](#3-component-library)
4. [Mobile Strategy](#4-mobile-strategy)
5. [Implementation Priority](#5-implementation-priority)

---

## 1. Design System Updates

### 1.1 Typography Scale (Update)

**Current problem**: H1 is text-3xl (1.875rem) / md:text-4xl (2.25rem) -- far too small for hero sections. Reference sites use 48-72px+ H1s.

```css
/* ADD to global.css @theme block */

/* Hero-specific display sizes */
--font-size-display: clamp(2.5rem, 5vw, 4.5rem);    /* 40-72px */
--font-size-display-sm: clamp(2rem, 4vw, 3.5rem);    /* 32-56px */
--line-height-display: 1.05;
--letter-spacing-display: -0.04em;
```

**Tailwind utility classes to use**:

| Element | AS-IS | TO-BE |
|---------|-------|-------|
| Hero H1 | `text-3xl md:text-4xl` | `text-4xl md:text-6xl lg:text-7xl` |
| Page H1 | `text-3xl md:text-4xl` | `text-3xl md:text-5xl` |
| Section H2 | `text-2xl md:text-3xl` | `text-2xl md:text-4xl` |
| Card title | `text-lg` | `text-xl font-semibold` |
| Body | `text-sm` | `text-base` (16px minimum) |
| Caption/meta | `text-xs` | `text-sm text-text-muted` |

**H1 global rule update** (global.css):
```css
h1 {
  letter-spacing: -0.04em;  /* was -0.03em */
  line-height: 1.08;        /* add -- tighter for large text */
  font-weight: 700;
}
```

### 1.2 Color System (Additions)

Current palette is solid. Add these for visual depth:

```css
/* ADD to global.css @theme block */

/* Gradient system -- inspired by Neon/Raycast */
--gradient-hero: linear-gradient(180deg, #09090B 0%, #0C1220 50%, #09090B 100%);
--gradient-section: linear-gradient(180deg, rgba(79,142,247,0.03) 0%, transparent 100%);
--gradient-card-shine: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%);
--gradient-text-accent: linear-gradient(135deg, #4F8EF7 0%, #93C5FD 100%);

/* Surface tint for hero sections */
--color-bg-hero: #0A0E1A;  /* slightly blue-tinted dark */
```

```css
/* ADD to :root (outside @theme) */
--shadow-hero-glow:
  0 0 120px 40px rgba(79,142,247,0.06),
  0 0 40px 10px rgba(79,142,247,0.03);
```

### 1.3 Spacing System

**Section rhythm** -- create consistent vertical spacing:

| Between | AS-IS | TO-BE |
|---------|-------|-------|
| Hero -> Section 1 | varies (py-8 to py-24) | `py-24 md:py-32` (96-128px) |
| Section -> Section | varies | `py-16 md:py-24` (64-96px) |
| Card internal | `p-4` to `p-6` | `p-6 md:p-8` standardized |
| Page max-width | `max-w-5xl` to `max-w-7xl` | `max-w-6xl` standard, `max-w-7xl` for data pages |

### 1.4 Border & Card System

```css
/* UPDATE card defaults */
.card-base {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);  /* was radius-md on many cards */
  padding: 1.5rem;
}

/* New: Gradient border card (for featured items) -- Neon/Linear pattern */
.card-featured {
  position: relative;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}
.card-featured::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
  padding: 1px;
  background: linear-gradient(135deg, rgba(79,142,247,0.3), rgba(79,142,247,0.05));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### 1.5 Button System

**Current**: `.btn-primary` is accent blue with black text. Needs size variants.

```css
/* ADD button sizes */
.btn-lg {
  padding: 0.875rem 2rem;
  font-size: 1rem;
  border-radius: var(--radius-md);
  min-height: 52px;
}
.btn-md {
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  border-radius: var(--radius-sm);
  min-height: 44px;
}
.btn-sm {
  padding: 0.375rem 1rem;
  font-size: 0.8125rem;
  border-radius: var(--radius-sm);
  min-height: 36px;
}

/* Ghost button -- higher contrast */
.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-border-hover);  /* was --color-border (too subtle) */
  color: var(--color-text);
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-smooth);
}
.btn-ghost:hover {
  border-color: var(--color-text-muted);
  background: rgba(255,255,255,0.04);
}
```

### 1.6 Motion System

Add entrance animations for hero elements (reference: Linear's staggered fade):

```css
/* Hero staggered entrance */
.hero-enter > *:nth-child(1) { animation: hero-enter 0.8s var(--ease-default) 0.1s both; }
.hero-enter > *:nth-child(2) { animation: hero-enter 0.8s var(--ease-default) 0.2s both; }
.hero-enter > *:nth-child(3) { animation: hero-enter 0.8s var(--ease-default) 0.3s both; }
.hero-enter > *:nth-child(4) { animation: hero-enter 0.8s var(--ease-default) 0.4s both; }
.hero-enter > *:nth-child(5) { animation: hero-enter 0.8s var(--ease-default) 0.5s both; }
```

---

## 2. Page-by-Page TO-BE Specs

### 2.1 HOME PAGE (Priority: P0)
**AS-IS: 5.4/10 --> TO-BE Target: 9.5/10**

#### Hero Section

**Reference patterns applied**:
- Linear: Large left-aligned H1 with product UI below
- Resend: Split layout (text left, 3D visual right)
- Neon: Atmospheric background glow with stats bar below
- Dub: Center-aligned with badge above H1, product screenshot below CTAs

**TO-BE structure**:
```
[Badge/announcement bar]          -- "12,847 simulations run" (Dub pattern)
[H1 -- 2 lines max]              -- Center or left aligned
[Subtitle -- 1-2 lines]          -- text-text-secondary
[CTA pair]                       -- Primary + Ghost
[Stats bar]                      -- 4 stats in a row
[Product screenshot/preview]     -- Interactive simulator preview or mockup
```

**Code specification**:

```html
<!-- Hero section -->
<section class="relative overflow-hidden" style="background: var(--gradient-hero)">
  <!-- Subtle glow behind hero -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[600px] h-[400px] rounded-full opacity-30 blur-[120px]
              bg-accent/10 pointer-events-none" aria-hidden="true"></div>

  <div class="relative max-w-6xl mx-auto px-6 pt-32 pb-20 md:pt-40 md:pb-28 hero-enter">
    <!-- Badge -->
    <div class="flex justify-center mb-8">
      <a href="/simulate" class="inline-flex items-center gap-2
         rounded-full border border-border-hover bg-bg-card/50
         px-4 py-1.5 text-sm text-text-secondary
         hover:border-accent/30 transition-colors">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span>
        12,847 simulations run
        <span class="text-accent">Try it free &rarr;</span>
      </a>
    </div>

    <!-- H1 -->
    <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold text-center
               tracking-[-0.04em] leading-[1.08] max-w-4xl mx-auto">
      Test Any Crypto Strategy
      <br class="hidden md:block" />
      on 569 Coins in Seconds
    </h1>

    <!-- Subtitle -->
    <p class="mt-6 text-lg md:text-xl text-text-secondary text-center
              max-w-2xl mx-auto leading-relaxed">
      Free backtesting with real fees. No code. No signup.
      We publish our failures too.
    </p>

    <!-- CTA pair -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
      <a href="/simulate" class="btn-primary btn-lg inline-flex items-center gap-2">
        Open Simulator
        <svg><!-- arrow icon --></svg>
      </a>
      <a href="/strategies" class="btn-ghost btn-lg inline-flex items-center gap-2">
        Explore Strategies
      </a>
    </div>

    <!-- Stats bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
      <div class="text-center">
        <p class="text-2xl md:text-3xl font-bold font-mono">569</p>
        <p class="text-sm text-text-muted mt-1">Coins Tested</p>
      </div>
      <div class="text-center">
        <p class="text-2xl md:text-3xl font-bold font-mono">2,898+</p>
        <p class="text-sm text-text-muted mt-1">Simulated Trades</p>
      </div>
      <div class="text-center">
        <p class="text-2xl md:text-3xl font-bold font-mono">9.4M+</p>
        <p class="text-sm text-text-muted mt-1">Data Points</p>
      </div>
      <div class="text-center">
        <p class="text-2xl md:text-3xl font-bold font-mono text-green">$0</p>
        <p class="text-sm text-text-muted mt-1">Always Free</p>
      </div>
    </div>
  </div>
</section>
```

#### Section 2: Product Preview (NEW)

**Reference**: Linear shows product UI in hero. Cal.com embeds actual product.

```html
<!-- Product preview -- simulator screenshot in a browser frame -->
<section class="max-w-6xl mx-auto px-6 -mt-8 relative z-10">
  <div class="rounded-xl border border-border bg-bg-card overflow-hidden"
       style="box-shadow: var(--shadow-elevated)">
    <!-- Browser chrome -->
    <div class="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-surface">
      <div class="flex gap-1.5">
        <div class="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
        <div class="w-3 h-3 rounded-full bg-[#febc2e]"></div>
        <div class="w-3 h-3 rounded-full bg-[#28c840]"></div>
      </div>
      <div class="flex-1 text-center">
        <span class="text-xs text-text-muted font-mono">pruviq.com/simulate</span>
      </div>
    </div>
    <!-- Screenshot -->
    <img src="/images/simulator-preview.webp" alt="PRUVIQ Strategy Simulator"
         class="w-full" loading="eager" />
  </div>
</section>
```

#### Section 3: How It Works (3 Steps)

**Reference**: Framer/Dub use simple 3-step grids with icons.

```html
<section class="max-w-6xl mx-auto px-6 py-24 md:py-32">
  <h2 class="text-2xl md:text-4xl font-bold text-center mb-4">
    How It Works
  </h2>
  <p class="text-text-secondary text-center mb-16 max-w-xl mx-auto">
    From strategy idea to verified results in 3 steps.
  </p>

  <div class="grid md:grid-cols-3 gap-8">
    <!-- Step 1 -->
    <div class="card-base text-center p-8">
      <div class="step-badge mx-auto mb-4">1</div>
      <h3 class="text-xl font-semibold mb-2">Pick a Strategy</h3>
      <p class="text-text-secondary text-sm leading-relaxed">
        Choose from 36 presets or build custom with 14 indicators.
        AND/OR logic supported.
      </p>
    </div>
    <!-- Step 2 -->
    <div class="card-base text-center p-8">
      <div class="step-badge mx-auto mb-4">2</div>
      <h3 class="text-xl font-semibold mb-2">Set Your Risk</h3>
      <p class="text-text-secondary text-sm leading-relaxed">
        Stop-loss, take-profit, position size, time filters.
        Realistic fees and slippage included.
      </p>
    </div>
    <!-- Step 3 -->
    <div class="card-base text-center p-8">
      <div class="step-badge mx-auto mb-4">3</div>
      <h3 class="text-xl font-semibold mb-2">See Real Results</h3>
      <p class="text-text-secondary text-sm leading-relaxed">
        Backtest on 569 coins with 2+ years of data.
        Results in seconds, no cherry-picking.
      </p>
    </div>
  </div>
</section>
```

#### Section 4: Social Proof / Trust

**Reference**: Neon has logo bar. Cal.com shows Trustpilot ratings.

```html
<section class="border-y border-border bg-bg-surface/50 py-16">
  <div class="max-w-6xl mx-auto px-6">
    <p class="text-center text-sm text-text-muted mb-8 uppercase tracking-wider font-mono">
      Transparent by default
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="card-featured p-6 text-center">
        <p class="text-3xl font-bold text-accent mb-2">88+</p>
        <p class="text-sm text-text-secondary">Strategy configurations tested</p>
        <p class="text-xs text-text-muted mt-2">Including all failures</p>
      </div>
      <div class="card-featured p-6 text-center">
        <p class="text-3xl font-bold text-red mb-2">67%</p>
        <p class="text-sm text-text-secondary">Strategies that failed</p>
        <p class="text-xs text-text-muted mt-2">Published transparently</p>
      </div>
      <div class="card-featured p-6 text-center">
        <p class="text-3xl font-bold text-green mb-2">100%</p>
        <p class="text-sm text-text-secondary">Open methodology</p>
        <p class="text-xs text-text-muted mt-2">Source available on GitHub</p>
      </div>
    </div>
  </div>
</section>
```

#### Section 5: Comparison Table (port from KO version)

The KO home page already has a comparison table (PRUVIQ vs competitors). Port this to EN.

#### Section 6: Final CTA

**Reference**: Dub/Framer pattern -- centered CTA with strong H2.

```html
<section class="relative py-24 md:py-32 overflow-hidden"
         style="background: var(--gradient-hero)">
  <div class="absolute top-0 left-1/2 -translate-x-1/2
              w-[500px] h-[300px] rounded-full opacity-20 blur-[100px]
              bg-accent/15 pointer-events-none"></div>
  <div class="relative max-w-2xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-5xl font-bold mb-4">
      Ready to verify?
    </h2>
    <p class="text-text-secondary text-lg mb-8">
      Test any strategy on 569 coins. Free, no signup required.
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="/simulate" class="btn-primary btn-lg">Open Simulator &rarr;</a>
      <a href="/strategies" class="btn-ghost btn-lg">Browse Strategies</a>
    </div>
  </div>
</section>
```

---

### 2.2 SIMULATE PAGE (Priority: P1)
**AS-IS: 6.8/10 --> TO-BE Target: 9.0/10**

**Key changes**:

1. **H1 size increase**: `text-3xl md:text-4xl` --> `text-3xl md:text-5xl`

2. **Empty state redesign**: Replace "Run a backtest to see results" gray box with:
```html
<!-- Simulator empty state -->
<div class="border border-dashed border-border rounded-xl p-12 text-center
            bg-[radial-gradient(ellipse_at_center,rgba(79,142,247,0.04),transparent_70%)]">
  <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
    <svg class="w-8 h-8 text-accent"><!-- chart/play icon --></svg>
  </div>
  <h3 class="text-xl font-semibold mb-2">Your results will appear here</h3>
  <p class="text-text-secondary mb-6 max-w-md mx-auto">
    Pick a strategy above and click Run. Results include win rate,
    profit factor, and equity curve across 569 coins.
  </p>
  <a href="#quick-test" class="btn-primary btn-md">
    Try Quick Test &rarr;
  </a>
</div>
```

3. **Market Scenario cards**: Add subtle color coding:
```
Breakout:        border-l-4 border-accent (blue)
Reversals:       border-l-4 border-yellow (amber)
Range Trading:   border-l-4 border-green (green)
Trend Following: border-l-4 border-[#A855F7] (purple)
Hedging:         border-l-4 border-red (red)
```

4. **Stats bar enhancement**: Make the "12,847 simulations run | 569 coins | 36 strategies" bar more prominent with `text-base` not `text-sm`, and add a subtle background.

---

### 2.3 STRATEGIES / DAILY RANKING (Priority: P0)
**AS-IS: 5.6/10 --> TO-BE Target: 9.0/10**

**Key changes**:

1. **Error state**: Add graceful fallback component:
```html
<!-- Error fallback (replaces "Failed to load data") -->
<div class="border border-warning/20 rounded-lg p-6 bg-warning/5 text-center">
  <p class="text-warning font-medium mb-2">Data temporarily unavailable</p>
  <p class="text-sm text-text-secondary mb-4">
    Rankings update daily. Try refreshing or check back shortly.
  </p>
  <button onclick="location.reload()" class="btn-ghost btn-sm">
    Refresh page
  </button>
</div>
```

2. **Best 3 cards enhancement**: Add tooltips for PF:
```html
<!-- Profit Factor with tooltip -->
<div class="group relative">
  <p class="text-xs text-text-muted">
    PF
    <span class="inline-block w-3.5 h-3.5 text-text-disabled cursor-help">(?)</span>
  </p>
  <p class="font-mono text-lg font-bold">2.22</p>
  <!-- Tooltip -->
  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              hidden group-hover:block
              bg-bg-tooltip text-text text-xs rounded-md px-3 py-2
              shadow-elevated whitespace-nowrap z-50">
    Profit Factor: Total profit / Total loss.<br/>
    Above 1.5 = good. Above 2.0 = excellent.
  </div>
</div>
```

3. **Tab styling upgrade**: Active tab should have accent underline + subtle background:
```html
<button class="px-4 py-2.5 text-sm font-medium
               border-b-2 border-accent text-text
               bg-accent/5 rounded-t-md transition-colors">
  DAILY RANKING
</button>
```

4. **H1 size**: `text-3xl` --> `text-3xl md:text-5xl`

---

### 2.4 LEADERBOARD / WEEKLY RANKINGS (Priority: P0)
**AS-IS: 3.2/10 --> TO-BE Target: 8.5/10**

**Key changes**:

1. **Never show empty page**: Always show last available data with a stale indicator:
```html
<!-- If data is stale, show banner + last data -->
<div class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 mb-6
            text-sm text-text-secondary">
  <span class="spinner w-4 h-4"></span>
  Updating weekly data. Showing last available results (Mar 14, 2026).
</div>
<!-- Then render the actual cards from cached data -->
```

2. **Add historical week selector**: Allow browsing past weeks
3. **Add "Subscribe for updates" email input or Telegram link**

---

### 2.5 MARKET DASHBOARD (Priority: P2)
**AS-IS: 6.8/10 --> TO-BE Target: 8.5/10**

**Key changes**:

1. **Economic Calendar**: Add loading skeleton instead of blank iframe:
```html
<div class="relative min-h-[400px]">
  <!-- Skeleton while loading -->
  <div class="absolute inset-0 skeleton rounded-lg" id="cal-skeleton"></div>
  <iframe onload="document.getElementById('cal-skeleton').style.display='none'"
          ...></iframe>
</div>
```

2. **Macro Indicators tooltips**: Add (?) icon for DXY, VIX, Fed Funds Rate with Casey-friendly explanations

3. **H1 size**: `text-3xl md:text-4xl` --> `text-3xl md:text-5xl`

---

### 2.6 COINS EXPLORER (Priority: P2)
**AS-IS: 6.2/10 --> TO-BE Target: 8.5/10**

**Key changes**:

1. **Simplified view toggle**: Add grid/table toggle for Casey users
```html
<div class="flex gap-2 mb-4">
  <button class="btn-sm btn-ghost" data-view="grid">
    <svg><!-- grid icon --></svg> Cards
  </button>
  <button class="btn-sm btn-ghost active" data-view="table">
    <svg><!-- list icon --></svg> Table
  </button>
</div>
```

2. **Table row clickability**: Entire row should be clickable, linking to `/simulate?coin=BTC`

3. **H1 size**: Matches system (`text-3xl md:text-5xl`)

---

### 2.7 LEARN CENTER (Priority: P2)
**AS-IS: 6.2/10 --> TO-BE Target: 8.5/10**

**Key changes**:

1. **Add difficulty badges and reading time**:
```html
<div class="flex items-center gap-3 text-xs text-text-muted">
  <span class="rounded-full bg-green/10 text-green px-2 py-0.5">Beginner</span>
  <span>5 min read</span>
  <span>Updated Mar 2026</span>
</div>
```

2. **Hero visual**: Add a simple illustration or gradient background to hero
3. **Progress tracking**: "X of 29 articles read" (if localStorage-based, no auth needed)

---

### 2.8 PERFORMANCE (Priority: P3)
**AS-IS: 7.2/10 --> TO-BE Target: 9.0/10**

Already strong. Minor tweaks:

1. **Equity curve**: Add context annotation:
```html
<div class="text-sm text-text-muted mt-2 flex items-center gap-2">
  <span class="text-warning">Strategy paused at -$75 (MDD 15.7%)</span>
  <span>|</span>
  <a href="/methodology" class="text-accent hover:underline">Why we stopped &rarr;</a>
</div>
```

2. **"Killed Strategies" section**: Add a subtle red left border to retired cards:
```
border-l-4 border-red/50
```

3. **H1 size**: `text-3xl md:text-4xl` --> `text-3xl md:text-5xl`

---

### 2.9 FEES (Priority: P3)
**AS-IS: 7.4/10 --> TO-BE Target: 9.0/10**

Already the best conversion page. Minor tweaks:

1. **OKX card**: Gray out entirely instead of showing "Coming Soon" text:
```html
<div class="relative opacity-60">
  <!-- OKX card content -->
  <div class="absolute inset-0 flex items-center justify-center
              bg-bg-card/80 rounded-lg backdrop-blur-sm">
    <span class="text-sm text-text-muted">Coming Q2 2026</span>
  </div>
</div>
```

2. **Savings animation**: When user adjusts volume slider, animate the savings number:
```css
.savings-flash {
  animation: number-reveal 0.3s var(--ease-default);
}
```

---

### 2.10 COMPARE PAGES (Priority: P2)
**AS-IS: 6.8/10 --> TO-BE Target: 9.0/10**

1. **Feature table**: Replace text with visual checkmarks:
```html
<!-- Instead of "Free forever" / "$14.95/mo" text -->
<td class="text-center">
  <span class="text-green text-lg">&#10003;</span>
  <span class="block text-xs text-text-muted mt-0.5">Free forever</span>
</td>
<td class="text-center">
  <span class="text-red text-lg">&times;</span>
  <span class="block text-xs text-text-muted mt-0.5">$14.95-59.95/mo</span>
</td>
```

2. **H1 size**: Keep `text-3xl md:text-5xl` (already correct on compare pages)

---

## 3. Component Library

### 3.1 New Components Needed

| Component | Purpose | Reference |
|-----------|---------|-----------|
| `HeroBadge` | Announcement/stats pill above H1 | Dub, Vercel |
| `HeroGlow` | Subtle radial gradient behind hero | Neon, Raycast |
| `BrowserFrame` | Product screenshot in browser chrome | Linear, Cal.com |
| `StepCard` | Numbered step with icon | Framer |
| `MetricCard` | Big number + label + optional delta | Current stats bar, upgraded |
| `Tooltip` | Hover explanation for jargon (PF, Sharpe) | -- |
| `ErrorFallback` | Graceful error state for data fetch failures | -- |
| `ViewToggle` | Grid/Table view switch | -- |
| `DifficultyBadge` | Beginner/Intermediate/Advanced pill | -- |
| `StaleBanner` | Data freshness indicator | -- |

### 3.2 Component Naming Convention

```
src/components/ui/          -- Shared UI primitives
  HeroBadge.astro
  HeroGlow.astro
  BrowserFrame.astro
  MetricCard.astro
  Tooltip.tsx               -- Preact (needs hover state)
  ErrorFallback.astro
  StaleBanner.astro

src/components/sections/    -- Page-level sections
  HeroHome.astro
  HowItWorks.astro
  TrustBar.astro
  FinalCta.astro
```

---

## 4. Mobile Strategy

### 4.1 Hero (Mobile)

```html
<!-- Mobile hero adjustments -->
<h1 class="text-4xl md:text-6xl lg:text-7xl ...">
  <!-- text-4xl = 2.25rem on mobile -- significant improvement from text-3xl -->
</h1>

<!-- Stack CTAs vertically on mobile -->
<div class="flex flex-col sm:flex-row ...">
  <!-- Primary takes full width on mobile -->
  <a class="btn-primary btn-lg w-full sm:w-auto ...">Open Simulator</a>
  <a class="btn-ghost btn-lg w-full sm:w-auto ...">Explore Strategies</a>
</div>

<!-- Stats: 2x2 grid on mobile, 4-col on desktop -->
<div class="grid grid-cols-2 md:grid-cols-4 ...">
```

### 4.2 Footer (Mobile)

Reduce footer to 2-column layout on mobile:
```html
<div class="grid grid-cols-2 md:grid-cols-4 gap-8">
  <!-- Collapse 4 columns to 2 on mobile -->
</div>
```

### 4.3 Sticky CTA Bar (Mobile)

Upgrade the existing sticky bar:
```html
<div class="fixed bottom-0 inset-x-0 z-40
            bg-bg-surface/95 backdrop-blur-md border-t border-border
            px-4 py-3 flex items-center justify-between
            md:hidden">
  <p class="text-sm text-text-secondary">Free. No signup.</p>
  <a href="/simulate" class="btn-primary btn-sm">
    Try Simulator &rarr;
  </a>
</div>
```

---

## 5. Implementation Priority

### P0 -- This Week (Highest Impact, AS-IS < 5.5/10)

| # | Task | Page | Impact | Effort |
|---|------|------|--------|--------|
| 1 | **Home Hero Redesign** | `/` | Casey +4pts | L |
|   | - H1: text-4xl md:text-6xl lg:text-7xl | | | |
|   | - HeroBadge component | | | |
|   | - HeroGlow radial gradient | | | |
|   | - CTA pair (primary + ghost, btn-lg) | | | |
|   | - Stats bar 2x2/4-col grid with larger numbers | | | |
| 2 | **Home Product Preview** | `/` | Casey +2pts | M |
|   | - BrowserFrame with simulator screenshot | | | |
|   | - Positioned -mt-8 overlapping hero gradient | | | |
| 3 | **Home "How It Works" section** | `/` | Casey +1pt | S |
| 4 | **Home Trust/Transparency section** | `/` | Quinn +1pt | S |
| 5 | **Home Final CTA section** | `/` | All +1pt | S |
| 6 | **Leaderboard empty state fix** | `/strategies/leaderboard` | Sam +5pts | S |
|   | - Show cached data with stale banner | | | |
| 7 | **Rankings error state fix** | `/strategies/ranking` | All +3pts | S |
|   | - ErrorFallback component | | | |
| 8 | **Home mobile hero fix** | `/` mobile | Casey +4pts | M |
|   | - text-4xl minimum, stack CTAs, 2x2 stats | | | |

### P1 -- Next Sprint

| # | Task | Page | Impact | Effort |
|---|------|------|--------|--------|
| 9 | **Simulator empty state redesign** | `/simulate` | Casey +2pts | S |
| 10 | **PF/metrics tooltips** | Rankings, Results | Casey +1pt | S |
| 11 | **Market scenario color coding** | `/simulate` | Tim +1pt | XS |
| 12 | **Typography scale global update** | All pages | All +0.5pt | M |
|    | - All H1s to text-3xl md:text-5xl minimum | | | |
| 13 | **KO home comparison table --> EN** | `/` EN | Tim +1pt | S |
| 14 | **Button system (btn-lg/md/sm + ghost)** | All | All +0.5pt | S |
| 15 | **Home KO hero parity** | `/ko` | Casey +2pts | M |

### P2 -- Backlog

| # | Task | Page | Impact | Effort |
|---|------|------|--------|--------|
| 16 | **Compare pages checkmark table** | `/compare/*` | Tim +2pts | M |
| 17 | **Learn difficulty badges + reading time** | `/learn` | Casey +1pt | S |
| 18 | **Coins card view toggle** | `/coins` | Casey +1pt | M |
| 19 | **Market tooltips for macro terms** | `/market` | Casey +1pt | S |
| 20 | **Economic calendar skeleton loader** | `/market` | All +0.5pt | XS |
| 21 | **Section dividers (gradient fades)** | All | Visual polish | S |
| 22 | **Hero stagger animation** | `/` | Polish | S |

### P3 -- Nice to Have

| # | Task | Page | Impact | Effort |
|---|------|------|--------|--------|
| 23 | **Performance equity curve annotation** | `/performance` | Quinn +0.5pt | XS |
| 24 | **Killed strategies red border** | `/performance` | Visual polish | XS |
| 25 | **Fees OKX grayed overlay** | `/fees` | Polish | XS |
| 26 | **Fees savings animation** | `/fees` | Casey +0.5pt | S |
| 27 | **Footer mobile 2-col** | All mobile | Mobile +0.5pt | XS |
| 28 | **Mobile sticky CTA upgrade** | All mobile | Casey +1pt | S |
| 29 | **Learn progress tracking** | `/learn` | Engagement | M |

---

## 6. Projected Scores After Implementation

| Page | AS-IS | After P0 | After P1 | After P2+P3 |
|------|-------|----------|----------|-------------|
| Home (EN) | 5.4 | 8.5 | 9.2 | 9.5+ |
| Simulate | 6.8 | 6.8 | 8.5 | 9.0 |
| Strategies/Ranking | 5.6 | 8.0 | 8.8 | 9.0 |
| Leaderboard | 3.2 | 7.5 | 8.0 | 8.5 |
| Market | 6.8 | 6.8 | 6.8 | 8.5 |
| Coins | 6.2 | 6.2 | 6.5 | 8.5 |
| Learn | 6.2 | 6.2 | 6.2 | 8.5 |
| Performance | 7.2 | 7.2 | 7.2 | 9.0 |
| Fees | 7.4 | 7.4 | 7.4 | 9.0 |
| Compare | 6.8 | 6.8 | 6.8 | 9.0 |
| Home (Mobile) | 4.2 | 7.8 | 8.5 | 9.0 |
| Simulate (Mobile) | 6.0 | 6.0 | 7.5 | 8.5 |
| **Weighted Avg** | **6.0** | **7.4** | **8.2** | **9.1** |

---

## 7. Reference Pattern Mapping

| Pattern | Source Site | Applied To | How |
|---------|-----------|------------|-----|
| Centered H1 + badge above | Dub, Vercel | Home hero | HeroBadge + centered text-7xl |
| Product UI in hero | Linear, Cal.com | Home hero | BrowserFrame with simulator screenshot |
| Atmospheric glow BG | Neon, Raycast | Home hero | Radial gradient blur div |
| Split hero (text L / visual R) | Resend, Lemon Squeezy | Alternative option | 50/50 grid |
| Logo/trust bar | Neon, Cal.com | Home section 4 | Stats + transparency metrics |
| 3-step grid | Framer, Dub | Home section 3 | StepCard component |
| Gradient border cards | Linear, Neon | Featured strategy cards | `.card-featured` with mask gradient |
| Staggered entrance | Linear | Home hero | `.hero-enter` CSS cascade |
| Dual CTA (filled + ghost) | Vercel, Neon, Dub | All CTAs | btn-primary + btn-ghost btn-lg |
| Announcement bar | Vercel, Dub | Home top | HeroBadge pill |

---

## 8. CSS Variables to Add (global.css summary)

```css
/* Copy-paste ready additions to global.css @theme block */

/* Display typography */
--font-size-display: clamp(2.5rem, 5vw, 4.5rem);
--font-size-display-sm: clamp(2rem, 4vw, 3.5rem);
--line-height-display: 1.05;
--letter-spacing-display: -0.04em;

/* Gradients */
--gradient-hero: linear-gradient(180deg, #09090B 0%, #0C1220 50%, #09090B 100%);
--gradient-section: linear-gradient(180deg, rgba(79,142,247,0.03) 0%, transparent 100%);
--gradient-card-shine: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%);

/* Hero background */
--color-bg-hero: #0A0E1A;
```

```css
/* Copy-paste ready additions to :root */
--shadow-hero-glow:
  0 0 120px 40px rgba(79,142,247,0.06),
  0 0 40px 10px rgba(79,142,247,0.03);
```

---

## 9. Persona Impact Summary

### Casey (80% of traffic -- most important)
- **Biggest wins**: Home hero (+4pts), Mobile hero (+4pts), Leaderboard fix (+5pts)
- **Key principle**: Visual proof > text explanation. Product screenshot in hero is the single highest-impact change.
- **Copy direction**: "Test before you risk real money" -- fear reduction, no jargon

### Tim (power user)
- **Biggest wins**: Compare checkmark tables (+2pts), Market scenario color coding (+1pt)
- **Key principle**: Show capability density. "569 coins, 14 indicators, realistic fees" should be scannable.

### Quinn (trust validator)
- **Biggest wins**: Trust section with failure stats (+1pt), Error state fixes (+3pts)
- **Key principle**: Never show broken data. Every error state must be graceful.

### Sam (copy trader)
- **Biggest wins**: Leaderboard always showing data (+5pts), Rankings error fix (+3pts)
- **Key principle**: Sam needs a "Best strategy right now" answer within 5 seconds of landing.
