# PRUVIQ Design Specification v2.0
**작성일**: 2026-03-20
**목표**: 최고 수준 UI/UX + 퍼포먼스 동시 달성
**방향**: Linear(레이아웃) × Vercel(히어로) × Hyperliquid(데이터 밀도) × Attio(타이포)

---

## 0. 설계 철학

### "Data as Visual Language"
PRUVIQ의 본질은 **숫자가 진실을 말하는 플랫폼**이다.
디자인은 그 숫자를 방해해선 안 된다. 모든 UI 결정은 단 하나의 질문으로 검증한다:

> **"이 요소가 없으면 데이터가 더 잘 보이는가?"**
> Yes → 제거. No → 유지.

### 3가지 원칙
1. **Depth over Flat** — 깊이감 있는 레이어링. 단순 flat은 2020년대 초
2. **Motion with Meaning** — 모든 애니메이션은 상태 변화를 전달
3. **Precision Typography** — 숫자는 항상 모노스페이스, 크기로 위계 표현

---

## 1. 디자인 시스템

### 1-1. Color Palette — "Obsidian"

현재 배경 `#17171c`는 너무 밝다. Vercel/Linear/Hyperliquid는 모두 `#000` ~ `#0A0A0A` 계열 사용.

```css
/* ─── BACKGROUNDS ─── */
--color-bg:            #09090B;   /* Zinc-950 — 메인 배경 (현재 #17171c → 더 깊게) */
--color-bg-surface:    #0F0F13;   /* 네비, 푸터 등 섹션 구분 */
--color-bg-card:       #18181B;   /* 카드 기본 (현재 #1e1e23) */
--color-bg-elevated:   #1C1C20;   /* 호버/액티브 상태 카드 */
--color-bg-overlay:    #27272A;   /* 드롭다운, 토스트 오버레이 */
--color-bg-subtle:     rgba(255,255,255,0.02); /* 초미묘한 섹션 구분 */

/* ─── TEXT ─── */
--color-text:          #FAFAFA;   /* Zinc-50 — 주요 텍스트 */
--color-text-secondary:#A1A1AA;   /* Zinc-400 — 보조 설명 */
--color-text-muted:    #71717A;   /* Zinc-500 — 레이블, 메타 */
--color-text-disabled: #52525B;   /* Zinc-600 — 비활성 */

/* ─── ACCENT (로고 파랑 유지, 더 정제된 버전) ─── */
--color-accent:        #4F8EF7;   /* 현재 #3182f6보다 밝고 premium */
--color-accent-dim:    #2563EB;   /* hover 상태 */
--color-accent-bright: #93C5FD;   /* 하이라이트, 선택 상태 */
--color-accent-subtle: rgba(79,142,247,0.10);
--color-accent-glow:   rgba(79,142,247,0.22);

/* ─── SEMANTIC ─── */
--color-up:            #22C55E;   /* Green-500 — 수익/양수 */
--color-up-muted:      rgba(34,197,94,0.15);
--color-down:          #EF4444;   /* Red-500 — 손실/음수 */
--color-down-muted:    rgba(239,68,68,0.15);
--color-warning:       #F59E0B;   /* Amber-500 — 경고 */
--color-warning-muted: rgba(245,158,11,0.12);

/* ─── BORDERS ─── */
--color-border:        rgba(255,255,255,0.07);   /* 기본 테두리 (현재 0.08) */
--color-border-hover:  rgba(255,255,255,0.14);   /* 호버 */
--color-border-accent: rgba(79,142,247,0.30);    /* 포커스/선택 */
--color-border-up:     rgba(34,197,94,0.30);
--color-border-down:   rgba(239,68,68,0.30);
```

**변경 포인트**:
- 배경: `#17171c` → `#09090B` (+47% 더 어두움 → Vercel/Linear 수준)
- 액센트: `#3182f6` → `#4F8EF7` (더 밝고 눈에 띔, 로고와 조화)
- 테두리: `rgba(255,255,255,0.08)` → `0.07` (더 섬세)

---

### 1-2. Typography — "Geist" 도입

현재 Inter + JetBrains Mono는 훌륭하지만 `Geist`(Vercel 제작, 오픈소스)가 더 적합:
- Inter보다 더 날카롭고 데이터 친화적
- Geist Mono는 JetBrains Mono보다 더 현대적 (숫자 가독성 superior)
- 2025-2026 fintech/SaaS에서 가장 많이 채택되는 폰트

