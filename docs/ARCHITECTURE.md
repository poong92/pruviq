# PRUVIQ Simulation Engine Architecture v1.0

> 전략 시뮬레이션 + 시장 컨텍스트 플랫폼
> 설계일: 2026-02-15
> 작성: System Architect

---

## 1. 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRUVIQ Platform Architecture                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────── DATA LAYER ────────────────────────────┐     │
│  │                                                                    │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │     │
│  │  │   Binance    │  │    Bybit    │  │     OKX     │  ...         │     │
│  │  │ Spot/Futures │  │ Spot/Futures│  │ Spot/Futures│              │     │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘              │     │
│  │         │                 │                 │                      │     │
│  │         ▼                 ▼                 ▼                      │     │
│  │  ┌─────────────────────────────────────────────────┐              │     │
│  │  │          Collector (ccxt + scheduler)            │              │     │
│  │  │  - 매 시간 자동 수집 (cron / n8n)               │              │     │
│  │  │  - 증분 업데이트 (since last timestamp)          │              │     │
│  │  │  - 상장/상폐 추적 (coin_registry)                │              │     │
│  │  └────────────────────┬────────────────────────────┘              │     │
│  │                       │                                            │     │
│  │                       ▼                                            │     │
│  │  ┌─────────────────────────────────────────────────┐              │     │
│  │  │             Storage (Parquet + Registry)         │              │     │
│  │  │  data/                                           │              │     │
│  │  │  ├── ohlcv/                                      │              │     │
│  │  │  │   ├── binance/spot/BTCUSDT_1h.parquet        │              │     │
│  │  │  │   ├── binance/futures/BTCUSDT_1h.parquet     │              │     │
│  │  │  │   ├── bybit/spot/BTCUSDT_1h.parquet          │              │     │
│  │  │  │   └── ...                                     │              │     │
│  │  │  ├── registry/                                   │              │     │
│  │  │  │   ├── coin_registry.json (상장/상폐 기록)     │              │     │
│  │  │  │   └── exchange_metadata.json                  │              │     │
│  │  │  └── market_context/                             │              │     │
│  │  │      ├── btc_daily.parquet                       │              │     │
│  │  │      ├── fear_greed.parquet                      │              │     │
│  │  │      └── events/                                 │              │     │
│  │  └─────────────────────────────────────────────────┘              │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────── SIMULATION LAYER ──────────────────────────┐     │
│  │                                                                    │     │
│  │  ┌──────────────┐    ┌────────────────────────┐                   │     │
│  │  │  Strategy     │    │   SimulationEngine     │                   │     │
│  │  │  Protocol     │───▶│                        │                   │     │
│  │  │  (Plugin)     │    │  - 바 단위 시뮬레이션  │                   │     │
│  │  └──────────────┘    │  - 비용 모델 적용      │                   │     │
│  │                       │  - look-ahead 방지     │                   │     │
│  │  ┌──────────────┐    └──────────┬─────────────┘                   │     │
│  │  │  Strategies   │              │                                  │     │
│  │  │  ├── BB Squeeze│             │                                  │     │
│  │  │  ├── RSI Mean │              ▼                                  │     │
│  │  │  │   Reversion│    ┌────────────────────────┐                   │     │
│  │  │  ├── Momentum │    │   BatchRunner          │                   │     │
│  │  │  │   Breakout │    │                        │                   │     │
│  │  │  └── ...      │    │  - 전체 코인 병렬 실행 │                   │     │
│  │  └──────────────┘    │  - 파라미터 그리드서치  │                   │     │
│  │                       │  - 결과 캐싱            │                   │     │
│  │  ┌──────────────┐    └──────────┬─────────────┘                   │     │
│  │  │  CostModel    │              │                                  │     │
│  │  │  (거래소별)   │              │                                  │     │
│  │  │  - 수수료     │              │                                  │     │
│  │  │  - 슬리피지   │              │                                  │     │
│  │  │  - 펀딩비     │              │                                  │     │
│  │  └──────────────┘              │                                  │     │
│  └────────────────────────────────┼──────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────── RESULT LAYER ───────────────────────────────┐     │
│  │                                                                    │     │
│  │  ┌──────────────────┐  ┌──────────────────┐                       │     │
│  │  │  ResultAggregator │  │   ResultStore     │                       │     │
│  │  │                   │  │                   │                       │     │
│  │  │  - 전략별 집계    │  │  - JSON 캐시       │                       │     │
│  │  │  - 코인별 상세    │  │  - SQLite 메타     │                       │     │
│  │  │  - 기간별 분석    │  │  - 무효화 정책     │                       │     │
│  │  │  - 랭킹/비교     │  │                   │                       │     │
│  │  └────────┬─────────┘  └────────┬──────────┘                       │     │
│  │           │                      │                                  │     │
│  │           ▼                      ▼                                  │     │
│  │  ┌───────────────────────────────────────┐                         │     │
│  │  │           API Layer (FastAPI)          │                         │     │
│  │  │                                       │                         │     │
│  │  │  GET /strategies                      │                         │     │
│  │  │  GET /strategies/{id}/results         │                         │     │
│  │  │  GET /strategies/{id}/coins/{symbol}  │                         │     │
│  │  │  GET /market-context/{date}           │                         │     │
│  │  │  POST /simulate (custom params)       │                         │     │
│  │  └───────────────────────────────────────┘                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────── MARKET CONTEXT LAYER ──────────────────────────┐     │
│  │                                                                    │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │     │
│  │  │ Price/Vol    │  │ Events       │  │ AI Summary   │            │     │
│  │  │ Tracker      │  │ Collector    │  │ (Phase 3)    │            │     │
│  │  │              │  │              │  │              │            │     │
│  │  │ - BTC daily  │  │ - 뉴스 RSS  │  │ - Ollama     │            │     │
│  │  │ - 변동성     │  │ - 이벤트 API │  │ - 시황 요약  │            │     │
│  │  │ - 공포탐욕   │  │ - 수동 입력  │  │ - 연결 분석  │            │     │
│  │  │ - 펀딩비     │  │ - 규제 뉴스  │  │              │            │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌──────────────────── INFRASTRUCTURE ────────────────────────────────┐     │
│  │                                                                    │     │
│  │  MacBook (개발)              Mac Mini (운영, 24/7)                │     │
│  │  ~/Desktop/pruviq            ~/pruviq                             │     │
│  │  - 코딩, 테스트              - cron/n8n 데이터 수집              │     │
│  │  - 전략 개발                 - 배치 시뮬레이션                    │     │
│  │  - 결과 분석                 - Ollama AI 요약                    │     │
│  │                              - API 서버 (FastAPI)                │     │
│  │                                                                    │     │
│  │  GitHub (pruviq/pruviq)     Cloudflare Pages (웹 대시보드)      │     │
│  │  - 코드 관리                 - 정적 프론트엔드                    │     │
│  │  - CI/CD                     - API 프록시                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 디렉토리 구조 최종안

