# PRUVIQ 브랜드 디자인 가이드 & 랜딩 페이지 설계

> Research Date: 2026-02-15
> 기반: 2026 최신 핀테크/SaaS/크립토 트렌드 분석
> 도메인: pruviq.com

---

## 1. 브랜드 아이덴티티

### 브랜드 이름
**PRUVIQ** (Prove + IQ, "증명하는 지능")

### 브랜드 컨셉
- **신뢰성 (Trust)**: 검증된 데이터 기반 의사결정
- **투명성 (Transparency)**: 숫자와 증거로 말하기
- **데이터 중심 (Data-Driven)**: 추측 없는 퀀트 분석
- **접근성 (Accessibility)**: 전문가 도구를 모두에게

### 톤앤매너
- **전문적이면서도 쉬운 (Professional yet Approachable)**
- 과도한 기술 용어 회피, 대신 명확한 숫자와 시각화
- "우리는 증명합니다" - 주장보다 데이터
- 친절하지만 권위 있는 목소리

---

## 2. 컬러 팔레트

> **참고**: [Octet Design - Crypto UI Color Palettes](https://octet.design/colors/user-interfaces/crypto-ui-design/)
> 크립토 플랫폼 색상 트렌드: 신뢰를 주는 블루 + 볼드한 네온 악센트 + 다크모드 최적화

### Primary Colors

| Color | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| **Primary** | `#1E40AF` (Blue 700) | `#3B82F6` (Blue 500) | CTA, Links, Key Actions |
| **Secondary** | `#7C3AED` (Violet 600) | `#8B5CF6` (Violet 500) | Accents, Premium Features |
| **Success** | `#059669` (Emerald 600) | `#10B981` (Emerald 500) | Positive Returns, Profit |
| **Warning** | `#D97706` (Amber 600) | `#F59E0B` (Amber 500) | Alerts, Warnings |
| **Error** | `#DC2626` (Red 600) | `#EF4444` (Red 500) | Losses, Errors |

### Background & Surface

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| **Base** | `#FFFFFF` | `#0F172A` (Slate 900) |
| **Surface** | `#F8FAFC` (Slate 50) | `#1E293B` (Slate 800) |
| **Elevated** | `#F1F5F9` (Slate 100) | `#334155` (Slate 700) |
| **Border** | `#E2E8F0` (Slate 200) | `#475569` (Slate 600) |

### Text

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| **Heading** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) |
| **Body** | `#334155` (Slate 700) | `#CBD5E1` (Slate 300) |
| **Muted** | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) |

### Chart Colors (Data Visualization)

```
Profit Line: #10B981 (Emerald 500)
Loss Line: #EF4444 (Red 500)
Baseline: #64748B (Slate 500)
Multi-Strategy:
  - Strategy 1: #3B82F6 (Blue 500)
  - Strategy 2: #8B5CF6 (Violet 500)
  - Strategy 3: #F59E0B (Amber 500)
  - Strategy 4: #10B981 (Emerald 500)
```

