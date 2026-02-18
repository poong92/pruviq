# PRUVIQ Roadmap v1.2

> 작성: 2026-02-18 | 작성자: 이재풍 + JEPO
> v1.1 완료 기반, 성장 단계 전환

---

## v1.1 완료 요약 (2026-02-18)

| Phase | 상태 | 주요 산출물 |
|-------|------|------------|
| Phase 1: Strategy Builder | ✅ 완료 | ConditionEngine, 11 인디케이터, /backtest API, Builder UI, 프리셋 5개 |
| Phase 1+: Multi-Strategy | ✅ 완료 | 5개 전략 시뮬레이션, 비교 페이지, 레지스트리 |
| Phase 2: 교육 + 수수료 | ✅ 완료 | 6개 교육 포스트 (EN+KO), FeeCalculator, BlogPost CTA |
| Phase 3: AI SEO 기술 | ✅ 완료 | FAQPage JSON-LD, robots.txt, llms.txt, README |

### 현재 자산
- **1,221 페이지** (EN+KO 이중언어)
- **17개 블로그 포스트** (11 EN + 6 KO 신규)
- **11개 기술 인디케이터** (BB, EMA, RSI, MACD, Stochastic, ADX, ATR, HV, Volume, Candle, Price Action)
- **5개 전략** (1 verified, 2 killed, 2 shelved)
- **575 코인 데이터** (2년+ 1H OHLCV)
- **인프라**: Cloudflare Pages + Mac Mini M4 Pro 64GB + DO 서버

### 현재 수익
- Binance 레퍼럴 (PRUVIQ 코드): 라이브, 트래픽 의존
- Bitget 어필리에이트: 심사 중

---

## Phase 4: 성장 엔진 (2026-03)

### 목표
월 방문자 0 → 1,000, 첫 레퍼럴 전환 달성

### 4-1. GitHub 공개 + 커뮤니티 시드

- [ ] **GitHub repo PUBLIC 전환** (⚠️ P0, AI SEO 블로커)
  - 현재 poong92/pruviq = PRIVATE
  - 백엔드 코드 분리 필요 (API 키, 서버 정보 제거)
  - 공개 범위: 프론트엔드 전체 + 백엔드 엔진 (API 키 제외)
- [ ] GitHub repo topics 추가 (crypto, backtesting, trading-strategy, no-code)
- [ ] GitHub Releases 생성 (v1.0.0)
- [ ] CONTRIBUTING.md + Issue templates
- [ ] GitHub Discussions 활성화

### 4-2. Product Hunt 런칭

- [ ] Product Hunt 계정 + 메이커 프로필
- [ ] 런칭 페이지 준비
  - 타이틀: "PRUVIQ - Free No-Code Crypto Strategy Backtester"
  - 태그라인: "Don't Believe. Verify. Test strategies on 535+ coins for free."
  - 스크린샷 5장: Builder, Backtest Results, Strategy Comparison, Equity Curve, Fee Calculator
  - GIF/비디오: 30초 데모 (조건 조합 → 백테스트 실행 → 결과 확인)
- [ ] 런칭 일정: 화요일 00:01 PST (최적 시간대)
- [ ] 헌터 섭외 또는 셀프 런칭

### 4-3. 콘텐츠 마케팅

#### Reddit (자연스러운 참여)
- [ ] r/algotrading: "Free tool I built for crypto backtesting" (Show & Tell)
- [ ] r/CryptoCurrency: 교육 포스트 + PRUVIQ 링크
- [ ] r/quantfinance: BB Squeeze 전략 분석 공유
- [ ] 규칙: 자기 홍보 비율 10% 이하, 커뮤니티 기여 우선

#### Medium / dev.to
- [ ] "I Built a Free Crypto Backtester - Here's What I Learned"
- [ ] "Why 4 Out of 5 Trading Strategies Fail (Data from 535 Coins)"
- [ ] "BB Squeeze: A Data-Driven Short Strategy That Actually Works"
- [ ] dev.to: 기술 스택 시리즈 (Astro + Preact + FastAPI)