```
pruviq/
├── src/
│   ├── __init__.py
│   │
│   ├── data/                          # 데이터 수집/관리
│   │   ├── __init__.py
│   │   ├── downloader.py              # [기존] ccxt OHLCV 다운로더
│   │   ├── collector.py               # 스케줄 기반 자동 수집기
│   │   ├── registry.py                # 코인 상장/상폐 레지스트리
│   │   ├── storage.py                 # Parquet 읽기/쓰기 추상화
│   │   └── validators.py              # 데이터 품질 검증 (결측, 이상치)
│   │
│   ├── simulation/                    # 시뮬레이션 엔진
│   │   ├── __init__.py
│   │   ├── engine.py                  # [기존] 단일 코인 시뮬레이션
│   │   ├── batch_runner.py            # 전체 코인 병렬 실행기
│   │   ├── grid_search.py            # 파라미터 그리드 서치
│   │   ├── cost_models.py            # 거래소별 비용 모델
│   │   └── cache.py                  # 결과 캐싱 (해시 기반)
│   │
│   ├── strategies/                    # 전략 플러그인
│   │   ├── __init__.py
│   │   ├── base.py                    # Strategy Protocol 정의
│   │   ├── bb_squeeze.py              # [기존] BB Squeeze
│   │   ├── rsi_mean_reversion.py      # Phase 1 추가
│   │   ├── momentum_breakout.py       # Phase 1 추가
│   │   └── registry.py               # 전략 자동 발견/등록
│   │
│   ├── results/                       # 결과 집계/저장
│   │   ├── __init__.py
│   │   ├── aggregator.py             # 전략별/코인별/기간별 집계
│   │   ├── store.py                  # SQLite 메타 + JSON 결과
│   │   ├── comparator.py            # 전략 간 비교, 랭킹
│   │   └── export.py                 # CSV/JSON/Parquet 내보내기
│   │
│   ├── market_context/                # 시장 컨텍스트 (기둥 2)
│   │   ├── __init__.py
│   │   ├── price_tracker.py          # BTC/ETH 일봉, 변동성, 상관
│   │   ├── fear_greed.py             # 공포탐욕 지수 수집
│   │   ├── funding_rate.py           # 선물 펀딩비 수집
│   │   ├── events.py                 # 뉴스/이벤트 저장 구조
│   │   └── correlator.py            # 전략 성과-시장 이벤트 연결
│   │
│   └── api/                           # API 서버 (Phase 2+)
│       ├── __init__.py
│       ├── app.py                     # FastAPI 앱
│       ├── routes/
│       │   ├── strategies.py
│       │   ├── results.py
│       │   ├── market_context.py
│       │   └── simulate.py
│       └── schemas.py                 # Pydantic 모델
│
├── data/                              # 데이터 저장소 (gitignore)
│   ├── ohlcv/                         # OHLCV 데이터 (Parquet)
│   │   ├── binance/
│   │   │   ├── spot/                  # BTCUSDT_1h.parquet, ...
│   │   │   └── futures/
│   │   ├── bybit/
│   │   │   ├── spot/
│   │   │   └── futures/
│   │   └── okx/
│   │       ├── spot/
│   │       └── futures/
│   ├── registry/                      # 메타데이터
│   │   ├── coin_registry.json         # 상장/상폐 추적
│   │   └── exchange_metadata.json     # 거래소 설정
│   ├── market_context/                # 시장 컨텍스트 데이터
│   │   ├── btc_daily.parquet
│   │   ├── fear_greed.parquet
│   │   ├── funding_rates/
│   │   └── events/
│   │       ├── 2024.json
│   │       ├── 2025.json
│   │       └── 2026.json
│   ├── cache/                         # 시뮬레이션 결과 캐시
│   │   └── {strategy_hash}/
│   │       └── {params_hash}.json
│   └── results/                       # 최종 결과 (SQLite + JSON)
│       ├── results.db                 # 메타데이터 인덱스
│       └── details/                   # 거래별 상세
│
├── scripts/                           # 실행 스크립트
│   ├── download_data.py               # [기존] 수동 데이터 다운로드
│   ├── run_simulation.py              # 시뮬레이션 실행
│   ├── update_data.py                 # 증분 데이터 업데이트
│   ├── update_market_context.py       # 시장 컨텍스트 업데이트
│   └── generate_report.py            # 결과 리포트 생성
│
├── tests/                             # 테스트
│   ├── test_engine.py                 # [기존]
│   ├── test_storage.py
│   ├── test_batch_runner.py
│   ├── test_grid_search.py
│   ├── test_cache.py
│   ├── test_registry.py
│   ├── test_strategies/
│   │   ├── test_bb_squeeze.py
│   │   └── test_base_protocol.py
│   └── fixtures/                      # 테스트용 데이터
│       └── sample_ohlcv.parquet
│
├── docs/                              # 문서
│   ├── ARCHITECTURE.md                # 이 문서
│   └── STRATEGY_GUIDE.md             # 전략 작성 가이드
│
├── .claude/
│   └── CLAUDE.md                      # 프로젝트 CLAUDE.md
│
├── .gitignore
├── requirements.txt
└── pyproject.toml                     # 프로젝트 메타데이터
```

### 기존 파일과의 매핑

