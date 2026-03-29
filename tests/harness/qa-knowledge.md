# PRUVIQ QA Knowledge Base

> Claude Vision이 스크린샷을 분석할 때 이 문서를 기준으로 판단한다.
> "정상"과 "비정상"의 기준, 비즈니스 룰, 알려진 버그 패턴을 포함한다.

---

## 서비스 개요

PRUVIQ는 크립토 트레이딩 전략 백테스팅 플랫폼이다.
- **핵심 기능**: 사용자가 전략을 설정 → 실제 과거 데이터로 백테스트 → 결과 확인
- **주요 차별점**: 손실 거래도 공개, 무료, 회원가입 불필요
- **데이터 소스**: CoinGecko (Binance API 아님 — 2025년 전환 완료)
- **현재 코인 수**: 569개 (2026-03 기준)
- **지원 언어**: 영어(EN), 한국어(KO)

---

## 현재 기술 현황 (알아야 할 것들)

| 항목 | 현재 상태 | 판단 기준 |
|------|---------|---------|
| 코인 수 | **569개** | 549가 보이면 → STALE_DATA (critical) |
| 데이터 소스 | **CoinGecko** | "Binance API" trust badge → 오류 (warning) |
| 시뮬레이션 방식 | 서버사이드 API | 결과가 10초+ 안 나오면 → 점검 필요 |
| SSR 랭킹 | EN + KO 모두 적용 | ranking-ssr-fallback div 비어있으면 → critical |
| 랭킹 갱신 주기 | 매일 KST 09:00 | date > 2일 경과 → 파이프라인 장애 |

---

## 페이지별 정상 상태 정의

### / (Home) — EN
**정상:**
- H1: "Test Your Strategy Before You Trade."
- 코인 수 배지: "569+" 표시
- Trust badges: "CoinGecko Data" 또는 "Binance API Read-Only" **아닌** 것 (수정 필요 항목)
- CTA 버튼 2개: "Try Simulator Free →", "See Backtest Results"
- Stats: "12,847+ simulations", "569 coins analyzed" (숫자 대략 맞음)
- 하단: social proof 섹션 (사용자 수 등)

**비정상:**
- 549 표시 → STALE_DATA critical
- "Binance API Read-Only" trust badge → WARNING (CoinGecko로 전환됐음)
- H1 비어있음 → BLANK_PAGE critical
- 쿠키 배너가 CTA 완전히 가림 → MOBILE_BROKEN warning

### /ko/ (Home) — KO
**정상:**
- H1: "실전 전에 전략을 검증하세요." (한국어)
- 코인 수: "569개 이상" 또는 "569+"
- 전체 텍스트 한국어

**비정상:**
- 영어 h1 텍스트 → LANGUAGE_WRONG critical
- 549 표시 → STALE_DATA critical

### /simulate/ (시뮬레이터) — EN
**정상:**
- H1: "Build a Strategy. Test It on 569+ Coins."
- 3개 탭: "Quick Test", "Standard", "Expert"
- 시나리오 카드 5개: Breakout, Reversals, Range Trading, Trend Following, Hedging
- **시나리오 클릭 시**: 즉시 시뮬레이션 실행, 3~15초 내 결과 표시
- 결과: Win Rate, Profit Factor, Total Trades, MDD, Sharpe, Sortino, Calmar
- **Run 버튼은 초기 화면에 없음** — 시나리오 클릭 = 실행 트리거 (정상 설계)
- "Run a backtest to see results." 텍스트 = 초기 상태 (정상)

**비정상:**
- 549 표시 → STALE_DATA critical
- 시나리오 클릭 후 30초 지나도 결과 없음 → COMPONENT_CRASH critical
- Win Rate > 95% 또는 < 5% → DATA_MISSING (결과 버그 의심)
- Calmar > 10 → STALE_DATA (Calmar 27.5x 버그 재발 의심)
- MDD > 80% → DATA_MISSING (정규화 버그 의심)
- PF = 999 → COMPONENT_CRASH critical (sentinel 값 노출)

