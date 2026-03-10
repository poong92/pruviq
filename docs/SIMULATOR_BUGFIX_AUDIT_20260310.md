# PRUVIQ Simulator Bug Audit & Fix Log — 2026-03-10

## Purpose
냉철한 전문가 감사로 발견된 계산 버그를 수정하고, 각 수정이 정확한지 나중에 검증할 수 있도록 기록합니다.

---

## Fix 1: engine.py LONG 청산 슬리피지 누락 [CRITICAL]

**파일**: `backend/src/simulation/engine.py:273`

**Before (잘못됨)**:
```python
if direction == "long":
    pnl_gross = (exit_price - entry_price) / entry_price      # exit_price: 슬리피지 미적용!
else:
    pnl_gross = (entry_price - exit_price_adj) / entry_price   # exit_price_adj: 슬리피지 적용 ✓
```

**After (수정)**:
```python
if direction == "long":
    pnl_gross = (exit_price_adj - entry_price) / entry_price   # exit_price_adj 사용 ✓
else:
    pnl_gross = (entry_price - exit_price_adj) / entry_price
```

**근거**: LONG 청산 = sell to close. 슬리피지로 인해 더 낮은 가격에 체결 (불리).
`exit_price_adj = exit_price * (1 - slippage_pct)`. engine_fast.py는 이미 정확했음.

**검증 방법**: 동일 전략을 engine.py와 engine_fast.py로 실행해서 PnL 일치 확인.

---

## Fix 2: Sortino TDD 공식 오류 [HIGH] — 4곳

**파일**: `engine_fast.py:367`, `engine.py:354`, `main.py:744`, `main.py:2254`

**Before (잘못됨)**:
```python
tdd = sqrt(mean(daily_returns[daily_returns < 0] ** 2))
# → 음수 관측수 N_down으로 나눔. 승률 높을수록 TDD 과대 → Sortino 과소
```

**After (수정)**:
```python
downside = np.minimum(daily_returns, 0)       # 양수는 0으로 처리
tdd = sqrt(mean(downside ** 2))               # 전체 N으로 나눔
```

**근거**: Sortino & van der Meer (1991) 원논문.
- 양수 수익을 0으로 치환하고 **전체 관측수 N**으로 나눔
- `mean(returns[returns<0]**2)`는 N_down으로 나누므로 학문적 정의와 다름
- 차이: 승률 70%인 전략 → N=100, N_down=30
  - 잘못된 TDD: `sqrt(sum/30)` = 1.83배 과대
  - 올바른 TDD: `sqrt(sum/100)` = 정확

**검증 방법**: 수동 계산 예시:
```
daily_returns = [2.0, -1.0, 3.0, -0.5, 1.5]
downside = [0, -1.0, 0, -0.5, 0]
TDD_correct = sqrt(mean([0, 1.0, 0, 0.25, 0])) = sqrt(0.25) = 0.5
TDD_wrong   = sqrt(mean([1.0, 0.25])) = sqrt(0.625) = 0.79  (58% 과대!)
```

---

## Fix 3: MDD 계산 — 절대값 → % of peak [HIGH]

**파일**: `main.py /simulate:715`, `main.py /backtest:2223`

**Before (compound 모드에서 잘못됨)**:
```python
dd = peak - equity  # 절대 인덱스 포인트 (simple 모드에서도 근사값일 뿐)
```

**After (수정)**:
```python
dd = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak
```

**근거**:
- peak=200 (initial의 200%), equity=150 (150%)
- 잘못된: dd = 200 - 150 = 50 (50% MDD??)
- 올바른: dd = (200-150)/200 * 100 = 25% (peak 대비 25% 하락)
- Simple 모드: peak=105, equity=100 → 잘못된 5.0, 올바른 4.76%. 차이 작지만 원칙적으로 올바른 방법 적용.

**검증 방법**: compound 백테스트에서 MDD가 100%를 넘지 않는지 확인.

---

## Fix 4: /simulate 일별 PnL — entry_time → exit_time [MEDIUM]

**파일**: `main.py:634`, `main.py:734`

**Before**: trade dict에 `exit_time` 없음, `t["time"]` (entry_time)으로 일별 분류
**After**: trade dict에 `exit_time` 추가, `t.get("exit_time", t["time"])` 사용

**근거**:
- PnL은 포지션 청산 시 실현됨 (Realized PnL)
- entry 날짜에 PnL을 귀속시키면 아직 실현되지 않은 손익을 해당 일에 반영
- /backtest는 이미 `t["exit_time"]` 사용 중 — 일관성