| 기존 파일 | 새 위치 | 변경사항 |
|-----------|---------|----------|
| `src/data/downloader.py` | 유지 | 거래소 추가 시 EXCHANGE_CONFIG 확장 |
| `src/simulation/engine.py` | 유지 | CostModel을 cost_models.py로 분리 |
| `src/strategies/bb_squeeze.py` | 유지 | Strategy Protocol을 base.py로 분리 |
| `data/spot/*.csv` | `data/ohlcv/binance/spot/*.parquet` | CSV -> Parquet 마이그레이션 |
| `tests/test_engine.py` | 유지 | 추가 테스트 파일 확장 |
| `scripts/download_data.py` | 유지 | 추가 스크립트 확장 |

---

## 3. 데이터 흐름

### 3.1 데이터 수집 흐름

```
[매 시간 cron / n8n 트리거]
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Collector.update_all()                               │
│                                                       │
│  1. exchange_metadata.json 로드                       │
│     → 활성 거래소 목록, 마지막 수집 시각               │
│                                                       │
│  2. 거래소별 순회:                                     │
│     for exchange in [binance, bybit, okx, ...]:       │
│       for market in [spot, futures]:                  │
│         a. coin_registry 확인 → 활성 코인 목록        │
│         b. 각 코인 since=last_timestamp 로 증분 수집   │
│         c. Parquet append (row group 단위)             │
│         d. 데이터 검증 (결측, 타임스탬프 연속성)        │
│         e. exchange_metadata 업데이트                  │
│                                                       │
│  3. 신규 상장 감지:                                    │
│     - exchange.load_markets() vs coin_registry 비교    │
│     - 새 코인 → registry 추가 + 730일 히스토리 수집    │
│                                                       │
│  4. 상폐 감지:                                        │
│     - 거래소에서 사라진 코인 → registry에 delist 기록   │
│     - 데이터는 삭제하지 않음 (생존자 편향 방지)         │
└──────────────────────────────────────────────────────┘
```

### 3.2 시뮬레이션 흐름

```
[사용자 요청: "BB Squeeze, SL 10%, TP 8%, Binance Futures, SHORT"]
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  BatchRunner.run(strategy, params, exchange, market)  │
│                                                       │
│  1. 캐시 확인                                         │
│     cache_key = hash(strategy + params + data_version)│
│     → 캐시 HIT → 즉시 반환                           │
│     → 캐시 MISS → 시뮬레이션 실행                     │
│                                                       │
│  2. 데이터 로드                                       │
│     registry = CoinRegistry.load(exchange, market)    │
│     coins = registry.get_active_coins(period)         │
│     dataframes = Storage.load_batch(coins)            │
│                                                       │
│  3. 병렬 시뮬레이션 (ProcessPoolExecutor)              │
│     for coin in coins:                                │
│       results[coin] = engine.run(df, strategy, coin)  │
│                                                       │
│  4. 결과 집계                                         │
│     aggregated = Aggregator.aggregate(results)        │
│     - 전체 성과 요약                                  │
│     - 코인별 상세                                     │
│     - 기간별 브레이크다운                              │
│     - equity curve 합성                               │
│                                                       │
│  5. 캐시 저장 + ResultStore 저장                       │
│     cache.store(cache_key, aggregated)                │
│     store.save(aggregated, metadata)                  │
│                                                       │
│  6. 반환                                              │
│     return AggregatedResult                           │
└──────────────────────────────────────────────────────┘
```

### 3.3 결과 제공 흐름

```
[API 요청 or CLI 실행]
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  ResultStore.query(filters)                           │
│                                                       │
│  1. SQLite 인덱스 조회                                │
│     - 전략명, 거래소, 기간, 정렬 기준                  │
│                                                       │
│  2. 상세 데이터 로드 (JSON)                            │
│     - 거래별 상세                                      │
│     - equity curve                                     │
│     - 코인별 브레이크다운                              │
│                                                       │
│  3. 시장 컨텍스트 연결 (optional)                      │
│     - 같은 기간 BTC 가격/변동성                        │
│     - 공포탐욕 지수                                    │
│     - 관련 이벤트                                      │
│                                                       │
│  4. 응답 포맷팅                                       │
│     - JSON API → 웹 대시보드                           │
│     - CSV → 다운로드                                   │
│     - 터미널 테이블 → CLI                              │
└──────────────────────────────────────────────────────┘
```

### 3.4 시장 컨텍스트 흐름

```
[매일 1회 cron / n8n]
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  MarketContextUpdater.daily_update()                  │
│                                                       │
│  1. BTC 일봉 + 변동성                                 │
│     - ccxt로 BTC/USDT 1D 수집                         │
│     - 30일 HV, 7일 HV 계산                            │
│     - btc_daily.parquet에 append                      │
│                                                       │
│  2. 공포탐욕 지수                                     │
│     - alternative.me API 호출                         │
│     - fear_greed.parquet에 append                     │
│                                                       │
│  3. 펀딩비 (선물 전용)                                 │
│     - 거래소 API로 펀딩비 히스토리 수집                 │
│     - funding_rates/에 거래소별 저장                   │
│                                                       │
│  4. 이벤트 (수동 + 자동)                               │
│     - RSS 피드 파싱 (CoinDesk, CoinTelegraph 등)      │
│     - 구조: {date, title, category, impact, source}   │
│     - events/YYYY.json에 append                       │
│                                                       │
│  5. [Phase 3] AI 시황 요약                             │
│     - Ollama에 당일 데이터 전달                        │
│     - 시황 요약 텍스트 생성                            │
│     - events/에 type=ai_summary로 저장                │
└──────────────────────────────────────────────────────┘
```

---

## 4. 핵심 설계 결정

### 4.1 저장 포맷: Parquet (CSV에서 마이그레이션)

| 기준 | CSV (현재) | Parquet (권장) | SQLite |
|------|-----------|----------------|--------|
| **읽기 속도** | 느림 (전체 파싱) | 매우 빠름 (컬럼 단위) | 빠름 |
| **파일 크기** | 큼 (텍스트) | 작음 (압축 70-80%) | 중간 |
| **컬럼 선택 읽기** | 불가 | 가능 | 가능 |
| **append 편의성** | 간단 | row group 단위 | 간단 |
| **pandas 호환** | 좋음 | 매우 좋음 | 좋음 |
| **도구 호환** | 범용 | 분석 도구 표준 | 범용 |

