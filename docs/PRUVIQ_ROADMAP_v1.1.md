# PRUVIQ Roadmap v1.1

> 작성: 2026-02-18 | 작성자: 이재풍 + JEPO
> 비전: TradingView/Investing.com/CoinGecko/CoinMarketCap 급 전문 퀀트투자 분석 플랫폼

---

## 비전

PRUVIQ = 사용자가 직접 전략을 설계하고 2년+ 실데이터로 백테스팅할 수 있는 **세계 최초 무료 크립토 퀀트 플랫폼**

### 벤치마크 대상과 차별점

| 서비스 | 강점 | PRUVIQ 차별점 |
|--------|------|--------------|
| TradingView | 차트 + Pine Script + 소셜 | 크립토 전용, 실거래 검증, 무료 백테스터 |
| Investing.com | 뉴스 + 경제 캘린더 | 퀀트 전략 중심, AI 기반 분석 |
| CoinGecko | 코인 데이터 + API | 전략 시뮬레이션 + 교육 |
| CoinMarketCap | 시장 데이터 + 추적 | 실전 검증된 백테스트 결과 |

---

## 현재 자산 (2026-02-18)

### 기술 스택
- **Frontend**: Astro + Preact → Cloudflare Pages (pruviq.com)
- **Backend API**: FastAPI → Mac Mini M4 Pro 64GB (api.pruviq.com)
- **터널**: Cloudflare Tunnel (Mac Mini ↔ 외부)
- **자동화**: n8n + Ollama qwen2.5:32b (Mac Mini)
- **트레이딩 데이터**: DO 서버 (167.172.81.145) → rsync → Mac Mini

### 이미 구축된 것
- [x] 웹사이트 v1.0 (1,209 페이지, EN/KO 이중 언어)
- [x] 5개 전략 시뮬레이션 API (BB Squeeze, Momentum, ATR, HV)
- [x] Coin Explorer (575개 코인)
- [x] Strategy Library (5개 전략 상세 페이지)
- [x] Strategy Comparison (5개 전략 비교)
- [x] Strategy Builder v1.0 (기본 UI + /backtest API 연동)
- [x] Performance Dashboard (38일 실거래 데이터)
- [x] 수수료 비교 페이지 (Binance 레퍼럴 라이브)
- [x] 613개 코인 1H OHLCV 데이터 (2년+)
- [x] Mac Mini 인프라 (보안 A등급, LaunchAgent 자동 시작)
- [x] Binance 레퍼럴 코드 PRUVIQ (현물 19/1, 선물 9/1)
- [x] ConditionEngine v1.0 (JSON 조건 파싱 + 벡터화 시그널 생성)
- [x] IndicatorPipeline v1.1 (BB, EMA, ATR, HV, Volume, Candle, RSI, MACD, Stochastic, ADX, Price Action)
- [ ] Bitget 어필리에이트 (심사 중)

### 수익 구조
| 채널 | 상태 | 예상 수익 |
|------|------|----------|
| Binance 레퍼럴 | 라이브 | 트래픽 의존 |
| Bitget 어필리에이트 | 심사 중 | 트래픽 의존 |
| 프리미엄 전략 | Phase 2 | $10-50/월 구독 |
| 광고 | Phase 3 | 트래픽 10K+/월 후 |

---

## Phase 1: Strategy Builder + Backtester (3주)

### 목표
사용자가 직접 전략 조건을 조합하고, 613개 코인 2년+ 데이터로 실제 백테스트를 실행할 수 있는 환경

### 1-1. 백엔드 엔진 (Week 1)

#### 데이터 준비
- [x] autotrader 613개 코인 데이터 → Mac Mini rsync
- [x] DataManager 검증 (메모리 ~4GB, 64GB 중 6%)
- [x] 데이터 경로 통일 (pruviq-data → pruviq/data) ← symlink 완료
- [x] 데이터 자동 동기화 cron (매일 02:30 UTC) ← crontab 설정됨

#### ConditionEngine (핵심)
사용자가 UI에서 조합한 조건을 JSON으로 받아 시그널 생성

