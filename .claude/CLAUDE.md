# OWNER DIRECTIVES (최우선 — 반드시 따를 것)

## 현재 작업 우선순위

P0: /coins/[symbol] 상세 페이지 404 수정 (동적 라우트 → SSG getStaticPaths)
P1: Terms of Service + Privacy Policy 페이지 생성
P2: 모바일 반응형 개선 (/simulate/ 페이지 터치타겟)
P3: SEO meta 태그 누락 페이지 보완

## 금지 사항 (STOP LIST)

다음을 하면 안 됨:
- 문서/프레임워크/프로세스 문서 생성
- 모니터링 인프라 구축 제안
- 스킬 추가/생성
- 리서치 보고서 작성
- 선택지(A/B/C/D) 제시 — 바로 실행
- MEMORY.md 자동 업데이트
- GitHub 이슈에 자동 코멘트
- git commit/push (PR만 생성, 머지는 오너가 함)

## 응답 규칙

3줄로 답할 것:
- What: 뭘 했는지 (1줄)
- Result: 빌드 통과 여부, PR 링크 (1줄)
- Next: 다음 작업 (1줄)

이 규칙을 어기면 안 됨.

---

# PRUVIQ v0.3.0

"Don't Believe. Verify." — 무료 크립토 전략 시뮬레이션 + 시장 컨텍스트 플랫폼

## 프로젝트 상태

```
버전: v0.3.0
Phase: 프로덕션 안정화
시작일: 2026-02-14
상태: P0/P1/MEDIUM 전부 해결 + 전체 검증 PASS
GitHub: pruviq/pruviq
배포: Cloudflare Pages (pruviq.com)
백엔드: api.pruviq.com (Mac Mini, FastAPI)
빌드: 1,257 pages (0 errors)
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

## 커밋 전 필수 QA (CRITICAL)

```
┌─────────────────────────────────────────────────────────────┐
│  git push → Cloudflare 자동 배포이므로, 커밋 = 프로덕션!    │
│                                                             │
│  1. npm run build                                           │
│     - 0 errors 확인                                         │
│     - 페이지 수 확인 (현재 ~1257)                           │
│                                                             │
│  2. bash scripts/qa-redirects.sh                            │
│     - _redirects vs dist/ 충돌 0건 확인                     │
│     - CONFLICT 있으면 절대 커밋 금지                        │
│                                                             │
│  3. 네비게이션 6개 메뉴 확인                                │
│     - Market, Strategies, Coins, Simulate, Learn, Fees     │
│     - 각각 다른 페이지로 이동하는지 확인                    │
│     - _redirects가 실제 페이지를 가리지 않는지 확인         │
│                                                             │
│  커밋 메시지에 빌드 결과 포함:                               │
│  "fix: ... (build: 1257 pages, qa-redirects: PASS)"        │
└─────────────────────────────────────────────────────────────┘
```

## _redirects 관리 규칙 (2026-02-19 교훈)

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages: _redirects > 실제 HTML 파일 (우선순위!)  │
│                                                             │
│  ❌ 금지: 실제 콘텐츠 페이지 경로를 _redirects에 넣기       │
│     → 페이지가 존재해도 리다이렉트가 먹어버림               │
│                                                             │
│  ✅ 허용: Astro.redirect() 페이지만 _redirects에 추가       │
│     → 이중 안전장치 (Astro + Cloudflare)                    │
│                                                             │
│  페이지 삭제/이동 시:                                        │
│  1. 소스 파일을 Astro.redirect()로 변환                     │
│  2. _redirects에 추가 (선택, 이중 안전장치)                 │
│  3. bash scripts/qa-redirects.sh 실행                       │
│                                                             │
│  사건: /coins → /simulate 잔여 리다이렉트로                 │
│  Coins 메뉴가 Simulate로 이동하는 버그 (2026-02-19)        │
└─────────────────────────────────────────────────────────────┘
```

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
│   │   ├── performance/     # → /simulate 리다이렉트
│   │   ├── fees.astro       # 수수료 비교
│   │   ├── builder.astro    # → /simulate 리다이렉트
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
    └── agents/              # 8개 전문가 에이전트
