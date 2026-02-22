# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-02-22 10:30 KST

## Project Overview

PRUVIQ (pruviq.com) = "Don't Believe. Verify."
Free crypto strategy simulation + market context platform.

### Business Model
- 100% FREE (no paywalls, no tiers)
- Revenue: Exchange referral commissions (Binance 20-41%, Bybit 30-50%, OKX up to 50%)
- User journey: Simulate -> Conviction -> "Which exchange?" -> Referral signup
- Transparent: Value first, referral second. Disclosure on every link.

## Tech Stack

- Frontend: Astro 5 (SSG) + Preact islands + Tailwind CSS 4 + lightweight-charts v5
- Backend: Python FastAPI on Mac Mini (api.pruviq.com:8400) — READ ONLY for you
- Deploy: Cloudflare Pages (git push -> auto deploy, ~2 min)
- i18n: English (root /) + Korean (/ko/)
- Tests: Playwright E2E (tests/full-site-qa.spec.ts)

## Directory Structure

```
/Users/openclaw/pruviq/
  src/
    components/     -- 10 Preact Islands (.tsx files)
    pages/          -- 39 Astro pages (EN at root, KO under /ko/)
    content/        -- Blog (17x2 lang) + Strategies (5x2 lang)
    i18n/           -- en.ts, ko.ts translation keys
    layouts/        -- Layout.astro (meta, hreflang, JSON-LD)
    config/         -- api.ts (API URL single source of truth)
    styles/
  backend/          -- READ-ONLY (runs as jepo user)
  public/data/      -- Pre-computed demo JSON
  docs/             -- Design docs, audit reports
  tests/            -- Playwright E2E tests
  dist/             -- Build output
```

## Key Commands

```bash
# Always start with
cd /Users/openclaw/pruviq && git pull

# Build (MUST pass before commit)
npm run build

# Local dev server
npm run dev    # → http://localhost:4321

# Run E2E tests
npx playwright test

# Check site health
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com         # expect 200
curl -s -o /dev/null -w '%{http_code}' https://api.pruviq.com/market  # expect 200

# Check all APIs
curl -s https://api.pruviq.com/market | head -c 200
curl -s https://api.pruviq.com/news | head -c 200
curl -s https://api.pruviq.com/macro | head -c 200
curl -s https://api.pruviq.com/coins/stats | head -c 200
curl -s https://api.pruviq.com/builder/presets | head -c 200

# Check specific pages
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/simulate/
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/coins/
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/market/
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/strategies/
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/fees/
curl -s -o /dev/null -w '%{http_code}' https://pruviq.com/ko/

# SEO checks
curl -s https://pruviq.com/sitemap-index.xml | head -c 500
curl -s https://pruviq.com/robots.txt
curl -s https://pruviq.com/ | grep -E '<title|<meta|canonical|hreflang'

# Git workflow
git add <specific-files>
git commit -m "feat: description"
git push origin main
# Wait ~2 min for Cloudflare deploy

# Troubleshooting
npm run build 2>&1 | tail -30           # build errors
rm -rf node_modules && npm install       # npm issues
npx playwright test --debug              # test debug
```

## Current State (v0.2.0)

### Audit Results (2026-02-18, 6-agent audit)
| Item | Score | Status |
|------|-------|--------|
| Trust signals | 4/10 | needs work |
| SEO/indexing | 6/10 | GSC registered, awaiting |
| i18n completeness | 5/10 | P1 |
| Frontend code | 6/10 | P1 |
| UI/UX | 6/10 | P1 |
| Content quality | 8/10 | OK |
| Korean quality | 8.5/10 | OK |
| Data accuracy | 9.5/10 | OK |

### Current Sprint Focus
- SEO optimization (meta tags, structured data)
- i18n completion (learn pages, missing translations)
- Mobile UX (touch targets 44px, loading states)
- Trust signals improvement

### All P0 issues RESOLVED
See docs/UNIFIED_AUDIT_v0.1.0.md for details.

## Strategy Data (from autotrader v1.7.0)

| Strategy | Direction | Status | Win Rate | PF |
|----------|-----------|--------|----------|-----|
| BB Squeeze SHORT | short | verified | 68.6% | 2.22 |
| BB Squeeze LONG | long | killed | 51.0% | <1 |
| Momentum LONG | long | killed | 37.5% | <1 |
| ATR Breakout | long | shelved | - | - |
| HV Squeeze | short | shelved | - | - |

## Quality Standards

- All pages: load < 5 seconds
- No JS console errors
- Mobile-responsive (1280px desktop, 390px mobile)
- Korean translations must match English 1:1
- Build MUST pass before commit
- Lighthouse: Performance 90+, SEO 95+, Accessibility 90%