```python
# 사용자 전략 JSON 예시
{
  "name": "My BB Squeeze Short",
  "direction": "short",
  "entry": {
    "operator": "AND",
    "conditions": [
      {"indicator": "bb", "field": "squeeze", "op": "==", "value": true},
      {"indicator": "bb", "field": "expansion_rate", "op": ">=", "value": 0.10},
      {"indicator": "ema", "field": "ema_fast", "op": "<", "value": "ema_slow"},
      {"indicator": "volume", "field": "vol_ratio", "op": ">=", "value": 2.0},
      {"indicator": "candle", "field": "bearish", "op": "==", "value": true}
    ]
  },
  "risk": { "sl_pct": 10, "tp_pct": 8, "max_bars": 48 },
  "filters": {
    "avoid_hours": [2, 3, 10, 20, 21, 22, 23],
    "min_volume_usd": 1000000
  },
  "backtest": {
    "start_date": "2024-01-01",
    "end_date": "2026-02-18",
    "position_size_usd": 60,
    "leverage": 5
  }
}
```

구현 파일:
- `backend/src/engine/condition_engine.py` - JSON 조건 파싱 + 시그널 생성 ✅
- `backend/src/engine/indicator_pipeline.py` - 동적 인디케이터 계산 ✅
- `backend/src/engine/backtest_engine.py` - 시그널 → 거래 → PnL → 통계

#### 인디케이터 라이브러리

| 인디케이터 | 필드 | 상태 |
|------------|------|------|
| BB (Bollinger Bands) | upper, lower, mid, width, squeeze, expansion_rate | ✅ 구현됨 |
| EMA (이동평균) | ema_fast, ema_slow, ema_trend | ✅ 구현됨 |
| ATR | atr, upper_band, lower_band | ✅ 구현됨 |
| HV (Historical Volatility) | hv, hv_squeeze, hv_percentile | ✅ 구현됨 |
| Volume | vol_ratio, volume_sma, volume_zscore | ✅ 구현됨 |
| Candle Pattern | bullish, bearish, doji, hammer | ✅ 구현됨 |
| RSI | rsi, rsi_oversold, rsi_overbought | ✅ 구현됨 |
| MACD | macd, signal, histogram, crossover | ✅ 구현됨 |
| Stochastic | stoch_k, stoch_d, oversold, overbought | ✅ 구현됨 |
| ADX | adx, plus_di, minus_di, trend_strength | ✅ 구현됨 |
| Price Action | close_vs_high_20, close_vs_low_20, breakout | ✅ 구현됨 |

#### API 엔드포인트

```
POST /backtest          ← 커스텀 전략 백테스트 (핵심) ✅
GET  /builder/indicators ← 사용 가능한 인디케이터 목록 + 필드 ✅
GET  /builder/presets    ← 프리셋 전략 목록 (기존 5개) ✅
GET  /coins             ← 코인 목록 + 메타데이터 ✅
POST /simulate          ← 기존 프리셋 시뮬레이션 ✅
POST /simulate/compare  ← 전략 비교 ✅
```

#### 성능 요구사항
- 1개 코인 백테스트: < 0.5초
- 50개 코인 백테스트: < 5초
- 535개 코인 전체 백테스트: < 30초
- 동시 요청: 4 workers (Mac Mini 14코어)

### 1-2. 프론트엔드 Strategy Builder (Week 2)

#### Strategy Builder UI
- [x] StrategyBuilder.tsx - 메인 빌더 UI (Preact island)
- [x] ConditionRow 개선 - 인디케이터별 optgroup 분류 완료
- [x] BacktestResults 대시보드 - 연간 분석, avg win/loss, consecutive losses
- [x] EquityCurve 차트 (lightweight-charts 구현 완료)
- [x] builder.astro / ko/builder.astro - 페이지

### 1-3. 프리셋 연동 (Week 2)

기존 5개 전략을 Builder에서 "Load Preset"으로 불러오기:
- BB Squeeze SHORT (검증됨, 실거래 운영 중)
- BB Squeeze LONG (killed)
- Momentum LONG (killed)
- ATR Breakout (shelved)
- HV Squeeze (shelved)

프리셋 로드 → 조건 자동 채움 → 사용자가 수정 → 백테스트 실행

---

## Phase 1B: 24/7 자동화 인프라 (Phase 1과 동시 진행)

### Mac Mini OpenClaw + n8n 파이프라인

#### 추천 구성: 하이브리드