```

## 에이전트 (8개)

| 에이전트 | 역할 | 도구 |
|----------|------|------|
| frontend-engineer | Astro/Preact/Tailwind 개발, 빌드, 배포 | Bash, Read, Write, Edit, Grep, Glob |
| ui-ux-designer | 디자인 시스템, 인터랙션, 접근성, 반응형 | Read, Write, Edit, Grep, Glob, WebSearch, WebFetch |
| qa-tester | i18n 완성도, 기능 테스트, 데이터 정합성 | Bash, Read, Grep, Glob, WebFetch |
| seo-specialist | 메타 태그, 인덱싱, 구조화 데이터, 키워드 | Read, Grep, Glob, WebSearch, WebFetch |
| content-strategist | 카피라이팅, 포지셔닝, 경쟁사 비교, 한국어 | Read, Grep, Glob, WebSearch, WebFetch |
| backend-engineer | FastAPI, 시뮬레이션 엔진, 데이터 파이프라인 | Bash, Read, Write, Edit, Grep, Glob |
| e2e-tester | Playwright E2E, 스크린샷, 회귀 테스트 | Bash, Read, Write, Edit, Grep, Glob, WebFetch |
| deployment-ops | cron, 파이프라인, API 상태, 장애 대응, 인프라 | Bash, Read, Write, Edit, Grep, Glob, WebFetch |

## 변경 이력

### v0.1.2 (2026-02-19)
- **P0/P1/MEDIUM 전부 해결** — 6-Agent 감사에서 발견된 이슈 100% 클리어
- **리다이렉트 충돌 수정** — _redirects가 Coins/Blog 콘텐츠 페이지를 가리는 버그 해결
- **QA 자동화** — qa-redirects.sh 스크립트 + CLAUDE.md QA 규칙 추가
- **전체 검증 PASS** — 3-Layer 검증 (Live URL 12/12 + Source 8/8 + Dist 12/12)

### v0.1.1 (2026-02-19)
- **Sprint 1 P0 수정 완료**
  - GSC 등록 + sitemap 제출 완료
  - API URL 중앙화 (src/config/api.ts 단일 소스)
  - CTA hover/active 피드백 추가
  - 콘셉트 정리: 백테스트 환경 제공이 핵심 (실거래 증명 불필요)
- **Sprint 2 P1 수정 완료**
  - i18n 387/387 키 완성 (EN=KO, 타입 안전)
  - meta description/title 전 페이지 최적화
  - 모바일 터치 타겟 44px, 반응형 개선
  - prose CSS 중복 제거 (global.css 단일)
  - ResizeObserver 메모리 릭 수정
- **MEDIUM 수정 완료**
  - CoinListTable `<a>` 태그 변환 (SEO 크롤링)
  - Market 펀딩률 CoinGecko `<a>` 링크
  - coin-symbols.ts non-ASCII 정리
  - Market disclaimer 데이터 갱신 주기 표시
- **Binance API 완전 제거** — CoinGecko로 전환 (autotrader IP 공유 문제 해결)
- **Market 거시경제 섹션** — TradingView Economic Calendar 추가

### v0.1.0 (2026-02-18, was v1.3.0)
- **6-Agent 종합 감사 완료**
- 감사 보고서: `docs/UNIFIED_AUDIT_v0.1.0.md`, `docs/COMPETITIVE_AUDIT_v0.1.0.md`

### v0.1.0 감사 점수 (before → after)
| 항목 | v0.1.0 감사 | v0.1.2 현재 | 변화 |
|------|------------|------------|------|
| 신뢰 신호 | 4/10 | 7/10 | +3 |
| SEO/인덱싱 | 6/10 | 8/10 | +2 |
| i18n 완성도 | 5/10 | 9/10 | +4 |
| 프론트엔드 코드 | 6/10 | 8/10 | +2 |
| UI/UX | 6/10 | 8/10 | +2 |
| 콘텐츠 품질 | 8/10 | 8/10 | = |
| 한국어 품질 | 8.5/10 | 8.5/10 | = |
| 법적 준수 | 7/10 | 7/10 | = |
| 데이터 정확도 | 9.5/10 | 9.5/10 | = |

## 인프라

```
개발: MacBook (jplee) ~/Desktop/pruviq
프론트엔드: Cloudflare Pages (pruviq.com)
백엔드 API: Mac Mini (jepo@172.30.1.16) :8080 → api.pruviq.com
  - SSH: ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 jepo@172.30.1.16
  - Tailscale: jepo@100.93.138.124
