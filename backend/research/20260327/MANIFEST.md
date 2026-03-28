# 전략 연구 데이터 매니페스트 (2026-03-27)

## 검증 피라미드 (아래→위)

각 레벨은 이전 레벨이 PASS일 때만 유효하다.
고장 시 이 순서로 아래부터 재검증.

```
LEVEL 6: 혁신 (볼륨 프로파일, Hurst 레짐)     ← 실험 중
LEVEL 5: 메타 전략 (lookback, 상관관계, 적응형) ← 대부분 실패 확인
LEVEL 4: 포지션 사이징 + OOS Walk-Forward       ← ATR SHORT 통과
LEVEL 3: 포트폴리오 조합 + 상충 제외            ← EW 5xSHORT Sharpe 3.91
LEVEL 2: SL/TP 최적화 + 멀티코인 + 변수 튜닝   ← ATR SHORT SL3 TP8 최적
LEVEL 1: 16전략 × 방향 × 기간 매트릭스          ← 252 combos, 61 strong
LEVEL 0: 엔진 수학 검증                          ← 8/10 PASS (MDD 기준차이)
```

## 파일 목록 + 체크섬

### LEVEL 0: 엔진 검증
- engine_verification.py — 수동 vs 엔진 PnL/PF/WR/MDD/SL/TP 비교
- 결과: 8/10 PASS (T1 PnL diff 0.08% = 실제 캔들 가격 차이, T2 MDD = 0-base vs 100-base)

### LEVEL 1: 전략 매트릭스
- phase1_full_matrix.csv — 252 rows (16전략 × 4방향 × 4기간, BTC only, SL7 TP7)
- 핵심: 61개 strong (PF>1.1, WR>50%, T≥10)

### LEVEL 2: 최적화
- phase2_sltp_optimization.csv — 200 rows (상위 8전략 × 5×5 SL/TP grid)
- phase3_multicoin.csv — 30 rows (상위 6전략 × 5 coins)
- phase4_variable_tuning.csv — 65 rows (상위 4전략 × max_bars/hours/vol_regime)
- 핵심: ATR SHORT SL3 TP8 = PF 1.58, 5/5 코인 수익

### LEVEL 3: 포트폴리오
- phase5_portfolio.csv — 28 rows (2-way, 3-way 조합, 상충 제외)
- phase6_full_portfolio.csv — 15 rows (top 10/30/50 코인)
- phase7_best_combo.csv — 8 rows (최적 SL/TP + top 50)
- 핵심: EW 5xSHORT MDD=4.5%, Sharpe=3.91

### LEVEL 4: OOS 검증
- oos_walk_forward.csv — 36 rows (6 candidates × 6 windows)
- oos_quarterly.csv — 48 rows (6 candidates × 8 quarters)
- oos_position_sizing.csv — 3 rows ($10K 시뮬레이션)
- 핵심: ATR SHORT OOS PF=1.91, $10K→$507K, MDD=16.4%

### LEVEL 5: 메타 전략
- meta_lookback_prediction.csv — 6 rows (lookback→forward 상관관계)
- meta_walkforward.csv — 8 rows (8 methods 비교)
- meta_correlation.csv — 36 rows (전략 간 상관관계)
- meta_regime_mapping.csv — 23 rows (월별 레짐→전략 매핑)
- meta_optimal.csv — 11 rows (적응형 vs 정적)
- 핵심: "전략을 고르는 전략"은 불가 (상관관계 ~0), Equal Weight가 최선

### LEVEL 6: 혁신
- innovation_L1_hurst.csv — 138 rows (Hurst 레짐별 전략 성과)
- innovation_L2_momentum.csv — 51 rows (모멘텀 로테이션)
- innovation_L3_mtf.csv — 4 rows (멀티타임프레임)
- innovation_L4_volume_profile.csv — 10 rows (볼륨 프로파일 POC)
- 핵심: 볼륨 프로파일 10/10 수익, PF=1.14, Sharpe=2.76

## 환경 정보
- 데이터: 577 coins, 2y OHLCV 1H (19,630 BTC candles)
- 엔진: engine_fast.py (vectorized, shift() 적용)
- 비용: fee 0.08%, slippage 0.02%, funding 0.01%/8h
- Python: 3.14, numpy, pandas
- 실행 시간: 총 ~2분 (엔진 직접 호출)

## 재현 방법
```bash
cd /Users/jepo/pruviq
.venv/bin/python3 backend/scripts/engine_verification.py    # L0
.venv/bin/python3 backend/scripts/deep_strategy_analysis.py  # L1-3
.venv/bin/python3 backend/scripts/oos_validation.py          # L4
.venv/bin/python3 backend/scripts/meta_strategy_research.py  # L5
.venv/bin/python3 backend/scripts/innovation_research.py     # L6
```
