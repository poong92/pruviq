# PRUVIQ /simulate Redesign — Master Plan

> 2026-04-21 / 담당: 이재풍 + Claude
> 스콥: /simulate + /ko/simulate, 백엔드 계약 유지, 16일 1-sprint
> 목적: 퍼널 퍼포먼스 개선 (방문 → OKX 연결 전환율 0.x% → 2%+)

---

## 0. 왜 (Why)

**전제:** /simulate 는 기능 페이지 아니라 **온보딩 + 신뢰 엔진 + 수익 퍼널 apex**.

**수익 구조:** 유저가 OKX 에 PRUVIQ 통해 연결 → OKX 수수료의 1% (스팟) / 9-20% (선물) → PRUVIQ 수익. 연결 0건 = 수익 0원. 현재 DB 세션 0건.

**OKX 연결의 관문:** /simulate 에서 "이거 진짜" 라는 신뢰 확보 → /dashboard 로 이동 → OAuth 승인 → 연결 완료.

**3 단계 실패 지점 (현재):**
1. /simulate → 신뢰 미획득 (차트 깨짐, 공감 부족, 온보딩 없음)
2. /dashboard 진입 장벽 (왜 OKX 연결? 설명 없음)
3. OAuth 자체 불완전 (별도 이슈, Jun 답변 대기)

**이 플랜은 1 + 2 해결. 3 은 OKX 측 대응 대기.**

---

## 1. 목표 (Goals) + 측정 지표 (KRs)

### O: /simulate 를 온보딩 + 신뢰 엔진으로 전환

| KR | 현재 | 90일 목표 |
|----|------|----------|
| /simulate 평균 체류 시간 | ? (측정 계기) | **120초+** |
| 프리셋 전환 이벤트 / 세션 | ? | **1.5+** |
| "Run live on OKX" CTA CTR | N/A (버튼 없음) | **5%+** |
| /simulate → /dashboard 이동률 | ? | **2%+** |
| OAuth 시작률 (/dashboard → okx.com authorize) | 0% (막힘) | OKX 해제 후 측정 |
| 모바일 이탈률 (>3s 세션) | ? | **<40%** |
| Lighthouse Perf | ? | **85+** |
| Lighthouse A11y | ? | **95+** |

**계기 (instrumentation):** Cloudflare Analytics + 자체 `/events` 엔드포인트 (Phase 3 포함).

---

## 2. 페르소나 × 스킬 매트릭스 (9 시나리오)

| 페르소나 ↓ / 스킬 → | 🟢 Quick Start | 🟡 Standard | 🔴 Expert |
|-------------------|---------------|-----------|---------|
| **A. 신규 한국인 리테일** | 기본 경로. 한국어 툴팁, sticky CTA. | 드물게 upgrade. | 거의 없음. |
| **B. 숙련 해외 퀀트** | 스킵 가능. | 기본 경로. Sharpe/Sortino/Heatmap. | 자주 upgrade. CSV, 키보드. |
| **C. 회의론자** | "Why trust" 링크 즉시 클릭. | 숫자 검증. | methodology 읽음. |
| **D. 모바일** | 주 진입점. sticky bottom Run. | 드물다. | 거의 없음. |
| **E. 접근성 (SR/키보드)** | 모든 스킬 공통 경로. ARIA live, keyboard nav. | 동일. | 키보드 단축키 환영. |

---

## 3. Information Architecture

### 현재 (문제)
```
/simulate → 단일 UI (모든 유저 동일)
  └── 빈 상태 또는 Loading strategy builder...
  └── 차트 (mobile 깨짐)
  └── 빌더 + 결과 혼재
```

### 목표
```
/simulate                       ← Skill mode: auto-detected or URL-forced
  ├── ?m=q (Quick Start)        ← 기본. 첫 방문자.
  │   └── 프리셋 카드 3개, 즉시 실행, 결과 이미 표시
  │
  ├── ?m=s (Standard)           ← 기본 프리셋 클릭 or /strategies "Try" 링크
  │   └── 7 프리셋 + SL/TP + 결과 전체
  │
  └── /simulate/builder (Expert) ← 커스텀. 별도 URL.
      └── Indicator AND/OR + 조건 + 저장 + CSV export
```