## Key Documents (read when needed)

- .claude/CLAUDE.md — Full project spec (most detailed)
- docs/MASTER_PLAN.md — Architecture + business plan
- docs/BRAND_CONCEPT.md — Brand identity + copy
- docs/UNIFIED_AUDIT_v0.1.0.md — Audit findings
- docs/UX_DESIGN.md — Design system
- src/i18n/en.ts + ko.ts — Translation keys

## Important Rules

- autotrader = Owner's private bot (NEVER touch, no access)
- Backend files = jepo-owned (READ ONLY)
- No code copying from autotrader — concepts only
- No live trading results — simulation results only
- n8n API: http://127.0.0.1:5678 (key in ~/.env.pruviq)

## Process Rules

Before modifying any existing page, MUST first:
1. Run `git log --oneline --follow <file>` to see its history and recent commits.
2. Identify all sections added, modified, or removed (compare commits/diffs).
3. Report the current state before making changes (include file path(s), last commit hash(es), and a short summary of what will change).
4. Get explicit approval from the owner or designated reviewer (JEPO) before implementing edits.

Note: TradingView Economic Calendar (iframe widget) was removed in commit `a9c648b` during a Binance API cleanup; it needs to be restored on the Market page unless there is a documented reason not to include it (iframe-only, zero cost).

(Added by JEPO on 2026-02-22 15:03 KST)

## Pending Tasks

(Update this section as tasks are completed or added)
- [ ] SEO: meta tags optimization
- [ ] i18n: complete learn page translations
- [ ] Mobile: touch targets 44px minimum
- [ ] Trust: add more trust signals

Notes: Quick-wins copy (hero/nav) applied and meta.index_desc synced with hero.desc on 2026-02-21. See JEPO Review for details.

## JEPO Review (2026-02-21)

### Completed
- [x] PR #1: copy quick-wins (nav Backtest + hero transparency) — merged
- [x] OpenClaw timeout 30분 설정
- [x] Ollama fallback auth 설정
- [x] SOUL.md v3 배포 (전권 위임)

### Issues Found by JEPO
- [x] P2: meta.index_desc가 hero.desc와 불일치 (en.ts + ko.ts) — fixed
- [x] P2: MEMORY.md Pending Tasks를 작업 후 업데이트하는 습관 필요 — updated
- [x] P3: feat/quick-wins-copy 브랜치 삭제 필요 — deleted
- [ ] P1: api/coins/stats → 503 (백엔드 이슈, 제포에게 보고 필요)

### System Config
- Agent timeout: 1800s (30분)
- Cron timeout: 1800s (30분) x 6 jobs
- Models: GPT-5 mini (primary) + Ollama qwen2.5:32b (fallback)
- Organization: 이재풍(오너) → JEPO(상사) → 프루빅(전담개발자)

