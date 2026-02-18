# PRUVIQ v1.3.0

"Don't Believe. Verify." — 무료 크립토 전략 시뮬레이션 + 시장 컨텍스트 플랫폼

## 프로젝트 상태

```
버전: v1.3.0
Phase: v0.5.0 베타 준비 중
시작일: 2026-02-14
상태: 6-Agent 감사 완료, Sprint 1 진행 중
GitHub: poong92/pruviq
배포: Cloudflare Pages (pruviq.com)
백엔드: api.pruviq.com (Mac Mini, FastAPI)
```

## 기술 스택

```
프론트엔드:
  - Astro 5 (SSG, Islands Architecture)
  - Preact (client-side islands: client:visible, client:load)
  - Tailwind CSS 4
  - lightweight-charts v5 (차트)
  - TypeScript

백엔드:
  - Python FastAPI (Mac Mini: jepo@172.30.1.16)
  - ccxt (거래소 데이터)
  - pandas/numpy (시뮬레이션 엔진)
  - uvicorn

배포:
  - Cloudflare Pages (git push → 자동 배포)
  - api.pruviq.com → Mac Mini :8400
```

## 핵심 콘셉트

### 기둥 1: 전략 시뮬레이션 (핵심 차별점)
- 사용자가 전략 선택 → 객관적 성과 데이터 제공
- 535+ 코인, 2년+ 데이터, 현실적 비용 모델링
- 코딩 불필요 — 파라미터 조정만으로 시뮬레이션
- 오픈소스 엔진 (투명성)

### 기둥 2: 시장 컨텍스트
- 뉴스, 이벤트, 거시경제, 시황 요약
- 전략 성과와 시장 이벤트 연결
- BTC 도미넌스, Fear & Greed, 펀딩률 등

### 수익 모델: 무료 + 레퍼럴
- 모든 기능 무료 (유료 티어 없음)
- 수익 = 거래소 레퍼럴 (Binance 20-41%, Bitget, OKX)
- 자연스러운 통합: 시뮬레이션 → "실거래하려면?" → 할인 레퍼럴
- 투명한 공개: "커미션으로 무료 유지"

### 브랜드 차별화 (4대 강점)
1. **급진적 투명성** — 실패한 전략 4개를 데이터와 함께 공개
2. **실거래 증명** — $3,000 바이낸스 선물 실거래 계좌
3. **구체적 실패 스토리** — "$14,115 손실 (look-ahead bias)"
4. **방법론 투명성** — Terms에서 look-ahead bias, 과적합 명시 경고

## 핵심 원칙

1. **autotrader와 완전 독립** — 코드/데이터/인프라 별도
2. **새로 검증** — 기존 백테스트 재사용 금지, 처음부터 검증
3. **데이터 공정성** — 거래소/시장 명시, 생존자 편향 방지
4. **단계적 고도화** — 한 단계씩 쌓아올리기
5. **투명성** — 비용 모델링 명시, 실패 전략도 공개
6. **무료 우선** — 유료 벽 없음, 레퍼럴만

## 디렉토리 구조

```
pruviq/
├── src/
│   ├── components/          # Preact Islands (10개)
│   │   ├── CoinChart.tsx         # 코인 차트 (lightweight-charts)
│   │   ├── CoinListTable.tsx     # 코인 목록 테이블
│   │   ├── DiscreteSlider.tsx    # SL/TP 슬라이더
│   │   ├── FeeCalculator.tsx     # 수수료 비교 계산기
│   │   ├── MarketDashboard.tsx   # 시장 대시보드
│   │   ├── PerformanceDashboard.tsx  # 성과 대시보드
│   │   ├── ResultsCard.tsx       # 결과 카드
│   │   ├── StrategyBuilder.tsx   # 전략 빌더
│   │   ├── StrategyComparison.tsx # 전략 비교
│   │   └── StrategyDemo.tsx      # 전략 데모 (메인)
│   ├── content/
│   │   ├── blog/            # EN 블로그 (17개)
│   │   ├── blog-ko/         # KO 블로그 (17개)
│   │   ├── strategies/      # EN 전략 (5개)
│   │   └── strategies-ko/   # KO 전략 (5개)
│   ├── i18n/
│   │   ├── en.ts            # 영어 번역 키
│   │   └── ko.ts            # 한국어 번역 키
│   ├── layouts/
│   │   └── Layout.astro     # 메인 레이아웃 (메타, hreflang, JSON-LD)
│   ├── pages/               # 39개 페이지
│   │   ├── index.astro      # EN 홈
│   │   ├── ko/index.astro   # KO 홈
│   │   ├── strategies/      # 전략 (index, [id], compare)
│   │   ├── blog/            # 블로그 (index, [id])
│   │   ├── simulate/        # 시뮬레이션
│   │   ├── learn/           # 교육 (index, [id])
│   │   ├── coins/           # 코인 (index, [symbol])
│   │   ├── market/          # 시장
│   │   ├── performance/     # 성과
│   │   ├── fees.astro       # 수수료 비교
│   │   ├── builder.astro    # 전략 빌더
│   │   ├── about.astro      # About
│   │   ├── privacy.astro    # 개인정보
│   │   ├── terms.astro      # 이용약관
│   │   ├── changelog.astro  # 변경이력
│   │   └── 404.astro        # 404
│   └── styles/
├── backend/                 # Python 시뮬레이션 엔진
│   ├── src/
│   │   ├── data/            # 데이터 수집 (ccxt)
│   │   ├── simulation/      # 엔진 (engine_fast.py)
│   │   ├── strategies/      # 전략 프로토콜
│   │   └── market_context/  # 시장 컨텍스트
│   ├── api/                 # FastAPI 엔드포인트
│   ├── scripts/             # CLI 스크립트
│   └── tests/               # pytest
├── public/
│   └── data/                # Pre-computed 데모 JSON
├── docs/                    # 설계 문서, 감사 보고서
└── .claude/
    └── agents/              # 5개 전문가 에이전트
```