### URL 상태 SSoT
- 모든 설정값 → URL query string
- `?preset=bb-squeeze-short&sl=10&tp=8&coins=top50&tf=1H&period=2y`
- 공유·북마크·재현 가능 (SSoT)
- localStorage 는 mode 토글만 (preference)

### 크로스 링크
- /strategies 의 "Try this" → `/simulate?preset=X` (Standard 모드)
- /strategies/ranking 의 "Simulate" → `/simulate?preset=X&tf=Y`
- /signals (유저가 시그널 본 뒤) → `/simulate?preset=X&symbol=Y`

---

## 4. 컴포넌트 인벤토리 (22개)

| # | 컴포넌트 | 재사용 | 신규/개조 | Phase |
|---|---------|------|---------|-------|
| 1 | PageHero | 전체 | 개조 | 1 |
| 2 | TrustGapHeader | /simulate | 신규 | 1 |
| 3 | PresetCard | /strategies | 신규 공용 | 1 |
| 4 | PresetGallery | /simulate | 신규 | 1 |
| 5 | SkillModeToggle | /simulate | 신규 | 2 |
| 6 | RiskRewardVisualizer | /simulate | 신규 | 1 |
| 7 | SLTPSlider (Dual) | /simulate | 신규 | 1 |
| 8 | HoldTimelineBar | /simulate | 신규 | 1 |
| 9 | UniverseChips | /simulate | 신규 | 2 |
| 10 | StrategySetupCard | /simulate | 신규 | 1 |
| 11 | EntryConditionVisualizer | /simulate | 신규 (14 변형) | 2 |
| 12 | MetricGrid | /simulate, /performance | 개조 공용 | 1 |
| 13 | MiniEquityCurve | /simulate, /strategies | 신규 공용 | 2 |
| 14 | MonthlyHeatmap | /simulate | 신규 | 2 |
| 15 | QuantDetails (accordion) | /simulate | 신규 | 2 |
| 16 | LiveVsBacktestBadge | /simulate, /strategies | 신규 | 1 |
| 17 | TrustLinksSection | /simulate, /trust | 신규 | 1 |
| 18 | OKXConnectCTA | /simulate, /dashboard | 개조 | 1 |
| 19 | ShareConfigButton | /simulate | 신규 | 2 |
| 20 | CSVExportButton | Expert only | 신규 | 3 |
| 21 | IndicatorComposer | Expert only | 신규 | 3 |
| 22 | KeyboardShortcutHelp | Expert only | 신규 | 3 |

### 재사용 원칙
- PresetCard, MetricGrid, MiniEquityCurve, OKXConnectCTA, TrustLinksSection 은 **다른 페이지에서도 씀** → 공용 컴포넌트 디렉토리로 승격
- Expert 전용은 `/simulate/builder` 스콥 유지

---

## 5. 디자인 시스템 확장

### 기존 토큰 활용
- `--color-accent`, `--color-bg-card`, `--color-text-muted` 그대로 사용
- Tailwind `card-enterprise` 패턴 유지

### 신규 토큰 필요
```css
/* Trust-signal 색상 (현재 없음) */
--color-verified-bg: green-500/10;
--color-verified-border: green-500/40;
--color-research-bg: yellow-500/10;
--color-research-border: yellow-500/40;

/* Heatmap 그라디언트 */
--heatmap-loss-deep: red-600;
--heatmap-loss-light: red-500/40;
--heatmap-neutral: gray-500/30;
--heatmap-gain-light: green-500/40;
--heatmap-gain-deep: green-600;

/* Motion */
--motion-preset-swap: 150ms ease-out;
--motion-metric-recalc: 300ms ease-in-out;
--motion-result-enter: 400ms cubic-bezier(0.16, 1, 0.3, 1);
```

### 타이포 hierarchy (엄격)
- **Hero metric** — 48px Bold mono (Win rate, Return 숫자)
- **H1** — 36-48px Extrabold
- **Section H2** — 20-24px Bold
- **Card label** — 11px uppercase mono tracking-wide
- **Body** — 14-16px regular
- **Meta / timestamp** — 11px mono muted

### 모션 원칙
- 슬라이더 드래그 → 메트릭 재계산: debounce 300ms + fade 150ms
- 프리셋 변경: cross-fade 150ms
- 결과 최초 렌더: bottom-up enter 400ms stagger (메트릭 카드들)
- **CLS 0** 목표 (레이아웃 시프트 금지)
- `prefers-reduced-motion` 존중