#### Hacker News
- [ ] Show HN: "PRUVIQ - Free no-code crypto strategy backtester"
- [ ] 타이밍: Product Hunt 런칭 후 1주

### 4-4. 크립토 디렉토리 등록

- [ ] DappRadar
- [ ] CoinGecko Tools
- [ ] CryptoCompare
- [ ] AlternativeTo (TradingView 대안으로)
- [ ] ToolsForCrypto

---

## Phase 5: n8n 자동화 파이프라인 (2026-03)

### 목표
Mac Mini에서 24/7 자동 운영: 데이터 갱신, 콘텐츠 생성, 모니터링

### 5-1. 데이터 동기화 (매일 02:30 UTC)

```
[cron 02:30] → rsync DO서버 → Mac Mini
  → 새 데이터 감지
  → performance.json 재생성
  → demo-*.json 재생성 (5개 전략)
  → git commit + push → Cloudflare 자동 배포
```

- [ ] n8n 워크플로우: data-sync
- [ ] rsync 스크립트 (이미 crontab 존재, n8n으로 이관)
- [ ] performance.json 재생성 스크립트
- [ ] demo data 재생성 (generate_demo_data.py 자동 실행)
- [ ] Git auto-commit + push

### 5-2. 콘텐츠 생성 (매일 06:00 UTC)

```
[cron 06:00] → Ollama qwen2.5:32b
  → 시장 데이터 수집 (BTC 가격, 주요 이벤트)
  → 시장 리포트 초안 생성
  → Telegram 채널 자동 게시
  → 블로그 포스트 초안 → 검토 큐
```

- [ ] n8n 워크플로우: content-gen
- [ ] Ollama API 연동 (localhost:11434)
- [ ] 프롬프트 템플릿: 시장 리포트, 전략 분석, 교육 콘텐츠
- [ ] Telegram Bot 연동 (@PRUVIQ 채널)
- [ ] 초안 검토 큐 (n8n + 수동 승인)

### 5-3. 모니터링 (실시간)

```
[5분 간격] → API 헬스 체크
  → 응답시간 > 5초 → Telegram 알림
  → 에러율 > 1% → Telegram 알림

[1시간 간격] → 사이트 가용성 체크
  → pruviq.com 접속 불가 → 즉시 알림
  → api.pruviq.com 접속 불가 → 즉시 알림
```

- [ ] n8n 워크플로우: monitoring
- [ ] API health check (api.pruviq.com/health)
- [ ] Cloudflare Pages 상태 체크
- [ ] Telegram 알림 연동
- [ ] 에러 로그 수집 (Mac Mini uvicorn 로그)

### 5-4. 분산 게시 (매일 12:00 UTC)

- [ ] n8n 워크플로우: distribute
- [ ] Medium API 연동 (초안 → 발행)
- [ ] dev.to API 연동
- [ ] Twitter/X API 연동 (선택)

---

## Phase 6: 제품 고도화 (2026-04~)

### 6-1. 실시간 데이터

- [ ] WebSocket 시장 데이터 (Mac Mini ← Binance)
- [ ] 실시간 가격 표시 (MarketDashboard 개선)
- [ ] 실시간 시그널 알림 (Telegram 연동)
- [ ] 데이터 갱신 주기: 1H → 5분 (프리미엄)

### 6-2. 사용자 참여

- [ ] 사용자 전략 저장 (localStorage → 서버)
- [ ] 전략 공유 링크 (URL 파라미터 인코딩)
- [ ] 전략 리더보드 (익명, 성과 기반 랭킹)
- [ ] 사용자 리뷰/코멘트 (전략별)

### 6-3. 프리미엄 기능 (수익화)

| 기능 | 무료 | 프리미엄 ($10/월) |
|------|------|-------------------|
| 백테스트 실행 | 10회/일 | 무제한 |
| 코인 수 | 50개 | 575개 전체 |
| 데이터 기간 | 1년 | 2년+ 전체 |
| 커스텀 인디케이터 | - | ✅ |
| API 접근 | - | ✅ |
| 실시간 시그널 | - | ✅ |
| 전략 내보내기 | - | Pine Script, Python |