**결정: Parquet**
- 수백 코인 x 2년+ = 파일 수백 개, 각각 17K+ 행
- 읽기 속도가 시뮬레이션 성능의 병목
- pandas `read_parquet`으로 CSV 대비 5-10배 빠른 로드
- 압축으로 디스크 절약 (BTC 17K행: CSV ~1.5MB -> Parquet ~300KB)
- Phase 0에서 기존 CSV를 Parquet으로 1회 마이그레이션

### 4.2 병렬 처리: ProcessPoolExecutor

```
전략 1개 x 코인 500개 시뮬레이션:
  - 직렬: ~500초 (코인당 ~1초)
  - 8코어 병렬: ~65초 (8배 가속)
  - M4 Pro 14코어: ~40초

그리드 서치 (10 파라미터 조합 x 500 코인):
  - 직렬: ~5,000초 (83분)
  - 14코어 병렬: ~360초 (6분)
```

**설계 원칙**:
- 코인 단위 병렬화 (전략 로직은 코인 간 독립)
- `concurrent.futures.ProcessPoolExecutor` 사용 (GIL 회피)
- 메모리 관리: 코인 데이터를 워커에 전달 시 복사 최소화
- 진행률 표시: tqdm 또는 커스텀 프로그레스 콜백

### 4.3 캐시 전략: Content-addressable Hash

```python
# 캐시 키 생성 로직
cache_key = sha256(
    strategy_name +
    sorted(params) +
    exchange +
    market_type +
    data_version +     # 데이터 최신 timestamp
    direction
)

# 무효화 조건
# 1. 데이터가 업데이트되면 data_version 변경 → 캐시 미스
# 2. 전략 코드 변경 시 strategy_version bump → 캐시 미스
# 3. 수동 캐시 클리어 지원
```

**캐시 저장 구조**:
```
data/cache/
├── bb_squeeze/
│   ├── a1b2c3d4.json    # params_hash → 결과
│   ├── e5f6g7h8.json
│   └── manifest.json     # 캐시 인덱스, 만료 시간
```

### 4.4 Strategy Protocol (플러그인 아키텍처)

```python
# src/strategies/base.py
from typing import Protocol, Optional
import pandas as pd

class Strategy(Protocol):
    """모든 전략이 구현해야 하는 인터페이스"""

    name: str
    version: str           # 캐시 무효화용

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """지표 계산. df에 필요한 컬럼 추가."""
        ...

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        시그널 확인.
        idx = 완성된 캔들 인덱스.
        return: "long", "short", or None

        규칙:
        - idx 행의 데이터만 사용 (look-ahead bias 방지)
        - 진입은 idx+1의 open에서 발생 (엔진이 처리)
        """
        ...

    def get_params(self) -> dict:
        """현재 파라미터 반환 (캐시 키, 결과 기록용)"""
        ...

    def get_param_grid(self) -> dict:
        """그리드 서치용 파라미터 범위 정의 (optional)"""
        ...
```

**전략 등록 (자동 발견)**:
```python
# src/strategies/registry.py
# strategies/ 디렉토리의 모든 Strategy 구현을 자동 수집
# 새 전략 파일 추가만으로 시스템에 등록
```

### 4.5 비용 모델: 거래소별 분리

```python
# src/simulation/cost_models.py

COST_MODELS = {
    "binance_spot": CostModel(
        fee_maker=0.001,     # 0.10%
        fee_taker=0.001,     # 0.10%
        slippage=0.0002,     # 0.02%
    ),
    "binance_futures": CostModel(
        fee_maker=0.0002,    # 0.02%
        fee_taker=0.0004,    # 0.04%
        slippage=0.0002,     # 0.02%
        funding_rate=True,   # 8시간마다 펀딩비 적용
    ),
    "bybit_spot": CostModel(
        fee_maker=0.001,
        fee_taker=0.001,
        slippage=0.0003,     # Binance보다 약간 높음
    ),
    "bybit_futures": CostModel(
        fee_maker=0.0002,
        fee_taker=0.00055,
        slippage=0.0003,
        funding_rate=True,
    ),
    "okx_spot": CostModel(
        fee_maker=0.0008,
        fee_taker=0.001,
        slippage=0.0003,
    ),
    "okx_futures": CostModel(
        fee_maker=0.0002,
        fee_taker=0.0005,
        slippage=0.0003,
        funding_rate=True,
    ),
}
```

### 4.6 생존자 편향 방지: Coin Registry

```python
# data/registry/coin_registry.json 구조
{
    "binance_futures": {
        "BTCUSDT": {
            "listed": "2019-09-13",
            "delisted": null,         # null = 현재 활성
            "status": "active"
        },
        "LUNAUSDT": {
            "listed": "2020-08-10",
            "delisted": "2022-05-28",  # Terra 사태 후 상폐
            "status": "delisted"
        }
    }
}

# 시뮬레이션 시 사용:
# - 특정 날짜에 존재했던 코인만 시뮬레이션에 포함
# - 상폐 코인도 데이터 보존 (과거 백테스트 정확성)
# - "현재 살아있는 코인만" 테스트하면 생존자 편향 발생
```

### 4.7 시장 컨텍스트 연결 구조

```python
# data/market_context/events/2026.json 구조
[
    {
        "date": "2026-02-07",
        "title": "BTC Short Squeeze - $233M 청산",
        "category": "market_event",     # market_event | regulation | macro | exchange
        "impact": "high",               # high | medium | low
        "source": "CoinGlass",
        "tags": ["btc", "short_squeeze", "liquidation"],
        "description": "BTC $72K까지 급등, 알트코인 연쇄 반등"
    },
    {
        "date": "2026-02-12",
        "title": "US CPI 발표",
        "category": "macro",
        "impact": "medium",
        "source": "BLS",
        "tags": ["macro", "cpi", "inflation"]
    }
]

# Correlator가 시뮬레이션 결과와 매칭:
# "BB Squeeze SHORT 전략은 short squeeze 이벤트 당일 SL 히트 3배 증가"
```