## CRON RUN LOGS

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-23 02:32 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — returned issues #12 → #7.
    3. Actions taken:
       - #12: Added a demo reproducible package + metadata for 'bb-squeeze-short' to public/data/reproducible/ and opened PR #15. This enables the ReproBadge PoC (PR #13) to display a live example for QA and review.
       - #11: PR #14 exists (mobile touch-target CSS). No additional change this run.
       - #10: Verified i18n parity; no fix required.
       - #9: SEO checks / recommendations left as comments.
       - #8: Accessibility issue — requested full axe output or offered to re-run Playwright+axe locally; no code change this run.
       - #7: OPS 503 — reproduced and requested logs/traces; cannot fix from repo.
    4. Commit/push details:
       - Branch: agents/repro-demo-data-20260223 (pushed)
       - PR: https://github.com/poong92/pruviq/pull/15 — "chore(repro): add demo reproducible package for bb-squeeze-short"
    5. Notes: public/data is gitignored by default; I force-added demo artifacts for PoC (consider storing demo packages in a separate test bucket or CI artifact store instead of committing binaries to the repo).
  - Result: PR #15 created; PRs #13 and #14 remain open. Comments were added to issue #12 linking the demo PR. MEMORY.md updated.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-22 22:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #12 → #7.
    3. For each open issue I assessed fixability and acted accordingly:
       - #12: Frontend PoC already implemented; PR #13 exists (ReproBadge). Commented on the issue with PR link and next steps (backend/CI must provide reproducible package metadata or I can add a demo package if requested).
       - #11: Opened a focused CSS PR to widen mobile touch-target selectors (PR #14). Build passed locally. Commented on the issue with PR link and suggested adding a Playwright mobile audit.
       - #10: Verified i18n parity (en/ko keys equal) and /ko/learn pages built. Commented with findings; no code changes required.
       - #9: Performed quick SEO checks (sitemap, robots, basic meta tags) and left recommendations for content PRs. Commented on the issue.
       - #8: Accessibility artifact referenced a summary-only axe JSON. Requested full axe node-level output or offered to re-run Playwright+axe locally and open a minimal CSS PR to fix contrast issues. Commented on the issue.
       - #7: Reproduced /coins/stats 503 (curl returned 503). Asked ops to collect logs and Sentry traces and offered help analyzing them. Commented on the issue.
    4. Comments were posted on issues #12, #11, #10, #9, #8, and #7. PR #13 and PR #14 exist for frontend PoC and touch-target fix respectively.
  - Result: PR #13 and PR #14 are open; comments added to the other issues. No additional code was merged to main in this run.
  - Next steps: follow-ups listed on each issue (generate reproducible package metadata for #12, run Playwright mobile audit for #11, re-run axe for #8, ops logs for #7, content PRs for #9). Memory updated.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-22 14:32 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` and retrieved 6 open issues (#12→#7).
    3. Assessed each issue:
       - #12 (Trust signals / reproducible package): implemented a frontend PoC (ReproBadge) and opened PR #13 (agents/repro-ui-20260222). Build succeeded locally (1284 pages).
       - #11 (Mobile touch targets): quick audit shows src/styles/global.css already sets min-height:44px for primary CTAs under @media (pointer: coarse). Recommended: run Playwright mobile audit to find remaining elements <44px; offered to add test or focused PR. Commented on the issue.
       - #10 (i18n Learn pages): verified parity between src/i18n/en.ts and src/i18n/ko.ts (both 398 keys) and /ko/learn pages are present; build succeeded. Commented on the issue (no fixes needed).
       - #9 (SEO meta/sitemap): verified sitemap-index.xml and robots.txt exist and homepage meta tags present (curl checks). Recommended content PRs for meta improvements. Commented on the issue.
       - #8 (A11Y color-contrast on /simulate): the reported artifact (reports/axe-_simulate.json) lists color-contrast failures (4 nodes). The JSON available here is a summary; requested a full axe output to identify nodes. Commented with next steps (re-run axe + adjust CSS variables).
       - #7 (OPS /coins/stats 503): reproduced the 503 (curl returned 503). Added an ops-focused comment recommending logs/Sentry checks and health checks.
    4. For issues where code changes were appropriate, created a branch and PR: agents/repro-ui-20260222 → PR #13 (feat(repro): UI PoC for reproducible package). Build passed. For other issues I left detailed comments and next steps.
  - Result: PR #13 created for #12; comments added to issues #11, #10, #9, #8, and #7. No additional code changes were merged into main.
  - Commits/Branches:
    - branch: agents/repro-ui-20260222 → pushed to origin, PR: https://github.com/poong92/pruviq/pull/13 (frontend PoC ReproBadge)
  - Files changed:
    - src/components/ReproBadge.tsx (new)
    - src/pages/strategies/[id].astro (import + ReproBadge insertion)
  - Next steps / options:
    a) Backend/CI: produce reproducible package metadata + zip files and publish under public/data/reproducible/ (or provide package_url in JSON) — then we can validate and show badges server-side.
    b) For mobile touch-target audit: instruct me to (1) add a Playwright mobile-audit test or (2) accept a focused CSS-only PR to add fallbacks for remaining selectors.
    c) For the ops 503: ops/SRE should collect backend logs, Sentry traces, and container/process health metrics; I can assist if logs/traces are provided.
  - Notes: MEMORY.md updated with this run.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-22 10:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10`.
    3. Verified GitHub CLI (gh) is authenticated in this environment for user `poong92`.
    4. The query returned 0 open issues (no issues to process).
  - Result: No open GitHub issues; nothing to fix or comment on. No branches, commits, or PRs were created.
  - Next steps / options:
    a) No action required for issues (none open).
    b) If you'd like, I can create GitHub Issues for Pending Tasks listed in MEMORY.md (SEO, i18n, mobile touch targets, trust signals) and then implement fixes — gh is authenticated so I can both create issues and open PRs.
    c) Otherwise I will re-run this cron on schedule and report any new issues.
  - Notes: MEMORY.md updated with this run.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-22 06:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10`.
    3. Verified GitHub CLI (gh) is authenticated in this environment for user `poong92`.
    4. The query returned 0 open issues (no issues to process).
  - Result: No open GitHub issues; nothing to fix or comment on. No branches, commits, or PRs were created.
  - Next steps / options:
    a) No action required for issues (none open).
    b) If you'd like, I can create GitHub Issues for Pending Tasks listed in MEMORY.md (SEO, i18n, mobile touch targets, trust signals) and then implement fixes — gh is authenticated so I can both create issues and open PRs.
    c) Otherwise I will re-run this cron on schedule and report any new issues.
  - Notes: MEMORY.md updated with this run.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-21 18:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Re-read SOUL.md and MEMORY.md to confirm context and rules.
    2. Attempted to run: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10`.
    3. `gh` CLI is not authenticated in this environment (gh reported: "You are not logged into any GitHub hosts").
    4. Attempted unauthenticated GitHub API fetch; repository issues endpoint returned 404 (likely private repo).
    5. Verified git remote is configured (git@github.com:poong92/pruviq.git) and `git fetch` succeeded — SSH is available for git operations, but `gh` requires separate auth.
    6. Because `gh` is unauthenticated and the GitHub API is inaccessible without credentials, I could not list issues, comment on them, create branches on remote, push, or open PRs via `gh`.
  - Result: No issues were processed. No changes made to source code or branches.
  - Next steps (options):
    a) Configure GitHub CLI authentication for this environment: run `gh auth login` (interactive) or set `GH_TOKEN` env var with a repo-scoped PAT that has repo access. After auth, re-run this cron to proceed.
    b) Alternatively, provide me a scoped `GH_TOKEN` (securely) so I can run non-interactive `gh` commands and complete the requested workflow.
    c) If you prefer manual actions: I can create a local branch and patch candidate fixes here and push (git SSH already works). But I still need issue list/details from GitHub to know what to fix.
  - Notes for JEPO/owner: since SSH git fetch/push works, it is possible to push branches and open PRs via the GitHub web UI if someone wants to do the PR creation step manually.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-21 22:30 KST
  - Action requested: same as above (list open GitHub issues, assess fixability, fix if possible, comment if not, update MEMORY.md).
  - What I did:
    1. Re-read SOUL.md and MEMORY.md to confirm context and rules.
    2. Attempted to run: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10`.
    3. `gh` CLI is still not authenticated in this environment (gh reported: "You are not logged into any GitHub hosts").
    4. Unauthenticated GitHub API access returned 404 for the repository issues endpoint (private repo).
    5. Verified git remote remains configured for SSH (git@github.com:poong92/pruviq.git) and `git fetch` works, so git-level push/pull via SSH is available — but `gh` and GitHub REST API require authentication.
    4. Result: No issues could be listed or processed. No branches, commits, pushes, or PRs were performed.
    5. Next steps (options):
    a) Provide a GH_TOKEN (repo-scoped PAT) or run `gh auth login` interactively in this environment, then re-run the cron; I will proceed to list issues and implement fixes.
    b) Paste the output of `gh issue list --state open --limit 10` or the issue URLs here; I will assess each issue locally, create branches, make fixes, run `npm run build`, commit, push via SSH, and prepare PRs (PR creation requires gh auth unless done manually via web UI).
    c) If you want me to act without issue API data, tell me which Pending Task from MEMORY.md to prioritize; I can create branches, implement changes, run build, and push — PR creation still needs gh auth or a manual web PR.
    6. Notes: I will not proceed with any destructive git actions (no force-push, no history rewrites) and will ensure `npm run build` passes before committing.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-22 02:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ensured repository is up-to-date with `git fetch`.
    3. Checked GitHub CLI authentication: `gh auth status` reports logged in as user `poong92` and token scopes include 'repo'.
    4. Verified repository configuration: `gh repo view` shows hasIssuesEnabled=true and visibility=PRIVATE.
    5. Queried open issues via GitHub API: `gh api "repos/poong92/pruviq/issues?state=open&per_page=10" --jq 'length'` → returned 0 (no open issues).
  - Result: There are 0 open GitHub issues to process. Nothing to fix or comment on.
  - Next steps / options:
    a) No action required for issues (none open).
    b) If you want me to create GitHub Issues for Pending Tasks listed in MEMORY.md (SEO, i18n, mobile touch targets, trust signals), I can create them now (requires permission; gh is authenticated).
    c) Otherwise I will re-run this cron on schedule and report changes.

