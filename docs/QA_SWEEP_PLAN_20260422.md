# PRUVIQ 전체 QA 스윕 — 2026-04-22

> 실화면 기준 기능/디자인/UX/UI 검수. 5 신규 페르소나 병렬 실행 후 프라이빗·신원노출 관련 제외 **전 항목 수용**.

## 1. 스코프

### 페이지 (EN + KO 미러)

**Tier 1 — 핵심 퍼널 (모든 페르소나 필수 경유)**
- `/`, `/simulate/`, `/simulate/builder/`, `/strategies/`, `/strategies/ranking/`, `/strategies/[id]` (3 샘플), `/strategies/compare/`
- `/signals/`, `/performance/`, `/trust/`, `/dashboard/`

**Tier 2 — 전환 보조**
- `/autotrading/`, `/market/`, `/coins/`, `/learn/`, `/fees/`
- `/compare/{tradingview,3commas,coinrule,cryptohopper,streak,gainium}`
- `/about/`, `/methodology/`, `/api/`

**Tier 3 — 법적/유틸**
- `/privacy/`, `/terms/`, `/changelog/`, `/blog/`, `/leaderboard/`, `/404`

### 베이스 URL
1순위: `https://pruviq.com`  
2순위: `http://localhost:4321` (CF Pages 미배포분 · 브랜드 cyan + persona 픽스 확인용)

## 2. 신규 5 페르소나 (이전 A-D 와 중복 회피)

| ID | 페르소나 | 뷰포트 | 주 언어 | 렌즈 | 담당 페이지 클러스터 |
|---|---|---|---|---|---|
| **P1** | 솔로 데이트레이더 (40, TradingView Pro 사용자) | 모바일 375 | KO | 차트 통합·전략 레시피 품질·모바일 플루엔시 | /simulate/*, /strategies/*, /signals, /market, /coins |
| **P2** | 퀀트 연구자 (35, ML PhD, 영어) | 데스크탑 1440 | EN | 방법론 엄격성·통계 정직성·재현성 | /methodology, /performance, /trust, /strategies/ranking, /simulate/builder, /api |
| **P3** | 핀테크 그로스 마케터 (30, 영+한) | 데스크탑 1280 | EN+KO | 카피·CTA 명확성·브랜드 아이덴티티·비교 포지셔닝 | /, /compare/*, /fees, /about, /performance, /autotrading |
| **P4** | 접근성 감사자 (키보드 only + SR 시뮬) | 데스크탑 1280 | EN | Tab order·aria·SR 출력·keyboard trap·color contrast·reduced-motion | Tier 1 전부 |
| **P5** | 한국 리테일 입문자 (25, zero trading 경험) | 모바일 375 | KO | 용어 하중·온보딩 이해도·사전 지식 없는 신뢰 형성 | /ko/, /ko/simulate/, /ko/learn, /ko/fees, /ko/trust, /ko/strategies/ |

## 3. QA 루브릭 (페르소나 공통)

각 페이지당 반드시 체크:

1. **FUNCTIONALITY** — 모든 버튼 클릭, 슬라이더 입력, 링크 hop, 폼 제출이 실제로 동작?
2. **VISUAL / BRAND** — cyan #2CB5E8 일관? 레거시 emerald/rose decorative 남음? 타이포 12px 미만?
3. **TRUST** — 숫자 fake 느낌? 클레임-증거 불일치? dead-end CTA? 빈 대시보드?
4. **UX / FRICTION** — 3초 안에 가치 전달? 점프/CLS? 로딩 상태 부재? 에러 recovery path?
5. **A11Y** — 44px 탭타깃, Tab focus 시각·순서, aria-label, role, heading order, prefers-reduced-motion
6. **I18N** — EN/KO parity, placeholder 미번역, 줄바꿈 깨짐, hardcoded string
7. **PERF** — 인터랙션 지연 · 불필요한 네트워크 호출 · 불필요한 re-render

## 4. 리포트 스키마 (각 페르소나 산출)

```
{
  "persona": "P1",
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MED|LOW",
      "category": "trust|ux|visual|a11y|i18n|func|perf",
      "page": "/simulate/",
      "selector": "[data-testid=...] or CSS",
      "symptom": "what the persona sees/experiences",
      "impact": "what it costs (bounce / confusion / etc)",
      "fix_hint": "component file + concrete change",
      "screenshot": "/tmp/persona-p1/xx.png"
    }
  ],
  "verdict": "WOULD_CONVERT | WOULD_STAY | WOULD_BOUNCE",
  "verdict_reason": "one sentence"
}
```

## 5. 수용/제외 정책 (오너 확정 2026-04-22)

| | |
|---|---|
| ✅ 수용 | UI/UX · 기능 버그 · 카피 수정 · a11y 위반 · 브랜드 비일관 · i18n gap · 성능 · 트러스트 격차 |
| ❌ 제외 | **개인정보 노출 요청** (founder 실명·LinkedIn·사무실 위치 등) · **신원 핑거프린팅** (IP log, device ID, cross-site tracking) |

## 6. 실행 절차

1. **이 문서 커밋** (v1 plan doc)
2. **5 페르소나 에이전트 병렬 dispatch** (non-overlapping 페이지 클러스터)
3. **수집 · dedupe · priority 정렬**
4. **배치 수정 PR 발행** (카테고리별: visual/a11y/trust/func/copy/perf)
5. **각 배치 머지 후 해당 페르소나 재검증** (regression)
6. **최종 보고 + memory 업데이트**

## 7. 배치 PR 예상 (추정 6-8개)

| 배치 | 범위 | 예상 PR 크기 |
|---|---|---|
| B1 | 브랜드 색상 잔여 decorative cyan 전환 | small |
| B2 | 44px 탭타깃 site-wide (signals, nav, footer) | small |
| B3 | /about 창업자 링크·audit 링크 (실명 제외, 회사명·GitHub·감사 링크만) | small |
| B4 | /strategies/ranking MDD "fixed-notional" 라벨 · preset 카드 trade-N | medium |
| B5 | /compare/3commas + /compare/cryptohopper 균형 (경쟁사 승리 2-3 row) | medium |
| B6 | /performance OOS/walk-forward 시각화 | medium |
| B7 | a11y fixes (keyboard trap · SR label · focus order) | medium |
| B8 | i18n parity + reduced-motion | small |

## 8. 성공 기준

- 모든 페이지 axe WCAG 2.2 AA 0 violations
- Lighthouse desktop 모든 tier 1 페이지 Perf ≥ 85 / A11y ≥ 95
- 5 페르소나 재검증 verdict: 최소 4/5 → WOULD_STAY 이상
- 모든 CRITICAL · HIGH finding 해결
- MED/LOW 최소 70% 해결

---

## 기록

| 일자 | 이벤트 |
|------|------|
| 2026-04-22 | v1 초안 · 플랜 확정 후 페르소나 dispatch |