---

## 5. Phase별 구현 우선순위

### Phase 0: 기반 구축 (현재 ~ 2주)

**목표**: 단일 거래소, 단일 전략으로 end-to-end 파이프라인 완성

```
Week 1:
├── [P0-1] Storage 레이어 구축
│   ├── storage.py: Parquet 읽기/쓰기
│   ├── CSV -> Parquet 마이그레이션 스크립트
│   └── 테스트: 읽기/쓰기/증분 업데이트
│
├── [P0-2] BatchRunner 구축
│   ├── batch_runner.py: 전체 코인 병렬 시뮬레이션
│   ├── ProcessPoolExecutor + 진행률 표시
│   └── 테스트: 10개 코인 병렬 실행
│
└── [P0-3] ResultAggregator 구축
    ├── aggregator.py: 전략별/코인별 집계
    ├── 출력: 터미널 테이블 (tabulate)
    └── 테스트: 집계 정확성

Week 2:
├── [P0-4] 캐시 시스템
│   ├── cache.py: 해시 기반 캐싱
│   ├── 무효화 정책 구현
│   └── 테스트: 캐시 히트/미스
│
├── [P0-5] CoinRegistry
│   ├── registry.py: 상장/상폐 추적
│   ├── 초기 데이터: Binance 현재 코인 목록
│   └── 테스트: 날짜 기준 코인 필터
│
├── [P0-6] 자동 수집기
│   ├── collector.py: cron 기반 증분 업데이트
│   ├── crontab 설정 (Mac Mini용)
│   └── 테스트: 증분 수집 정확성
│
└── [P0-7] E2E 검증
    ├── BB Squeeze 전략으로 Binance Spot 전체 코인 시뮬레이션
    ├── 결과를 autotrader 백테스트와 교차 검증 (독립 구현이지만 유사 결과 기대)
    └── 성능 벤치마크 (500코인 시뮬레이션 소요시간)
```

**Phase 0 완료 기준**:
- Binance Spot 300+ 코인 데이터 Parquet 저장
- BB Squeeze 전략 300+ 코인 병렬 시뮬레이션 5분 이내 완료
- 결과: 전략 요약 + 코인별 상세 + 기간별 분석 출력
- 캐시: 동일 시뮬레이션 재실행 시 1초 이내 반환
- 테스트: 20개+ 통과

---

### Phase 1: 전략 확장 + 기본 컨텍스트 (2주)

**목표**: 전략 3개, 시장 컨텍스트 기본, 비교 기능

```
Week 3:
├── [P1-1] Strategy Protocol 분리
│   ├── base.py: Protocol 정의 분리 (engine.py에서)
│   ├── registry.py: 전략 자동 발견
│   └── 전략 작성 가이드 문서 (STRATEGY_GUIDE.md)
│
├── [P1-2] 추가 전략 2개
│   ├── rsi_mean_reversion.py: RSI 과매도/과매수 평균 회귀
│   │   - RSI < 30 Long, RSI > 70 Short
│   │   - 볼린저 밴드 확인
│   ├── momentum_breakout.py: 돌파 전략
│   │   - N봉 고가/저가 돌파
│   │   - 볼륨 확인
│   └── 각 전략 테스트
│
└── [P1-3] 전략 비교 기능
    ├── comparator.py: 전략 간 성과 비교
    ├── 동일 코인/기간에서 전략 A vs B vs C
    └── 랭킹: Sharpe 기준, PF 기준, MDD 기준

Week 4:
├── [P1-4] 시장 컨텍스트 기본
│   ├── price_tracker.py: BTC 일봉 + 변동성
│   ├── fear_greed.py: 공포탐욕 지수 수집
│   └── correlator.py: 전략 성과-시장 상태 기본 연결
│
├── [P1-5] 그리드 서치
│   ├── grid_search.py: 파라미터 조합 탐색
│   ├── BB Squeeze: SL [5,7,10,12], TP [4,6,8,10], ...
│   ├── 결과: 최적 파라미터 + 히트맵
│   └── 과적합 경고 (IS vs OOS 비교)
│
├── [P1-6] ResultStore (SQLite)
│   ├── store.py: SQLite 메타데이터 인덱스
│   ├── 쿼리: "BB Squeeze 전략의 모든 결과 조회"
│   └── JSON 상세 결과 연결
│
└── [P1-7] 멀티 거래소 데이터 (Binance + Bybit)
    ├── downloader.py EXCHANGE_CONFIG에 Bybit 추가
    ├── Bybit Spot/Futures 데이터 수집
    └── 거래소 간 비교 가능
```

**Phase 1 완료 기준**:
- 전략 3개 (BB Squeeze, RSI MR, Momentum)
- 전략 간 비교 리포트 출력
- BTC 가격/변동성 + 공포탐욕 지수 수집
- 그리드 서치: BB Squeeze 최적 파라미터 탐색
- Binance + Bybit 데이터 수집
- ResultStore에 모든 결과 저장

---

### Phase 2: 사용자 경험 + API (3주)

**목표**: 웹에서 전략 선택 -> 결과 조회 가능

```
Week 5-6:
├── [P2-1] FastAPI 서버
│   ├── app.py: 기본 앱 + CORS
│   ├── routes/strategies.py: GET /strategies
│   ├── routes/results.py: GET /strategies/{id}/results
│   ├── routes/simulate.py: POST /simulate (커스텀 파라미터)
│   └── schemas.py: Pydantic 모델 (요청/응답)
│
├── [P2-2] 웹 대시보드 v1 (Astro + Tailwind)
│   ├── 전략 목록 페이지
│   ├── 전략 상세 페이지 (성과 차트, 코인 테이블)
│   ├── 파라미터 조정 UI
│   └── 시장 컨텍스트 타임라인
│
├── [P2-3] 멀티 거래소 확장 (OKX, Gate.io 등)
│   ├── 거래소 4-6개 지원
│   ├── 동일 전략의 거래소별 비교
│   └── 거래소별 비용 모델 정확화
│
└── [P2-4] 뉴스/이벤트 연동
    ├── events.py: RSS 피드 파싱 (CoinDesk, CoinTelegraph)
    ├── 수동 이벤트 입력 지원
    └── 전략 성과 차트에 이벤트 마커 오버레이

Week 7:
├── [P2-5] 선물 전용 기능
│   ├── 펀딩비 수집 + 시뮬레이션 반영
│   ├── 레버리지 설정 (1x, 2x, 3x, 5x, 10x)
│   ├── 청산가 계산 + 경고
│   └── 현물 vs 선물 비교 리포트
│
└── [P2-6] 결과 내보내기
    ├── CSV 다운로드
    ├── JSON API
    └── PDF 리포트 생성 (선택)
```