### 6-4. 모바일 PWA

- [ ] Service Worker 등록
- [ ] 오프라인 지원 (캐시된 데이터로 제한적 백테스트)
- [ ] 앱 설치 프롬프트
- [ ] 모바일 UX 최적화 (Builder 터치 UI)

### 6-5. 추가 인디케이터

| 인디케이터 | 우선순위 | 난이도 |
|-----------|---------|--------|
| Ichimoku Cloud | 중 | 중 |
| Fibonacci Retracement | 중 | 중 |
| VWAP | 높 | 낮 |
| OBV (On-Balance Volume) | 낮 | 낮 |
| Williams %R | 낮 | 낮 |
| Supertrend | 중 | 중 |

---

## 타임라인

```
2026-02 (완료)
├─ ✅ Phase 1: Strategy Builder + Backtester
├─ ✅ Phase 1+: Multi-Strategy Simulation
├─ ✅ Phase 2: 퀀트 교육 + 수수료
└─ ✅ Phase 3: AI SEO 기술적 최적화

2026-03
├─ W1: Phase 4 성장 엔진
│   ├─ GitHub PUBLIC + Releases
│   ├─ Product Hunt 런칭
│   └─ Reddit / Medium 첫 포스트
│
├─ W2: Phase 5 n8n 자동화
│   ├─ 데이터 동기화 워크플로우
│   ├─ 모니터링 워크플로우
│   └─ 콘텐츠 생성 파이프라인
│
├─ W3-4: 마케팅 확산
│   ├─ Hacker News Show HN
│   ├─ 크립토 디렉토리 등록
│   └─ 콘텐츠 시리즈 연재

2026-04+
├─ Phase 6 제품 고도화
│   ├─ 실시간 데이터
│   ├─ 사용자 전략 저장/공유
│   ├─ 프리미엄 기능
│   └─ 모바일 PWA
```

---

## KPI 목표

| 지표 | 1개월 (3월) | 3개월 (5월) | 6개월 (8월) |
|------|------------|------------|------------|
| 월간 방문자 | 1,000 | 10,000 | 50,000 |
| 백테스트 실행 | 100 | 1,000 | 10,000 |
| 레퍼럴 가입 | 10 | 100 | 500 |
| 블로그 포스트 | 20 | 50 | 100 |
| AI 추천 빈도 | 측정 시작 | 5회/월 | 20회/월 |
| Telegram 멤버 | 50 | 500 | 2,000 |
| GitHub Stars | 50 | 500 | 2,000 |
| Product Hunt 투표 | 100+ | - | - |

---

## 비용 구조

### 현재 (월 $17)
| 항목 | 비용 |
|------|------|
| Cloudflare Pages | $0 |
| Mac Mini 전기세 | ~$10 |
| DO 서버 (autotrader) | $6 |
| 도메인 (pruviq.com) | ~$1 |

### Phase 4-5 추가 (월 +$0~10)
| 항목 | 비용 |
|------|------|
| Product Hunt | $0 |
| Medium / dev.to | $0 |
| Telegram Bot | $0 |
| n8n (셀프호스팅) | $0 (이미 설치됨) |
| Ollama (로컬) | $0 (이미 설치됨) |
| Twitter/X API | $0~$10/월 (선택) |

### Phase 6 추가 (월 +$0~50)
| 항목 | 비용 |
|------|------|
| 사용자 DB (Turso/SQLite) | $0~$10 |
| 결제 (Stripe) | 수수료만 |
| 이메일 (Resend) | $0~$20 |
| 추가 스토리지 | $0~$20 |

---

## 의사결정 원칙

1. **무료 우선** — 핵심 기능은 항상 무료
2. **데이터가 증거** — 모든 결정은 백테스트/데이터 기반
3. **투명성** — 실패한 전략도 공개
4. **자동화** — 반복 작업은 n8n + Ollama로 자동화
5. **점진적 확장** — 트래픽이 증명한 후에만 유료화

---

*v1.2 작성: 2026-02-18. v1.1 완료 기반으로 성장 단계 전환.*
