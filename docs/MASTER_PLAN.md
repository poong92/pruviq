# PRUVIQ Master Plan v1.0

> 8명 전문가 통합 설계 (2026-02-15)
> 전문가: Data Research, System Architect, Infrastructure, Business Model, UX/Frontend, Simulation QA, Service Planning, Brand/Landing

---

## 1. 서비스 정의

**한 줄**: 투명한 오픈소스 엔진으로 크립토 전략을 검증하고, 시장 맥락 속에서 인사이트를 발견하는 플랫폼

**두 기둥:**
- 기둥 1: 전략 시뮬레이션 (핵심 차별점) — 전략 선택 → 객관적 성과 데이터
- 기둥 2: 시장 컨텍스트 — 뉴스/이벤트/시황 + 전략 성과 연결

**차별점**: 오픈소스 엔진(투명성) + 시장 맥락 통합 + OOS 검증 + 코딩 불필요

---

## 2. 아키텍처 (System Architect)

```
┌─────────────────────────────────────────────────┐
│                    API Layer                     │
│              FastAPI (Phase 2+)                  │
├─────────────────────────────────────────────────┤
│                  Result Layer                    │
│     SQLite Index + JSON Cache + Aggregator       │
├──────────────────────┬──────────────────────────┤
│   Simulation Layer   │  Market Context Layer     │
│   Engine + Strategy  │  BTC/Fear&Greed/News     │
│   Protocol + Cache   │  Events + AI Summary     │
├──────────────────────┴──────────────────────────┤
│                   Data Layer                     │
│  Parquet Storage + Coin Registry + Downloader    │
└─────────────────────────────────────────────────┘
```

**핵심 결정:**
- 저장: Parquet (CSV 대비 5-10x 빠른 로드, 80% 압축)
- 병렬: ProcessPoolExecutor → 500코인 시뮬레이션 40초
- 캐시: Content-addressable (전략+파라미터+데이터버전 해시)
- 전략: Strategy Protocol → 파일 추가만으로 등록

---

## 3. 인프라 (Infrastructure Architect)

```
MacBook (jplee)          Mac Mini (jepo)           DO Server
~/Desktop/pruviq    →    ~/pruviq              167.172.81.145
개발 전용                 운영/자동화/AI            autotrader ONLY
git push                 git pull               Docker
                         n8n (5678)
                         Ollama (11434)
                         PRUVIQ API (8400)
                         크론: 매시 데이터수집
```

**환경 분리:** Python venv 분리, API 키 분리, Git repo 분리
**크론 스케줄:**
- 매시 :05 — OHLCV 수집 (현물)
- 매시 :15 — OHLCV 수집 (선물)
- 4시간마다 — 시장 이벤트 수집
- UTC 01:00 — 시뮬레이션 배치 실행
- UTC 02:00 — AI 시황 요약 (Ollama)

**디스크:** 1년 후 ~63GB (Mac Mini 256GB 기준 40%+ 여유)

---

## 4. 데이터 (Data Research)

**소싱:**
- Binance 647개 USDT 선물 / 197+ 현물
- ccxt 페이지네이션으로 2년+ 히스토리
- Rate limit: 6000 weight/분 (IP별)

**저장:**
- 500코인 × 2년 1H = ~10.7GB (Parquet)
- 압축: Brotli로 50% 추가 절감

**업데이트:** 일일 배치 (01:00 UTC) — 1H 전략에 충분
**공정성:** 생존자 편향 방지 → 상폐 코인 추적 (CoinGecko API)

---

## 5. 사업 모델 (Business Model)

**시장:** 글로벌 크립토 봇 시장 $47B (2026), 65% 거래 자동화

**Freemium:**
| | Free | Pro $19/월 | Premium $49/월 |
|--|------|-----------|----------------|
| 전략 | 3개 | 무제한 | 무제한 |
| 코인 | 100개 | 500+ | 500+ |
| 데이터 | 1년 | 3년 | 5년 |
| 시뮬레이션 | 월 10회 | 무제한 | 무제한 |
| 시장 컨텍스트 | 30일 | 전체 | 전체 + AI |

**추가 수익:**
- Bybit Affiliate: 최대 50% (평생)
- Binance Affiliate: 41% 현물, 30% 선물
- 교육 콘텐츠, 전략 마켓플레이스

**비용:** 월 $1-6 (자가호스팅) → 손익분기: Pro 3명
**Year 1 목표:** 500 MAU, $12-16.5K 매출

---

## 6. 서비스 기획 (Service Planning)

**User Journey:**
1. Discovery → 3분 내 가치 이해 (가입 없이 데모)
2. Exploration → 전략 카탈로그 + 시장 맥락
3. Experimentation → 파라미터 조정 + 시뮬레이션
4. Conversion → Pro $19/월 (7일 무료)
5. Habit → 주 1회 재방문

**핵심 페이지:**
- 랜딩 → 전략 목록 → 전략 상세(결과) → 시장 컨텍스트 → 가격