**Phase 2 완료 기준**:
- FastAPI 서버: 5개 이상 엔드포인트
- 웹 대시보드: 전략 선택 -> 결과 조회 가능
- 거래소 4개 이상 지원
- 선물 펀딩비 반영
- 뉴스/이벤트 타임라인

---

### Phase 3: 고도화 (4주+)

**목표**: AI 시황, 실시간 업데이트, 커뮤니티 기능

```
├── [P3-1] AI 시황 요약 (Ollama + Mac Mini)
│   ├── 당일 데이터 → Llama 시황 요약 생성
│   ├── 한국어 + 영어 자동 생성
│   └── 텔레그램 자동 발송 (n8n)
│
├── [P3-2] 실시간 시뮬레이션 (near-real-time)
│   ├── 데이터 15분 간격 업데이트
│   ├── 현재 활성 시그널 표시
│   ├── WebSocket 기반 알림 (optional)
│   └── "지금 이 전략을 적용하면 이 코인에서 시그널 활성"
│
├── [P3-3] 커뮤니티 기능
│   ├── 사용자 커스텀 전략 업로드 (코드 샌드박스)
│   ├── 전략 공유/랭킹 보드
│   ├── 사용자별 포트폴리오 시뮬레이션
│   └── 댓글/토론
│
├── [P3-4] 고급 분석
│   ├── Monte Carlo 시뮬레이션
│   ├── Walk-forward 최적화
│   ├── 상관관계 분석 (전략 간, 코인 간)
│   └── 포트폴리오 최적화 (여러 전략 조합)
│
└── [P3-5] 프리미엄 기능
    ├── Stripe 결제 연동
    ├── 프리미엄 전략 잠금
    ├── API 키 발급 (외부 연동)
    └── 실시간 알림 (텔레그램/디스코드)
```

---

## 6. 기술 스택 권장사항

### 핵심 스택 (Phase 0-1)

| 영역 | 기술 | 이유 |
|------|------|------|
| **언어** | Python 3.11+ | 기존 코드베이스, pandas/numpy 생태계 |
| **데이터 처리** | pandas + numpy | 시뮬레이션 연산, 기존 코드 호환 |
| **저장 포맷** | Parquet (pyarrow) | 컬럼 단위 읽기, 압축, 빠른 로드 |
| **데이터 수집** | ccxt | 멀티 거래소 통합 API (기존 사용 중) |
| **병렬 처리** | concurrent.futures | 표준 라이브러리, 간단한 API |
| **테스트** | pytest | 표준, 풍부한 플러그인 |
| **메타 저장** | SQLite | 서버리스, 파일 기반, 충분한 성능 |
| **진행률** | tqdm | 배치 시뮬레이션 진행 표시 |
| **CLI** | argparse / click | 스크립트 실행 인터페이스 |

### 확장 스택 (Phase 2-3)

| 영역 | 기술 | 이유 |
|------|------|------|
| **API 서버** | FastAPI | 비동기, 자동 문서, Pydantic 통합 |
| **웹 프론트** | Astro + Tailwind CSS | 정적 사이트, 빠른 빌드, SEO |
| **차트** | Chart.js / Lightweight Charts | 가볍고 모바일 호환 |
| **호스팅** | Cloudflare Pages (프론트) + Mac Mini (API) | 무료 CDN + 로컬 서버 |
| **스케줄러** | cron (단순) / n8n (복잡) | Mac Mini 24/7 운영 |
| **AI 요약** | Ollama (로컬) + Groq API (운영) | 비용 효율 AI |
| **결제** | Stripe | 글로벌 결제, Python SDK |

### 의존성 관리 (requirements.txt 확장)

```
# Core (Phase 0)
ccxt>=4.0.0
pandas>=2.0.0
numpy>=1.24.0
pyarrow>=14.0.0          # Parquet 지원
tqdm>=4.65.0             # 진행률

# Testing
pytest>=7.0.0

# Phase 1
tabulate>=0.9.0          # 터미널 테이블 출력

# Phase 2
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0            # 비동기 HTTP 클라이언트

# Phase 3
# stripe>=8.0.0
# feedparser>=6.0.0      # RSS 파싱
```

---

## 7. 핵심 제약사항 및 설계 원칙

### 7.1 Look-ahead Bias 방지 (autotrader 교훈 계승)

```
절대 규칙:
1. check_signal(df, idx) → idx 행까지의 데이터만 사용
2. 진입가 = idx+1의 open (다음 캔들 시가)
3. 지표 계산에 미래 데이터 사용 금지
4. SL/TP 체크 시 진입 이후 캔들만 확인

검증 방법:
- test_look_ahead_bias() 테스트 필수 (기존 구현됨)
- 전략 추가 시 해당 테스트 자동 적용
```

### 7.2 autotrader와의 독립성

```
원칙:
- 코드 복사 금지 (개념만 참고)
- 데이터 공유 금지 (각자 수집)
- 설정값 참조 금지 (독립 검증)
- 동일 전략이라도 독립 구현 → 교차 검증 가능

공유 가능:
- 교훈/원칙 (look-ahead bias, 생존자 편향 등)
- 설계 패턴 (Strategy Protocol 개념)
```

### 7.3 데이터 공정성

```
투명성 원칙:
1. 모든 시뮬레이션 결과에 비용 모델 명시
2. 현물/선물 구분 명확히 표기
3. 거래소별 수수료 차이 반영
4. 슬리피지 모델링 명시
5. 면책 조항: "시뮬레이션 결과는 실제 수익을 보장하지 않습니다"
```

