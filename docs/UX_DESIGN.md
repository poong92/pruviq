# PRUVIQ UX/프론트엔드 아키텍처 설계

> Research Date: 2026-02-15
> Status: RESEARCH COMPLETE
> Confidence: HIGH (실제 경쟁사 분석 기반)

---

## 목차
1. [경쟁사 UX 분석](#1-경쟁사-ux-분석)
2. [PRUVIQ 핵심 화면 설계](#2-pruviq-핵심-화면-설계)
3. [기술 스택 권장](#3-기술-스택-권장)
4. [사용자 플로우](#4-사용자-플로우)
5. [데이터 시각화 전략](#5-데이터-시각화-전략)
6. [모바일 대응 전략](#6-모바일-대응-전략)
7. [성능 최적화](#7-성능-최적화)
8. [구현 우선순위](#8-구현-우선순위)

---

## 1. 경쟁사 UX 분석

### 1.1 TradingView (차트 + 백테스트 UI)

#### 강점
- **Strategy Tester 패널**: 차트 하단에 고정되어 빠른 접근 가능
- **핵심 지표 즉시 표시**: Net Profit, Total Trades, Win Rate, Sharpe Ratio 등
- **Equity Curve 시각화**: 녹색(수익)/빨간색(손실) 구간으로 직관적 표시
- **무료 플랜 제공**: 기본 백테스트 기능을 무료로 사용 가능
- **Bar Replay + Strategy Tester**: 수동 테스트와 자동 백테스트 병행 가능

#### 약점
- 무료 플랜의 indicator/alert 제한
- Pine Script 학습 곡선
- 크립토 전용 기능 부족 (전통 금융 중심)

#### 출처
- [How to Use TradingView Strategy Tester Full Tutorial (2026)](https://chartwisehub.com/tradingview-strategy-tester/)
- [How to Backtest on TradingView: The Complete 2026 Guide](https://pineify.app/resources/blog/how-to-backtest-on-tradingview-comprehensive-2025-guide)

---

### 1.2 CoinGlass (파생상품 데이터 대시보드)

#### 강점
- **다차원 데이터 통합**: 파생상품, 옵션, 현물, Order Flow, Liquidation 히트맵 등
- **실시간 가격 + 변동률**: 색상 코딩으로 가격 움직임 직관적 표시
- **고도로 커스터마이징 가능**: 사용자가 대시보드 모듈을 자유롭게 배치/숨김
- **히트맵 시각화**: 거래 세션별 파생상품 동향을 히트맵으로 표시
- **Open Interest + Liquidation**: 레버리지 수준과 청산 리스크 한눈에 파악

#### 약점
- 전략 백테스트 기능 없음 (데이터 제공만)
- 초보자에게는 정보 과부하 가능성

#### 출처
- [CoinGlass - Crypto Market Data](https://www.coinglass.com/)
- [CoinGlass Professional Platform Analysis](https://dapp.expert/analytics/coinglass-professional-platform-for-analyzing-cryptocurrency-derivatives)

---

### 1.3 3Commas (봇 설정 UI)

#### 강점
- **3가지 난이도 봇**: GORDON (보수적/중간/공격적), Wizard (초보자), Advanced (전문가)
- **시각적 설정**: 복잡한 코드 없이 클릭/슬라이더로 봇 설정
- **모바일 최적화**: 작은 화면에서도 설정 변경 가능
- **Take Profit + Trailing Stop**: 최대 4개 TP 목표 + 트레일링 스탑 설정
- **대시보드 중심**: 거래 관리, 거래소 연결, 봇 생성, 포트폴리오 통계를 한 곳에서

#### 약점
- 백테스트 기능 제한적
- 실시간 시장 컨텍스트 부족

#### 출처
- [DCA Bot: Interface and Main Settings](https://help.3commas.io/en/articles/3108940-dca-bot-interface-and-main-settings)
- [Dashboard & the 3Commas User Interface](https://help.3commas.io/en/articles/3108945-dashboard-the-3commas-user-interface)

---

### 1.4 Shrimpy (포트폴리오 관리 UI)

#### 강점
- **통합 포트폴리오 추적**: 여러 거래소 잔고를 한 대시보드에서 확인
- **자동 리밸런싱**: 사용자 설정 비율에 맞춰 자동 거래
- **소셜 트레이딩**: 다른 사용자의 포트폴리오 전략 복사 가능
- **P&L + 세금 리포트**: 통합 손익 계산 및 세금 보고 준비

#### 약점
- 모바일 앱 없음 (반응형 웹만 제공)
- 전략 백테스트 기능 부재

#### 출처
- [Shrimpy Review: Crypto Portfolio Management](https://coincodecap.com/shrimpy-crypto-trading-bot-review)
- [Shrimpy: Crypto Portfolio Management](https://www.shrimpy.io/)

---

### 1.5 경쟁사 분석 종합

| 플랫폼 | 강점 | 약점 | PRUVIQ에 적용할 점 |
|--------|------|------|-------------------|
| **TradingView** | 차트+백테스트 통합, Equity Curve | 크립토 전용 기능 부족 | 백테스트 결과를 차트와 함께 표시 |
| **CoinGlass** | 다차원 데이터, 커스터마이징 | 전략 백테스트 없음 | 시장 컨텍스트 데이터를 전략 성과와 연결 |
| **3Commas** | 시각적 봇 설정, 난이도별 UI | 백테스트 제한적 | 파라미터 조정을 슬라이더/드롭다운으로 단순화 |
| **Shrimpy** | 통합 대시보드, 자동 리밸런싱 | 모바일 앱 없음 | 여러 전략/코인 성과를 한 대시보드에 통합 |

---

## 2. PRUVIQ 핵심 화면 설계

### 2.1 전략 선택 페이지 (Strategy Explorer)

#### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  PRUVIQ Logo    [검색창]         [Free | Pro]   [@username] │
├─────────────────────────────────────────────────────────────┤
│  필터 사이드바  │  전략 카드 그리드                          │
│  ─────────────  │  ────────────────────────────────         │
│  ☑ BB Squeeze   │  ┌─────────────┐  ┌─────────────┐        │
│  ☐ RSI Mean Rev │  │ BB Squeeze  │  │ Momentum    │        │
│  ☐ Breakout     │  │ SHORT       │  │ LONG        │        │
│  ☐ Grid         │  │             │  │             │        │
│                 │  │ Win: 68.6%  │  │ Win: 52.3%  │        │
│  거래소:         │  │ PF: 2.22    │  │ PF: 1.15    │        │
│  ☑ Binance      │  │ MDD: -26.7% │  │ MDD: -18.2% │        │
│  ☐ OKX          │  │             │  │             │        │
│                 │  │ [Simulate] │  │ [Simulate] │        │
│  마켓:           │  └─────────────┘  └─────────────┘        │
│  ☑ USDT         │                                           │
│  ☐ BUSD         │  (더 많은 전략 카드...)                     │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 요소
- **전략 카드**: 핵심 지표 (Win Rate, PF, MDD) 즉시 표시
- **필터링**: 거래소, 마켓, 전략 타입별 실시간 필터
- **CTA 버튼**: "Simulate" 버튼으로 다음 단계 유도
- **색상 코딩**:
  - Win Rate: 60% 이상 = 녹색, 50-60% = 노란색, 50% 미만 = 빨간색
  - PF: 2.0 이상 = 녹색, 1.5-2.0 = 노란색, 1.5 미만 = 빨간색

#### 참고
- TradingView의 Strategy Tester 핵심 지표 즉시 표시 방식
- 3Commas의 난이도별 봇 구분 UI

---

### 2.2 파라미터 조정 페이지 (Strategy Customizer)

#### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  < 뒤로     BB Squeeze SHORT - 파라미터 조정                  │
├─────────────────────────────────────────────────────────────┤
│  설정 패널                │  실시간 프리뷰                     │
│  ──────────────────────  │  ─────────────────────────────    │
│  Stop Loss: [====|====] │  현재 설정 결과:                   │
│             5%     15%  │                                    │
│             (현재: 10%) │  Win Rate: 68.6%                   │
│                         │  Profit Factor: 2.22               │
│  Take Profit: [==|====] │  Max Drawdown: -26.7%              │
│               4%    12% │  Total Trades: 2,898               │
│               (현재: 8%)│                                    │
│                         │  [에쿼티 커브 미니 차트]            │
│  코인 수: [===|=======] │                                    │
│           100     600   │                                    │
│           (현재: 535)   │                                    │
│                         │                                    │
│  시간 필터:              │                                    │
│  ☑ 02:00 UTC           │                                    │
│  ☑ 03:00 UTC           │                                    │
│  ☐ 08:00 UTC           │                                    │
│  ...                    │                                    │
│                         │                                    │
│  [기본값 복원] [Run Simulation >]                            │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 요소
- **슬라이더**: SL, TP, 코인 수 등을 시각적으로 조정
- **실시간 프리뷰**: 파라미터 변경 시 예상 결과 즉시 표시 (클라이언트 사이드 계산 OR 캐시된 시뮬레이션 결과)
- **체크박스**: 시간 필터 등 on/off 설정
- **기본값 복원**: 검증된 설정으로 빠르게 돌아가기

#### 참고
- 3Commas의 슬라이더 기반 봇 설정
- TradingView의 파라미터 입력 UI

---

### 2.3 결과 대시보드 (Simulation Results)

#### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  < 뒤로     BB Squeeze SHORT - 시뮬레이션 결과                │
├─────────────────────────────────────────────────────────────┤
│  핵심 지표 카드                                              │
│  ───────────────────────────────────────────────────────    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Win Rate│ │  PF     │ │  MDD    │ │ Trades  │          │
│  │ 68.6%   │ │  2.22   │ │ -26.7%  │ │ 2,898   │          │
│  │ ▲ +2.1% │ │ ▲ +0.15 │ │ ▼ -1.2% │ │         │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  에쿼티 커브                                                 │
│  ────────────────────────────────────────────────────────  │
│  [Lightweight Charts: 2년+ 에쿼티 커브, 시장 이벤트 오버레이]│
│                                                             │
│  코인별 성과 히트맵                                          │
│  ────────────────────────────────────────────────────────  │
│  [히트맵: 각 코인의 PnL을 색상으로 표시, 클릭 시 상세 보기]  │
│                                                             │
│  기간별 비교                                                 │
│  ────────────────────────────────────────────────────────  │
│  [Bar Chart: 월별/분기별 수익률 비교]                        │
│                                                             │
│  [시장 컨텍스트 보기 >]  [전략 수정]  [다른 전략 비교]       │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 요소
- **지표 카드**: Win Rate, PF, MDD, Total Trades를 카드 형식으로 즉시 표시
  - 이전 시뮬레이션 대비 변화량 표시 (▲/▼)
- **Equity Curve**: TradingView Lightweight Charts로 구현
  - 시장 이벤트 (BTC 급락, 숏스퀴즈 등)를 annotation으로 표시
- **코인별 히트맵**: Finviz/TradingView 스타일 히트맵
  - 셀 크기 = 거래 수, 셀 색상 = PnL (녹색/빨간색)
- **기간별 비교**: ApexCharts Bar Chart
  - 월별/분기별 수익률을 막대 그래프로 시각화

#### 참고
- TradingView의 Equity Curve + 핵심 지표 표시
- CoinGlass의 히트맵 시각화
- Finviz의 Stock Heatmap

---

### 2.4 시장 컨텍스트 타임라인 (Market Context Timeline)

#### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  < 뒤로     시장 컨텍스트 타임라인                            │
├─────────────────────────────────────────────────────────────┤
│  [날짜 선택기: 2024-01-01 ~ 2026-02-15]                      │
│                                                             │
│  타임라인                                                    │
│  ────────────────────────────────────────────────────────  │
│  2026-02-07 (목)  BTC 숏스퀴즈 $233M 청산                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 이벤트: 숏스퀴즈 + Fear Index 6 (극단적 공포)             │
│  │ BTC: $60K → $72K (+20%)                                │
│  │                                                        │
│  │ BB Squeeze SHORT 성과:                                 │
│  │  - Daily PnL: -$233 (-7.8%)                           │
│  │  - SL 히트: 16건                                       │
│  │  - 원인: 숏 포지션이 급등장에서 손실                    │
│  │                                                        │
│  │ [에쿼티 커브 미니뷰: 해당 날짜 하이라이트]              │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  2026-01-14 (화)  알트코인 전반 급락                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 이벤트: BTC.D 상승 (알트 자금 이탈)                     │
│  │                                                        │
│  │ BB Squeeze SHORT 성과:                                 │
│  │  - Daily PnL: +$415 (+14.2%)                          │
│  │  - 승률: 78.3%                                         │
│  │  - 원인: 변동성 확대로 SHORT 시그널 증가               │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  (더 많은 이벤트...)                                         │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 요소
- **날짜 선택기**: 특정 기간의 시장 이벤트만 필터링
- **타임라인 카드**: 각 이벤트별로 카드 형식으로 표시
  - 이벤트 설명 (BTC 가격 변동, 뉴스, 청산 데이터)
  - 전략 성과 (Daily PnL, 승률, SL/TP 비율)
  - 원인 분석 (왜 이날 수익/손실이 발생했는지)
- **미니 차트**: 각 카드에 해당 날짜의 에쿼티 커브 미니뷰

#### 참고
- CoinGlass의 시장 데이터 + 이벤트 연결
- AutoTrader의 Daily Journal 구조 (docs/history/daily/*.md)

---

### 2.5 코인 상세 페이지 (Coin Detail)

#### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  < 뒤로     BTCUSDT - 전략별 성과 비교                        │
├─────────────────────────────────────────────────────────────┤
│  코인 정보                                                   │
│  ────────────────────────────────────────────────────────  │
│  현재가: $66,980  24H 변동: -2.3%  거래량: $1.2B             │
│                                                             │
│  전략별 성과 비교                                             │
│  ────────────────────────────────────────────────────────  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ BB Squeeze  │ │ Momentum    │ │ Grid Bot    │          │
│  │ SHORT       │ │ LONG        │ │             │          │
│  │             │ │             │ │             │          │
│  │ Win: 72.1%  │ │ Win: 48.3%  │ │ Win: 55.6%  │          │
│  │ PF: 2.45    │ │ PF: 0.98    │ │ PF: 1.23    │          │
│  │ Trades: 156 │ │ Trades: 89  │ │ Trades: 234 │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  거래 히스토리 (BB Squeeze SHORT)                            │
│  ────────────────────────────────────────────────────────  │
│  [테이블: 날짜, 진입가, 청산가, PnL, 청산 이유 (TP/SL/TO)]   │
│                                                             │
│  [다른 코인 보기]                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 요소
- **코인 정보**: 현재가, 24H 변동률, 거래량 (실시간 API 연동 OR 정적 스냅샷)
- **전략별 성과 비교**: 같은 코인에 대한 여러 전략의 성과 비교
- **거래 히스토리 테이블**: 개별 거래 내역 (AutoTrader trades CSV와 유사)

---

## 3. 기술 스택 권장

### 3.1 프레임워크 비교

| 프레임워크 | 장점 | 단점 | 권장 사용처 |
|-----------|------|------|------------|
| **Astro** | - 95% 적은 JS (Next.js 대비)<br>- 블로그/콘텐츠 사이트 2배 빠름<br>- Islands Architecture<br>- 35KB 번들 크기 | - 인터랙티브한 앱에는 부적합<br>- SSR 지원 제한적 | 마케팅 페이지, 블로그, 정적 콘텐츠 |
| **Next.js** | - React Server Components<br>- App Router (streaming)<br>- 풍부한 생태계<br>- Vercel 배포 최적화 | - 번들 크기 큼<br>- 정적 사이트에는 과한 기능 | 대시보드, 인터랙티브 앱 |
| **Nuxt.js** | - Vue 팀에게 친숙<br>- 80% 빠른 HMR (Next.js 대비)<br>- Nitro 엔진 (35% 빠른 TTFB)<br>- 1/3 적은 보일러플레이트 | - React 생태계보다 작음 | Vue 선호 팀, 멀티 브랜드 배포 |

#### PRUVIQ 권장: **Next.js 14+ (App Router)**

**이유:**
1. **대시보드 중심 앱**: PRUVIQ는 정적 콘텐츠가 아닌 인터랙티브 데이터 시각화 중심
2. **React 생태계**: 차트 라이브러리 (Lightweight Charts, ApexCharts)가 React 지원 우선
3. **SSG + SSR 혼합**:
   - 전략 카드 페이지 = SSG (빌드 시 생성)
   - 시뮬레이션 결과 = SSR (사용자 파라미터 기반)
4. **Edge Runtime**: Vercel Edge Functions로 빠른 API 응답 (특히 글로벌 사용자)
5. **React Server Components**: 500+ 코인 데이터를 서버에서 처리 후 클라이언트에 전달 (번들 크기 감소)

**대안:**
- **Astro**: 마케팅 페이지 (landing page, about, pricing)만 별도로 구축
- **Nuxt.js**: Vue 팀이거나 멀티 리전 배포가 중요한 경우

#### 출처
- [Nuxt vs Next.js vs Astro vs SvelteKit: The 2026 Frontend Framework Showdown](https://www.nunuqs.com/blog/nuxt-vs-next-js-vs-astro-vs-sveltekit-2026-frontend-framework-showdown)
- [Astro vs Next.js: Which Framework Should You Use in 2026?](https://pagepro.co/blog/astro-nextjs/)

---

### 3.2 차트 라이브러리 비교

| 라이브러리 | 장점 | 단점 | 권장 사용처 |
|-----------|------|------|------------|
| **Lightweight Charts** | - 35KB 초소량<br>- 10,000+ 포인트 100ms 렌더링<br>- 금융 차트 전문 (캔들스틱, OHLC)<br>- Data Conflation (대용량 최적화)<br>- TradingView 제작 | - 금융 차트만 지원<br>- 커스터마이징 제한적 | Equity Curve, 가격 차트 |
| **ApexCharts** | - 대용량 데이터 최적화<br>- 부드러운 애니메이션<br>- Annotation 기능 (이벤트 표시)<br>- 다양한 차트 타입<br>- 무료 오픈소스 | - 번들 크기 큼 (Lightweight 대비) | 바차트, 히트맵, 다양한 시각화 |
| **Chart.js** | - 간단한 API<br>- Canvas 기반 (모바일 최적화)<br>- 가벼움 | - 대용량 데이터 성능 저하<br>- 고급 기능 부족 | 간단한 차트 (파이, 도넛) |

#### PRUVIQ 권장: **Lightweight Charts + ApexCharts 혼합**

**사용 분리:**
- **Lightweight Charts**: Equity Curve, 가격 차트 (금융 데이터 전문)
- **ApexCharts**:
  - 코인별 성과 히트맵
  - 월별/분기별 바차트
  - 시장 이벤트 Annotation (에쿼티 커브에 오버레이)

**이유:**
- Lightweight Charts는 에쿼티 커브 렌더링에 최적화 (10,000+ 데이터 포인트, 2년+ 기간)
- ApexCharts는 히트맵, 바차트 등 다양한 시각화 지원
- 둘 다 React 지원 (next.js 호환)

#### 출처
- [TradingView Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [6 Best JavaScript Charting Libraries for Dashboards in 2026](https://embeddable.com/blog/javascript-charting-libraries)

---

### 3.3 UI 컴포넌트 라이브러리

#### 권장: **shadcn/ui (Tailwind CSS 기반)**

**이유:**
1. **복사-붙여넣기 방식**: npm 의존성 없이 직접 소유 (커스터마이징 자유)
2. **Tailwind CSS**: 빠른 스타일링 + 일관된 디자인 시스템
3. **Radix UI 기반**: 접근성 (a11y) 기본 탑재
4. **트렌드**: 2026년 가장 인기 있는 React UI 라이브러리

**대안:**
- **Ant Design**: 기업용 대시보드에 적합하지만 번들 크기 큼
- **MUI**: Material Design이 필요한 경우

---

### 3.4 상태 관리

#### 권장: **Zustand + React Query**

**Zustand:**
- 간단한 전역 상태 (사용자 설정, 선택된 전략, 파라미터)
- Redux보다 보일러플레이트 90% 적음

**React Query:**
- 서버 데이터 캐싱 (시뮬레이션 결과, 코인 가격)
- 자동 refetch, stale-while-revalidate

---

### 3.5 데이터베이스/백엔드

#### 권장: **Supabase (PostgreSQL + Edge Functions)**

**이유:**
1. **PostgreSQL**: 500+ 코인, 수백만 거래 데이터 저장
2. **Row-Level Security**: 사용자별 데이터 격리 (Free vs Pro)
3. **Edge Functions**: 시뮬레이션 실행 (Python/Node.js)
4. **실시간 Subscriptions**: 시뮬레이션 진행 상황 실시간 업데이트

**대안:**
- **Planetscale**: MySQL 기반, 브랜치 기능
- **Neon**: Serverless PostgreSQL

---

## 4. 사용자 플로우

### 4.1 첫 방문자 플로우 (Freemium)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Landing Page                                            │
│     - "Backtest Your Crypto Strategy in 30 Seconds"        │
│     - 핵심 가치 제안 (객관적 성과 데이터 + 시장 컨텍스트)    │
│     - [Get Started (무료)] 버튼                              │
├─────────────────────────────────────────────────────────────┤
│  2. Strategy Explorer (가입 불필요)                          │
│     - 3개 전략 미리보기 (BB Squeeze, Momentum, Grid)         │
│     - 핵심 지표 (Win Rate, PF, MDD) 표시                    │
│     - [Simulate] 버튼 클릭                                   │
├─────────────────────────────────────────────────────────────┤
│  3. Simulation Results (제한된 보기)                         │
│     - 에쿼티 커브 + 핵심 지표 카드 (모두 표시)               │
│     - 코인별 히트맵 (흐림 처리, "Pro로 업그레이드" 오버레이) │
│     - 시장 컨텍스트 타임라인 (5개 이벤트만 표시)             │
│     - [Sign Up to Unlock Full Results] CTA                  │
├─────────────────────────────────────────────────────────────┤
│  4. Sign Up (이메일/OAuth)                                   │
│     - 이메일 + 비밀번호 OR Google/GitHub OAuth              │
│     - Free Plan 자동 활성화                                  │
├─────────────────────────────────────────────────────────────┤
│  5. Free Plan Dashboard                                     │
│     - 3개 전략 전체 접근                                     │
│     - 파라미터 조정 제한 (SL/TP만 조정 가능)                 │
│     - 시뮬레이션 월 10회 제한                                 │
│     - 시장 컨텍스트 타임라인 (최근 30일만)                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.2 Pro 사용자 플로우

```
┌─────────────────────────────────────────────────────────────┐
│  1. Strategy Explorer                                       │
│     - 모든 전략 접근 (10+ 전략)                              │
│     - 커스텀 전략 업로드 기능                                │
├─────────────────────────────────────────────────────────────┤
│  2. Strategy Customizer                                     │
│     - 모든 파라미터 조정 가능 (SL, TP, 시간 필터, 코인 수)   │
│     - 실시간 프리뷰 (클라이언트 사이드 시뮬레이션)           │
│     - [Run Full Simulation] 클릭                             │
├─────────────────────────────────────────────────────────────┤
│  3. Simulation Queue                                        │
│     - 서버에서 Python 백테스트 실행 (1-5분 소요)             │
│     - 진행 상황 바 (Supabase Realtime 기반)                  │
├─────────────────────────────────────────────────────────────┤
│  4. Full Results Dashboard                                  │
│     - 모든 차트/지표 접근                                     │
│     - CSV 다운로드 (거래 내역)                               │
│     - 시장 컨텍스트 타임라인 (전체 기간)                     │
│     - [Compare with Other Strategies] 기능                  │
├─────────────────────────────────────────────────────────────┤
│  5. Market Context Timeline                                 │
│     - 모든 이벤트 접근                                        │
│     - 커스텀 이벤트 추가 (내 메모)                           │
│     - 이벤트별 전략 성과 오버레이                            │
├─────────────────────────────────────────────────────────────┤
│  6. Coin Detail Pages                                       │
│     - 개별 코인의 전략별 성과 비교                           │
│     - 거래 히스토리 테이블 (전체 접근)                       │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.3 Free vs Pro 기능 분리

| 기능 | Free | Pro |
|------|------|-----|
| **전략 수** | 3개 (BB Squeeze, Momentum, Grid) | 10+ 전략 + 커스텀 업로드 |
| **파라미터 조정** | SL/TP만 | 모든 파라미터 |
| **시뮬레이션 횟수** | 월 10회 | 무제한 |
| **에쿼티 커브** | 표시 | 표시 + CSV 다운로드 |
| **코인별 히트맵** | 흐림 처리 | 전체 접근 |
| **시장 컨텍스트** | 최근 30일 | 전체 기간 + 커스텀 이벤트 |
| **거래 히스토리** | 없음 | CSV 다운로드 |
| **전략 비교** | 없음 | 최대 5개 전략 비교 |
| **API 접근** | 없음 | REST API (시뮬레이션 자동화) |

#### 참고
- [Crypto Backtesting - Freemium Models](https://www.tradewell.app/crypto-backtesting)
- [Gainium - Free Backtesting](https://gainium.io/crypto-backtesting)

---

## 5. 데이터 시각화 전략

### 5.1 핵심 지표 우선순위 (중요도 순)

1. **Win Rate (승률)**: 가장 직관적, 첫 번째 카드
2. **Profit Factor (PF)**: 수익성 판단, 두 번째 카드
3. **Max Drawdown (MDD)**: 리스크 평가, 세 번째 카드
4. **Total Trades**: 샘플 크기, 네 번째 카드
5. **Sharpe Ratio**: 고급 사용자용, 확장 패널에 숨김
6. **Calmar Ratio**: Pro 사용자만
7. **평균 RR**: Pro 사용자만

---

### 5.2 차트 타입별 사용처

| 차트 타입 | 사용처 | 라이브러리 |
|-----------|--------|------------|
| **Line Chart** | Equity Curve, BTC 가격 추이 | Lightweight Charts |
| **Candlestick** | 개별 코인 가격 차트 | Lightweight Charts |
| **Bar Chart** | 월별/분기별 수익률 비교 | ApexCharts |
| **Heatmap** | 코인별 성과, 시간대별 수익률 | ApexCharts |
| **Pie Chart** | SL/TP/TIMEOUT 비율 | Chart.js |
| **Histogram** | PnL 분포 | ApexCharts |

---

### 5.3 색상 코딩 규칙

#### 성과 지표
- **녹색 (#10b981)**: 긍정적 (수익, 높은 승률, 낮은 MDD)
- **빨간색 (#ef4444)**: 부정적 (손실, 낮은 승률, 높은 MDD)
- **노란색 (#f59e0b)**: 중립/경고 (손익분기 근처)
- **회색 (#6b7280)**: 비활성/보조 정보

#### 히트맵
- **진한 녹색**: 높은 수익 (PnL > +10%)
- **연한 녹색**: 중간 수익 (PnL 0~10%)
- **회색**: 손익분기 (PnL ±1%)
- **연한 빨간색**: 중간 손실 (PnL -10~0%)
- **진한 빨간색**: 큰 손실 (PnL < -10%)

#### 참고
- Finviz, TradingView의 히트맵 색상 스킴
- [7 Epic Stock, FX & Crypto Heatmaps for Traders Tested 2026](https://www.liberatedstocktrader.com/stock-heat-map/)

---

### 5.4 정보 과부하 방지 전략

#### 1. Progressive Disclosure (점진적 공개)
```
Level 1: 핵심 지표 카드 4개 (Win Rate, PF, MDD, Trades)
   ↓ [Show More] 클릭
Level 2: 고급 지표 (Sharpe, Calmar, Avg RR, Avg Duration)
   ↓ [Show Advanced Charts] 클릭
Level 3: 상세 차트 (PnL 분포, 시간대별 히트맵, 연속 손실 분석)
```

#### 2. 탭 구조
```
[Overview] [Equity Curve] [Coin Breakdown] [Market Context] [Settings]
```
- Overview: 핵심 지표 + 에쿼티 커브
- Equity Curve: 차트 전체 화면 + Annotation
- Coin Breakdown: 코인별 히트맵 + 테이블
- Market Context: 타임라인
- Settings: 파라미터 재조정

#### 3. 툴팁/호버
- 모든 전문 용어에 툴팁 제공 (예: "Sharpe Ratio란?")
- 차트 호버 시 상세 데이터 표시

#### 참고
- [Best Practices for Crypto Exchange UI/UX Design](https://sdlccorp.com/post/best-practices-for-crypto-exchange-ui-ux-design/)

---

## 6. 모바일 대응 전략

### 6.1 모바일 우선 설계 원칙

#### 통계 (2026년 기준)
- **60% 이상의 크립토 거래가 모바일에서 발생**
- **지연 100ms 이상이면 사용자가 인지**
- **모바일 앱 사용자는 웹 전용 사용자보다 3배 더 자주 방문**

#### 출처
- [Cryptocurrency Trading Platform Mobile Responsive Design Best Practices 2026](https://www.openware.com/news/articles/user-centric-design-for-crypto-trading-platforms-best-practices)

---

### 6.2 반응형 레이아웃

#### Desktop (1280px+)
```
┌─────────────────────────────────────────────────────────────┐
│  Header (로고 + 검색 + 사용자 메뉴)                           │
├────────────────┬────────────────────────────────────────────┤
│  사이드바      │  메인 콘텐츠 (2-3 컬럼 그리드)              │
│  (필터, 메뉴)  │                                            │
└────────────────┴────────────────────────────────────────────┘
```

#### Tablet (768px ~ 1279px)
```
┌─────────────────────────────────────────────────────────────┐
│  Header (햄버거 메뉴 + 로고 + 사용자)                         │
├─────────────────────────────────────────────────────────────┤
│  메인 콘텐츠 (1-2 컬럼 그리드)                               │
└─────────────────────────────────────────────────────────────┘
```

#### Mobile (< 768px)
```
┌─────────────────┐
│  Header         │
│  (햄버거 + 로고) │
├─────────────────┤
│  메인 콘텐츠    │
│  (1 컬럼 스택)  │
│                 │
├─────────────────┤
│  Bottom Tab Nav │
│  [Home][Charts] │
│  [Context][Me]  │
└─────────────────┘
```

---

### 6.3 모바일 최적화 체크리스트

- [ ] **Bottom Tab Navigation**: 엄지 손가락으로 쉽게 접근
- [ ] **스와이프 제스처**:
  - 좌우 스와이프로 차트/탭 전환
  - 아래로 당겨서 새로고침
- [ ] **차트 축소**: 모바일에서는 미니 차트 + 탭하면 전체 화면
- [ ] **카드 스택**: Desktop 그리드 → Mobile 세로 스택
- [ ] **터치 타겟 크기**: 최소 44x44px (iOS 권장)
- [ ] **오프라인 지원**: Service Worker로 캐싱
- [ ] **프로그레시브 웹 앱 (PWA)**: 홈 화면 추가 가능

#### 참고
- [Best Practices for Crypto Exchange UI/UX Design](https://sdlccorp.com/post/best-practices-for-crypto-exchange-ui-ux-design/)

---

## 7. 성능 최적화

### 7.1 500+ 코인 데이터 렌더링

#### 문제
- 500개 코인 x 2년 x 1시간 봉 = 약 876,000 데이터 포인트
- 브라우저에서 모두 렌더링 시 프리징

#### 해결책

##### 1. 서버 사이드 집계
```typescript
// Edge Function에서 실행
async function aggregateBacktestResults(strategy: string) {
  // PostgreSQL에서 코인별 PnL, Win Rate만 집계
  const results = await supabase
    .from('backtest_results')
    .select('coin, pnl, win_rate, total_trades')
    .eq('strategy', strategy)

  // 클라이언트에 500개 요약 데이터만 전송 (< 50KB)
  return results
}
```

##### 2. Virtualization (테이블/리스트)
```typescript
// react-window로 코인 리스트 가상화
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={500}
  itemSize={50}
>
  {CoinRow}
</FixedSizeList>
```

##### 3. Data Conflation (차트)
```typescript
// Lightweight Charts의 Data Conflation 활성화
chart.applyOptions({
  enableConflation: true, // 줌 아웃 시 자동 병합
})
```

##### 4. 지연 로딩
```typescript
// 히트맵은 탭 클릭 시에만 로드
<Tab.Panel>
  <Suspense fallback={<Skeleton />}>
    <CoinHeatmap />
  </Suspense>
</Tab.Panel>
```

---

### 7.2 성능 목표

| 지표 | 목표 | 현실적 범위 |
|------|------|-------------|
| **First Contentful Paint (FCP)** | < 1.5초 | 1.0 ~ 2.0초 |
| **Largest Contentful Paint (LCP)** | < 2.5초 | 2.0 ~ 3.0초 |
| **Time to Interactive (TTI)** | < 3.5초 | 3.0 ~ 4.0초 |
| **차트 렌더링** | < 100ms | 100 ~ 200ms |
| **API 응답** | < 300ms | 200 ~ 500ms |

---

### 7.3 최적화 체크리스트

- [ ] **이미지 최적화**: Next.js Image 컴포넌트 사용 (WebP, lazy loading)
- [ ] **코드 스플리팅**: 차트 라이브러리를 동적 import
  ```typescript
  const LightweightChart = dynamic(() => import('./LightweightChart'), {
    ssr: false,
    loading: () => <Skeleton />
  })
  ```
- [ ] **CDN**: Vercel/Cloudflare CDN으로 정적 에셋 배포
- [ ] **Database Indexing**: PostgreSQL에서 coin, strategy, date 컬럼 인덱싱
- [ ] **API 캐싱**: React Query의 staleTime 설정 (5분)
- [ ] **Compression**: Brotli/Gzip 압축 (Next.js 기본 지원)

---

## 8. 구현 우선순위

### Phase 1: MVP (4주)
**목표**: 1개 전략의 백테스트 결과를 보여주는 최소 기능

- [x] 기술 스택 결정 (Next.js + Tailwind + shadcn/ui)
- [ ] 데이터베이스 설계 (Supabase)
  - `strategies` 테이블
  - `backtest_results` 테이블 (코인별 집계)
  - `trades` 테이블 (개별 거래)
- [ ] Strategy Explorer 페이지
  - BB Squeeze SHORT 전략 카드 1개
  - 핵심 지표 (Win Rate, PF, MDD) 표시
- [ ] Simulation Results 페이지
  - 지표 카드 4개
  - Lightweight Charts로 Equity Curve
  - 코인별 히트맵 (ApexCharts)
- [ ] 반응형 디자인 (Desktop + Mobile)

---

### Phase 2: Freemium (2주)
**목표**: 가입 없이 체험 → 가입 유도 → Pro 전환

- [ ] Landing Page (Astro)
  - 가치 제안
  - 전략 미리보기
  - Pricing 페이지
- [ ] 인증 (Supabase Auth)
  - 이메일/비밀번호
  - Google OAuth
- [ ] Free vs Pro 기능 분리
  - Free: 3개 전략, 월 10회 시뮬레이션
  - Pro: 모든 전략, 무제한 시뮬레이션
- [ ] Stripe 결제 연동 ($29/월)

---

### Phase 3: 파라미터 조정 + 시장 컨텍스트 (3주)
**목표**: 사용자가 전략을 커스터마이징하고 시장 이벤트와 연결

- [ ] Strategy Customizer 페이지
  - SL/TP 슬라이더
  - 시간 필터 체크박스
  - 실시간 프리뷰 (캐시된 시뮬레이션)
- [ ] 백엔드 시뮬레이션 API
  - Python 백테스트 스크립트 (AutoTrader 재사용)
  - Supabase Edge Function으로 실행
  - 진행 상황 Realtime 업데이트
- [ ] Market Context Timeline 페이지
  - BTC 가격, 청산 데이터 API 연동
  - 날짜별 이벤트 카드
  - 전략 성과 오버레이

---

### Phase 4: 고급 기능 (2주)
**목표**: Pro 사용자를 위한 고급 분석 도구

- [ ] Coin Detail 페이지
  - 전략별 성과 비교
  - 거래 히스토리 테이블
- [ ] 전략 비교 기능
  - 최대 5개 전략 나란히 비교
  - 차이점 하이라이트
- [ ] CSV 다운로드
  - 거래 내역
  - 코인별 성과
- [ ] REST API (Pro 전용)
  - `/api/simulate` (커스텀 파라미터)
  - `/api/results/{simulation_id}`

---

### Phase 5: 커뮤니티 + 콘텐츠 (진행 중)
**목표**: 사용자 유지 + SEO

- [ ] 블로그 (Astro)
  - "BB Squeeze 전략이란?"
  - "크립토 백테스트 완벽 가이드"
- [ ] 커뮤니티 전략 공유
  - 사용자가 커스텀 파라미터 공유
  - 좋아요/댓글 기능
- [ ] 디스코드/텔레그램 연동
  - 새 시뮬레이션 결과 알림

---

## 부록: 데이터 소스 규칙

### ⚠️ 할루시네이션 방지 (CRITICAL)

**2026-02-13 교훈**: 에이전트가 다음 3건의 할루시네이션 발생
1. BTC $69,102 오보 (실제 $66,980) → 웹검색 가격 추정 금지
2. Daily Loss -5.99% 오보 (실제 -1.22%) → Income API 7일/1일 혼동
3. `realized_pnl_usd=0` 필드 사용 → `pnl_amount` 필드만 사용

### 필수 규칙
1. **모든 주장에 출처 URL 필수** - 출처 없으면 "unverified" 표시
2. **검증되지 않은 정보 명시** - 추측은 "추측입니다"로 표시
3. **상반된 의견 모두 보고** - 편향 방지
4. **수치는 원본 출처와 대조 필수** - 숫자 확인
5. **할루시네이션 위험 시 명시적 경고** - 불확실성 표시

### 신뢰도 평가 기준
| 등급 | 기준 |
|------|------|
| **높음** | 학술 논문, 공식 문서, 검증된 데이터 |
| **중간** | 커뮤니티 합의, 다수 출처 일치 |
| **낮음** | 단일 출처, 익명 주장, 검증 불가 |

---

## Sources (출처)

### 경쟁사 분석
- [How to Use TradingView Strategy Tester Full Tutorial (2026)](https://chartwisehub.com/tradingview-strategy-tester/)
- [How to Backtest on TradingView: The Complete 2026 Guide](https://pineify.app/resources/blog/how-to-backtest-on-tradingview-comprehensive-2025-guide)
- [CoinGlass - Crypto Market Data](https://www.coinglass.com/)
- [CoinGlass Professional Platform Analysis](https://dapp.expert/analytics/coinglass-professional-platform-for-analyzing-cryptocurrency-derivatives)
- [DCA Bot: Interface and Main Settings | 3Commas](https://help.3commas.io/en/articles/3108940-dca-bot-interface-and-main-settings)
- [Dashboard & the 3Commas User Interface](https://help.3commas.io/en/articles/3108945-dashboard-the-3commas-user-interface)
- [Shrimpy Review: Crypto Portfolio Management](https://coincodecap.com/shrimpy-crypto-trading-bot-review)
- [Shrimpy: Crypto Portfolio Management](https://www.shrimpy.io/)

### UX Best Practices
- [Best Practices for Crypto Exchange UI/UX Design - SDLC Corp](https://sdlccorp.com/post/best-practices-for-crypto-exchange-ui-ux-design/)
- [Designing a Modern Crypto Dashboard: Key Features and Best Practices](https://multipurposethemes.com/blog/designing-a-modern-crypto-dashboard-key-features-and-best-practices/)
- [User-Centric Design for Crypto Trading Platforms: Best Practices](https://www.openware.com/news/articles/user-centric-design-for-crypto-trading-platforms-best-practices)

### 기술 스택
- [Nuxt vs Next.js vs Astro vs SvelteKit: The 2026 Frontend Framework Showdown](https://www.nunuqs.com/blog/nuxt-vs-next-js-vs-astro-vs-sveltekit-2026-frontend-framework-showdown)
- [Astro vs Next.js: Which Framework Should You Use in 2026?](https://pagepro.co/blog/astro-nextjs/)
- [Astro vs. Next.js: Features, performance, and use cases compared | Contentful](https://www.contentful.com/blog/astro-next-js-compared/)

### 차트 라이브러리
- [TradingView Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [GitHub - tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts)
- [6 Best JavaScript Charting Libraries for Dashboards in 2026](https://embeddable.com/blog/javascript-charting-libraries)
- [Chart.js vs ApexCharts | StackShare](https://stackshare.io/stackups/apexcharts-vs-js-chart)

### 데이터 시각화
- [6 Heatmaps to Supercharge Your Trading in 2026](https://www.greatworklife.com/stock-heatmaps/)
- [7 Epic Stock, FX & Crypto Heatmaps for Traders Tested 2026](https://www.liberatedstocktrader.com/stock-heat-map/)
- [TradingView heatmaps: from global trends to details](https://www.tradingview.com/support/solutions/43000766446-tradingview-heatmaps-from-global-trends-to-details/)

### Freemium 모델
- [Crypto Backtesting - Tradewell](https://www.tradewell.app/crypto-backtesting)
- [Backtest Crypto Trading Bots | Gainium](https://gainium.io/crypto-backtesting)
- [FREE Online Backtest - EasyCryptoBot](https://easycryptobot.com/free-backtest/)

### 모바일 최적화
- [Best Crypto Apps in 2026: The Mobile Platforms Crypto Investors Actually Use](https://blocktelegraph.io/best-crypto-apps-in-2026-mobile-platforms-crypto-investors-actually-use/)
- [How to Build a Crypto Exchange App: The 2026 Guide](https://b2broker.com/news/crypto-exchange-app-development/)

---

## 다음 단계

1. **프로토타입 제작**: Figma로 핵심 화면 5개 디자인
2. **기술 스택 PoC**: Next.js + Lightweight Charts + ApexCharts 통합 테스트
3. **데이터베이스 설계**: Supabase 스키마 설계 + 샘플 데이터 임포트
4. **MVP 개발 시작**: Phase 1 (4주) 착수

---

**작성자**: Research-Agent
**작성일**: 2026-02-15
**버전**: 1.0.0
**검증 상태**: ✅ COMPLETE (실제 경쟁사 분석 기반)
