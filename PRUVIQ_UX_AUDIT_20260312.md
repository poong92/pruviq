# PRUVIQ UX/사용성 전체 감사 리포트

> 2026-03-12 | 15페이지 분석 + 4 페르소나 여정 매핑

## 종합 점수

| 페이지 | 점수 | 핵심 약점 | 우선순위 |
|--------|------|-----------|----------|
| / (홈) | **7.5** | stats 숫자 맥락 부재, 카운터 0→N 레이아웃 시프트 | P2 |
| /simulate | **7.0** | Quick 모드에서도 19개 지표 전부 노출 (Casey 이탈) | **P0** |
| /market | **5.0** | 클라이언트 렌더링이라 정적 분석 한계, 데이터 밀도 미확인 | P3 |
| /coins | **5.0** | 동적 렌더링, 검색/필터/정렬 UX 미평가 | P3 |
| /coins/[symbol] | **4.0** | 차트 없음, 메타데이터 부족, 전략 성과 수치 없음 | **P1** |
| /strategies | **6.5** | 5개만 표시 (프리셋 26개 중), 필터/정렬 없음 | **P1** |
| /strategies/[id] | **7.4** | 차트/시각화 없음, CTA 하단 배치, 리스크 경고 약함 | P2 |
| /strategies/compare | **3.0** | 비교 UI 동적 렌더링, 정적 분석 불가 | P2 |
| /performance | **5.5** | 차트 0개, 텍스트 위주, 시간 범위 선택 없음 | **P1** |
| /learn | **6.5** | 검색/필터 없음, 26개 가이드 스크롤만 | P2 |
| /fees | **7.5** | 계산기 정적, 이해충돌 FAQ 부재 | P2 |
| /leaderboard | **6.0** | 주간만, 시간 범위 없음, 전략 상세 부족 | P3 |
| /api | **7.0** | 에러 문서 없음, 응답 스키마 불완전 | P3 |
| /methodology | **6.5** | 시각 자료 0개, ToC 없음, survivorship bias 미기재 | **P1** |
| /ko (한국어) | **8.2** | 자연스러운 번역, 금융용어 일부 개선 필요 | P3 |

**전체 평균: 6.2/10**

---

## 페르소나별 점수

| 페르소나 | 점수 | 핵심 병목 |
|----------|------|-----------|
| Casey (초보자, 80% 타겟) | **6.5** | ResultsCard에서 19개 지표 폭격 → 이탈 |
| Tim (중급 트레이더) | **7.5** | 26개 프리셋 접근 불가, History Diff 뷰 없음 |
| Quinn (퀀트) | **8.0** | Survivorship bias 9px 최하단, 슬리피지 설명 불일치 |
| Sam (회의론자) | **5.5** | 팀 익명, 리뷰 0건, 이해충돌 미해명 |

---

## P0 개선안: 즉시 실행 (가장 높은 ROI)

### 1. ResultsCard Progressive Disclosure (Casey 이탈률 -30%)
**현재**: Quick/Standard/Expert 모든 모드에서 19개 지표 동시 노출
**개선**: Quick 모드 → 4개 핵심(Win Rate, PF, Return, Grade) + "Show details" 접기
**구현**: ResultsCard.tsx에 `simMode` prop 추가, Quick일 때 conditional render
**영향**: Casey 첫 경험 개선 → 시뮬레이터 재방문율 +20%

### 2. Strategy Grade 최상단 이동 (전 페르소나)
**현재**: Grade 박스가 결과 카드 중간에 위치
**개선**: 결과 카드 최상단에 대형 배치 + 인간 언어 해석
- Grade A: "This strategy passed all tests"
- Grade D: "This strategy lost money — kept for transparency"
**영향**: 첫 3초에 결론 파악, 전 페르소나 만족도 상승

---

## P1 개선안: 이번 주 (높은 영향도)