---

## 6. 데이터 흐름 + API 계약

### 현재 엔드포인트 (변경 없음)
- `POST /simulate` — 메인 백테스트. 입력 body: strategy, sl_pct, tp_pct, period, coins, timeframe
- `GET /rankings/daily` — 일간 랭킹
- `GET /strategies/list` — 프리셋 메타
- `GET /signals/live` — 실시간 시그널
- `GET /auth/okx/status` — OAuth 상태

### 신규 엔드포인트 필요
- `GET /simulate/metadata?preset=X` — 프리셋 상세 + live trading 성과 요약 (없으면 {}). Phase 1 의 "Backtest vs Live gap" 뱃지용.
- `GET /trust/gap-summary` — "Backtest +54%, Live +38%, Gap 3%" 3 숫자. Phase 1 hero용.
- **옵션** `POST /events` — 분석 이벤트 수집. Phase 3.

### 백엔드 계약
- /simulate 응답 schema 고정 (JSON Schema 파일 생성, CI 검증)
- 스키마 변경 시 PR 에 schema diff 필수

### SSR vs Client
| 데이터 | 전략 |
|--------|------|
| 프리셋 메타 (name, live_status) | **SSR** — 빌드타임에 주입 (public/data/presets.json) |
| 기본 시뮬 결과 | **SSR** — 대표 프리셋 결과 prepopulate (빈 상태 제거) |
| 유저 커스텀 시뮬 결과 | **Client fetch** — URL 변경 시 재요청 |
| OAuth 상태 | **Client fetch** — 캐시 X, every load |
| Trust gap summary | **SSR (60s revalidate)** — 거의 변하지 않음 |

---

## 7. 상태 관리

### 원칙
- **URL = SSoT.** 모든 유저 입력은 URL query 에 sync.
- **React state = URL 의 reflection.** useEffect 로 URL 변경 시 상태 갱신.
- **localStorage 는 preference 만** (skill mode, 마지막 본 coin 등). 상태 복원 X.

### 구체 구현
```typescript
// useSimConfig hook
const { config, updateConfig } = useSimConfig();
// config: { preset, sl, tp, coins, timeframe, period }
// updateConfig(patch) → URL updated + fetch triggered (debounced 300ms)
```

### 재계산 트리거
- URL 변경 감지 → fetch
- 동일 config 재요청은 in-memory cache 히트 (LRU 10)
- Fetch in-flight 시 이전 요청 abort (AbortController)

---

## 8. 폼 + 검증

### 클라이언트 검증
- SL: 0.5 ~ 50% (0 이면 무손절 위험, 50 초과 무의미)
- TP: 0.5 ~ 100%
- Period: 최소 30일, 최대 백엔드 지원 범위
- SL vs TP: SL > TP 허용 (역R:R 전략), 단 경고 툴팁 표시

### 서버 에러 처리
- 400 (잘못된 파라미터): 필드 옆 inline 에러
- 422 (범위 초과): 부드러운 경고, 기본값 복원 제안
- 500 (백엔드 실패): "Simulation temporarily unavailable" + retry 버튼
- Timeout (30s+): "Simulation timed out. Try shorter period or fewer coins."

---

## 9. 접근성 (WCAG 2.2 AA 목표)

### 필수
- 색 대비 4.5:1+ (텍스트), 3:1+ (UI 요소)
- 키보드 전체 탐색 (Tab / Shift+Tab / 방향키 / Enter / Esc)
- 스크린리더 랜드마크: `<main>`, `<nav>`, `<aside>`, `<section aria-label>`
- 슬라이더: `role="slider"` + `aria-valuemin/max/now` + `aria-valuetext="-10%"`
- 결과 영역: `aria-live="polite"` (재계산 자동 알림)
- 포커스 visible (outline 또는 ring)
- 44×44px 최소 터치 타겟
- Reduced motion 존중

### 검증
- axe-core CI 게이트 (0 violations)
- 수동 NVDA + VoiceOver 주요 경로 1회
- 키보드 only 전체 플로우 녹화 (README 에 첨부)

---

## 10. 성능 예산

