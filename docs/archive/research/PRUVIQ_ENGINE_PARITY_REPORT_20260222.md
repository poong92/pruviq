# PRUVIQ Engine Parity Report — 2026-02-22

## AutoTrader v1.7.0 vs Pruviq BB Squeeze Preset 검증 결과

**결론: PARITY NOT ACHIEVED — 8개 항목 수정 필요**

Pruviq 프리셋이 AutoTrader와 **다른 전략**을 실행 중임. 동일 결과를 주장하려면 아래 수정 필수.

---

## CRITICAL (반드시 수정)

### 1. 스퀴즈 탐지: Lookback Window vs Single Candle

| | AutoTrader | Pruviq Preset |
|--|-----------|---------------|
| 로직 | `df.iloc[-11:-1]['is_squeeze'].any()` | `is_squeeze == True, shift=1` |
| 의미 | 과거 10캔들 중 아무거나 스퀴즈 | prev 캔들만 스퀴즈 |

**영향**: 유효 시그널 40-60% 누락
**수정**: `any_in_window` 연산자 추가 또는 `recent_squeeze = is_squeeze.rolling(10).max()` 필드 계산

### 2. 확장 조건 2개 누락

AutoTrader에 있지만 Pruviq에 없는 조건:
```python
# 조건 A: 밴드폭 확장 중
curr['bb_width'] > prev['bb_width']

# 조건 B: 밴드폭 이동평균 대비 임계값 초과
curr['bb_width'] > curr['bb_width_ma'] * 0.9
```

**영향**: 거짓 시그널 발생 (확장 아닌데 진입)
**수정**: Pruviq preset에 두 조건 추가

### 3. 가격 < BB 중간선 필터 누락

AutoTrader: `curr['close'] < curr['bb_mid']` (SHORT 방향 확인)
Pruviq: **없음**

**영향**: 가격이 BB 중간선 위에서도 SHORT 진입 (거짓 시그널 30-50%)
**수정**: `{"field": "close", "op": "<", "field2": "bb_mid", "shift": 0}` 추가

---

## HIGH (수정 권장)

### 4. 불필요한 bearish 조건 제거

Pruviq: `{"field": "bearish", "op": "==", "value": True, "shift": 1}`
AutoTrader: **이 조건 없음** (downtrend만 체크, 개별 캔들 방향 무관)

**영향**: 유효 시그널 ~40% 추가 누락
**수정**: bearish 조건 제거

### 5. bb_width_change shift 오류

AutoTrader: `curr` 캔들에서 읽음 (shift=0) = prev→curr 변화
Pruviq: `shift=1` (prev 캔들) = prev2→prev 변화 (1캔들 지연)

**수정**: shift=1 → shift=0

### 6. 진입가 차이

AutoTrader: `close[i]` (시그널 캔들 종가)
Pruviq: `open[i+1]` (다음 캔들 시가)

**수정**: close[i] 사용으로 통일

---

## MEDIUM (확인/조정)

### 7. SL/TP 동일바 우선순위 → **일치** (수정 불필요)

### 8. 수수료 모델
AutoTrader: 0.08%/side (taker) → Pruviq: 0.04%/side
**수정**: 0.08%/side로 통일

### 9. 슬리피지 모델
AutoTrader: 0% → Pruviq: 0.02%
**수정**: 0%로 통일 (또는 AutoTrader에 맞춤)

---

## 파라미터 일치 확인 (OK)

| 파라미터 | AutoTrader | Pruviq | 상태 |
|----------|-----------|--------|------|
| BB Period | 20 | 20 | OK |
| BB Std | 2.0 | 2.0 | OK |
| EMA Fast/Slow | 20/50 | 20/50 | OK |
| Volume Multiplier | 2.0 | 2.0 | OK |
| Avoid Hours | [2,3,10,20,21,22,23] | [2,3,10,20,21,22,23] | OK |
| SL/TP | 10%/8% | 10%/8% | OK |
| Max Hold | 48 bars | 48 bars | OK |

---

## 수정 완료 후 검증 방법

1. AutoTrader `backtest_matched_live.py`로 특정 코인 백테스트 실행
2. Pruviq `/backtest` 엔드포인트로 동일 코인 백테스트 실행
3. 거래 수, 승률, PF, 총수익률 비교 → 1% 이내 일치 확인
4. 개별 거래 타임스탬프 + PnL 비교 → 100% 일치 확인

---

## Backend 신규 모듈 설계 (6개)

| 우선순위 | 모듈 | 파일 | 규모 |
|----------|------|------|------|
| 1 | Parallel Processing | `src/simulation/parallel.py` | 80줄 |
| 2 | Enhanced Equity Curve | schema 변경 | 최소 |
| 3 | Chart Data Endpoint | `api/main.py` 확장 | ~100줄 |
| 4 | Monte Carlo | `src/validation/monte_carlo.py` | ~100줄 |
| 5 | CSV/Excel Export | `src/export/exporter.py` | ~150줄 |
| 6 | Walk-Forward Analysis | `src/validation/walk_forward.py` | ~150줄 |

### 핵심 아키텍처 결정
- ThreadPoolExecutor (4 workers) — numpy GIL 해제 활용
- 기존 engine.py, engine_fast.py, condition_engine.py 수정 없음
- asyncio.to_thread() 래핑 필수
- 신규 의존성: openpyxl 1개만
- Aggregator 추출 (main.py 중복 80줄 → shared function)