```
[자동화 작업] OpenClaw + Ollama qwen2.5:32b (무료, 24/7)
├─ 블로그 콘텐츠 초안 생성
├─ SEO 메타 태그 최적화
├─ 데이터 수집 + 업데이트
├─ 소셜 미디어 포스팅
├─ 모니터링 + 알림
└─ 반복적 코드 수정

[핵심 개발] Claude Code on MacBook (기존 구독)
├─ Strategy Builder 아키텍처
├─ ConditionEngine 핵심 로직
├─ 복잡한 UI 컴포넌트
└─ 보안/성능 최적화
```

#### n8n 워크플로우 설계

```
┌─ 매일 02:30 UTC ─────────────────────────────────┐
│ [데이터 동기화]                                     │
│  DO서버 → rsync → Mac Mini                        │
│  → 새 데이터 감지 → performance.json 재생성       │
│  → git commit + push → Cloudflare 자동 배포       │
└──────────────────────────────────────────────────┘

┌─ 매일 06:00 UTC ─────────────────────────────────┐
│ [콘텐츠 생성]                                      │
│  Ollama → 시장 리포트 초안 생성                    │
│  → Telegram 채널 자동 게시                         │
│  → 블로그 포스트 초안 → 검토 큐                    │
└──────────────────────────────────────────────────┘

┌─ 매일 12:00 UTC ─────────────────────────────────┐
│ [분산 게시]                                        │
│  검토 완료된 콘텐츠 → Medium API                   │
│  → dev.to API → Twitter/X API                     │
│  → Reddit (수동 검토 후)                           │
└──────────────────────────────────────────────────┘

┌─ 실시간 ────────────────────────────────────────┐
│ [모니터링]                                        │
│  "PRUVIQ" 웹 언급 감지 → Telegram 알림            │
│  사용자 피드백 수신 → 분류 → 대응                  │
│  서버 헬스 체크 (5분 간격)                         │
│  API 응답시간 추적                                 │
└──────────────────────────────────────────────────┘
```

---

## Phase 2: 퀀트 교육 + 수수료 최적화 ✅ COMPLETE

### 퀀트 교육 콘텐츠

#### 인디케이터 교육 시리즈 (Builder와 연동)
각 교육 포스트에서 "Open Strategy Builder →" 버튼으로 직접 실습

| 콘텐츠 | 형식 | 상태 |
|--------|------|------|
| BB Squeeze란? | 블로그 + 차트 설명 | ✅ 기존 완료 |
| RSI 과매수/과매도 활용법 | 블로그 + Builder 연동 | ✅ 완료 (EN+KO) |
| EMA 크로스오버 전략 | 블로그 + Builder 연동 | ✅ 완료 (EN+KO) |
| MACD 다이버전스 | 블로그 + Builder 연동 | ✅ 완료 (EN+KO) |
| 볼륨 프로파일 분석 | 블로그 + Builder 연동 | ✅ 완료 (EN+KO) |
| 스토캐스틱 + ADX | 블로그 + Builder 연동 | ✅ 완료 (EN+KO) |
| 백테스트 101: 과적합 피하기 | 교육 아티클 | ✅ 기존 완료 |
| 리스크 관리: Kelly Criterion | 교육 아티클 | ✅ 기존 완료 |
| SL/TP 최적화 가이드 | 교육 + 데이터 기반 분석 | ✅ 완료 (EN+KO) |

#### 수수료 최적화 도구
- [x] FeeCalculator 인터랙티브 컴포넌트 (Preact island)
- [x] 거래량/거래횟수/메이커비율 슬라이더
- [x] 5개 거래소 실시간 비교 (Binance, Bybit, OKX, Bitget, MEXC)
- [x] 연간 절감액 자동 계산 + PRUVIQ 레퍼럴 적용
- [x] EN + KO 양국어 지원
- [x] /fees 및 /ko/fees 페이지에 임베드

#### BlogPost CTA 개선
- [x] education 카테고리: "Build Your Own Strategy" → Strategy Builder 링크
- [x] 기타 카테고리: 기존 "Try Live Demo" CTA 유지

---

## Phase 3: AI SEO (GEO) + 마케팅 (지속)

### 목표
GPT, Gemini, Claude, Perplexity에게 "크립토 백테스팅 도구 추천해줘"라고 물었을 때 PRUVIQ가 답변에 포함되도록 최적화

### AI 크롤링 타겟 (우선순위)

