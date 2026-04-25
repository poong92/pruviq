# QA Automation — 9-Layer Architecture

> **영구 레퍼런스**. 세션 이야기는 `~/.claude/projects/-Users-jepo-pruviq/memory/project_qa_automation_20260424.md` 참조.

PRUVIQ 사이트의 자동 검증 인프라. "65/65 tests PASS 인데 유저가 버그 찾는" 상태를 원천 차단하기 위해 2026-04-24 도입. 각 레이어는 **서로 다른 실패 모드**를 잡도록 설계.

---

## 레이어 요약

| Layer | 파일 | 트리거 | 검증 대상 |
|-------|------|--------|-----------|
| **1** Discovery | `scripts/discover-interactives.mjs`, `tests/e2e/crawl/runtime-inventory.spec.ts` | 매 PR | 52 canonical 루트의 hydrated testid/버튼/앵커 인벤토리 |
| **2** Click-everything | `tests/e2e/crawl/click-all.spec.ts`, `tests/e2e/helpers/assert-populated.ts` | 매 PR | 각 버튼 클릭 후 **populated 결과** (빈 리스트/에러 sentinel 아님) |
| **3** Hook contract (static) | `src/schemas/data-contracts.ts`, `tests/unit/hook-contract.test.ts` | 매 PR | `public/data/*.json` shape + invariant ("macro ≥ 1 항목" 같은) |
| **3.5** Live-API contract | `tests/contract/live-api-contract.spec.ts` | 매 PR | `api.pruviq.com/news /macro /market /health` 실시간 응답 shape |
| **4** Freshness monitor | `scripts/check-freshness.mjs`, `.github/workflows/freshness-monitor.yml` | 15-min cron | 정적 데이터 stale 감지 → 자동 Issue |
| **5** Scenario flows | `tests/e2e/scenarios/user-flows.spec.ts` | 매 PR | 4 핵심 유저 여정 step-by-step (preset→결과, macro 뉴스 탭, 등) |
| **6** A11y interactive | `tests/accessibility/interactive-a11y.spec.ts` | 매 PR | 버튼 클릭 후 axe — 신규 위반 0 |
| **7** Nightly sweep | `.github/workflows/nightly-qa.yml` | 매일 02:00 UTC | prod 전체 재실행 + auto-issue |
| **8** Flake classifier | `scripts/classify-flake.mjs`, `.github/workflows/flake-report.yml` | 매주 월 04:00 UTC | passed-after-retry 기록 + 주간 리포트 (Issue 자동 생성) |

**Lighthouse budget gate** (레이어 번호 외 독립):
- `lighthouserc.json`, `.github/workflows/lighthouse-budget.yml`
- 5 URL × 4 카테고리 (Perf/A11y/BP/SEO) + LCP/CLS/TBT. 넘으면 PR fail.

**Blog populated check** (독립):
- `tests/e2e/crawl/blog-populated.spec.ts`. 78개 .md 전수 h1+body+no-error.

**Broken-link crawler** (독립):
- `scripts/check-broken-links.mjs`. dist/ 전 href → HEAD → 404 리포트.

---

## 설계 원칙

### 1. Populated > Loaded
"페이지 로드됨" 검증만으로는 `/ko/market/` 매크로 탭이 빈 리스트로 렌더되는 버그를 못 잡음. `tests/e2e/helpers/assert-populated.ts::expectPopulated()` 가 visible + textContent.length > 0 + no `-empty`/`-error` sentinel 을 요구.

### 2. Multi-source contract
Layer 3 (정적 JSON) + Layer 3.5 (라이브 API) 가 **같은 schema 모듈** (`src/schemas/data-contracts.ts`) 공유. 백엔드/프론트 어느 쪽 변경이든 한쪽만 통과 못 하면 CI red.

### 3. Invariant over shape
shape 체크만으로 "categoryless items → 전부 crypto 분류" 같은 논리 버그 못 잡음. Layer 3에 "macro 카테고리 최소 1건" 같은 **비즈니스 불변조건** 포함.