```css
/* ─── FONT FAMILIES ─── */
--font-sans: 'Geist', 'Inter', system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;

/* ─── TYPE SCALE (8pt 기반, Display 강화) ─── */
/* Display — 히어로 숫자, 대형 헤딩 */
.text-display-xl  { font-size: 72px; line-height: 1.0; letter-spacing: -0.04em; font-weight: 700; }
.text-display-lg  { font-size: 56px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 700; }
.text-display-md  { font-size: 40px; line-height: 1.1;  letter-spacing: -0.02em; font-weight: 700; }
.text-display-sm  { font-size: 32px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; }

/* Heading */
.text-heading-lg  { font-size: 24px; line-height: 1.3;  letter-spacing: -0.01em; font-weight: 600; }
.text-heading-md  { font-size: 20px; line-height: 1.4;  letter-spacing: -0.01em; font-weight: 600; }
.text-heading-sm  { font-size: 16px; line-height: 1.5;  font-weight: 600; }

/* Body */
.text-body-lg     { font-size: 16px; line-height: 1.7;  font-weight: 400; }
.text-body-md     { font-size: 14px; line-height: 1.6;  font-weight: 400; }
.text-body-sm     { font-size: 13px; line-height: 1.5;  font-weight: 400; }

/* Label / Mono — 데이터 표시용 */
.text-label       { font-size: 11px; line-height: 1.4; letter-spacing: 0.08em; font-weight: 600; text-transform: uppercase; font-family: var(--font-mono); }
.text-mono-xl     { font-size: 32px; line-height: 1.2; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.text-mono-lg     { font-size: 24px; line-height: 1.3; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.text-mono-md     { font-size: 16px; line-height: 1.4; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.text-mono-sm     { font-size: 12px; line-height: 1.4; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

**핵심 규칙**: 모든 수치 (승률%, PF, PnL, 거래 수)는 반드시 `font-variant-numeric: tabular-nums` 적용.
숫자가 바뀔 때 레이아웃이 흔들리지 않아야 함.

---

### 1-3. Spacing & Grid

```
Base unit: 4px
Scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128

Content widths:
  --width-xs:   480px   (좁은 폼, 모달)
  --width-sm:   640px   (블로그, 아티클)
  --width-md:   768px   (섹션 콘텐츠)
  --width-lg:   1024px  (전략 목록, 랭킹)
  --width-xl:   1280px  (홈 히어로, 대시보드)
  --width-full: 1440px  (풀와이드 섹션)

Gutters:
  mobile:  16px
  tablet:  24px
  desktop: 40px
```

---

### 1-4. Border Radius

```css
--radius-xs:   4px;   /* 배지, 태그 */
--radius-sm:   6px;   /* 버튼, 입력 */
--radius-md:   10px;  /* 카드 (현재 8px → 더 현대적) */
--radius-lg:   14px;  /* 큰 카드, 패널 */
--radius-xl:   20px;  /* 모달, 팝오버 */
--radius-full: 9999px; /* 알약형 배지 */
```

---

### 1-5. Shadow & Depth System

Flat shadow 버림. 실제 깊이감 있는 레이어 시스템:

```css
/* 카드 기본 — 테두리 + 미묘한 그림자 */
--shadow-card:
  0 0 0 1px rgba(255,255,255,0.07),
  0 2px 8px rgba(0,0,0,0.3),
  0 8px 24px rgba(0,0,0,0.2);

/* 카드 호버 — 살짝 들어올려짐 */
--shadow-card-hover:
  0 0 0 1px rgba(255,255,255,0.12),
  0 4px 16px rgba(0,0,0,0.4),
  0 16px 40px rgba(0,0,0,0.3);

/* 액센트 글로우 — 선택/포커스 상태 */
--shadow-accent-glow:
  0 0 0 1px rgba(79,142,247,0.35),
  0 0 20px rgba(79,142,247,0.15),
  0 4px 16px rgba(0,0,0,0.3);

/* 수익 글로우 */
--shadow-up-glow:
  0 0 0 1px rgba(34,197,94,0.30),
  0 0 16px rgba(34,197,94,0.10);

/* 손실 글로우 */
--shadow-down-glow:
  0 0 0 1px rgba(239,68,68,0.30),
  0 0 16px rgba(239,68,68,0.10);