**디자인 근거**:
- Blue: 금융 신뢰성의 표준색 ([Robinhood](https://newsroom.aboutrobinhood.com/the-top-secret-robinhood-design-story/), Stripe 사용)
- Violet: 혁신과 AI를 상징 (크립토 네이티브)
- Dark Mode 기본: 크립토 플랫폼 표준 ([Binance, DefiLlama](https://defillama.com/))

---

## 3. 타이포그래피

> **참고**: [Typography Pairing for Finance (2026)](https://typ.io/tags/finance)
> 핀테크 규칙: 최대 3개 폰트, Serif (신뢰) + Sans-Serif (가독성) 조합

### Font Stack

```css
/* Heading: Serif - 신뢰감과 권위 */
--font-heading: 'Source Serif Pro', Georgia, serif;

/* Body: Sans-Serif - 가독성과 현대성 */
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Mono: 숫자와 코드 */
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

### Korean Fonts

```css
/* 한글 Heading */
--font-kr-heading: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;

/* 한글 Body */
--font-kr-body: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
```

**폰트 선택 근거**:
- **Source Serif Pro**: Google Fonts, 프로페셔널하고 숫자 가독성 우수
- **Inter**: 2026 UI 디자인 표준 ([Figma Best Fonts](https://www.figma.com/resource-library/best-fonts-for-websites/))
- **Pretendard**: 한글 웹폰트 표준, 토스/카카오페이 사용

### Type Scale (Tailwind CSS)

| Element | Class | Size (rem) | Usage |
|---------|-------|-----------|-------|
| **H1** | `text-5xl` | 3rem | Hero Heading |
| **H2** | `text-4xl` | 2.25rem | Section Title |
| **H3** | `text-2xl` | 1.5rem | Card Title |
| **Body Large** | `text-lg` | 1.125rem | Lead Paragraph |
| **Body** | `text-base` | 1rem | Default Text |
| **Small** | `text-sm` | 0.875rem | Caption, Label |
| **Numbers** | `font-mono text-lg` | 1.125rem | PnL, Stats |

### Font Weight

```
Heading: font-bold (700)
Subheading: font-semibold (600)
Body: font-normal (400)
Caption: font-medium (500)
Numbers: font-semibold (600)
```

---

## 4. 랜딩 페이지 설계

> **참고**: [SaaS Landing Page Trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
> 트렌드: 마이크로 애니메이션, 인터랙티브 데모, 스토리 기반 디자인, 스마트 네비게이션

### 페이지 구조 (8 Sections)

```
┌─────────────────────────────────────────┐
│ 1. Navigation (Sticky)                  │
├─────────────────────────────────────────┤
│ 2. Hero                                 │
├─────────────────────────────────────────┤
│ 3. Core Values (3 Cards)                │
├─────────────────────────────────────────┤
│ 4. Interactive Demo (Strategy Simulator)│
├─────────────────────────────────────────┤
│ 5. Market Context Preview               │
├─────────────────────────────────────────┤
│ 6. Trust Indicators (Numbers)           │
├─────────────────────────────────────────┤
│ 7. FAQ                                  │
├─────────────────────────────────────────┤
│ 8. Footer + Final CTA                   │
└─────────────────────────────────────────┘
```

---

### Section 1: Navigation (Sticky)

**레이아웃**:
```
┌────────────────────────────────────────────────────────┐
│ [PRUVIQ Logo]  [Features] [Pricing] [Docs]  [Sign Up] │
└────────────────────────────────────────────────────────┘
```

**스타일**:
- 높이: 64px
- 배경: Blur background (backdrop-blur-md)
- 스크롤 시 그림자 추가 (shadow-lg)
- 모바일: Hamburger Menu

**CTA**:
- Primary Button: "Sign Up" (Blue 500, 우측 정렬)
- Ghost Button: "Docs" (Transparent)

---

### Section 2: Hero

**카피 (한국어)**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  추측이 아닌, 증명된 전략으로

  암호화폐 자동매매를 시작하세요
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

서브카피:
PRUVIQ는 500+ 코인, 2년+ 데이터로 검증된 전략을
누구나 실행할 수 있도록 만듭니다.

백테스트부터 실거래까지, 모든 과정이 투명합니다.
```

**카피 (영어)**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Proven strategies, not promises.

  Start automated crypto trading today.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subheading:
PRUVIQ delivers battle-tested strategies verified
across 500+ coins and 2+ years of market data.

From backtest to live trading, every step is transparent.
```

**CTA Buttons**:
```
[Try Free Backtest →]  [View Sample Results]
  (Primary Blue)         (Ghost Secondary)
```

**Visual**:
- Right: Animated equity curve (micro-animation on scroll)
- 3D mockup: Dashboard preview with blur effect
- Gradient background: Blue → Violet subtle gradient

**레이아웃** (Desktop):
```
┌──────────────────┬──────────────────┐
│                  │                  │
│  Headline        │   [Equity Chart] │
│  Subheading      │   [Dashboard]    │
│                  │   [Mock 3D]      │
│  [CTA Buttons]   │                  │
│                  │                  │
└──────────────────┴──────────────────┘
```

**모바일**: 세로 스택, Chart 먼저 표시

---

### Section 3: Core Values (3 Cards)

**한국어**:
```
┌────────────────┬────────────────┬────────────────┐
│ 🔬 검증된 전략   │ 📊 투명한 데이터 │ ⚡ 즉시 실행 가능 │
├────────────────┼────────────────┼────────────────┤
│ 500+ 코인,     │ 모든 백테스트   │ API 연동으로    │
│ 2년+ 실제 데이터│ 결과와 파라미터 │ 10분 만에       │
│ 기반 검증      │ 100% 공개      │ 실거래 시작     │
└────────────────┴────────────────┴────────────────┘
```

**영어**:
```
┌────────────────┬────────────────┬────────────────┐
│ 🔬 Proven      │ 📊 Transparent │ ⚡ Ready to Go │
│   Strategies   │    Data        │               │
├────────────────┼────────────────┼────────────────┤
│ Verified with  │ Every backtest │ Go live in 10  │
│ 500+ coins,    │ result and     │ minutes with   │
│ 2+ years data  │ parameter open │ API connection │
└────────────────┴────────────────┴────────────────┘
```

**스타일**:
- 3-column grid (모바일: 1-column stack)
- Card: Hover시 lift effect (shadow-xl)
- Icon: 4rem 크기, Gradient background
- Padding: p-8

---

### Section 4: Interactive Demo (Strategy Simulator)

**제목**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  직접 백테스트를 실행해보세요

  Try Live Backtest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**컴포넌트**:
```
┌──────────────────────────────────────────┐
│ Strategy Selector                        │
│ [BB Squeeze v1.7.0 ▼]                    │
├──────────────────────────────────────────┤
│ Parameters:                              │
│ ├─ SL: [10%]  TP: [8%]                   │
│ ├─ Coins: [535]  Period: [2 years]       │
│ └─ Position Size: [$60]  Leverage: [5x]  │
├──────────────────────────────────────────┤
│          [▶ Run Backtest]                │
├──────────────────────────────────────────┤
│ Results:                                 │
│ ┌────────────────────────────────────┐   │
│ │ Equity Curve (Animated)            │   │
│ │ ────────────────────/\─────────    │   │
│ │                   /    \           │   │
│ │ ─────────────────/      \──────    │   │
│ └────────────────────────────────────┘   │
│                                          │
│ PnL: +103%  Sharpe: 2.43  MDD: -26.7%   │
│ Win Rate: 68.6%  Total Trades: 2,898    │
└──────────────────────────────────────────┘
```

**트렌드 반영**:
- [Interactive Product Demo](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples/) - 2026 SaaS 필수 트렌드
- 실제 백테스트 API 호출 (실시간)
- 결과 애니메이션: 숫자 카운트업, 차트 그리기 효과

---

### Section 5: Market Context Preview

**제목**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  시장 상황도 함께 제공합니다

  Market Intelligence Included
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**컴포넌트**:
```
┌────────────────────────────────────────┐
│ 📈 BTC Dominance: 59.2%                │
│ 💰 Total3/BTC Ratio: 0.42              │
│ 🔥 Funding Rate (Avg): +0.008%         │
│ 📊 Altcoin Volatility: High (42% ATR)  │
│                                        │
│ Current Regime: Altcoin Consolidation  │
│ Strategy Suggestion: SHORT ONLY ✅     │
└────────────────────────────────────────┘
```

**스타일**:
- 2-column grid (Left: Metrics, Right: Chart)
- Real-time data 표시 (WebSocket or 1min polling)
- 색상: Success (Green), Warning (Amber)

---

### Section 6: Trust Indicators (Numbers)

**한국어**:
```
┌──────────────────────────────────────────────┐
│        숫자로 증명하는 신뢰성                 │
│                                              │
│  [535]         [2+ Years]      [2,898]      │
│  검증 코인       백테스트 기간    총 거래 수   │
│                                              │
│  [68.6%]       [2.43]          [Open]       │
│  승률           Sharpe Ratio    Source Code  │
└──────────────────────────────────────────────┘
```

**영어**:
```
┌──────────────────────────────────────────────┐
│        Proven by Numbers                     │
│                                              │
│  [535]         [2+ Years]      [2,898]      │
│  Coins Tested   Backtest Period  Total Trades│
│                                              │
│  [68.6%]       [2.43]          [Open]       │
│  Win Rate      Sharpe Ratio    Source Code  │
└──────────────────────────────────────────────┘
```

**애니메이션**:
- Scroll trigger: 숫자 카운트업 애니메이션
- "Open Source Code" 링크는 GitHub로 연결

**디자인 근거**:
- [Trust through Transparency](https://www.optimalworkshop.com/blog/building-trust-through-design-for-financial-services-ux)
- DefiLlama 사례: "committed to providing accurate data without ads"

---

### Section 7: Pricing (Future)

현재는 무료 베타, 추후 Freemium 모델:

```
┌─────────────────────────────────────────┐
│ Free (Beta)                             │
│ ├─ 전략 백테스트 무제한                  │
│ ├─ 시장 컨텍스트 실시간 조회             │
│ ├─ API 연동 가이드                      │
│ └─ 커뮤니티 지원                        │
│                                         │
│ [Start Free →]                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Pro (Coming Soon)                       │
│ ├─ 전용 Discord 채널                    │
│ ├─ 월간 전략 리뷰                       │
│ ├─ 커스텀 전략 컨설팅                   │
│ └─ 우선 신규 기능 접근                  │
│                                         │
│ [Join Waitlist]                         │
└─────────────────────────────────────────┘
```

---

### Section 8: FAQ

**한국어**:
```
Q1: 백테스트와 실거래 결과가 다를 수 있나요?
A1: PRUVIQ는 백테스트 로직과 실거래 로직이 100% 동일합니다.
    슬리피지, 수수료, 타이밍까지 모두 반영합니다.

Q2: 어떤 거래소를 지원하나요?
A2: 현재 바이낸스 선물 (Binance Futures)을 지원합니다.
    추후 타 거래소 확장 예정입니다.

Q3: 자금은 얼마나 필요한가요?
A3: 최소 $3,000 권장 (포지션 $60 x 50개).
    리스크 관리를 위해 충분한 증거금이 필요합니다.

Q4: 코딩을 몰라도 사용할 수 있나요?
A4: 네, 웹 대시보드에서 클릭만으로 실행 가능합니다.
    단, API 키 설정은 필요합니다 (가이드 제공).

Q5: 오픈소스인가요?
A5: 네, 모든 전략 코드는 GitHub에 공개되어 있습니다.
    투명성이 PRUVIQ의 핵심 가치입니다.
```

**영어**:
```
Q1: Can backtest results differ from live trading?
A1: PRUVIQ ensures 100% identical logic between backtest and live.
    Slippage, fees, and timing are all included.

Q2: Which exchanges are supported?
A2: Currently Binance Futures. More exchanges coming soon.

Q3: How much capital do I need?
A3: Minimum $3,000 recommended ($60 position x 50 positions).
    Adequate margin is essential for risk management.

Q4: Do I need coding skills?
A4: No, web dashboard allows click-to-execute.
    API key setup required (guide provided).

Q5: Is it open source?
A5: Yes, all strategy code is public on GitHub.
    Transparency is core to PRUVIQ.
```

**스타일**:
- Accordion UI (닫힘/펼침)
- Hover시 배경색 변화

---

### Section 9: Footer + Final CTA

**구조**:
```
┌─────────────────────────────────────────────────┐
│          [Start Your Free Backtest →]          │
│                                                 │
│  No credit card required. No hidden costs.     │
├─────────────────────────────────────────────────┤
│ PRUVIQ                                          │
│ ├─ About                                        │
│ ├─ Docs                                         │
│ ├─ GitHub                                       │
│ ├─ Discord                                      │
│ └─ Blog                                         │
│                                                 │
│ © 2026 PRUVIQ. All rights reserved.            │
│ Terms | Privacy | Data Policy                  │
└─────────────────────────────────────────────────┘
```

**스타일**:
- 배경: Slate 900 (Dark) / Slate 100 (Light)
- 링크: Hover시 Primary Color

---

## 5. 핵심 UI 컴포넌트 스타일

### 5.1 Strategy Card (전략 카드)

```css
.strategy-card {
  background: surface;
  border: 1px solid border;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
}

.strategy-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.strategy-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.strategy-card-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-heading);
}

.strategy-card-badge {
  background: var(--color-primary);
  color: white;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.strategy-card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 4px;
}

.stat-value.positive {
  color: var(--color-success);
}

.stat-value.negative {
  color: var(--color-error);
}
```

**HTML 예시**:
```html
<div class="strategy-card">
  <div class="strategy-card-header">
    <h3 class="strategy-card-title">BB Squeeze v1.7.0</h3>
    <span class="strategy-card-badge">LIVE</span>
  </div>
  <p class="text-muted">SHORT-only Bollinger Band squeeze strategy</p>

  <div class="strategy-card-stats">
    <div class="stat-item">
      <div class="stat-label">Win Rate</div>
      <div class="stat-value positive">68.6%</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Sharpe</div>
      <div class="stat-value positive">2.43</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">MDD</div>
      <div class="stat-value negative">-26.7%</div>
    </div>
  </div>
</div>
```

---

### 5.2 Equity Curve Chart (에쿼티 커브)

**라이브러리**: [Chart.js](https://www.chartjs.org/) or [Recharts](https://recharts.org/)

```javascript
// Chart.js 설정 예시
const equityCurveConfig = {
  type: 'line',
  data: {
    labels: dates, // ['2024-01-01', '2024-01-02', ...]
    datasets: [
      {
        label: 'Portfolio Value',
        data: equityValues, // [10000, 10050, 10120, ...]
        borderColor: '#10B981', // Emerald 500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4, // Smooth curve
        pointRadius: 0, // No dots
        pointHoverRadius: 6
      },
      {
        label: 'Buy & Hold',
        data: buyHoldValues,
        borderColor: '#64748B', // Slate 500
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'Inter',
            size: 12
          },
          color: '#64748B'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#CBD5E1',
        borderColor: '#475569',
        borderWidth: 1,
        padding: 12,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: {
          color: '#334155',
          drawBorder: false
        },
        ticks: {
          color: '#94A3B8',
          font: {
            family: 'Inter',
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: '#334155',
          drawBorder: false
        },
        ticks: {
          color: '#94A3B8',
          font: {
            family: 'JetBrains Mono',
            size: 11
          },
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  }
};
```

**스타일 가이드**:
- Height: 400px (Desktop), 280px (Mobile)
- Gradient Fill: Success color with 0.1 opacity
- Hover: Crosshair cursor + tooltip
- Animation: Ease-in-out, 1.5s duration

---

### 5.3 Performance Table (성과 테이블)

```css
.performance-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: 8px;
  overflow: hidden;
}

.performance-table thead {
  background: var(--elevated);
}

.performance-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.performance-table td {
  padding: 16px;
  border-top: 1px solid var(--border);
  font-size: 0.875rem;
  color: var(--text-body);
}

.performance-table .coin-symbol {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-heading);
}

.performance-table .pnl-value {
  font-family: var(--font-mono);
  font-weight: 600;
}

.performance-table .pnl-positive {
  color: var(--color-success);
}

.performance-table .pnl-negative {
  color: var(--color-error);
}

.performance-table tr:hover {
  background: var(--elevated);
}
```

**HTML 예시**:
```html
<table class="performance-table">
  <thead>
    <tr>
      <th>Coin</th>
      <th>Trades</th>
      <th>Win Rate</th>
      <th>PnL</th>
      <th>PnL %</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="coin-symbol">BTCUSDT</td>
      <td>42</td>
      <td>71.4%</td>
      <td class="pnl-value pnl-positive">+$1,234</td>
      <td class="pnl-value pnl-positive">+12.3%</td>
    </tr>
    <tr>
      <td class="coin-symbol">ETHUSDT</td>
      <td>38</td>
      <td>65.8%</td>
      <td class="pnl-value pnl-positive">+$892</td>
      <td class="pnl-value pnl-positive">+8.9%</td>
    </tr>
    <!-- More rows -->
  </tbody>
</table>
```

---

### 5.4 Button Styles (버튼)

```css
/* Primary CTA */
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.btn-primary:hover {
  background: #2563EB; /* Blue 600 */
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Secondary (Ghost) */
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  border: 2px solid var(--color-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(59, 130, 246, 0.1);
}

/* Icon Button */
.btn-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-icon svg {
  width: 20px;
  height: 20px;
}
```

**HTML 예시**:
```html
<button class="btn-primary btn-icon">
  Start Free Backtest
  <svg><!-- Arrow icon --></svg>
</button>

<button class="btn-secondary">
  View Docs
</button>
```

---

### 5.5 Navigation Bar (네비게이션)

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 64px;
  background: rgba(15, 23, 42, 0.8); /* Slate 900 with opacity */
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  transition: all 0.3s ease;
}

.navbar.scrolled {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.navbar-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-logo {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
}

.navbar-links {
  display: flex;
  gap: 32px;
  align-items: center;
}

.navbar-link {
  color: var(--text-body);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.navbar-link:hover {
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .navbar-links {
    display: none;
  }

  .navbar-mobile-menu {
    display: block;
  }
}
```

---

## 6. 기술 스택 권장

### Frontend Framework
```
Astro 5.x + Tailwind CSS 4.x
```

**장점**:
- 정적 사이트 생성 (SSG) → 초고속 로딩
- 섬 아키텍처 (Island Architecture) → 필요한 부분만 JS
- Tailwind CSS 기본 지원
- TypeScript 기본 지원

**참고**: [Astro + Tailwind Dark Mode Guide](https://namoku.dev/blog/darkmode-tailwind-astro/)

### UI Component Libraries (Optional)

```
- Headless UI: Accessible components (Menu, Dialog, etc.)
- Radix UI: Primitives for complex components
- Lucide Icons: Modern icon set
```

### Charts & Visualization

```
- Chart.js: 가볍고 빠른 차트 라이브러리
- Recharts: React 기반 (Astro Island로 사용)
- D3.js: 커스텀 시각화 (Advanced)
```

### Animation

```
- Framer Motion: Micro-animations
- GSAP: Scroll-triggered animations
- AOS (Animate On Scroll): 간단한 스크롤 애니메이션
```

**트렌드**: [Micro-animations in 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples/)

### Dark Mode Implementation

```javascript
// tailwind.config.mjs
export default {
  darkMode: 'class', // or 'media'
  // ...
}

// Add to <head> (prevent FOUC)
<script is:inline>
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.add(theme);
</script>

// Toggle component
<button id="theme-toggle">
  <svg class="sun-icon">...</svg>
  <svg class="moon-icon">...</svg>
</button>

<script>
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('click', () => {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.remove(current);
    document.documentElement.classList.add(next);
    localStorage.setItem('theme', next);
  });
</script>
```

**참고**: [Tailwind Dark Mode Official Guide](https://tailwindcss.com/docs/dark-mode)

---

## 7. 성능 목표 (Lighthouse)

```
Performance: 95+
Accessibility: 100
Best Practices: 100
SEO: 100
```

### 최적화 체크리스트

- [ ] Image Optimization (WebP, AVIF)
- [ ] Lazy Loading (images, charts)
- [ ] Code Splitting (Astro Islands)
- [ ] Font Preloading (Inter, Source Serif Pro)
- [ ] Critical CSS Inlining
- [ ] Minification (HTML, CSS, JS)
- [ ] Gzip/Brotli Compression
- [ ] CDN (Cloudflare, Vercel Edge)

---

## 8. 참고 사례 (Best Practices)

### 핀테크 랜딩 페이지

| 사이트 | 강점 | PRUVIQ 적용 |
|--------|------|------------|
| [Stripe](https://stripe.com) | 간결한 카피, 명확한 CTA | Hero 섹션 참고 |
| [Robinhood](https://robinhood.com) | 친근한 디자인, 접근성 | 톤앤매너 참고 |
| [DefiLlama](https://defillama.com/) | 데이터 투명성, 다크모드 | Trust Indicators 참고 |
| [Dune Analytics](https://dune.com) | 인터랙티브 데모 | 백테스트 시뮬레이터 참고 |

### 한국 핀테크

| 사이트 | 강점 | PRUVIQ 적용 |
|--------|------|------------|
| 토스 | 쉬운 카피, 한글 타이포 | 한국어 버전 참고 |
| 카카오페이 증권 | 숫자 중심 신뢰성 | Trust Indicators 참고 |

---

## 9. 디자인 철학 (Design Principles)

### 1. Data Serenity (데이터 평온)
> "시각적 미니멀리즘 + 완전한 기능적 명확성"
> 출처: [Dashboard Design 2026 Trends](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)

- 복잡한 데이터를 단순하게 표현
- 숫자는 굵게, 레이블은 얇게
- 공백을 두려워하지 않기

### 2. Narrative Metrics (설명하는 숫자)
> "숫자 + 인간이 읽을 수 있는 설명"

예시:
```
❌ Sharpe Ratio: 2.43
✅ Sharpe Ratio: 2.43 (Excellent risk-adjusted returns)
```

### 3. Trust UX (신뢰 UX)
> "인터페이스가 신뢰할 수 있게 느껴지는 이유: 차분하고, 명확하고, 빠르다"
> 출처: [Building Trust Through Design](https://www.optimalworkshop.com/blog/building-trust-through-design-for-financial-services-ux)

- 일관된 타이포그래피 → 보안을 속삭임
- 신중한 색상 → 무결성을 암시
- 예측 가능한 인터랙션 → 인간적이고 일관됨

### 4. Progressive Disclosure (점진적 공개)
- 처음엔 간단히, 클릭하면 상세히
- FAQ는 Accordion으로
- 차트는 기본 → Hover시 툴팁

---

## 10. 모바일 대응 (Responsive Design)

### Breakpoints (Tailwind CSS)

```
sm:  640px  (Mobile landscape, small tablet)
md:  768px  (Tablet)
lg:  1024px (Desktop)
xl:  1280px (Large desktop)
2xl: 1536px (Extra large desktop)
```

### 모바일 우선 변경사항

| 섹션 | Desktop | Mobile |
|------|---------|--------|
| Hero | 2-column (Text + Chart) | Stack (Chart 위, Text 아래) |
| Core Values | 3-column grid | 1-column stack |
| Demo | Wide layout | Full-width, 세로 스크롤 |
| Navigation | Horizontal links | Hamburger menu |
| Table | Full columns | Horizontal scroll or Card view |

### 모바일 폰트 크기

```css
/* Desktop */
h1 { font-size: 3rem; }    /* 48px */
h2 { font-size: 2.25rem; } /* 36px */
body { font-size: 1rem; }  /* 16px */

/* Mobile */
@media (max-width: 768px) {
  h1 { font-size: 2rem; }    /* 32px */
  h2 { font-size: 1.5rem; }  /* 24px */
  body { font-size: 0.875rem; } /* 14px */
}
```

---

## 11. 접근성 (Accessibility)

### WCAG 2.1 AA 준수

- [ ] Color Contrast Ratio >= 4.5:1 (Text)
- [ ] Color Contrast Ratio >= 3:1 (UI Components)
- [ ] Keyboard Navigation (Tab, Enter, Esc)
- [ ] ARIA Labels for icons and buttons
- [ ] Alt text for images
- [ ] Focus Indicators (outline, ring)
- [ ] Skip to main content link

### 다크모드 접근성

```css
/* Light Mode Contrast */
--text-on-primary: #FFFFFF; /* White on Blue 700 = 7.5:1 ✅ */

/* Dark Mode Contrast */
--text-on-primary: #F8FAFC; /* Slate 50 on Blue 500 = 8.2:1 ✅ */
```

**도구**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 12. SEO 최적화

### Meta Tags

```html
<title>PRUVIQ - Proven Crypto Trading Strategies with Data</title>
<meta name="description" content="Backtest crypto strategies across 500+ coins, 2+ years of data. Transparent, verified, ready to deploy. Start free today.">
<meta name="keywords" content="crypto trading, backtest, algorithmic trading, quant, bitcoin, binance">

<!-- Open Graph -->
<meta property="og:title" content="PRUVIQ - Proven Crypto Trading Strategies">
<meta property="og:description" content="Transparent crypto trading with 500+ coins verified">
<meta property="og:image" content="https://pruviq.com/og-image.png">
<meta property="og:url" content="https://pruviq.com">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="PRUVIQ - Proven Crypto Trading">
<meta name="twitter:description" content="Backtest strategies with real data">
<meta name="twitter:image" content="https://pruviq.com/twitter-card.png">
```

### Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "PRUVIQ",
  "applicationCategory": "FinanceApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "127"
  }
}
```

---

## 13. 다음 단계 (Next Steps)

### Phase 1: 디자인 시스템 구축 (1주)
- [ ] Tailwind config 설정 (색상, 폰트, spacing)
- [ ] 기본 컴포넌트 라이브러리 (Button, Card, Input)
- [ ] 다크모드 토글 구현
- [ ] Figma/Sketch 디자인 파일 생성 (Optional)

### Phase 2: 랜딩 페이지 개발 (2주)
- [ ] Hero 섹션 + CTA
- [ ] Core Values 카드
- [ ] Interactive Demo (백테스트 시뮬레이터)
- [ ] FAQ + Footer

### Phase 3: 성능 최적화 (1주)
- [ ] Lighthouse 점수 95+ 달성
- [ ] 이미지 최적화 (WebP, lazy loading)
- [ ] SEO 메타 태그 추가
- [ ] Analytics 연동 (Google Analytics or Plausible)

### Phase 4: A/B 테스트 (진행 중)
- [ ] Hero 카피 변형 테스트
- [ ] CTA 버튼 색상/문구 테스트
- [ ] Demo 위치 변경 테스트 (섹션 3 vs 섹션 4)

---

## 14. 리소스 (Resources)

### 디자인 인스피레이션
- [SaaS Landing Page Examples](https://www.landingfolio.com/inspiration/landing-page/fintech)
- [Dribbble: Crypto UI](https://dribbble.com/tags/crypto)
- [Behance: Fintech Design](https://www.behance.net/search/projects?search=fintech)

### UI Kits & Templates
- [AstroWind](https://github.com/arthelokyo/astrowind) - Astro + Tailwind 무료 템플릿
- [Tailwind UI](https://tailwindui.com/) - 공식 컴포넌트 라이브러리 (유료)
- [Flowbite](https://flowbite.com/) - Tailwind 기반 무료 컴포넌트

### 학습 자료
- [Astro Docs](https://docs.astro.build/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Stripe Atlas: Landing Page Copy](https://stripe.com/guides/atlas/landing-page-copy)

---

## Sources

### SaaS & Landing Page Design Trends
- [10 SaaS Landing Page Trends for 2026 (with Real Examples)](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [Fintech and Finance Web Design Trends 2026](https://www.vezadigital.com/post/fintech-web-design-trends)
- [Best Dashboard Design Examples for 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [36 Best FinTech SaaS Landing Pages in 2026](https://www.saasframe.io/landing-page-examples/fintech)

### Design Best Practices
- [Robinhood Design Story](https://newsroom.aboutrobinhood.com/the-top-secret-robinhood-design-story/)
- [Stripe Payment Page Best Practices](https://stripe.com/resources/more/payment-page-template-best-practices)
- [Building Trust Through Design for Financial Services](https://www.optimalworkshop.com/blog/building-trust-through-design-for-financial-services-ux)

### Color & Typography
- [Best 33 Crypto UI Design Color Palettes](https://octet.design/colors/user-interfaces/crypto-ui-design/)
- [Typography Pairing for Finance](https://typ.io/tags/finance)
- [24 Best Fonts for Websites in 2026](https://www.figma.com/resource-library/best-fonts-for-websites/)
- [40 Best Google Fonts 2026](https://www.typewolf.com/google-fonts)

### Crypto Dashboard Examples
- [DefiLlama - DeFi Dashboard](https://defillama.com/)
- [Dune Analytics](https://dune.com/home)

### Korean Fintech
- [Top 15 Fintech Startups in South Korea to Watch](https://www.innreg.com/blog/top-fintech-startups-in-south-korea)
- [South Korea's KakaoPay & Toss: How Digital Wallets Are Dominating](https://www.transfi.com/blog/south-koreas-kakaopay-toss-how-digital-wallets-are-dominating)

### Technical Implementation
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Interactive Dark Mode with Tailwind and Astro](https://namoku.dev/blog/darkmode-tailwind-astro/)
- [20 Best Free Tailwind CSS Landing Page Templates 2026](https://adminlte.io/blog/tailwind-landing-page-templates/)

---

## 결론

PRUVIQ 브랜드는 **신뢰성, 투명성, 데이터 중심**이라는 핵심 가치를 시각적으로 표현해야 합니다.

- **컬러**: 신뢰의 블루 + 혁신의 바이올렛 + 다크모드 기본
- **타이포**: 신뢰의 Serif Heading + 가독성의 Sans-Serif Body
- **레이아웃**: 인터랙티브 데모 중심 + 숫자로 증명하는 Trust Indicators
- **기술**: Astro + Tailwind로 빠르고 접근성 높은 사이트

2026년 핀테크/SaaS 트렌드를 반영하여, 마이크로 애니메이션과 인터랙티브 요소로 사용자 경험을 극대화하되, 성능(Lighthouse 95+)과 접근성(WCAG AA)을 절대 희생하지 않습니다.

**다음 단계**: Figma로 프로토타입 제작 → Astro로 구현 → A/B 테스트
