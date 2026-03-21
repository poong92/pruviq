# PRUVIQ Hero Redesign — Reference Site Analysis
> 2026-03-21 | Based on actual site content + PRUVIQ source code audit

---

## PRUVIQ Current Hero: Diagnosis

### Layout
```
grid md:grid-cols-[1fr_360px] lg:grid-cols-[1fr_400px]
= Left ~70% text | Right ~30% TopStrategyWidget
```

### Problems Identified (from source code)
| # | Issue | Evidence |
|---|-------|----------|
| 1 | **Information overload in hero** | 12+ distinct elements before CTA: tag, H1, subtitle, subcopy, stats grid (4 cards), beginner note, competitor comparison block, social proof line, 2 CTAs, soft CTA, trust badges (4), ranking shortcut, data attribution |
| 2 | **CTA buried** | Primary CTA is at line 83-86 of the hero — after stats grid, beginner note, AND comparison block |
| 3 | **Right side is a widget, not a visual** | TopStrategyWidget is functional but not a "hero visual" — it doesn't create visual impact at first glance |
| 4 | **H1 is 2 lines with variable interpolation** | "Test Any Crypto Strategy" + "on 569 Coins in 3 Seconds." — second line has dynamic coin count |
| 5 | **No background treatment** | `min-h-[80vh]` with default `--color-bg: #09090B` — flat, no gradient/glow/texture |
| 6 | **Font: 4xl/6xl** | `text-4xl md:text-6xl` = 36px/60px — adequate but no tracking drama |
| 7 | **5 text blocks before CTA** | tag -> H1 -> subtitle -> subcopy -> stats -> beginner note -> comparison -> social proof -> CTA |
| 8 | **Stats duplicated** | Stats grid in hero AND again in separate section below how-it-works |

### CSS Variables (from global.css)
```css
--color-bg:       #09090B    /* Zinc-950 */
--color-bg-card:  #18181B    /* Zinc-800 */
--color-accent:   #4F8EF7    /* Premium blue */
--color-text:     #FAFAFA    /* Zinc-50 */
--color-text-muted: #71717A  /* Zinc-500 */
--color-up:       #22C55E    /* Green-500 */
--color-down:     #EF4444    /* Red-500 */
--color-border:   rgba(255,255,255,0.07)
```

---

## 1. Linear.app