### 7.4 확장성 가드레일

```
성능 목표:
- 500코인 x 1전략 시뮬레이션: 5분 이내
- 500코인 x 10파라미터 그리드 서치: 30분 이내
- API 응답 시간 (캐시 히트): 100ms 이내
- 매 시간 데이터 수집: 10분 이내 (6거래소 전체)

스케일 한계 (1인 개발자 현실):
- 실시간 WebSocket 스트리밍 → Phase 3 이후
- 사용자 커스텀 전략 실행 → 샌드박스 필수 (보안)
- 동시 사용자 100명 이상 → Mac Mini 한계, 클라우드 필요
```

---

## 8. 데이터 규모 추정

### 현재 (Phase 0)

| 항목 | 규모 |
|------|------|
| 거래소 | 1 (Binance) |
| 시장 | 1 (Spot) |
| 코인 | ~300 (거래량 상위) |
| 타임프레임 | 1H |
| 기간 | 2년 (~17,500 행/코인) |
| 총 행 수 | ~5.25M |
| CSV 총 용량 | ~4.5GB |
| Parquet 총 용량 | ~900MB (80% 압축) |

### 최종 목표 (Phase 2-3)

| 항목 | 규모 |
|------|------|
| 거래소 | 6 (Binance, Bybit, OKX, Gate, Bitget, MEXC) |
| 시장 | 2 (Spot + Futures) |
| 코인 | ~500 x 6거래소 x 2시장 = ~6,000 심볼 (중복 제거 ~1,500 유니크) |
| 타임프레임 | 1H |
| 기간 | 2년 |
| 총 행 수 | ~105M |
| Parquet 총 용량 | ~18GB |
| 일일 증분 | ~144K 행 (~25MB Parquet) |
| 월간 증분 | ~750MB |

**디스크 예산**: Mac Mini 512GB SSD 기준, 데이터 50GB 할당 시 2년+ 여유

---

## 9. 인프라 배치도

```
┌─────────────────────────────────────────────────────────┐
│  MacBook (jplee) — 개발 환경                             │
│  ~/Desktop/pruviq                                       │
│                                                         │
│  역할:                                                  │
│  - 코드 작성, 테스트, 리뷰                               │
│  - 소규모 시뮬레이션 (10-50 코인)                        │
│  - 웹 프론트엔드 개발                                   │
│  - git push → GitHub → Mac Mini pull                    │
│                                                         │
│  도구: Claude Code, pytest, venv                        │
└───────────────────────┬─────────────────────────────────┘
                        │ git push
                        ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub (pruviq/pruviq)                                │
│                                                         │
│  역할:                                                  │
│  - 소스 코드 관리                                       │
│  - CI: pytest 자동 실행 (GitHub Actions)                │
│  - CD: Mac Mini에 자동 배포 (webhook or cron pull)      │
└───────────────────────┬─────────────────────────────────┘
                        │ git pull (cron)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Mac Mini (jepo) — 운영 환경 (24/7)                      │
│  ~/pruviq                                               │
│                                                         │
│  역할:                                                  │
│  1. 데이터 수집 (cron, 매 시간)                          │
│     - 6 거래소 x 2 시장 OHLCV 증분 수집                 │
│     - 시장 컨텍스트 일 1회 수집                          │
│                                                         │
│  2. 배치 시뮬레이션 (야간 or on-demand)                  │
│     - 새 데이터로 전체 시뮬레이션 재실행                  │
│     - 캐시 업데이트                                     │
│                                                         │
│  3. API 서버 (FastAPI, Phase 2+)                        │
│     - Tailscale로 외부 접근                             │
│     - 또는 Cloudflare Tunnel                            │
│                                                         │
│  4. AI 시황 (Ollama, Phase 3)                           │
│     - 로컬 LLM으로 시황 요약 생성                       │
│                                                         │
│  5. n8n 자동화                                          │
│     - 데이터 수집 오케스트레이션                         │
│     - 텔레그램 알림                                     │
│     - 컨텐츠 자동 생성                                  │
│                                                         │
│  crontab:                                               │
│    0 * * * *  cd ~/pruviq && python scripts/update_data.py│
│    0 1 * * *  cd ~/pruviq && python scripts/update_market_context.py│
│    0 3 * * *  cd ~/pruviq && python scripts/run_simulation.py --all│
│    0 */6 * * * cd ~/pruviq && git pull origin main      │
│                                                         │
│  리소스: M4 Pro 14코어 / 64GB RAM / 512GB SSD           │
└───────────────────────┬─────────────────────────────────┘
                        │ API 응답
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages — 웹 프론트엔드                       │
│  pruviq.com                                             │
│                                                         │
│  역할:                                                  │
│  - 정적 웹 대시보드 (Astro + Tailwind)                  │
│  - Mac Mini API를 프록시로 호출                         │
│  - 전략 결과 시각화                                     │
│  - 시장 컨텍스트 타임라인                               │
│  - 무료 CDN, HTTPS, DDoS 방어                          │
└─────────────────────────────────────────────────────────┘
```

---

## 10. 리스크 및 완화 전략

| 리스크 | 영향 | 완화 |
|--------|------|------|
| **데이터 수집 실패** (API 장애) | 불완전한 데이터 | 재시도 로직 + 결측 감지 경고 + 다음 시간 재수집 |
| **Parquet 파일 손상** | 데이터 유실 | 일일 백업 (rsync to 외장 드라이브 or cloud) |
| **시뮬레이션 로직 버그** | 잘못된 결과 | 단위 테스트 + autotrader 교차 검증 + look-ahead 테스트 |
| **Mac Mini 장애** | 서비스 중단 | 데이터 GitHub 백업, API는 "점검 중" 페이지로 fallback |
| **캐시 무효화 누락** | 오래된 결과 제공 | data_version 기반 자동 무효화 + 수동 클리어 CLI |
| **과적합 결과 발표** | 신뢰 손상 | IS/OOS 분리 필수, 과적합 경고 배지, 면책 조항 |
| **API 키 노출** | 보안 침해 | .env 사용, gitignore 철저, 읽기 전용 API 키만 사용 |
| **1인 개발 병목** | 진행 지연 | Phase 단위 MVP, 핵심 기능 우선, 완벽주의 지양 |

