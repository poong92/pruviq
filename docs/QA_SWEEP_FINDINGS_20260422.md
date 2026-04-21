# QA Sweep Findings — 2026-04-22

5 페르소나 병렬 실행 → 집계 · dedupe · 우선순위.

## 페르소나 Verdict 요약

| Persona | 역할 | Verdict | Findings |
|---|---|---|---|
| P1 | 솔로 데이트레이더 (모바일 KO) | WOULD_STAY | 18 |
| P2 | 퀀트 연구자 (EN 데스크탑) | WOULD_STAY | 16 |
| P3 | 그로스 마케터 (브랜드 · 비교) | "약함" | 11 |
| P4 | 접근성 감사자 (키보드) | WOULD_BOUNCE | 9 |
| P5 | 한국 초심자 (모바일) | 부분 리포트 | 9 |

## CRITICAL (중복 페르소나 + 즉시 ship-block)

| # | Finding | 페르소나 | 파일 추정 |
|---|---|---|---|
| 1 | /compare/tradingview "Backtest Transparency" 체크마크 flip (PRUVIQ "—", TV "✓") | P3 | src/pages/compare/tradingview.astro |
| 2 | Coin count SSoT 위반 (235 / 240+ / 500+ 공존) | P3 | /about, /performance, /autotrading, home |
| 3 | 히어로 BB Squeeze 숫자 /performance 불일치 (EN WR48.9 vs 실 68.6%) | P3 | src/pages/index.astro |
| 4 | /compare/3commas + /cryptohopper 10/12 ✓ (경쟁사 1 row 만) | P3 | 2 .astro |

## HIGH (다수 페르소나 영향)

| # | Finding | 페르소나 | 파일 추정 |
|---|---|---|---|
| 5 | 전역 nav 27px + /signals Details <44px | P1 P5 | Layout.astro + /signals 컴포넌트 |
| 6 | /ko/market 펀딩률 누락 | P1 | MacroPanel |
| 7 | Slippage 모순 /methodology "not modeled" vs /simulate "includes" | P2 | 두 페이지 copy |
| 8 | IS/OOS + MC artifact 렌더링 없음 (copy만 있음) | P2 | /performance or /methodology |
| 9 | axe color-contrast 12 노드 (opacity-50 + text-[10px]) | P4 | 다수 페이지 |
| 10 | prefers-reduced-motion 미준수 (animate-pulse/ping) | P4 | global.css |
| 11 | console 405 에러 20+ site-wide | P1 P2 | backend verb |
| 12 | /autotrading 혼재 (nav SOON + hero "Running 24/7") | P3 | autotrading/index.astro |
| 13 | /ko/ 히어로 전략 카드 미번역 | P3 | index KO |
| 14 | /methodology Binance 잔존 → OKX | P2 | methodology |

## MED

| # | Finding | 페르소나 |
|---|---|---|
| 15 | /strategies/ranking MDD/PF/WR scope 라벨 누락 (Rule 4) | P1 |
| 16 | /simulate + /signals h1→h3 스킵 | P4 |
| 17 | Verdict for low-sample N<500 (Sharpe 0.55 노이즈) 오판 | P2 |
| 18 | Builder Hot Strategies "4T verified" low-sample 배지 미적용 | P2 |
| 19 | /ko/learn/ 글로서리 + 툴팁 (용어 하중 23) | P5 |
| 20 | /about 기관 신뢰 시그널 (GitHub org, audit, 회사명 — 실명은 제외) | P3 P5 |

## LOW

| # | Finding | 페르소나 |
|---|---|---|
| 21 | emerald decorative 12 잔존 | P1 |
| 22 | Fees Binance 19%/Futures 9% 숨김 | P3 |
| 23 | sub-12px 밀집 테이블 | P1 P5 |

---

## 배치 PR 플랜

| 배치 | 포함 | 크기 | 영향 |
|---|---|---|---|
| **B1** 빠른 SSoT/copy | #1 #2 #3 #7 #14 | S | CRITICAL × 3 즉시 해결 |
| **B2** Layout a11y site-wide | #5 #9 #10 #16 | M | 다수 페이지 영향 |
| **B3** 비교 테이블 균형 | #4 | M | 경쟁사 승리 2+ row 추가 |
| **B4** /autotrading + /ko 번역 | #12 #13 | S | 혼재 신호 정리 |
| **B5** Methodology + Verdict + 배지 | #17 #18 | S | 정직성 가드 |
| **B6** 새 기능 (backend) | #6 #8 #11 | L | MacroPanel funding · OOS 차트 · 405 triage |
| **B7** 글로서리·ranking·about·fees·emerald·테이블 | #15 #19 #20 #21 #22 #23 | M | nice-to-have cleanup |

각 배치 끝나면 해당 페르소나 재실행 → regression 확인.

## 제외 정책 준수 (오너 확정)

❌ **수용 불가:** 창업자 실명, LinkedIn, 사무실 주소, IP 로깅, 디바이스 핑거프린팅  
✅ **수용:** 회사명, GitHub 기관 링크, 외부 감사 회사, 사용자 수 미러, 전문용어 툴팁, 번역 개선, 탭타깃, 색상·모션 접근성

---

## 페르소나 재검증 트리거

각 배치 머지 후 해당 페르소나 1회 rerun:
- B1, B3, B4 → P3
- B2, B7 → P4
- B5, B6 → P2
- B2, B4, B7 → P5
- B2, B3 → P1

최종 5/5 WOULD_STAY 이상 도달할 때까지 반복.