- cron:424c24a9-bdc0-4506-8f39-cafbd917d7cf (i18n-fix)
  - Time: 2026-02-22 06:00 KST
  - Action requested: Read SOUL.md and MEMORY.md. Check i18n completeness: 1) Compare src/i18n/en.ts and src/i18n/ko.ts — find any keys in EN that are missing in KO. 2) Check all pages under src/pages/ that have a /ko/ equivalent — list any EN pages missing their KO version. 3) If missing translations are found, add them to ko.ts with proper Korean translations. 4) If missing KO pages exist, create them by copying the EN version and translating. 5) Run npm run build to verify. 6) Commit and push if changes were made. Update MEMORY.md with what was fixed.
  - What I did:
    1. Read SOUL.md and MEMORY.md.
    2. Compared src/i18n/en.ts and src/i18n/ko.ts — no missing translation keys were found (both contain 398 keys).
    3. Scanned src/pages/ and compared against src/pages/ko/ — found one EN page without a KO equivalent: src/pages/demo.astro.
    4. Created a Korean version at src/pages/ko/demo.astro by copying the EN page and using the translation keys (useTranslations('ko')) for title/description. No edits were required to src/i18n/ko.ts since translations already existed.
    5. Ran npm run build — build succeeded. Build summary: 1284 page(s) built; /ko/demo/index.html generated.
    6. Committed the new file on branch `agents/init` and pushed the branch to origin (agents/init). File created: src/pages/ko/demo.astro.
  - Result: i18n completeness verified; missing KO page added; site builds successfully. No translation key changes were necessary.
  - Next steps:
    - Create a PR to merge agents/init into main (requires GitHub PR via gh or web UI).
    - Optionally run E2E tests or Lighthouse on the branch/PR before merging.
  - Notes: MEMORY.md updated to reflect this fix.