autotrader 서버 (DO): 절대 건드리지 않음
```

## Mac Mini 2계정 구조 (CRITICAL)

```
┌─────────────────────────────────────────────────────────────┐
│  Mac Mini에 같은 레포(pruviq/pruviq)가 2곳에 clone 됨     │
│                                                             │
│  jepo (/Users/jepo/pruviq)                                 │
│    - API 서버 (uvicorn --workers 1)                        │
│    - LaunchAgent: com.pruviq.api.plist                     │
│    - 데이터: /Users/jepo/pruviq-data/futures               │
│    - 용도: 백엔드 API 전용                                  │
│    - 주의: backend/ 코드 변경 시 여기도 git pull 필요       │
│                                                             │
│  openclaw (/Users/openclaw/pruviq)                         │
│    - OpenClaw 스킬봇 워크스페이스                           │
│    - 프론트엔드/스킬/메모리 작업 전용                       │
│    - OpenClaw이 자동 커밋+푸시 가능                         │
│    - 용도: 프론트엔드 + 콘텐츠 + 스킬                      │
│                                                             │
│  ⚠️ 충돌 방지 규칙:                                        │
│  1. backend/api/main.py 변경 → jepo 쪽 pull + 서버 재시작  │
│  2. openclaw은 backend/ 코드 직접 수정 금지                │
│  3. 프론트엔드만 변경하면 jepo pull 불필요 (Cloudflare 배포)│
│  4. 양쪽에서 동시 push 시 충돌 가능 → rebase로 해결        │
│                                                             │
│  API 서버 배포 절차:                                        │
│  1. MacBook에서 코드 수정 + git push                       │
│  2. ssh jepo → cd /Users/jepo/pruviq && git pull           │
│  3. kill uvicorn → nohup 재시작 (또는 LaunchAgent reload)  │
│  4. curl localhost:8080/health 확인                         │
└─────────────────────────────────────────────────────────────┘
```

## 백엔드 API 서버 설정 (2026-02-22)

```
- uvicorn --workers 1 (필수! 인메모리 캐시 공유 안 됨)
- CoinGecko 60초 백그라운드 폴링 (API 키 없음, 월간 한도 없음)
- 시작 시 pre-fetch (startup race condition 방지)
- LaunchAgent: ~/Library/LaunchAgents/com.pruviq.api.plist (jepo)
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
v0.0.1 ✅ 기반 뼈대
v0.0.2 ✅ 시뮬레이션 데모 (SL/TP 슬라이더, 즉시 결과)
v0.0.3 ✅ UX 구조조정 + i18n (NAV 간소화, 한국어 19페이지) [tag: v0.0.3]
v0.0.4 ✅ 콘텐츠 확장 (블로그 17x2, 전략 5x2)
v0.0.5 ✅ 시장 대시보드 + 코인 차트
v0.0.6 ✅ 전략 비교 + 성과 대시보드
v0.1.0 ✅ 6-Agent 종합 감사 완료 [tag: v0.1.0]
v0.1.1 ✅ Sprint 1 P0 수정 + Sprint 2 P1 수정
v0.1.2 ✅ MEDIUM 수정 + 리다이렉트 QA + 전체 검증 PASS
v0.2.0 ✅ 백엔드 API 연동 + 멀티 전략 + 5명 전문가 감사 (현재) [tag: v0.2.0]

v0.3.0: 성장 + 감사 수정
  - CRITICAL 4건 수정 (admin auth, memory leak, alt text, sitemap hreflang)
  - 블로그 트래픽 확보 (SEO 효과 측정)
  - 레퍼럴 전환 추적

v1.0.0: 정식 오픈
  - Product Hunt 런칭
  - 유료 기능 (있다면)
  - 안정성 확보 후
```