**주의**: "AI optimized" 라벨은 마케팅 문구로, 실제 AI 최적화 여부는 별도 검증 불필요

### /ko/simulate/ (시뮬레이터) — KO
**정상:**
- H1: "전략을 만들고, 569개 코인에서 테스트하세요."
- 탭, 버튼 등 한국어 번역 적용
- 기능 동일 (시나리오 클릭 = 실행)

### /strategies/ranking (전략 랭킹) — EN
**정상:**
- H1: "Daily Strategy Ranking"
- SSR fallback div `#ranking-ssr-fallback` 존재 + 실제 전략명 포함
- BEST 3 카드: 전략명, Win Rate, PF, Trades 표시
- WORST 3 카드: 표시
- 날짜: 오늘 또는 어제 (KST 기준 2일 이내)
- 필터 버튼: 30 Days, 365 Days, 7 Days / Top 30, Top 50, Top 100, BTC Only
- 한국어 없어야 함

**비정상:**
- BEST 3 중 Trades < 100인 카드에 ⚠️ 경고 배지 없음 → UX_ISSUE warning
- "Loading interactive filters..." 텍스트가 데이터 로드 후에도 보임 → UX_ISSUE info
- 날짜 > 2일 경과 → DATA_MISSING critical (랭킹 파이프라인 장애)
- 한국어 텍스트 메인 섹션에 표시 → LANGUAGE_WRONG warning

**알려진 이슈 (허용됨):**
- 전략명(MACD Cross LONG 4H 등)은 영어로 표시 — 의도된 설계
- Trades < 100인 전략이 BEST 3에 올라올 수 있음 — 필터링 미구현 상태

### /ko/strategies/ranking (전략 랭킹) — KO
**정상:**
- H1: "오늘의 전략 랭킹" (한국어)
- SSR fallback div `#ranking-ssr-fallback` 존재 + 데이터 있음
- 한국어 레이블 (Win Rate → "승률" 등)
- 탭명: StrategyTabs 컴포넌트 (전략 라이브러리 / 일일 랭킹 / 주간 순위) — 단일 소스, 전 페이지 동일
- 전략명은 영어 유지 (MACD Cross 등) — 의도된 설계