### 4. Drift detection beyond tests
정적 데이터 cron 파이프라인이 멈출 수 있음 (Layer 4). `.generated` 타임스탬프 + 파일별 max age (news 30min, macro 2h, OHLCV 6h 등) → Issue 자동 생성/해결.

### 5. Self-healing flakes
레이어 2/5는 flaky 할 수 있음. Layer 8 의 `classify-flake.mjs` 가 passed-after-retry 로그 후 `flake-log.ndjson` 축적 → 주간 리포트로 "진짜 flaky 테스트 vs 일시적 네트워크" 분리.

---

## 실제 잡은 버그 (2026-04-24)

Layer 1 runtime inventory 가 돌자마자:
- `/strategies/ichimoku/`, `/keltner-squeeze/`, `/ma-cross/` **404 감지** → `src/content/strategies/*.md` 추가로 해결
- `/coins/*usdt/` **40개 404 감지** → `TOP_COINS × COIN_SYMBOLS` 드리프트, noscript 필터로 해결
- `/ko/simulate/v2-probe/` **1개 404** → KO 리다이렉트 추가

Broken-link crawler 로:
- 총 53 broken 발견 → 0 까지 정리

Layer 3.5 로:
- 라이브 API `/news` 에 `category` 필드 누락 확인 → 백엔드 `main.py` + `schemas.py` 수정 (macro RSS 3개 추가 + category 필드 추가)

Lighthouse 로:
- `/market/` Best Practices **59점** (TradingView iframe 쿠키) → IntersectionObserver lazy mount 로 **73점** 회복

---

## 운영 체크리스트

**매일**:
- Layer 7 nightly 02:00 UTC 실행 → Issues 탭에 `nightly-qa` 라벨 있으면 확인

**매 PR**:
- 전 레이어 자동 실행. 머지 전 확인:
  - Layer 2/5/6: Playwright PR 체크 green
  - Layer 3: vitest unit 체크 green
  - Lighthouse budget: 5 URL 전부 예산 내
  - Docs-lint (PR5 이후): 드리프트 문구 0

**분기별 (권장)**:
- Layer 1 inventory 숫자 변화 (52 → ?) 추이 확인 — 루트 추가/제거 감지
- Layer 8 flake-log.ndjson aggregated report 확인 — 플레이크 상위 5

---

## 근본 원인 이슈 2건 (세션 중 발견)

### `data-deploy.yml` workflow registry stuck
2026-04-24 00:15~15:22 UTC 동안 10개 PR push 이벤트 drop. 대증요법: 수동 `gh workflow run`. 원론적 해결: `*/30 cron drift detector` 추가 (#1355).

### CodeQL `js/incomplete-multi-character-sanitization`
regex 기반 HTML strip 이 CodeQL 반복 fail → character-scan tokenizer 로 교체 (PR #1341, #1343).

---

## 확장 가이드

새 QA 측면 추가 시:
1. 기존 Layer 중 자연스러운 확장인지 판단 (예: "API 응답 시간 SLA" → Layer 4 확장)
2. 새 클래스면 Layer 9/10/... 번호 부여, 이 문서에 행 추가
3. 트리거 선택: 매 PR (빠른 피드백) / 야간 cron (실측) / 15분 cron (감시)
4. `docs/ARCHITECTURE.md` 의 "QA Assurance Layer" 섹션에 참조 갱신

---

## 관련 파일

- 소스 코드: `scripts/` · `tests/` · `src/schemas/` · `lighthouserc.json`
- CI: `.github/workflows/{nightly-qa,freshness-monitor,flake-report,lighthouse-budget,docs-lint}.yml`
- 아키텍처: `docs/ARCHITECTURE.md` (QA Assurance Layer 섹션)
- 인프라: `docs/INFRASTRUCTURE.md` (CI runner 분배)
