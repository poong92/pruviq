# PRUVIQ Simulator QA — 진행 상황 (2026-03-10)

## 완료된 작업

### 1. 현상파악 (3개 에이전트 병렬 스캔) ✅
- 백엔드: API 6개 엔드포인트, 14개 지표, 26개 프리셋, 3개 엔진 구조 파악
- 프론트엔드: 23개 컴포넌트, 3-tier 모드, i18n 200+ 키, 파라미터 UI 전체 매핑
- 업계 표준: Sharpe/Sortino/MDD/PF/VaR/Calmar 공식 표준 + 경쟁 플랫폼 비교

### 2. 검증 인프라 생성 ✅
- `simulator-qa` 에이전트: `/Users/jplee/Desktop/autotrader/.claude/agents/simulator-qa.md`
- `/sim-audit` 스킬: `/Users/jplee/.claude/skills/sim-audit/instructions.md`
- Ground Truth 데이터셋: `/Users/jplee/Desktop/pruviq/tests/ground_truth/formulas.json`
- QA 스크립트: `/Users/jplee/Desktop/pruviq/tests/sim_audit.py`

### 3. 첫 번째 전체 검증 실행 ✅
- 결과: **83 PASS / 5 FAIL / 7 WARN**
- FAIL 중 4건은 테스트 코드/GT 오류 → 수정 완료
- 실제 시뮬레이터 버그 1건 발견 (MDD > 100%)

## 발견된 이슈

### 확정 버그 (코드 수정 필요)
| # | 이슈 | 파일 | 라인 | 상태 |
|---|------|------|------|------|
| B1 | MDD > 100% (단리 모드 equity 하한 없음) | main.py | 2218-2219 | % of peak으로 수정됨 → 자연적으로 해결 |
| B2 | engine_fast.py MDD 절대 포인트 | engine_fast.py | 344 | ✅ 수정 완료 (% of peak) |
| B3 | /simulate/compare MDD 절대 포인트 | main.py | 1090 | ✅ 수정 완료 (% of peak) |
| B3b | monte_carlo.py MDD 절대 포인트 | monte_carlo.py | 132-135 | ✅ 수정 완료 (% of peak) |
| B3c | generate_demo_data.py MDD 절대 포인트 | generate_demo_data.py | 148 | ✅ 수정 완료 (% of peak) |
| B4 | Calmar CAGR 단리 연환산 → 복리 CAGR | engine.py, engine_fast.py, main.py (3곳) | ✅ 수정 완료 |
| B4b | engine.py MDD 절대 포인트 | engine.py | 327 | ✅ 수정 완료 (% of peak) |

### 경고 (개선 권장)
| # | 이슈 | 우선순위 |
|---|------|---------|
| W1 | 슬리피지 0.02% 편도 (업계 0.05-0.1% 권장) | MEDIUM |
| W2 | Sharpe annualization factor UI 미표시 | MEDIUM |
| W3 | 거래 수 < 100 경고 없음 | LOW |
| W4 | Sharpe > 3 과적합 경고 없음 | LOW |
| W5 | 시장 체제별 성과 분리 없음 | LOW |
| W6 | 생존 편향 미고지 | LOW |
| W7 | PF 999.99 cap → "N/A" 또는 "∞" 표시 권장 | LOW |

## 다음 단계 (TODO)

### Phase 1: 최소 검증 단위 완성 (진행 중)
- [ ] B1 수정: 단리 모드 equity floor 추가 또는 MDD cap 100%
- [ ] B2 수정: engine_fast.py MDD → % of peak
- [ ] B3 수정: /simulate/compare MDD → % of peak
- [ ] B4 확인: Calmar CAGR 계산 방식 검증
- [ ] sim_audit.py 재실행 → 0 FAIL 확인

### Phase 1.5: 전문가 에이전트 병렬 검증 (진행 중)
- [ ] strategy-analyst: 파라미터 조합 논리, 복리 코인 강제 문제
- [ ] validation-analyst: 통계 유의성, 과적합 탐지 로직 검증
- [ ] data-quality-engineer: 입력 데이터 무결성, NULL 필드 검사

### Phase 2: 검증 범위 확장
- [ ] 각 금융 공식별 독립 검증 (Sharpe, Sortino, MDD, PF, Calmar 각각)
- [ ] Cross-engine 심층 비교 (/simulate vs /backtest 전체 필드)
- [ ] 프리셋 26개 전수 검증
- [ ] 단리/복리 전환 시 모든 지표 정합성
- [ ] 경계값 테스트 확장 (SL=0.5%, TP=100%, leverage=125x 등)

### Phase 3: UX 검증
- [ ] 프론트엔드 라벨 ↔ 백엔드 계산 매핑 검증
- [ ] i18n 키 정확성 (EN/KO)
- [ ] 프리셋 이름/설명 ↔ 실제 조건 일치

### Phase 4: 수정 + 배포
- [ ] 버그 수정 PR 생성
- [ ] sim_audit.py CI 통합
- [ ] Mac Mini 동기화
- [ ] 프로덕션 배포 + 재검증

## 파일 목록

```
tests/
├── sim_audit.py              # 메인 QA 스크립트 (4-layer)
├── SIM_AUDIT_PROGRESS.md     # 이 파일 (진행 추적)
└── ground_truth/
    ├── README.md             # GT 데이터셋 설명
    └── formulas.json         # 수기 계산 정답 데이터
```
