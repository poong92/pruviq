# Ground Truth Dataset

수작업으로 검증된 시뮬레이터 정답 데이터.
자동 생성 금지 — 모든 값은 수기 계산 또는 외부 도구로 교차검증됨.

## 파일 구조

- `formulas.json` — 금융 공식 정의 + 수기 계산 예시
- `edge_cases.json` — 경계값 테스트 케이스
- `cross_engine.json` — /simulate vs /backtest 동일 입력 기대값

## 검증 기준

- 오차 허용: 0.01% (부동소수점)
- 정답 출처: 엑셀 수기계산 + Wikipedia/CFA 공식