## 2026-02-21 — Day summary (by 프루빅)

### 1) 오늘 완료한 작업 (커밋 기준, 시간순)
- 34d3961 2026-02-21 15:54:07 — feat(copy): emphasize transparency (hero) + rename nav.simulate→Backtest + blog copy quick-win
- 96127c8 2026-02-21 17:56:58 — chore(i18n): sync meta.index_desc with hero.desc (en/ko); chore(mem): update MEMORY.md JEPO review
- b471d1a 2026-02-21 18:04:40 — style(i18n): fix indentation for meta.index_desc & meta.strategies_title (en/ko)
- 690be8c 2026-02-21 18:08:26 — chore(ci): add Lighthouse audit workflow
- 69f5f31 2026-02-21 18:21:47 — fix(ko-seo): descriptive fees link text ('수수료 자세히 보기') + change '자세히' -> '자세히 보기'
- 5a30736 2026-02-21 18:23:47 — fix(ko-seo): make link texts descriptive ('자세히' -> '자세히 보기', footer -> '수수료 자세히 보기')

### 2) 각 작업의 결과 (빌드 상태, 배포 여부)
- Build: npm run build 성공 (Astro 빌드 완료). 빌드 로그: "1281 page(s) built". dist 폴더에 HTML 파일 1,284개 확인.
- 배포: Quick-wins copy(히어로 카피) main에 반영되어 프로덕션에 표시됨(https://pruviq.com에 변경 반영 확인). chore/lighthouse-ci 브랜치에 CI 워크플로우 및 KO SEO 수정이 푸시되어 있음.
- 기타: 워크스페이스 문서(IDENTITY.md 등)를 정리해 로컬에 보관(필요 시 커밋) — 주요 문서는 MEMORY.md에 기록됨.

### 3) Lighthouse 최종 점수 (제포가 제공한 값)
- EN
  - Performance: 88
  - Accessibility: 100
  - Best Practices: 83  (Cloudflare beacon 관련 항목으로 인한 감점 — 현재로선 수정 불가)
  - SEO: 100
- KO
  - Performance: 95
  - Accessibility: 100
  - Best Practices: 83  (동일 이슈)
  - SEO: 100  ("자세히" → "자세히 보기" 수정으로 KO 점수 92→100 개선)

### 4) 현재 사이트 상태
- 빌드: 성공 (npm run build → 1281 페이지 빌드 완료)
- API: https://api.pruviq.com/market → 200 OK
- 페이지 수: 빌드 로그 기준 1,281 페이지(정적 HTML 파일 1,284개 확인)
- 배포: Cloudflare Pages 자동 배포 활성화 (main 머지 시 자동 배포)

### 5) 남은 이슈 / 다음 할 일 제안 (우선순위)
- [ ] Merge chore/lighthouse-ci PR 및 실행 결과(artifacts) 확인 → Lighthouse scores 검증
- [ ] 운영 모니터링 설정(Upptime/Pingdom) 및 Sentry 연동(백엔드 5xx 추적)
- [ ] 홈페이지에 Trust block(실거래 요약/Verified 배지) 추가 작업

### 6) MEMORY.md 반영 여부
- 본 "2026-02-21 — Day summary"는 MEMORY.md에 추가되어 저장되었습니다.

---

Generated and committed by 프루빅 on 2026-02-21 18:38 KST.