/* 팝오버/드롭다운 */
--shadow-elevated:
  0 0 0 1px rgba(255,255,255,0.10),
  0 8px 32px rgba(0,0,0,0.6),
  0 32px 64px rgba(0,0,0,0.4);
```

---

### 1-6. Motion System

#### 원칙
- 기능적 목적 없는 모션 금지
- 모든 전환: 80-200ms (Linear 기준)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo — 빠르게 시작, 부드럽게 멈춤)

```css
/* ─── TRANSITIONS ─── */
--ease-default:    cubic-bezier(0.16, 1, 0.3, 1);   /* 주력 — ease-out-expo */
--ease-bounce:     cubic-bezier(0.34, 1.56, 0.64, 1); /* 탄성 — 버튼 클릭 피드백 */
--ease-smooth:     cubic-bezier(0.4, 0, 0.2, 1);    /* 부드러운 — 색상 전환 */

--duration-instant: 80ms;    /* hover 색상 변화 */
--duration-fast:    150ms;   /* 버튼 상태, 배지 */
--duration-normal:  220ms;   /* 카드 hover, 드롭다운 */
--duration-slow:    350ms;   /* 페이지 전환, 모달 */
--duration-entrance: 500ms;  /* 첫 진입 애니메이션 */

/* ─── KEYFRAMES ─── */