### Hero Structure
| Attribute | Value |
|-----------|-------|
| Layout | **Centered, full-width** — no left-right split |
| H1 | "Linear -- The system for product development" (alt: varies by campaign) |
| Subtitle | Minimal — product-focused tagline |
| CTA | "Get started" (primary) + "Learn more" (ghost) |
| Right side | **Animated dot grid** — abstract, not a product screenshot |
| Below hero | Customer logos → Feature sections |
| Background | **Dark (#0A0A0A-ish)** with subtle animated grid dots |
| Typography | Variable font, tight letter-spacing, large display size |

### Key Design Patterns
- **Minimal text**: H1 + 1 line subtitle + 2 CTAs. That's it.
- **Animated background**: CSS keyframe dot grid creates depth without distraction
- **Color palette**: Near-black bg, white text, purple/blue accent
- **No stats in hero**: Zero numbers above the fold

### Applicable to PRUVIQ
| Pattern | How to Apply |
|---------|-------------|
| Animated subtle bg | Add CSS grid-dot animation or radial gradient glow behind hero |
| Strip hero to 3 elements | H1 + subtitle + CTA only. Move everything else below fold |
| Centered layout option | Consider `text-center max-w-4xl mx-auto` instead of grid split |

### Tailwind Implementation
```html
<!-- Linear-style minimal hero -->
<section class="min-h-[85vh] flex items-center justify-center relative overflow-hidden">
  <!-- Subtle radial glow -->
  <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,142,247,0.12),transparent)]"></div>
  <div class="relative z-10 text-center max-w-4xl mx-auto px-4">
    <h1 class="text-5xl md:text-7xl font-bold tracking-[-0.04em] mb-6">
      Test Any Strategy on<br/>
      <span class="text-[--color-accent]">569 Coins. Free.</span>
    </h1>
    <p class="text-lg text-[--color-text-muted] mb-8 max-w-xl mx-auto">
      No code. No signup. Just data.
    </p>
    <div class="flex gap-4 justify-center">
      <a href="/simulate" class="bg-[--color-accent] text-white px-8 py-3.5 rounded-lg font-semibold text-lg">
        Try Simulator Free &rarr;
      </a>
      <a href="/strategies" class="border border-[--color-border] px-8 py-3.5 rounded-lg font-semibold text-lg hover:border-[--color-accent]">
        See Results
      </a>
    </div>
  </div>
</section>
```

---

## 2. Vercel

### Hero Structure
| Attribute | Value |
|-----------|-------|
| Layout | **Centered, stacked vertical** |
| H1 | "Build and deploy on the AI Cloud." |
| Subtitle | "Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster, more personalized web." |
| CTA | **"Deploy"** (primary, filled) + **"Get a Demo"** (secondary, outlined) |
| Right side | None — fully centered |
| Below hero | **Customer logos with metrics** (Runway: "7m to 40s", Leonardo: "95% reduction", Zapier: "24x faster") |
| Background | Dark/light mode toggle. Dark mode: near-black with subtle gradient |
| Typography | Geist font, large display, tight tracking |

### Key Design Patterns
- **2 CTA buttons with clear hierarchy**: Deploy (filled, action verb) vs Demo (outlined)
- **Logos with numbers below hero**: Not just logos — each has a specific metric
- **Short H1**: 7 words. Period at end for finality.
- **Subtitle is value prop**: What it does + for whom

### Applicable to PRUVIQ
| Pattern | How to Apply |
|---------|-------------|
| Logo + metric section | "Powered by Binance data" + "569 coins" + "2yr+ history" as a horizontal strip below hero |
| Short imperative H1 | "Test strategies. Before you trade." (6 words, period) |
| CTA verb hierarchy | Primary = action ("Try Free"), Secondary = browse ("See Results") |
| Centered stack | Drop grid layout, go full centered |

### Tailwind Implementation
```html
<!-- Vercel-style centered hero with metrics strip below -->
<section class="pt-24 pb-16 text-center">
  <div class="max-w-3xl mx-auto px-4">
    <h1 class="text-5xl md:text-[4.5rem] font-bold tracking-[-0.04em] leading-[1.1] mb-6">
      Backtest strategies.<br/>Before you trade.
    </h1>
    <p class="text-xl text-[--color-text-secondary] mb-10 max-w-2xl mx-auto leading-relaxed">
      Free crypto strategy backtesting on 569 coins. No code, no signup, no cost.
    </p>
    <div class="flex gap-4 justify-center mb-16">
      <a href="/simulate" class="bg-white text-black px-8 py-3.5 rounded-full font-semibold text-base hover:bg-gray-200 transition">
        Try Simulator
      </a>
      <a href="/strategies" class="border border-white/20 px-8 py-3.5 rounded-full font-semibold text-base hover:border-white/40 transition">
        See Results
      </a>
    </div>
  </div>
</section>
<!-- Metrics strip (Vercel-style) -->
<div class="border-y border-[--color-border] py-6">
  <div class="max-w-5xl mx-auto px-4 flex justify-center gap-12 text-center">
    <div>
      <p class="text-2xl font-bold font-mono">569+</p>
      <p class="text-xs text-[--color-text-muted]">Coins tested</p>
    </div>
    <div>
      <p class="text-2xl font-bold font-mono">2yr+</p>
      <p class="text-xs text-[--color-text-muted]">Historical data</p>
    </div>
    <div>
      <p class="text-2xl font-bold font-mono">88+</p>
      <p class="text-xs text-[--color-text-muted]">Strategies backtested</p>
    </div>
    <div>
      <p class="text-2xl font-bold font-mono text-[--color-up]">$0</p>
      <p class="text-xs text-[--color-text-muted]">Forever free</p>
    </div>
  </div>
</div>
```

---

## 3. Resend

### Hero Structure
| Attribute | Value |
|-----------|-------|
| Layout | **Centered** |
| H1 | "Resend" (brand only, extremely minimal) |
| Subtitle | "Email API for developers. Send transactional and marketing emails at scale." |
| CTA | "Get started" primary + code snippet |
| Right side | N/A — code example below |
| Below hero | SDK icons + code examples |
| Background | Dark, minimal |
| Typography | Clean, system-like |

### Key Design Patterns
- **Ultra-minimal H1**: Brand name + 1-line description
- **Code example as social proof**: Developers see familiar code = trust
- **SDK/integration icons**: Shows breadth without words

### Applicable to PRUVIQ
| Pattern | How to Apply |
|---------|-------------|
| Show product in hero | A mini simulator preview or API response snippet |
| Integration badges | "Powered by Binance" + "CoinGecko" with actual icons |

---

## 4. Raycast

### Hero Structure
| Attribute | Value |
|-----------|-------|
| Layout | **Centered with 3D visual element** |
| H1 | "Your shortcut to everything." |
| Subtitle | "A collection of powerful productivity tools all within an extendable launcher. Fast, ergonomic and reliable." |
| CTA | **"Download for Mac"** (primary) + **"Download for Windows (beta)"** (secondary) |
| Right side | **Animated 3D cube** with glass morphism shader |
| Below hero | "It's not about saving time / It's about feeling like you're never wasting it" + feature cards (Fast, Ergonomic, Native, Reliable) |
| Background | **Dark (RGB 7,9,10 = #070A0A)** with 3D ambient light |
| Accent | Red/pink (#FF1627), cyan (#00ACEE), green (#2ED469) |
| Typography | Large display, tight tracking |

### Key Design Patterns
- **H1 is emotional, not functional**: "Your shortcut to everything" — not "A launcher for macOS"
- **3D visual element**: Creates "wow" factor, premium feel
- **Below-hero reframe**: Emotional statement, then features
- **Dark with vibrant accents**: Near-black bg, bright colored accents

### Applicable to PRUVIQ
| Pattern | How to Apply |
|---------|-------------|
| Emotional H1 | "Know before you trade." or "Data kills bad trades." instead of feature-listing H1 |
| 3D/animated visual | Animated equity curve or pulsing coin grid as hero visual |
| Dark + vibrant accent | Already have #4F8EF7 — make it glow more (radial gradient, box-shadow) |
| Feature section below | "Fast, Ergonomic, Native, Reliable" → "569 Coins, 3 Seconds, Zero Code, Free Forever" |

### Tailwind Implementation
```html
<!-- Raycast-style emotional hero -->
<section class="min-h-[90vh] flex items-center justify-center relative overflow-hidden">
  <!-- Accent glow -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[--color-accent] rounded-full opacity-[0.07] blur-[120px]"></div>
  <div class="relative z-10 text-center max-w-4xl mx-auto px-4">
    <h1 class="text-5xl md:text-7xl lg:text-8xl font-bold tracking-[-0.05em] leading-[0.95] mb-8">
      Know before<br/>you trade.
    </h1>
    <p class="text-xl md:text-2xl text-[--color-text-secondary] mb-10 max-w-xl mx-auto">
      Free crypto backtesting. 569 coins. 2 years of data. Zero code.
    </p>
    <a href="/simulate" class="inline-block bg-[--color-accent] text-white px-10 py-4 rounded-xl font-semibold text-lg shadow-[0_0_40px_rgba(79,142,247,0.3)] hover:shadow-[0_0_60px_rgba(79,142,247,0.4)] transition-shadow">
      Try Simulator Free &rarr;
    </a>
  </div>
</section>

<!-- 4-stat strip below (Raycast feature-row style) -->
<div class="border-t border-[--color-border]">
  <div class="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-x divide-[--color-border]">
    <div class="py-8 text-center">
      <p class="text-3xl font-bold font-mono mb-1">569+</p>
      <p class="text-sm text-[--color-text-muted]">Coins</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-3xl font-bold font-mono mb-1">3s</p>
      <p class="text-sm text-[--color-text-muted]">Per backtest</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-3xl font-bold font-mono mb-1">0</p>
      <p class="text-sm text-[--color-text-muted]">Code required</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-3xl font-bold font-mono text-[--color-up] mb-1">$0</p>
      <p class="text-sm text-[--color-text-muted]">Forever</p>
    </div>
  </div>
</div>
```

---

## 5. CoinGecko

### Hero Structure
| Attribute | Value |
|-----------|-------|
| Layout | **Data-first** — search bar + table immediately |
| H1 | "Cryptocurrency Prices by Market Cap" |
| Subtitle | "The global cryptocurrency market cap today is $2.5 Trillion, a 0.0% change in the last 24 hours." |
| CTA | **Search bar** is the primary interaction |
| Right side | N/A — full-width data table |
| Below hero | Market stats strip (Market Cap, Volume, BTC Dominance, Coins Tracked: 18,064, Exchanges: 1,481) |
| Background | Light default, dark toggle available |

### Key Design Patterns
- **Data IS the hero**: No marketing copy — raw data
- **Stats bar as trust signals**: 18,064 coins, 1,481 exchanges = authority
- **SOC 2 compliance badge**: Trust indicator for financial data
- **Search as CTA**: Main action is searching, not clicking a button

### Applicable to PRUVIQ
| Pattern | How to Apply |
|---------|-------------|
| Stats as authority | "569 coins, 12.8M+ candles, 88+ strategies tested" — numbers build trust |
| Data source badge | "SOC 2" equivalent: "Binance verified data" badge |
| Search/interactive element in hero | Mini strategy selector or coin search as hero interaction |

---

## Cross-Site Pattern Summary

| Pattern | Linear | Vercel | Resend | Raycast | CoinGecko | PRUVIQ Current |
|---------|--------|--------|--------|---------|-----------|---------------|
| Layout | Centered | Centered | Centered | Centered | Full-width | **Left-right grid** |
| H1 word count | ~8 | 7 | 1 | 4 | 5 | **11+** |
| Elements above CTA | 3 | 3 | 3 | 3 | 2 | **12+** |
| Background | Animated dots | Gradient | Minimal | 3D glow | Flat light | **Flat dark** |
| CTA style | Filled + Ghost | Filled + Outlined | Filled | Filled + Link | Search bar | **Filled + Outlined** |
| Stats location | Below fold | Below hero strip | None | Below hero | In hero | **In hero (cluttered)** |
| Visual element | Dot grid | None | Code | 3D cube | Data table | **Widget** |

---

## Recommended PRUVIQ Hero Redesign

### Verdict: Raycast-style centered hero + Vercel-style metrics strip

Based on all 5 references, the optimal pattern for PRUVIQ is:

### Structure (3 elements above fold)
```
1. H1 (emotional, short)     — 4-6 words
2. Subtitle (value prop)     — 1 line
3. CTA (single primary)      — action verb
---
4. Stats strip (below hero)  — 4 numbers
5. TopStrategyWidget          — move to "featured" section below
```

### What to Remove from Hero
- [x] Stats grid (4 cards) → move to stats strip below
- [x] Beginner note → move to /learn or FAQ
- [x] Competitor comparison block → stays in comparison section
- [x] Social proof line → move below fold
- [x] Trust badges (4 items) → footer or trust section
- [x] Ranking shortcut → nav or below fold
- [x] Data attribution → footer
- [x] Soft CTA ("Not sure?") → remove or move

### Final Code Pattern (Ready to Apply)

```html
<!-- HERO: Raycast emotion + Vercel structure -->
<section class="min-h-[85vh] flex items-center justify-center relative overflow-hidden"
         aria-labelledby="hero-heading">
  <!-- Background glow -->
  <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[800px] h-[400px] bg-[--color-accent] rounded-full
              opacity-[0.06] blur-[150px] pointer-events-none"></div>

  <div class="relative z-10 text-center max-w-4xl mx-auto px-4 py-20">
    <!-- Tag -->
    <p class="font-mono text-[--color-accent] text-sm mb-6 tracking-wider">
      {t('hero.tag')}
    </p>

    <!-- H1: Short, emotional -->
    <h1 id="hero-heading"
        class="text-5xl md:text-7xl font-bold tracking-[-0.04em] leading-[1.05] mb-6">
      Test Any Strategy on<br/>
      <span class="text-[--color-accent]">{coinsAnalyzed} Coins. Free.</span>
    </h1>

    <!-- Subtitle: 1 line -->
    <p class="text-lg md:text-xl text-[--color-text-secondary] mb-10 max-w-xl mx-auto">
      {t('hero.subtitle')}
    </p>

    <!-- CTA: Primary only, with glow -->
    <div class="flex flex-col sm:flex-row gap-4 justify-center mb-6">
      <a href="/simulate"
         class="bg-[--color-accent] text-white px-10 py-4 rounded-lg font-semibold text-lg
                shadow-[0_0_30px_rgba(79,142,247,0.25)]
                hover:shadow-[0_0_50px_rgba(79,142,247,0.35)]
                hover:bg-[--color-accent-dim] transition-all min-h-[52px]">
        {t('hero.cta_primary')} &rarr;
      </a>
      <a href="/strategies"
         class="border border-white/10 text-[--color-text] px-8 py-4 rounded-lg
                font-semibold text-lg hover:border-[--color-accent]/40
                hover:text-[--color-accent] transition-all min-h-[52px]">
        {t('hero.cta_secondary')}
      </a>
    </div>

    <!-- Micro-trust (1 line) -->
    <p class="text-sm text-[--color-text-muted] font-mono">
      No signup required &middot; Results in 3 seconds &middot; Powered by Binance data
    </p>
  </div>
</section>

<!-- STATS STRIP (Vercel-style, separated from hero) -->
<div class="border-y border-[--color-border]">
  <div class="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4
              divide-x divide-[--color-border]">
    <div class="py-8 text-center">
      <p class="text-2xl md:text-3xl font-bold font-mono">{coinsAnalyzed}+</p>
      <p class="text-xs text-[--color-text-muted] mt-1">{t('home.stat_coins')}</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-2xl md:text-3xl font-bold font-mono">{tradingDays}+</p>
      <p class="text-xs text-[--color-text-muted] mt-1">{t('home.stat_trades')}</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-2xl md:text-3xl font-bold font-mono">{candlesProcessed}+</p>
      <p class="text-xs text-[--color-text-muted] mt-1">{t('home.stat_datapoints')}</p>
    </div>
    <div class="py-8 text-center">
      <p class="text-2xl md:text-3xl font-bold font-mono text-[--color-up]">$0</p>
      <p class="text-xs text-[--color-text-muted] mt-1">{t('home.stat_free')}</p>
    </div>
  </div>
</div>
```

### CSS Additions (global.css)
```css
/* Hero accent glow — add to global.css */
.hero-glow {
  background: radial-gradient(
    ellipse 80% 50% at 50% -20%,
    rgba(79, 142, 247, 0.10),
    transparent
  );
}

/* CTA button glow */
.btn-glow {
  box-shadow: 0 0 30px rgba(79, 142, 247, 0.25);
  transition: box-shadow 0.3s ease;
}
.btn-glow:hover {
  box-shadow: 0 0 50px rgba(79, 142, 247, 0.35);
}
```

### Key Metrics (Before → After)
| Metric | Current | Proposed |
|--------|---------|----------|
| Elements above CTA | 12+ | **4** (tag, H1, subtitle, CTA) |
| H1 word count | 11 | **7** |
| CTA distance from top | ~600px scroll | **~300px** (visible without scroll on 900px viewport) |
| Background treatment | None | **Radial accent glow** |
| CTA visual weight | Flat filled button | **Glow shadow + larger padding** |
| Layout | Left-right grid | **Centered** |
| Stats location | Inline (clutters hero) | **Separate strip below** |

### Mobile Considerations (390x844)
```html
<!-- Mobile adjustments -->
<h1 class="text-4xl sm:text-5xl md:text-7xl ...">
<!-- text-4xl = 36px on mobile — readable, not cramped -->

<!-- Stack CTAs vertically on mobile (already handled by flex-col sm:flex-row) -->

<!-- Stats strip: 2x2 grid on mobile (already handled by grid-cols-2 md:grid-cols-4) -->
```

### What Moves Where
| Element | From | To |
|---------|------|-----|
| Stats grid (4 cards) | Hero inline | Stats strip section |
| Beginner note | Hero | /learn page or remove |
| Competitor comparison | Hero | Stays in comparison section (lower) |
| Social proof line | Hero | Remove (quotes section handles this) |
| Trust badges (4) | Hero | Footer or trust section |
| Ranking shortcut | Hero | Nav or TopStrategy widget section |
| Data attribution | Hero | Footer |
| TopStrategyWidget | Hero right column | New "Live Data" section below stats strip |
| Soft CTA | Hero | Remove |

---

## Note on Screenshots

Browser automation tools (browser_navigate, browser_take_screenshot) were not available in this environment. The analysis above is based on:
- Actual HTML/CSS content fetched from each site via WebFetch
- Exact text, layout patterns, and design values extracted from rendered content
- PRUVIQ source code direct inspection (index.astro, global.css, en.ts)

For actual pixel-level screenshots, run the PRUVIQ dev server and use the existing `vision-collect.spec.ts` Playwright script, or manually screenshot each reference site at 1280x900 and 390x844.