| 지표 | 기준 | 초과 시 |
|------|------|---------|
| LCP | <2.5s (75p) | PR reject |
| INP (이전 FID) | <200ms | 경고 |
| CLS | <0.1 | PR reject |
| JS bundle (gzipped) | <180KB | 경고 |
| TTFB (SSR) | <500ms | Cloudflare edge 조사 |
| /simulate POST p95 | <3s | 백엔드 조사 |

### 전략
- 기본 프리셋 결과 SSR → LCP 단축
- 차트 X (Phase 1 기준) — chart lib 제거로 bundle 약 60KB 절약
- Entry Visualizer = 순수 SVG/DOM (라이브러리 무)
- 이미지 없음 (아이콘은 Lucide SVG inline)
- Preact 기반 (React 대비 3배 작음)

---

## 11. i18n 전략

### 신규 키 예상량
- simulate.* : 기존 ~40 + 신규 ~50 = **~90**
- 각 전략 해설 (14개): 이름, 입장 조건, 시각적 설명 → **42 키** (14 × 3)
- 에러 메시지 10개
- A11y aria-label 20개

**총 신규 ~120 키 × 2 언어 = 240 문자열.**

### 번역 품질
- 전문용어 (Sharpe, Sortino, MDD 등) 는 영어 유지 + 첫 출현 시 괄호 해설
- 한국어 카피 copywriter subagent 최종 검토

---

## 12. 스킬 모드 구현

### 모드 감지 로직 (Phase 2)
```
function detectMode(url) {
  if (url.query.m === 'q') return 'quick';
  if (url.query.m === 'x') return 'expert';
  if (url.pathname.endsWith('/builder')) return 'expert';
  if (url.query.preset) return 'standard'; // from cross-link
  if (hasVisitedBefore() && localStorage.lastMode) return localStorage.lastMode;
  return 'quick'; // default for first-time
}
```

### 모드 간 전환
- 상단 토글 3 버튼 `Quick · Standard · Expert`
- 클릭 → URL 갱신 + 컴포넌트 재렌더
- 모드 간 설정값 최대한 preserve (Quick → Standard 갈 때 기본 프리셋 유지)

---

## 13. 신뢰 기반 (Trust Pillars 5)

/simulate 가 온보딩 엔진이려면 아래 5 신뢰 신호를 모두 전달해야 함:

1. **데이터 투명성** — "OKX USDT-SWAP, 2년, 상장폐지 포함, 0.05% 수수료" (한 줄 명시, 항상 보임)
2. **실패 공개** — "88 전략 실험, 2개 승격, 14 연구, 72 폐기" (버튼 → /changelog)
3. **Backtest-vs-Live 갭** — 숫자 3개 (백테 x%, 실거래 y%, gap z%) + 설명 팝오버
4. **지표 스코프 명시** — MDD, Win rate 에 (portfolio vs per-strategy) 명시
5. **공개 감사** — "Every trade published" /trust 링크 + Merkle transparency 언급 (C8 해결 후)

---

## 14. 테스트 전략

### 단위 테스트 (Vitest)
- useSimConfig hook: URL ↔ state 동기화
- 메트릭 포맷팅 함수들 (percentage, duration)
- 슬라이더 검증 함수

### 통합 테스트
- /simulate API mocking + 결과 렌더 확인
- 에러 상태 (400/500/timeout) 각각 UI 검증

### E2E (Playwright)
- **5 페르소나 × 3 뷰포트 = 15 시나리오 보장**
  - 각 페르소나의 핵심 user journey 2-3 단계
- 키보드 only 전체 플로우 1 시나리오
- 스크린리더 시나리오 최소 1개 (NVDA 또는 axe)

### 시각 회귀
- Playwright screenshot 기존 로직 활용
- 3 뷰포트 × 2 언어 × 2 모드 (quick/standard) = 12 베이스라인 스크린샷

### 계약 테스트
- /simulate API 응답 JSON Schema 검증 (CI)

---

## 15. 롤아웃 플랜

### Feature Flag
- Cloudflare Worker 또는 `?v=new` query param 으로 구 UI ↔ 신 UI 토글
- 초기: staging 에서만 신 UI
- 점진: 10% → 50% → 100% 트래픽