/* 카드 진입 — stagger 적용 */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 숫자 카운트업 — metric 카드용 */
@keyframes number-reveal {
  from { opacity: 0; transform: translateY(4px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* 수익 플래시 */
@keyframes flash-up {
  0%   { background: transparent; }
  30%  { background: rgba(34,197,94,0.15); }
  100% { background: transparent; }
}

/* 손실 플래시 */
@keyframes flash-down {
  0%   { background: transparent; }
  30%  { background: rgba(239,68,68,0.15); }
  100% { background: transparent; }
}

/* 로딩 shimmer */
@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}

/* 실시간 점 깜빡임 */
@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}

/* 히어로 진입 */
@keyframes hero-enter {
  from { opacity: 0; transform: translateY(24px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
}
```

#### Scroll Reveal (현재 시스템 개선)
```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity var(--duration-slow) var(--ease-default),
              transform var(--duration-slow) var(--ease-default);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger: 자식 요소 80ms 간격 */
.reveal-stagger > *:nth-child(1) { transition-delay: 0ms; }
.reveal-stagger > *:nth-child(2) { transition-delay: 80ms; }
.reveal-stagger > *:nth-child(3) { transition-delay: 160ms; }
.reveal-stagger > *:nth-child(4) { transition-delay: 240ms; }
```

---

## 2. 컴포넌트 설계

### 2-1. MetricCard (핵심 KPI 표시)

가장 많이 쓰이는 컴포넌트. 전략 상세, 랭킹, 시뮬레이터 결과 등 전체에 사용.

```
┌─────────────────────────────┐
│ LABEL              DELTA    │  ← 11px mono uppercase + ±delta badge
│                             │
│ 68.4%                       │  ← 32px mono, tabular-nums, 시맨틱 컬러
│                             │
│ ▁▂▅▃▆▄▇▅ sparkline (옵션)  │  ← 36px h, SVG inline
└─────────────────────────────┘

States: default / positive(glow up) / negative(glow down) / loading(shimmer)
Sizes: sm(compact) / md(standard) / lg(hero)
```

### 2-2. StrategyCard (전략 목록 카드)

```
┌──────────────────────────────────────────┐
│ ● VERIFIED        1H · LONG · MEDIUM     │  ← status badge + meta
│                                          │
│ BB Squeeze Short                         │  ← 20px semibold
│ Bollinger Band 수축 구간의 방향성 전략   │  ← 13px muted
│                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐         │
│ │ 68.4%  │ │  2.22  │ │-11.2%  │         │  ← MetricCard sm ×3
│ │ Win R  │ │   PF   │ │  MDD   │         │
│ └────────┘ └────────┘ └────────┘         │
│                                          │
│ [Simulate →]              [Details →]   │
└──────────────────────────────────────────┘

Hover: translateY(-2px) + shadow-card-hover
Active: scale(0.99)
```

### 2-3. RankingRow (랭킹 리스트 행)

Linear의 이슈 리스트에서 영감:

```
┌─────────────────────────────────────────────────────────────┐
│ 🥇  BB Squeeze Short    1H · SHORT    68.4%   2.22   1,847  │
│     Bollinger Band...   ←────────────────────── low sample⚠│
└─────────────────────────────────────────────────────────────┘

- 행 전체 클릭 가능 (cursor: pointer)
- hover: bg-elevated + left accent border (2px)
- 5열: rank | name+subtitle | timeframe·direction | wr | pf | trades
```

### 2-4. Button System

```css
/* Primary */
.btn-primary {
  background: var(--color-accent);
  color: #000;                    /* 흰색 아닌 검정 → 대비율 ↑ */
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
  transition: all var(--duration-instant) var(--ease-smooth);

  &:hover { background: var(--color-accent-bright); transform: translateY(-1px); }
  &:active { transform: scale(0.97); }
}

/* Secondary */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border-hover);
  color: var(--color-text);
  /* hover: border-color → --color-accent */
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  /* hover: bg-subtle + color → text */
}

/* Destructive (Killed strategies) */
.btn-destructive {
  background: var(--color-down-muted);
  border: 1px solid var(--color-border-down);
  color: var(--color-down);
}
```

### 2-5. Badge System

```
Verified:    ● 초록 dot + "VERIFIED" — border: up/0.3, bg: up-muted
Testing:     ◐ 노랑 dot + "TESTING"  — border: warning/0.3
Killed:      ✕ 빨강 dot + "KILLED"   — border: down/0.3, line-through name
Shelved:     ○ 회색 dot + "SHELVED"  — border: border-hover
Live:        ● 깜빡임 dot + "LIVE"   — animation: live-pulse 2s
```

### 2-6. Navigation — Command-style

현재 nav는 전통적인 링크 구조. Linear/Vercel 스타일의 **compact top bar**로 교체:

```
┌──────────────────────────────────────────────────────────────┐
│ [PRUVIQ logo]  Strategies  Simulate  Rankings  Learn  Blog  │ [KO/EN] │
└──────────────────────────────────────────────────────────────┘

- Height: 52px (현재보다 compact)
- Sticky + backdrop-blur: 12px
- bg: rgba(9,9,11,0.85) (배경 블러)
- border-bottom: var(--color-border) — 스크롤 후 나타남
- Active item: --color-accent + 하단 2px accent line
- Mobile: hamburger → full-screen overlay (Raycast 스타일)
```

### 2-7. Data Table (Rankings)

```
┌──────────────────────────────────────────────────────────────────┐
│ STRATEGY ↕    TIMEFRAME   WIN RATE ↓   PF ↕    TRADES   STATUS  │  ← sticky header
├──────────────────────────────────────────────────────────────────┤
│ 🥇 BB Squeeze  1H · SHORT   68.4%      2.22    1,847    ● VER   │
│ 🥈 Momentum    4H · LONG    61.2%      1.87    2,103    ● VER   │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘

- 열 정렬 (클릭): 현재 정렬 방향 화살표 표시
- 행 호버: bg-elevated + left-border 2px accent
- 스켈레톤: shimmer 애니메이션
- 모바일: 카드 형태로 자동 전환 (3열 이하)
```

---

## 3. 페이지별 리디자인 설계

### 3-1. Homepage — 완전 재설계 (최고 우선순위)

#### Hero Section (Above The Fold)
**현재 문제**: 정적 마케팅 텍스트. 첫 화면에서 실제 데이터를 보여주지 않음.
**새 방향**: Hyperliquid처럼 **실제 데이터가 Hero** — "백테스팅 결과가 곧 광고"

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PRUVIQ_                                [Live] 03:47 UTC        │
│                                                                  │
│  ┌──────────────────────────────────┐                           │
│  │ Today's #1 Strategy              │                           │
│  │                                  │                           │
│  │ BB Squeeze SHORT  1H             │  ← 실시간 API 데이터      │
│  │ ──────────────────────────────── │                           │
│  │ Win Rate   PF      MDD    Trades │                           │
│  │  68.4%    2.22   -11.2%  1,847  │                           │
│  │                    ▁▂▅▃▆▄▇▅▆▃   │  ← equity sparkline       │
│  └──────────────────────────────────┘                           │
│                                                                  │
│  Which strategy actually works?                                 │  ← h1: 56px Geist Bold
│  Backtested across 569 coins.                                   │  ← 24px muted
│  No signup. No code. No cost.                                   │  ← 3-word punch copy
│                                                                  │
│  [▶ Run Simulation Free]    [See All Rankings →]               │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  569 Coins  ·  1M+ Trades  ·  37 Strategies  ·  $0 Forever     │  ← trust bar
└──────────────────────────────────────────────────────────────────┘
```

#### Feature Sections (Below Fold)

**Section 2: Problem/Solution (Vercel 방식)**
```
"Your backtest said +120%."
"Your live account said -40%."
"There's a reason for that."
→ [How PRUVIQ is different →]
```
3-column comparison grid: TradingView | Quant Tools | PRUVIQ
각 열: feature list + 가격 + CTA

**Section 3: Live Rankings Preview**
현재 랭킹 Top 3 카드 + "See Full Rankings →" CTA
실시간 데이터 fetch (30초 갱신)

**Section 4: Simulator Demo (Framer 방식)**
인터랙티브 미니 시뮬레이터 임베드:
파라미터 슬라이더 → 결과 즉시 업데이트 → "Try Full Simulator →"

**Section 5: Strategy Showcase**
Verified 전략 2-3개 카드 + "All Strategies →"

**Section 6: Community Proof**
현재 quote 카드 유지하되 레이아웃 정리

**Section 7: Final CTA**
```
Start verifying strategies.
No account needed.
[Run Your First Simulation →]
```

---

### 3-2. Simulator — 전면 재설계

**현재**: 단일 컬럼, 설정 → 결과가 위아래로
**새 방향**: 2-panel split layout (Hyperliquid 방식)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Strategies   Simulator                      [Share] [Export] │
├────────────────────────┬────────────────────────────────────────┤
│ CONFIGURATION  [─────] │  RESULTS                               │
│                        │                                        │
│ Strategy               │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│ [BB Squeeze Short ▼]   │  │ 68.4%│ │ 2.22 │ │1,847 │ │-11.2%│ │
│                        │  │Win R │ │  PF  │ │Trade │ │ MDD  │ │
│ Stop Loss    [10%  ─]  │  └──────┘ └──────┘ └──────┘ └──────┘ │
│ Take Profit  [ 8%  ─]  │                                        │
│ Coin Group   [Top50 ▼] │  EQUITY CURVE                          │
│ Timeframe    [ 1H  ▼]  │  ┌──────────────────────────────────┐ │
│ Period       [1Y   ▼]  │  │  ╱╲    ╱╲      ╱╲                │ │
│                        │  │╱    ╲╱    ╲  ╱    ╲  ╱           │ │
│ ────────────────────── │  │           ╲╱      ╲╱             │ │
│ PRESETS                │  └──────────────────────────────────┘ │
│ [BB Squeeze ▾]         │                                        │
│ [Momentum   ▾]         │  TRADE DISTRIBUTION (heatmap)          │
│ [ATR Break  ▾]         │  ┌──────────────────────────────────┐ │
│                        │  │ Mon ▓▓▓░░░▓▓░░░  (win rate/day) │ │
│ [▶ Run Simulation]     │  │ Tue ░░▓▓▓▓░░▓▓                  │ │
│                        │  └──────────────────────────────────┘ │
└────────────────────────┴────────────────────────────────────────┘
```

모바일: Tab 전환 (Config tab / Results tab)

---

### 3-3. Strategies Index — 카드 → 테이블+카드 하이브리드

**새 레이아웃**:
```
┌─────────────────────────────────────────────────────────────────┐
│ STRATEGIES                    [▤ Grid] [≡ List]  [▼ Filter]    │
│ 37 strategies · 5 verified                                      │
├─────────────────────────────────────────────────────────────────┤
│ VERIFIED ──────────────────────────────────────────────────────  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ ● VERIFIED   │ │ ● VERIFIED   │ │ ● VERIFIED   │             │
│ │ BB Squeeze S │ │ Momentum 4H  │ │ ATR Breakout │             │
│ │ 68.4% / 2.22 │ │ 61.2% / 1.87 │ │ 57.8% / 1.63 │             │
│ └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
│ IN TESTING ─────────────────────────────────────────────────── │
│ ...                                                              │
│ KILLED ─────────────────────────────────────────────────────── │
│ (불투명 처리, hover로 펼치기)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3-4. Rankings — 완전 데이터 대시보드

```
┌─────────────────────────────────────────────────────────────────┐
│ STRATEGY RANKINGS    [30d ▾] [Top50 ▾]          Updated 3m ago │
├──────────────────────────────────┬──────────────────────────────┤
│ BEST 3 TODAY                     │ WORST 3 TODAY                │
│ ┌────────┐┌────────┐┌────────┐  │ ┌────────┐┌────────┐┌──────┐ │
│ │🥇      ││🥈      ││🥉      │  │ 3 worst cards (dimmed)     │ │
│ └────────┘└────────┘└────────┘  │                              │
├──────────────────────────────────┴──────────────────────────────┤
│ FULL RANKINGS TABLE                                             │
│ (sortable, filterable, sticky header)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3-5. Performance — 스토리텔링 리디자인

현재: 숫자 표 나열
새 방향: **살아있는 트레이딩 기록** (투명성 강조)

```
┌─────────────────────────────────────────────────────────────────┐
│ LIVE PERFORMANCE RECORD          ● ARCHIVED: Jan 2024 – Feb 2026│
│                                                                  │
│  Total PnL        Win Rate      Profit Factor    Max Drawdown   │
│  +$794            68.6%           2.22            -11.2%        │  ← MetricCard lg
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ EQUITY CURVE                                    [1M][3M][6M][All]│
│ ┌────────────────────────────────────────────────────────────┐  │
│ │        ╱╲    ╱╲      ╱╲                                    │  │
│ │      ╱    ╲╱    ╲  ╱    ╲  ╱              (animated SVG)  │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ WHY PRUVIQ PUBLISHES THIS                                       │
│ "We lost $4,000 on a backtested strategy. That's why this       │
│  exists. Every trade. Every loss. Published."                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3-6. About — 창업자 스토리 강화

Solo Founder 섹션을 현재보다 훨씬 강조:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1인 개발자.                                                     │  ← 40px Bold
│ $4,000 잃고 만들었습니다.                                       │  ← 24px muted
│                                                                  │
│ [사진/아이콘 자리]  Background text...                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 기술 스택 업그레이드

### 추가할 것 (최소화 원칙)

| 라이브러리 | 용도 | 크기 | 이유 |
|-----------|------|------|------|
| `@fontsource/geist` | Geist 폰트 | ~40KB | 현재 Inter 대체 |
| `@fontsource/geist-mono` | Geist Mono | ~30KB | 현재 JetBrains 대체 |
| `motion` (Framer Motion v12) | 마이크로 애니메이션 | ~25KB tree-shaken | 시뮬레이터 결과 transition |

### 제거할 것 (정리)

현재 CSS-only 애니메이션 대부분은 유지. motion 라이브러리는 시뮬레이터+차트에만 사용.

### 유지할 것

```
Astro 5            ✅ 그대로 (SSG + 부분 SSR)
Preact             ✅ 그대로 (interactive islands)
Tailwind v4        ✅ 그대로 (design tokens만 업데이트)
lightweight-charts ✅ 그대로 (TradingView 차트)
Cloudflare Pages   ✅ 그대로 (Edge CDN)
```

### 폰트 교체 방법

```bash
# 패키지 설치
pnpm add @fontsource-variable/geist @fontsource-variable/geist-mono

# global.css 교체
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';

# CSS 변수 업데이트
--font-sans: 'Geist Variable', 'Inter', system-ui, sans-serif;
--font-mono: 'Geist Mono Variable', 'JetBrains Mono', monospace;
```

---

## 5. 퍼포먼스 목표 & 전략

### Core Web Vitals 목표

| 지표 | 현재 (추정) | 목표 |
|------|------------|------|
| LCP  | ~1.8s      | < 1.2s |
| CLS  | ~0.08      | < 0.02 |
| INP  | ~80ms      | < 50ms |
| FID  | ~40ms      | < 20ms |
| TTFB | ~200ms     | < 100ms (Cloudflare Edge) |

### 달성 방법

1. **폰트 최적화**
   - `font-display: swap` (현재도 있지만 Geist는 Variable font → 단일 파일)
   - `preload` 힌트 추가

2. **이미지 최적화**
   - 현재 OG 이미지 AVIF 있음 ✅
   - Hero 섹션 실시간 데이터 → 이미지 없음 → CLS ↓

3. **JS Bundle 최소화**
   - Preact를 유지하는 이유: React(41KB) vs Preact(4KB)
   - `motion` 라이브러리 tree-shaking 필수 (~25KB → 실제 사용 부분만)
   - `client:visible` 패턴 유지 (뷰포트 밖 컴포넌트 지연 로딩)

4. **CSS 최적화**
   - Tailwind v4 purge → 실제 사용 클래스만 빌드
   - Critical CSS inline (현재 Astro가 자동 처리)

5. **Cloudflare Edge**
   - `_headers` 파일: Cache-Control 최적화
   - Brotli 압축 활성화 확인

---

## 6. 구현 로드맵

### Phase 1: 디자인 시스템 교체 (3-5일)
> 변경 파일: `global.css` 1개 + Layout.astro 폰트 부분

- [ ] 배경/텍스트/테두리 색상 변수 교체
- [ ] 폰트 Geist로 교체 (Inter fallback 유지)
- [ ] Shadow 시스템 추가
- [ ] Motion 변수/keyframes 추가
- [ ] 모든 페이지 QA (색상 깨짐 체크)

### Phase 2: 핵심 컴포넌트 재설계 (5-7일)
> 변경 파일: 10-15개 컴포넌트

- [ ] Button system (Primary/Secondary/Ghost/Destructive)
- [ ] Badge system (Verified/Testing/Killed/Live)
- [ ] MetricCard 컴포넌트
- [ ] StrategyCard 재설계
- [ ] Navigation 재설계 (compact sticky + blur)
- [ ] RankingCard/RankingRow
- [ ] DataTable 기본 구조

### Phase 3: 핵심 페이지 재설계 (7-10일)
> 우선순위: Homepage → Simulator → Rankings → Strategies → Performance

- [ ] Homepage hero (실시간 데이터 히어로)
- [ ] Homepage sections (Problem/Solution, Preview, Demo)
- [ ] Simulator split-layout
- [ ] Rankings 대시보드
- [ ] Strategies 그리드/리스트 하이브리드
- [ ] Performance 스토리텔링 레이아웃

### Phase 4: 서브 페이지 & 폴리시 (5-7일)
- [ ] About solo founder 강화
- [ ] Blog/Learn 카드 레이아웃
- [ ] Coins 페이지
- [ ] 404 / Error 페이지
- [ ] 마이크로 인터랙션 전체 점검
- [ ] 모바일 전체 QA
- [ ] 다크모드 가시성 최종 확인

### Phase 5: 퍼포먼스 & SEO 최종 (2-3일)
- [ ] Core Web Vitals 측정 & 최적화
- [ ] Lighthouse 점수 확인 (목표: 95+)
- [ ] 접근성 axe 검사
- [ ] 다국어(KO) 동일 적용 확인

---

## 7. 우선순위 판단 기준

### 무조건 먼저 할 것 (퍼스트 임프레션)
1. 배경 색상 (#09090B로 교체) — **1시간 작업, 최대 효과**
2. 폰트 Geist 교체 — **2시간, 전체 분위기 변화**
3. Homepage hero 재설계 — **최고 ROI**

### 나중에 해도 되는 것
- Simulator split-layout (현재도 작동은 됨)
- DataTable (랭킹 현재도 쓸만함)

### 하지 말아야 할 것
- 기존 콘텐츠 컬렉션 손대기 (MDX 글 등)
- i18n 시스템 재설계
- URL 구조 변경 (SEO 손상)

---

## 8. 최종 체크리스트

### 디자인 품질
- [ ] 모든 텍스트 대비율 WCAG AA (4.5:1 이상)
- [ ] 모든 인터랙티브 요소 44px 최소 터치 영역
- [ ] 키보드 네비게이션 가능
- [ ] `prefers-reduced-motion` 적용

### 기술 품질
- [ ] Lighthouse Performance ≥ 95
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Lighthouse SEO ≥ 95
- [ ] 번들 크기 증가 ≤ 50KB (gzip)

### 비즈니스
- [ ] CTA 버튼 클릭률 측정 포인트 유지
- [ ] 기존 URL 구조 100% 유지 (리다이렉트 불필요)
- [ ] 한국어/영어 동시 적용

---

*다음 단계: Phase 1부터 PR 단위로 순차 진행*
