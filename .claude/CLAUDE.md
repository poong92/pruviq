# OWNER DIRECTIVES (최우선)

## 금지 사항 (STOP LIST)

- 문서/프레임워크/프로세스 문서 생성
- 모니터링 인프라 구축 제안
- 스킬 추가/생성
- 리서치 보고서 작성
- 선택지(A/B/C/D) 제시 — 바로 실행
- MEMORY.md 자동 업데이트
- GitHub 이슈에 자동 코멘트
- git commit/push (PR만 생성, 머지는 자동)
- PR 생성 후 "머지해주세요" 언급 금지 — CI 통과 시 자동 머지됨

## Edit 후 즉시 검증 룰 (CRITICAL)

> `post-edit.sh`가 Prettier 자동 실행. 그러나 잘못 제거된 코드(예: `setShowInfo`)는 lint 통과해도 버그 잔존.

매 Edit 직후: `grep -n "변경한_심볼" 파일경로` → 없으면 Edit 재시도. 빌드 통과 ≠ 코드 정상.
**근거**: setShowInfo가 useState destructuring에서 제거됐어도 빌드 통과 (2026-04-14).

## PR 생성 규칙 (CRITICAL)

`gh pr create --title "..." --label automerge --body "..."` — `automerge` 라벨 없으면 자동 머지 안 됨.

## PR/배포 워크플로우

- PR 생성 → CI 자동 통과 → 자동 머지 (오너 수동 머지 안 함)
- backend/ 변경 포함 PR도 자동 머지 (2026-04-11 backend/ 차단 제거)
- backend/ 머지 후: `deploy-backend.yml`이 DO droplet에 자동 SSH 배포 (push + */30 cron)

## 응답 규칙 (3줄)

- What: 뭘 했는지
- Result: 빌드 통과 여부, PR 링크
- Next: 다음 작업

---

# PRUVIQ v0.3.0

"Verify. Execute. Profit." — 무료 크립토 전략 시뮬레이션 + 시장 컨텍스트 플랫폼

- 배포: Cloudflare Pages (pruviq.com) / 백엔드: api.pruviq.com (DO droplet FastAPI :8080)
- 수익: 거래소 레퍼럴 (모든 기능 무료)
- 인프라: MacBook → git push → CF 자동 빌드. Mac Mini M4 dev-only

## 아키텍처 원칙

1. **autotrader 완전 독립** — 코드/데이터/인프라 별도, 코드 복사 금지
2. **새로 검증** — 기존 백테스트 재사용 금지, 처음부터 검증

## 원론적 해결 룰 (반복 방지)

> 현상 → 시스템 분석 → 근본 원인 제거. 증상 패치 금지.

**룰 1 — 디렉토리 라우팅**: `src/pages/[dir]/` 만들면 `index.astro` 필수 (없으면 404). 체크: `ls src/pages/[dir]/`. 근거: /compare 404 (2026-03-15).

**룰 2 — API 페이지 noscript**: `client:load/visible` 페이지의 `<noscript>`는 "JS 활성화" 대신 실제 SSR 데이터 또는 정적 샘플. 근거: /coins, /market, /strategies/ranking JS 의존 빈 페이지 (2026-03-15).

**룰 3 — 수수료율 SSoT**: 모든 거래소 레퍼럴 수수료율은 `src/config/exchanges.ts`에서만. 콘텐츠/컴포넌트 하드코딩 금지. 근거: Binance 10% vs 40% 불일치 (2026-03-15).

**룰 4 — 성과 지표 스코프**: MDD/WR/PF 등은 스코프 명시 필수. ❌ "MDD 33%" ✅ "MDD 33% (포트폴리오 전체 기준)". 근거: /performance 33% vs config 한도 20% 혼란.

**룰 5 — Exception bare pass 금지**: 백엔드 사용자-facing 경로에서 `except ValueError: pass` 금지. `raise HTTPException(400, detail="...")` 사용. 근거: filter_df_by_date() silent failure → 잘못된 날짜 무시.

**룰 6 — 새 전략/프리셋 체크리스트**: (1) 프리셋 동작 확인 POST /simulate (2) 0 trades 아닌지 (3) /strategies/ranking 노출 (4) i18n en.ts+ko.ts 동시 (5) /strategies 인덱스 카드.

**룰 7 — 프로덕션 배포 SSoT (CRITICAL)**: 배포는 `.github/workflows/data-deploy.yml` 하나만. Mac Mini/로컬/타 LaunchAgent에서 `wrangler deploy` 금지 (asset manifest race → 51 페이지 404). 새 자동 배포 추가 전 CF KV concurrency lock 선결. 근거: 2026-04-26 PR #1400.

**룰 8 — Multi-session/Worktree (CRITICAL)**:
(a) 같은 main 브랜치 동시 commit 금지 (cron이 push함, race 발생)
(b) PR rekick은 30분+ stuck 시만. 그 미만은 cron 다음 tick. rekick 전 `gh pr view <N> --json mergeable_state` BEHIND 확인 필수.
(c) 머지된 worktree prune 의무 (weekly cron `scripts/worktree-prune.sh`)
(d) 한 worktree에 두 Claude 인스턴스 금지 (stash 손실 가능). 근거: 2026-04-26 ultraplan 45 PR 머지 중 cron origin-behind → 7-14h diverge.

---

## 커밋 전 필수 QA (CRITICAL)

> git push = Cloudflare 자동 배포 = 커밋 = 프로덕션.

1. `npm run build` → 0 errors + 페이지 수 확인 (현재 ~2518)
2. `bash scripts/qa-redirects.sh` → _redirects vs dist/ 충돌 0건. CONFLICT 있으면 커밋 금지
3. 네비게이션 메뉴 확인 — 각각 다른 페이지 이동 + _redirects가 실제 페이지 가리지 않음

커밋 메시지에 빌드 결과 포함: `"fix: ... (build: 2518 pages, qa-redirects: PASS)"`

## _redirects 관리 (2026-02-19 교훈)

> Cloudflare Pages 우선순위: `_redirects` > 실제 HTML 파일.

- ❌ 금지: 실제 콘텐츠 페이지 경로를 `_redirects`에 추가 (페이지 존재해도 리다이렉트가 먹음)
- ✅ 허용: `Astro.redirect()` 페이지만 `_redirects`에 (이중 안전장치)

페이지 삭제/이동 시: (1) 소스를 `Astro.redirect()`로 변환 (2) `_redirects`에 추가 (선택) (3) `bash scripts/qa-redirects.sh` 실행