**비정상:**
- SSR div 비어있음 → BLANK_PAGE critical (PR #464 이전 버그 재발)
- H1 없거나 영어 → LANGUAGE_WRONG warning

### /market/ (마켓 대시보드)
**정상:**
- H1: "Market Dashboard"
- 초기 로드 시 스켈레톤 허용 (동적 데이터, client-side 로드)
- 하이드레이션 후: BTC/ETH 가격, Fear & Greed Index, 시장 지표
- 완전 공백은 비정상

**비정상:**
- 4초 대기 후에도 완전 공백 → DATA_MISSING warning
- JS 에러 → COMPONENT_CRASH critical

### /coins/ (코인 목록)
**정상:**
- H1: "Browse All Coins"
- 코인 목록 (BTC, ETH, SOL 등 심볼)
- 스파크라인 차트 (SVG 또는 canvas)
- 검색/필터 기능

**비정상:**
- 코인 없이 완전 공백 → DATA_MISSING warning
- 검색창 안 보임 → UX_ISSUE warning

### /performance/ (성과)
**정상:**
- H1: "Every Trade Published. Including Losses."
- 실제 거래 테이블 (코인명, 날짜, P&L, SL/TP)
- 2,898+ 거래 기록
- "Last updated" 날짜: 최근 30일 이내 권장

**비정상:**
- 거래 테이블 없음 → DATA_MISSING warning
- Last updated > 30일 경과 → DATA_MISSING warning
- 차트 없음 → INFO (현재 미구현 상태 — critical 아님)

### /strategies/ (전략 목록)
**정상:**
- 전략 카드들 (BB Squeeze, RSI Divergence 등)
- 각 카드: Win Rate, PF, Trades 수치
- 필터: Active, Retired, Under Review

**비정상:**
- Trades < 100 카드 표시 → INFO (주의 필요)
- "Verified" vs "ACTIVE" 용어 불일치 → UX_ISSUE info (알려진 이슈)

### /learn/ (학습 센터) — EN
**정상:**
- 아티클 카드 6개+ 표시
- Beginner/Intermediate/Advanced 난이도 구분 존재
- 각 카드 클릭 가능 (링크 활성)
- 검색/필터 기능 있으면 추가 점수

**비정상:**
- 카드 0개 → DATA_MISSING critical
- 카드 클릭 불가 → UX_ISSUE warning
- 완전 공백 → BLANK_PAGE critical

### /leaderboard/ (리더보드) — EN
**정상:**
- 주간 최고 전략 테이블 표시 (최소 3행)
- PF, WR, Direction 컬럼 존재
- 전략 행 클릭 가능 (상세 이동)

**비정상:**
- 테이블 없음 → DATA_MISSING critical
- 완전 공백 → BLANK_PAGE critical

### /compare/tradingview/ (비교 페이지)
**정상:**
- 비교 테이블 표시
- PRUVIQ vs TradingView 행/컬럼 존재
- 비교 항목 5개+

**비정상:**
- 테이블 없음 → BLANK_PAGE critical
- 비교 항목 3개 미만 → UX_ISSUE warning

### /api/ (API 문서)
**정상:**
- 엔드포인트 목록 표시
- 사용법 설명 텍스트
- 코드 예시 또는 curl 명령

**비정상:**
- 완전 공백 → BLANK_PAGE critical

### /methodology/ (방법론)
**정상:**
- 슬리피지/수수료 가정 설명
- Survivorship bias 설명
- 텍스트 콘텐츠 충분

**비정상:**
- 완전 공백 → BLANK_PAGE critical

### /builder/ (전략 빌더)
**정상:**
- 지표 선택 UI
- 파라미터 입력 필드
- 실행/테스트 버튼

**비정상:**
- 완전 공백 → BLANK_PAGE critical

### /changelog/ (변경 이력)
**정상:**
- 날짜별 업데이트 항목 3개+
- 최근 항목이 30일 이내

**비정상:**
- 완전 공백 → BLANK_PAGE critical
- 최근 항목 90일+ 경과 → DATA_MISSING warning

### /about/, /fees/, /privacy/, /terms/ 등 정적 페이지
**정상:**
- H1 존재, 텍스트 렌더링
- 내용 완전 표시

**비정상:**
- 완전 공백 → BLANK_PAGE critical
- 4xx/5xx → critical

### /ko/ 하위 페이지 (KO)
**정상:**
- H1 한국어
- 주요 UI 레이블 한국어 (일부 기술 용어 영어 허용)
- 기능 동일 (EN 페이지와 동일한 데이터)

**비정상:**
- 영어 H1 → LANGUAGE_WRONG warning
- 완전 공백 → BLANK_PAGE critical

### Tablet (768px) 공통 기준
**정상:**
- 가로 스크롤 없음
- 텍스트 가독성 유지
- 터치 타겟 최소 44px
- 레이아웃 적응 (1컬럼 또는 2컬럼)

**비정상:**
- 가로 스크롤 필요 → LAYOUT_BROKEN warning
- 요소 겹침 → LAYOUT_BROKEN warning
- 텍스트 잘림 → UX_ISSUE warning

---

## 데이터 범위 기준 (시뮬레이터 결과값)

| 지표 | 정상 범위 | 의심 범위 | 버그 징후 |
|------|---------|---------|---------|
| Win Rate | 30% ~ 80% | 10% ~ 95% | < 10% 또는 > 95% |
| Profit Factor | 0.1 ~ 10 | 0.01 ~ 20 | 999 (sentinel) |
| Max Drawdown | 1% ~ 60% | 0% ~ 80% | > 80% (정규화 버그) |
| Sharpe Ratio | -3 ~ 8 | -5 ~ 15 | > 20 (계산 오류) |
| Sortino Ratio | -3 ~ 15 | -5 ~ 30 | > 50 (TDD 분모 오류) |
| Calmar Ratio | -2 ~ 5 | -5 ~ 10 | > 10 (trade days 버그) |
| Total Trades | 50 ~ 5000 | 10 ~ 10000 | < 10 (샘플 부족) |

---

## 알려진 버그 패턴 (재발 감시)

| 버그 | 증상 | 수정 PR | 판정 |
|------|------|---------|------|
| Calmar 27.5x 과대 | Calmar > 10 | PR#350 | critical |
| MDD 100% 과대 | MDD > 80% | PR#348 | critical |
| PF sentinel 999 | PF = 999 화면 표시 | PR#322 | critical |
| Sortino 분모 오류 | Sortino > 50 | PR#322 | critical |
| EN ranking 빈 화면 | SSR fallback 비어있음 | PR#460 | critical |
| KO ranking 빈 화면 | KO SSR fallback 비어있음 | PR#464 | critical |
| 코인 수 stale | 549 표시 (현재 569) | PR#464 | critical |

---

## 인터랙션 테스트 기준

### 시뮬레이터 실행 (Breakout 시나리오)
1. 시나리오 카드 "💥 Breakout" 클릭
2. **3~15초** 내 결과 표시 기대
3. 결과에 반드시 포함되어야 할 것:
   - Win Rate (숫자%)
   - Profit Factor (소수점)
   - Total Trades (정수)
   - Max Drawdown (숫자%)
4. 결과 수치가 위 데이터 범위 내에 있어야 함

### 랭킹 필터 클릭
1. "365 Days" 버튼 클릭
2. **5초** 내 데이터 업데이트 기대
3. "30d" 레이블이 "365d"로 바뀌어야 함

### 내비게이션
- 메뉴 링크 클릭 → 해당 페이지 로드 (3초 내)
- 모바일 햄버거 → 메뉴 열림 → 항목 클릭 → 이동

---

## 쿠키 배너 정책

쿠키 배너("This site uses essential security cookies only. Got it")는:
- **모든 페이지**에 기본 표시됨 (정상)
- **콘텐츠를 overlay로 가리면** → UX_ISSUE warning
- **CTA 버튼을 완전히 가리면** → MOBILE_BROKEN warning (모바일)
- **배너 자체**는 이슈 아님 — 가리는 정도로 판단

---

## 언어 정책

| 항목 | EN 페이지 | KO 페이지 |
|------|---------|---------|
| H1, 본문 | 영어 필수 | 한국어 필수 |
| 전략명 (MACD Cross 등) | 영어 OK | 영어 OK (의도적) |
| UI 레이블 (Win Rate 등) | 영어 | 한국어 권장 (일부 영어 허용) |
| 탭명 | 영어 | 혼재 허용 (알려진 이슈) |
| 숫자, 퍼센트 | 공통 | 공통 |

---

## 판정 기준

### critical (❌ FAIL)
- 콘텐츠가 완전히 비어있음 (SSR 빈 화면, 스켈레톤만)
- JS 에러로 컴포넌트 미표시
- 시뮬레이터 결과 버그 (PF=999, Calmar>10, MDD>80%)
- 코인 수 549 표시
- 랭킹 날짜 > 2일
- HTTP 4xx/5xx

### warning (⚠️ WARNING)
- 데이터는 있지만 부정확 (API vs 화면 불일치)
- Trust badge 오류 (Binance API 표시)
- 중요 UI 요소가 쿠키 배너에 가림
- 인터랙션 후 응답 지연 (15~30초)
- 언어 불일치 (의도되지 않은 것)
- Trades < 100인 카드에 경고 배지 없음

### info (🔵 INFO)
- 경미한 UX 개선 가능 항목
- 쿠키 배너 일반 겹침
- 성능 최적화 기회
- 디자인 일관성 개선

### pass (✅ PASS)
- 위 기준 해당 없음
- 개선 제안은 있을 수 있으나 기능 정상