### 측정 기간
- 각 단계 최소 72h 유지
- 주요 지표 regression 감지 시 즉시 rollback

### 공개 커뮤니케이션
- Telegram 공지 "새 시뮬레이터 프리뷰"
- /changelog 엔트리
- Blog 포스트 (선택)

---

## 16. 리스크 등록부

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| OKX OAuth 여전히 막힘 | 높음 | 중 | "Run live" CTA 비활성 + "Coming soon when OKX approves" 문구 |
| Backtest-vs-Live 데이터 부재 | 중 | 중 | Phase 1 에서 mock 값 → 실제 API 있으면 교체 |
| Entry Visualizer 14 전략 디자인 시간 초과 | 높음 | 저 | 핵심 5 개만 Phase 2, 나머지 Phase 3 로 연기 |
| 성능 예산 초과 | 중 | 고 | Phase 1 끝에 Lighthouse 게이트 |
| 모바일 슬라이더 사용성 낮음 | 중 | 고 | Phase 1 유저 테스트 3 명 이상 |
| i18n 240 문자열 번역 시간 | 중 | 저 | EN 먼저 → KO 자동번역 + copywriter 검수 |

---

## 17. 팀 + 시간 + 16일 브레이크다운

**리소스: 이재풍 (의사결정/PM) + Claude (구현 전담)**
**외부 필요 (선택):** 디자이너 — Entry Visualizer 14 개 삽화 (Phase 2). 없으면 Claude 가 기본 수준 SVG.

### Phase 1 — Onboarding Core (6일)

| 일 | Deliverable |
|----|-----------|
| D1 | 디자인 시스템 확장 (신규 토큰 + 타이포 + 모션) · Tailwind config 업데이트 |
| D2 | PresetGallery + PresetCard + LiveVsBacktestBadge + TrustGapHeader |
| D3 | SLTPSlider + RiskRewardVisualizer + HoldTimelineBar + StrategySetupCard |
| D4 | MetricGrid + MiniEquityCurve placeholder (실 데이터는 Phase 2) |
| D5 | OKXConnectCTA + TrustLinksSection + URL ↔ state hook · useSimConfig |
| D6 | 모바일 레이아웃 · sticky CTA · 초기 E2E 2 시나리오 · Lighthouse 첫 측정 |

**Phase 1 출하 기준:** LCP <2.5s, A11y score 95+, 주요 E2E 녹색. 신 UI 를 staging 에 올리고 feature flag 로 토글.

### Phase 2 — Trust Depth (5일)

| 일 | Deliverable |
|----|-----------|
| D7 | EntryConditionVisualizer (BB Squeeze, RSI, MACD 3개 기본) |
| D8 | EntryConditionVisualizer (MA Cross, Supertrend 2개 + 패턴 extract) |
| D9 | MonthlyHeatmap + QuantDetails (Sharpe, Sortino 등 accordion) |
| D10 | UniverseChips + ShareConfigButton + SkillModeToggle |
| D11 | i18n 240 문자열 KO 번역 + 검수 · 시각 회귀 베이스라인 |

**Phase 2 출하 기준:** 신 UI 100% 대체, 구 UI 제거 가능.

### Phase 3 — Expert + Polish (5일)

| 일 | Deliverable |
|----|-----------|
| D12 | /simulate/builder 라우트 + IndicatorComposer (AND/OR) |
| D13 | CSV export + 프리셋 저장 + KeyboardShortcutHelp |
| D14 | 나머지 9개 Entry Visualizer (핵심 패턴 재사용) |
| D15 | A11y 전수 audit (axe + 수동 SR/키보드) · Lighthouse 최종 |
| D16 | E2E 15 시나리오 완성 · 시각 회귀 · 롤아웃 준비 |

**Phase 3 출하 기준:** 프로덕션 100% 트래픽 신 UI.

---

## 18. 의존성 + 블로커

### 의존성 (이 플랜 시작 전 필요)
1. **백엔드 `/simulate/metadata` + `/trust/gap-summary` 엔드포인트** — 없으면 mock 으로 Phase 1 진행, Phase 2 이전에 구현
2. **데이터: Live trading 성과 공개 허용** — 이재풍님 결정 (공개? 요약만?)
3. **Expert 모드 범위** — Phase 3 에 포함 확정