1. **GitHub** - 오픈소스 백테스팅 라이브러리 공개 (README에 PRUVIQ 링크)
2. **Product Hunt** - 공식 런칭 (Phase 1 완료 후)
3. **Reddit** - r/algotrading, r/CryptoCurrency 자연스러운 언급
4. **Medium / dev.to** - 퀀트 교육 아티클 시리즈
5. **Hacker News** - Show HN 포스트
6. **Stack Overflow / Quant SE** - 관련 질문에 PRUVIQ 활용 답변
7. **크립토 디렉토리** - DeFi Llama, DappRadar 등 등록

---

## 타임라인 총정리

```
2026-02
├─ W3 (2/18~): Phase 1 백엔드 확장 ✅ COMPLETE
│   ├─ ✅ P0: 데이터 경로 통일 (symlink)
│   ├─ ✅ RSI, MACD, Stochastic, ADX 인디케이터 (11개 전체 구현)
│   ├─ ✅ ConditionEngine 새 인디케이터 연동 (벡터화)
│   ├─ ✅ /backtest API 성능: 535코인 2.9s (목표 30s)
│   ├─ ✅ 데이터 자동 동기화 cron (02:30 UTC)
│   ├─ ✅ API 4 workers (M4 Pro 14코어 활용)
│   └─ ✅ Yearly stats 추가 (/backtest 응답)
│
├─ W3+W4 (2/18~): Phase 1 프론트엔드 확장 ✅ COMPLETE
│   ├─ ✅ Strategy Builder: 인디케이터별 필드 그룹핑 (optgroup)
│   ├─ ✅ Strategy Builder: 인디케이터 파라미터 튜닝 UI
│   ├─ ✅ BacktestResults: 연간 분석 테이블
│   ├─ ✅ BacktestResults: avg win/loss, max consecutive losses
│   ├─ ✅ Preset 연동 (5개 프리셋, API 기반)
│   └─ ✅ 전체 파이프라인 스크립트 (update→regen→reload)

├─ W3 (2/18): Phase 2 퀀트 교육 + 수수료 ✅ COMPLETE
│   ├─ ✅ 6개 인디케이터 교육 포스트 (RSI, EMA, MACD, Volume, Stochastic+ADX, SL/TP)
│   ├─ ✅ 각 포스트 EN + KO 양국어 (12 페이지)
│   ├─ ✅ FeeCalculator 인터랙티브 컴포넌트 (거래소 5개 비교)
│   ├─ ✅ BlogPost education CTA → Strategy Builder 연동
│   └─ ✅ 빌드: 1,221 페이지, 0 에러

2026-03
├─ W1 (3/3~): Phase 3 AI SEO 시작
│   ├─ GitHub 오픈소스 공개
│   ├─ Product Hunt 준비 + 런칭
│   └─ 분산 게시 자동화 가동
│
├─ W2 (3/10~): Phase 3 마케팅 확산
│   ├─ Reddit / Medium / dev.to 콘텐츠
│   ├─ Hacker News Show HN
│   └─ 크립토 디렉토리 등록

2026-04+
├─ 지속 성장
│   ├─ 사용자 전략 마켓플레이스
│   ├─ 프리미엄 구독 (고급 인디케이터, API 접근)
│   ├─ 실시간 시장 대시보드
│   └─ 모바일 앱 (PWA)
```

---

## 핵심 KPI

| 지표 | 1개월 | 3개월 | 6개월 |
|------|-------|-------|-------|
| 월간 방문자 | 1,000 | 10,000 | 50,000 |
| 백테스트 실행 | 100 | 1,000 | 10,000 |
| 레퍼럴 가입 | 10 | 100 | 500 |
| 블로그 포스트 | 10 | 30 | 60 |
| AI 추천 빈도 | 측정 시작 | 5회/월 | 20회/월 |

---

## 비용 구조

### 현재 (월 고정비)
| 항목 | 비용 |
|------|------|
| Cloudflare Pages | $0 (무료) |
| Mac Mini (전기세) | ~$10 |
| DO 서버 (autotrader) | $6 |
| 도메인 (pruviq.com) | ~$1 |
| **합계** | **~$17/월** |

### 추천 조합
1. **최소 비용**: Ollama 로컬 ($0) + 기존 Claude Pro → **$17/월**
2. **최적 밸런스**: OpenClaw Cloud Executive ($149) → **$166/월**
3. **최대 품질**: Claude Max $200 + Ollama 자동화 → **$217/월**

---

*이 로드맵은 실행 결과에 따라 지속 업데이트됩니다.*