---

## Fix 5: Profit Factor 0.001 sentinel → 999.99 [MEDIUM]

**파일**: 7곳 (engine_fast.py, engine.py, main.py ×5)

**Before**:
```python
gross_loss = ... if losses else 0.001  # → PF = 50000+ (가짜 숫자)
```

**After**:
```python
gross_loss = ... if losses else 0.0
profit_factor = round(gp/gl, 2) if gl > 0 else (999.99 if gp > 0 else 0.0)
```

**근거**:
- 0 손실 시 PF는 정의상 무한대
- 999.99는 JSON/UI에서 깔끔하게 표시, "매우 높음"을 의미
- null은 프론트엔드 downstream 계산을 깨뜨림

---

## Fix 6: Sharpe/Sortino 자본가중 (/backtest) [HIGH]

**파일**: `main.py:2243-2247`

**Before**:
```python
daily_pnl[day_key] += t["pnl_pct"]  # raw pnl_pct 합산 → 코인 수에 비례해 과대
```

**After**:
```python
daily_pnl[day_key] += t.get("pnl_usd", 0)
daily_returns = np.array(list(daily_pnl.values())) / initial_capital * 100
```

**근거**:
- 포트폴리오 Sharpe = 일일 포트폴리오 수익률의 평균/표준편차
- 일일 포트폴리오 수익률 = sum(pnl_usd) / total_capital
- 이전 방식: 100코인 × 5% = 일일 "500%" → Sharpe 의미 없음
- 수정 후: 100코인 × $3 = $300 / $6000 = 5% → 올바른 포트폴리오 수익률

**미수정 (/simulate)**: /simulate는 pnl_usd를 개별 거래에서 계산하지 않음. 향후 수정 필요.
현재 /simulate의 Sharpe는 "per-trade aggregated Sharpe"로 문서화하고, 절대값 비교는 /backtest 사용 권장.

---

## Fix 7: "CURRENT LIVE SETTINGS" → "DEFAULT SETTINGS" [UX]

**파일**: `src/components/ResultsCard.tsx:61, 122`

**Before**: `live: 'CURRENT LIVE SETTINGS'` / `'현재 라이브 설정'`
**After**: `live: 'DEFAULT SETTINGS'` / `'기본 설정'`

**근거**: 실거래 중단(2026-03-09). "LIVE"는 사실이 아님.

---

## Fix 8: Compound OFF 시 coin 모드 미복원 [UX]

**파일**: `src/components/SimulatorPage.tsx:337-346`

**Before**: compound OFF 시 coinMode가 'select'에 고정
**After**: compound OFF → `setCoinMode('all')` + `setSelectedCoins([])`

---

## NOT A BUG (감사 과정에서 오탐으로 확인)

| 항목 | 이유 |
|------|------|
| SHORT 진입 슬리피지 `(1 - slippage)` | SHORT = 매도 진입. 낮은 가격에 체결 = SHORT에 불리 = 올바른 adverse slippage |
| SL/TP 진입 캔들 체크 | entry bar의 open에서 진입 → 같은 bar의 high/low로 exit 체크는 표준 관행 |
| Calmar 단순 연환산 | simple 모드에서 선형 합산 수익에 선형 연환산은 일관적. compound 모드만 CAGR 필요 (향후) |

---

## 미수정 (향후 과제)

| 항목 | 이유 |
|------|------|
| /simulate Sharpe 자본가중 | pnl_usd 미계산 → 구조 변경 필요. /backtest는 수정 완료 |
| Calmar CAGR (compound) | compound 모드 전용 `((1+r)^(365/n)-1)` 필요. 현재 simple 모드만 정확 |
| engine_fast.py / engine.py MDD | 단일코인 엔진은 pnl_pct 합산 기반. 작은 오차이므로 우선순위 낮음 |

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/simulation/engine.py` | Fix 1 (LONG slippage), Fix 2 (Sortino), Fix 5 (PF) |
| `backend/src/simulation/engine_fast.py` | Fix 2 (Sortino), Fix 5 (PF) |
| `backend/api/main.py` | Fix 2,3,4,5,6 (Sortino, MDD, exit_time, PF, Sharpe) |
| `src/components/ResultsCard.tsx` | Fix 7 (LIVE → DEFAULT) |
| `src/components/SimulatorPage.tsx` | Fix 8 (compound toggle reset) |