### 차단 (blocker)
1. 🔴 **OKX OAuth 여전히 막힘** (Jun 답변) → "Run live" CTA 최종 활성화만 대기. 나머지 진행 가능.
2. 🟡 **백엔드 Sharpe/Sortino 반환 필드 여부** — 확인 후 누락 시 백엔드 추가

---

## 19. Decision Log (세션 기반 의사결정 기록)

| # | 결정 | 근거 |
|---|------|------|
| 1 | 차트 (price + trade markers) 제거 | 원래 의도 "빌더 시각화" 미충족 · 모바일 깨짐 · 경쟁사 모방 |
| 2 | 3 스킬 모드 (Quick/Standard/Expert) | 페르소나 분화 · 모바일 최적화 |
| 3 | 디폴트 Quick Start with pre-populated results | 빈 페이지 이탈 방지 |
| 4 | URL = SSoT | 공유·재현·북마크 |
| 5 | /simulate 에서 OKX 연결 CTA 명시 노출 | 온보딩 퍼널 목표 |
| 6 | Entry Visualizer 14 전략 — 순수 SVG | 번들 사이즈 + 디자이너 없어도 진행 |
| 7 | Expert 는 별도 URL `/simulate/builder` | 복잡성 격리, SEO 분리 |
| 8 | 기본 feature-flag 롤아웃 | 리그레션 리스크 관리 |
| 9 | Live-vs-Backtest gap 첫 화면 | 신뢰 차별화 핵심 |
| 10 | `/market` 유지 | 2026-04-21 오너 결정 — 제거 안 함, 별도 PR 없음 |

---

## 20. Acceptance Criteria (Done 정의)

**Phase 1 "Done" =**
- [ ] 신 UI 를 `?v=new` 토글로 staging 접근 가능
- [ ] 5 페르소나 기본 경로 E2E 통과
- [ ] 3 뷰포트 시각 회귀 통과
- [ ] A11y axe 0 violations
- [ ] Lighthouse Perf 85+, A11y 95+
- [ ] EN + KO i18n 모두 존재 (새 키 포함)
- [ ] OKXConnectCTA 가 /dashboard 로 올바른 params 전달
- [ ] 기존 URL query string 호환 (`/simulate?preset=bb-squeeze-short` 등)

**Phase 2 "Done" =** 위 + 신 UI 100% 트래픽, 구 UI 제거, 14 전략 중 5 개 Entry Visualizer.

**Phase 3 "Done" =** 위 + /simulate/builder 가동, 나머지 9 Entry Visualizer, 프로덕션 안정.

---

## 21. 승인된 결정 사항 (2026-04-21 오너 확정)

| # | 질문 | 확정 답변 |
|---|------|----------|
| 1 | 플랜 전체 승인 | ✅ 16일 올인 스프린트, Phase 1→2→3 순차 |
| 2 | `/market` 제거 | ❌ 유지 (제거 안 함) |
| 3 | Expert 모드 범위 | ✅ Phase 3 에 `/simulate/builder` 포함 |
| 4 | Live trading 성과 공개 | **(b) 요약 백분율만** — "Backtest +54% / Live +38% / Gap 3%" 형태 |
| 5 | Hero 카피 톤 | ✅ "Most Backtests Lie. Ours Come With Proof." 유지 |
| 6 | 스킬 모드 default | ✅ 첫 방문자 → **Quick Start** |
| 7 | Entry Visualizer 14 개 제작 | **Claude 프론트 스킬로 자체 제작** — 순수 SVG, 외주 없음 |

**모든 기본값 = 전문가(Claude) 권고안 동일. 추가 질문 없음. D1 시작.**

**전체 진행 방식 확정:**
- 원스텝 진행 (세션 분절 X, 컨텍스트 보호)
- 자동매매 관련 GNB 항목은 Phase 1 중 "Coming Soon" 처리
- 디자이너 = Claude 프론트엔드 스킬

---

## 22. 수정 이력

| 일자 | 수정 | 작성 |
|------|------|------|
| 2026-04-21 | 초안 | Claude + 이재풍 세션 |
| 2026-04-21 | §19 item 10 수정 (/market 유지), §21 전면 개정 (7개 결정 모두 확정, 전문가 기본값 그대로 승인) | 오너 최종 확정 |