**성공 지표:**
- Phase 1: MAU 1,000 / Pro 5% / MRR $500
- Phase 2: MAU 5,000 / Pro 8% / MRR $5,000
- Phase 3: MAU 20,000 / Pro 12% / MRR $50,000

---

## 7. UX/프론트엔드 (UX/Frontend)

**기술 스택:**
- Next.js 14+ (App Router) / Astro 5.x 중 선택
- Tailwind CSS + shadcn/ui
- Lightweight Charts (에쿼티 커브) + ApexCharts (히트맵)
- 다크모드 기본

**핵심 화면:**
1. 전략 카드 그리드 (필터/정렬)
2. 파라미터 슬라이더 + 실시간 프리뷰
3. 결과 대시보드 (지표 카드 + 에쿼티 커브 + 히트맵)
4. 시장 컨텍스트 타임라인 (이벤트 + 성과 오버레이)

**성능:** FCP < 1.5초, LCP < 2.5초, 차트 < 100ms
**모바일:** 웹 우선(분석 작업) + 반응형 → Phase 2에서 PWA

---

## 8. 브랜드/랜딩 (Brand/Landing)

**컬러:** Blue(신뢰) + Violet(혁신), 다크모드 기본
**폰트:** Inter(본문) + Source Serif Pro(제목) + Pretendard(한글)
**스택:** Astro 5.x + Tailwind 4.x
**성능:** Lighthouse 95+

**랜딩 8섹션:**
1. Nav (Sticky)
2. Hero (카피 + Interactive Chart)
3. Core Values (3 Cards)
4. Demo (백테스트 시뮬레이터)
5. Market Context Preview
6. Trust Indicators (숫자)
7. FAQ
8. Footer + CTA

---

## 9. 시뮬레이션 QA (Simulation QA)

**autotrader 교훈 → PRUVIQ 방지:**
- Look-ahead bias 자동 탐지 (5종 테스트)
- 캔들 인덱스 규약 + 결과 재현성 (해시 서명)
- 생존자 편향: 상폐 코인 데이터 보존
- 과적합 탐지: IS/OOS 비교, Sharpe Decay, Parameter Sensitivity
- Monte Carlo 10,000회 + Walk-forward 검증

**사용자 투명성:**
- 신뢰 구간 표시 (±X%)
- 거래 수 경고 (30건 미만 = "Insufficient")
- 과적합 경고 배지
- 면책 조항 (한/영)

**검증 배지 시스템:** 7개 긍정 + 5개 경고 배지

---

## 10. 통합 로드맵

### Phase 0 (1-2주): 기반 구축
- [ ] Parquet 저장소 + 데이터 수집 파이프라인
- [ ] 시뮬레이션 엔진 검증 (QA 5종 테스트)
- [ ] BB Squeeze 전략 1개 완전 검증
- [ ] 300코인 5분 이내 시뮬레이션
- [ ] Mac Mini 크론 설정

### Phase 1 (3-4주): MVP
- [ ] 전략 3개 추가 + 검증
- [ ] 웹 대시보드 v1 (전략 목록 + 결과)
- [ ] 기본 시장 지표 (BTC, 공포탐욕)
- [ ] 랜딩 페이지 (pruviq.com)
- [ ] 베타 50명 초대

### Phase 2 (5-8주): 확장
- [ ] 파라미터 커스텀 UI
- [ ] 멀티 거래소 (Bybit, OKX 추가)
- [ ] 시장 이벤트 타임라인
- [ ] Freemium 결제 (Stripe)
- [ ] PWA 전환

### Phase 3 (9-12주+): 고도화
- [ ] AI 시황 요약 (Ollama)
- [ ] 포트폴리오 시뮬레이션
- [ ] 커뮤니티 (전략 공유)
- [ ] 거래소 Affiliate 연동
- [ ] MAU 1,000 → 5,000

---

## 11. 즉시 실행 (이번 주)

1. **GitHub repo 생성** — poong92/pruviq
2. **Parquet 저장소** — downloader.py → Parquet 출력으로 전환
3. **Binance 현물 전체 다운로드** — 거래량 상위 300개
4. **BB Squeeze 검증** — QA 5종 테스트 통과
5. **Mac Mini 환경 설정** — venv, 크론, git pull

---

## 참고 문서

| 문서 | 내용 |
|------|------|
| docs/ARCHITECTURE.md | 시스템 아키텍처 상세 |
| docs/INFRASTRUCTURE.md | 인프라 환경 설계 |
| docs/BUSINESS_MODEL.md | 사업 모델 + 수익 구조 |
| docs/SERVICE_PLAN.md | 서비스 기획서 |
| docs/UX_DESIGN.md | UX/프론트엔드 설계 |
| docs/BRAND_DESIGN.md | 브랜드 + 랜딩 페이지 |
| docs/SIMULATION_QA.md | 시뮬레이션 품질 보증 |