## 에이전트 (5개)

| 에이전트 | 역할 | 도구 |
|----------|------|------|
| frontend-engineer | Astro/Preact/Tailwind 개발, 빌드, 배포 | Bash, Read, Write, Edit, Grep, Glob |
| ui-ux-designer | 디자인 시스템, 인터랙션, 접근성, 반응형 | Read, Write, Edit, Grep, Glob, WebSearch, WebFetch |
| qa-tester | i18n 완성도, 기능 테스트, 데이터 정합성 | Bash, Read, Grep, Glob, WebFetch |
| seo-specialist | 메타 태그, 인덱싱, 구조화 데이터, 키워드 | Read, Grep, Glob, WebSearch, WebFetch |
| content-strategist | 카피라이팅, 포지셔닝, 경쟁사 비교, 한국어 | Read, Grep, Glob, WebSearch, WebFetch |

## v1.3.0 감사 결과 (2026-02-18)

### 점수 요약
| 항목 | 점수 | 상태 |
|------|------|------|
| 신뢰 신호 | 4/10 | P0 |
| SEO/인덱싱 | 6/10 | P0 |
| i18n 완성도 | 5/10 | P1 |
| 프론트엔드 코드 | 6/10 | P1 |
| UI/UX | 6/10 | P1 |
| 콘텐츠 품질 | 8/10 | OK |
| 한국어 품질 | 8.5/10 | OK |
| 법적 준수 | 7/10 | P2 |
| 데이터 정확도 | 9.5/10 | OK |

### P0 CRITICAL (3건 남음, 4건 해결)
1. Google 미인덱싱 (site:pruviq.com = 0) — GSC 등록 + sitemap 제출 필요
2. 홈에 실거래 증명 없음 (최대 차별점이 About에 묻힘)
3. API URL fallback 불일치 (5개 컴포넌트 각기 다른 fallback) — 중앙화 필요

### ✅ 해결 확인 (2026-02-18 검증)
- ~~COMING SOON 키 잔존~~ → EN/KO 양쪽 의도적 UI 라벨로 확인
- ~~CTA 버튼 피드백~~ → hover:opacity-90 + transition 존재 (active 피드백은 P1)
- ~~Privacy/Terms 한국어~~ → ko/privacy.astro, ko/terms.astro 존재 확인
- ~~API URL localhost:8400~~ → import.meta.env.PUBLIC_PRUVIQ_API_URL 전환 완료

### 상세 보고서
- `docs/UNIFIED_AUDIT_v1.3.0.md` (통합 감사)
- `docs/COMPETITIVE_AUDIT_v1.3.0.md` (경쟁사 비교)

## 인프라

```
개발: MacBook (jplee) ~/Desktop/pruviq
프론트엔드: Cloudflare Pages (pruviq.com)
백엔드 API: Mac Mini (jepo@172.30.1.16) :8400 → api.pruviq.com
  - SSH: ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 jepo@172.30.1.16
  - Tailscale: jepo@100.93.138.124
autotrader 서버 (DO): 절대 건드리지 않음
```

## autotrader와의 관계

- autotrader = 재풍이 개인 투자 (건드리지 않음)
- pruviq = autotrader 경험 기반 새 서비스
- 코드 복사 금지 — 개념만 참고, 구현은 처음부터
- 실거래 결과 공개 금지 — 시뮬레이션 결과만 제공

## 전략 데이터 (v1.7.0 autotrader 기준)

| 전략 | 방향 | 상태 | 승률 | PF | SL | TP |
|------|------|------|------|-----|-----|-----|
| BB Squeeze SHORT | short | verified | 68.6% | 2.22 | 10% | 8% |
| BB Squeeze LONG | long | killed | 51.0% | <1 | 7% | 6% |
| Momentum LONG | long | killed | 37.5% | <1 | 5% | 10% |
| ATR Breakout | long | shelved | - | - | 7% | 10% |
| HV Squeeze | short | shelved | - | - | 10% | 6% |

## 로드맵

```
v0.1.x ✅ 기반 뼈대
v0.2.0 ✅ 시뮬레이션 데모 (SL/TP 슬라이더, 즉시 결과)
v0.3.0 ✅ UX 구조조정 + i18n (NAV 간소화, 한국어 19페이지)
v1.0.0 ✅ 콘텐츠 확장 (블로그 17x2, 전략 5x2)
v1.1.0 ✅ 시장 대시보드 + 코인 차트
v1.2.0 ✅ 전략 비교 + 성과 대시보드
v1.3.0 ✅ 6-Agent 종합 감사 완료 (현재)

v1.4.0: Sprint 1 Quick Wins (P0 수정)
  - Google Search Console 등록 + sitemap 제출
  - COMING SOON 제거
  - CTA 호버 피드백
  - API URL 중앙화
  - 홈에 실거래 증명 섹션

v1.5.0: Sprint 2 (P1 수정)
  - i18n 완성도 향상
  - Learn 페이지 i18n화
  - 타이틀/메타 최적화
  - 모바일 터치 타겟 44px
  - 로딩 상태 추가

v2.0.0: 멀티 전략 시뮬레이션
  - 5개 전략 모두 인터랙티브 데모
  - 전략 비교 페이지
  - 백엔드 전략 레지스트리
```