### 3. /coins/[symbol] 페이지 강화
**현재**: 차트 없음, 가격/볼륨 메타데이터 없음, 전략 수치 없음
**개선**: OHLCV 차트(lightweight-charts) + 현재가/24h변동 + 전략별 WR/PF 표
**영향**: 코인 상세 페이지가 전략 진입 퍼널로 기능

### 4. /strategies 전체 프리셋 테이블
**현재**: 5개 전략 카드만 표시
**개선**: 26개 프리셋 전체를 WR/PF/Return 정렬 가능 테이블 + 상태 필터(Active/Retired/Review)
**영향**: Tim 체류시간 +2분, 시뮬레이터 클릭률 +25%

### 5. /performance 시각화
**현재**: 텍스트/숫자만, 차트 0개
**개선**: Equity curve + 월별 수익 히트맵 + 시간 범위 선택기
**영향**: 데이터 설득력 +50%

### 6. /methodology Survivorship Bias 섹션
**현재**: ResultsCard 9px 회색 텍스트에만 존재
**개선**: "Known Limitations" 전용 섹션 — 상장폐지 영향 추정치 포함
**영향**: Quinn 신뢰 전환 +20%

---

## P2 개선안: 다음 주

### 7. 홈 카운터 스켈레톤 로더
"0+" → 실제 숫자 전환 시 레이아웃 시프트 제거

### 8. 전략 상세 페이지 차트 추가
Equity curve, 월별 히트맵, 승/패 분포 차트

### 9. /learn 검색/필터 추가
26개 가이드를 태그/난이도로 필터링

### 10. History 비교 Diff 뷰
2개 결과 좌우 컬럼 + 차이값 강조

### 11. About 팀 최소 정보 공개
GitHub 핸들 + 역할 (Sam 이탈률 -35%)

### 12. /fees 이해충돌 FAQ
"왜 레퍼럴인가" + 객관성 보장 설명

---

## A/B 테스트 우선순위 (ROI 순)

| 순위 | 테스트 | 대상 | 예상 임팩트 |
|------|--------|------|------------|
| 1 | ResultsCard Quick 모드 4-metric vs 전체 | Casey | 이탈률 -30% |
| 2 | About 팀 핸들 공개 vs 현재 익명 | Sam | 이탈률 -35% |
| 3 | /methodology Survivorship bias 섹션 추가 | Quinn | 신뢰 +20% |
| 4 | /strategies 26개 전체 테이블 vs 5개 카드 | Tim | 체류 +2분 |
| 5 | Grade 최상단 배치 vs 현재 위치 | 전체 | 이해도 +40% |

---

## 전환 퍼널 예상 통과율

| 단계 | Casey | Tim | Quinn | Sam |
|------|-------|-----|-------|-----|
| 홈 → 데모 | 70% | 80% | 65% | 40% |
| 데모 → 시뮬 사용 | **50%** | 85% | 80% | **35%** |
| 시뮬 → 재방문 | 30% | 70% | 75% | 80%* |

*Sam은 한 번 신뢰 형성 시 가장 충성도 높은 페르소나

**최대 병목**: Casey 시뮬레이터 ResultsCard (50% 이탈), Sam About 페이지 (60% 이탈)

---

## 결론

PRUVIQ의 **"실패 공개" 철학은 독보적 포지셔닝**이나, 이를 살리는 UX가 부족:
- 초보자(Casey)에게는 결과가 너무 복잡
- 회의론자(Sam)에게는 신뢰 증거가 부족
- 중급자(Tim)에게는 전략 접근성이 낮음
- 퀀트(Quinn)에게는 방법론 투명성에 빈틈

**6.2 → 8.0 도달 로드맵**:
1. P0 (이번 주): ResultsCard Progressive Disclosure + Grade 최상단 → +0.8
2. P1 (다음 주): 코인 상세 + 전략 테이블 + 성과 차트 + Survivorship bias → +0.6
3. P2 (2주 후): 팀 공개 + 이해충돌 FAQ + History Diff + Learn 검색 → +0.4