---

## 부록 A: 주요 데이터 모델

### SimulationResult (확장)

```
SimulationResult:
  strategy_name: str
  strategy_version: str
  exchange: str                    # "binance", "bybit", ...
  market_type: str                 # "spot" | "futures"
  symbol: str                      # "BTCUSDT" (단일 코인) or "ALL" (집계)
  params: dict
  direction: str                   # "long" | "short" | "both"
  period: str                      # "2024-01-01 ~ 2026-02-15"

  # 성과 요약
  total_trades: int
  wins: int
  losses: int
  win_rate: float
  total_return_pct: float
  profit_factor: float
  sharpe_ratio: float              # 추가
  calmar_ratio: float              # 추가
  avg_win_pct: float
  avg_loss_pct: float

  # 리스크
  max_drawdown_pct: float
  max_consecutive_losses: int
  avg_bars_held: float             # 추가

  # 비용
  total_fees_pct: float
  total_funding_pct: float         # 선물 전용

  # 청산별
  tp_count: int
  sl_count: int
  timeout_count: int

  # 기간별 브레이크다운
  yearly_breakdown: dict           # {2024: {...}, 2025: {...}}

  # 상세 (optional, 대용량)
  trades: list[Trade]
  equity_curve: list[float]
```

### AggregatedResult (전체 코인 집계)

```
AggregatedResult:
  strategy_name: str
  exchange: str
  market_type: str
  total_coins: int
  coins_with_trades: int

  # 전체 집계
  summary: SimulationResult        # 모든 코인 합산

  # 코인별
  by_coin: dict[str, SimulationResult]

  # 기간별
  by_year: dict[str, SimulationResult]

  # 상위/하위
  top_coins: list[str]             # PnL 상위 10
  worst_coins: list[str]           # PnL 하위 10

  # 메타
  run_timestamp: str
  data_version: str
  cache_key: str
```

---

## 부록 B: API 엔드포인트 설계 (Phase 2)

```
GET  /api/v1/strategies
     → 사용 가능한 전략 목록

GET  /api/v1/strategies/{strategy_id}
     → 전략 상세 (파라미터, 설명)

GET  /api/v1/strategies/{strategy_id}/results
     ?exchange=binance&market=futures&direction=short
     → 시뮬레이션 결과 요약

GET  /api/v1/strategies/{strategy_id}/results/{symbol}
     → 특정 코인 상세 결과

GET  /api/v1/strategies/{strategy_id}/results/compare
     ?params=a,b,c
     → 파라미터 조합 비교

POST /api/v1/simulate
     body: {strategy, params, exchange, market, direction}
     → 커스텀 시뮬레이션 실행 (큐잉)

GET  /api/v1/market-context/{date}
     → 해당 날짜 시장 컨텍스트

GET  /api/v1/market-context/timeline
     ?from=2024-01-01&to=2026-02-15
     → 기간별 시장 이벤트 타임라인

GET  /api/v1/exchanges
     → 지원 거래소 목록 + 코인 수
```

---

## 부록 C: 기존 코드에서의 마이그레이션 경로

### engine.py 변경사항

현재 `engine.py`에 포함된 `CostModel`과 `Strategy Protocol`을 분리:

```
현재:
  engine.py → CostModel, Strategy, SimulationEngine, SimulationResult, Trade

Phase 1 이후:
  strategies/base.py    → Strategy Protocol
  simulation/cost_models.py → CostModel, COST_MODELS
  simulation/engine.py  → SimulationEngine (import from above)
  results/aggregator.py → SimulationResult 확장 + AggregatedResult
```

분리 시 기존 import 호환을 위해 `engine.py`에서 re-export:
```python
# engine.py (하위 호환)
from src.strategies.base import Strategy
from src.simulation.cost_models import CostModel
```

### 데이터 마이그레이션

```
현재: data/spot/btcusdt_1h.csv
이후: data/ohlcv/binance/spot/BTCUSDT_1h.parquet

마이그레이션 스크립트:
  scripts/migrate_csv_to_parquet.py
  - 기존 CSV 읽기
  - Parquet 변환 + 압축
  - 검증 (행 수, 값 일치)
  - 디렉토리 구조 변경
```

---

## QA Assurance Layer (추가: 2026-04-24)

Data/Simulation/Result/API Layer 위에 깔리는 **수직 관통 검증 인프라**.
자세한 아키텍처: [QA_AUTOMATION.md](QA_AUTOMATION.md)

핵심 레이어 (9):
1. **Discovery** — 52 canonical 루트 인터랙티브 엘리먼트 인벤토리
2. **Click-everything** — 클릭 후 populated 결과 검증
3. **Hook contract** — static JSON shape + 비즈니스 invariant
- **3.5** Live-API contract — api.pruviq.com 실시간 응답
4. **Freshness monitor** — 15-min cron, stale 감지 + auto-issue
5. **Scenario flows** — 4 핵심 유저 여정 step-by-step
6. **A11y interactive** — 클릭 후 axe 0 신규 위반
7. **Nightly sweep** — 매일 02:00 UTC prod 전수
8. **Flake classifier** — passed-after-retry 격리

**추가 검증**:
- Lighthouse budget (5 URL × 4 카테고리 + Web Vitals)
- Blog populated (78 포스트 h1+body 검증)
- Broken-link crawler (dist/ 전수 href HEAD)
- docs-lint (경로 오염/구 namespace/Mac Mini 드리프트 grep 가드) <!-- docs-lint-allow: meta-description of what this guard blocks -->

**설계 원칙**: "페이지 로드됨"이 아닌 **"클릭 결과 populated"** 로 검증.
정적 + 라이브 API 양쪽에서 같은 schema 모듈을 공유 — 한쪽만 통과 못 해도
CI red.

---

*이 문서는 PRUVIQ 시뮬레이션 엔진의 설계 가이드입니다. Phase 진행에 따라 업데이트됩니다.*
*최종 업데이트: 2026-04-24 (QA Assurance Layer 추가)*
