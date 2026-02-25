# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-02-26 02:30 KST

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

## Recent Automation Update

- Time: 2026-02-24 03:59 KST
- Actor: PRUVIQ Bot (프루빅)
- Branch: agents/upgrade-automation-20260223
- Commits: c9a23c8 (chore(autonomy): add AUTONOMY.md, VERSION, PR template, and validate-startup-files CI)
- Tag: v0.0.1 (created and pushed)
- What changed:
  - Added AUTONOMY.md (automation policy, merge rules, rollback) (confirmed in AUTONOMY.md)
  - Created VERSION = 0.0.1 (confirmed in VERSION)
  - Added PR template (.github/pull_request_template.md)
  - Added validate-startup-files CI (.github/workflows/validate-startup-files.yml)
  - (Earlier) research PoC and workflow added in branch (scripts/research_agent.py, .github/workflows/agent-research-free.yml)
- Why: Enable safe, incremental automation for agent-driven work while preserving safety and rollback paths.
- Next: Monitor PR #20 CI results; after CI passes run post-merge smoke checks and, if OK, deploy and re-submit sitemap to GSC as needed.

Generated and committed by PRUVIQ Bot on 2026-02-24 03:59 KST.

## Pending Tasks

(Update this section as tasks are completed or added)
- [ ] SEO: meta tags optimization
- [ ] i18n: complete learn page translations
- [ ] Mobile: touch targets 44px minimum
- [ ] Trust: add more trust signals

Notes: Quick-wins copy (hero/nav) applied and meta.index_desc synced with hero.desc on 2026-02-21. See JEPO Review for details.

## CRON RUN LOGS

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (daily-seo-audit)
  - Time: 2026-02-26 00:00 KST
  - Action requested: daily SEO audit (titles, meta descriptions, sitemap, robots, hreflang, JSON-LD, build)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules.
    2. Fetched sitemap-index.xml and parsed sitemap-0.xml to extract all URLs used for crawling (saved to /Users/openclaw/pruviq/tmp/urls.txt).
    3. Crawled every URL listed in the sitemap and extracted <title>, meta description, hreflang counts, and JSON-LD presence. Results saved to /Users/openclaw/pruviq/tmp/seo_pages.tsv (TSV: url, http_code, title, title_len, desc, desc_len, hreflang_count, jsonld_count).
    4. Verified robots.txt and homepage/KO JSON-LD validity.
    5. Ran `npm run build` to confirm the site builds successfully.

  - Findings (evidence):
    - sitemap: https://pruviq.com/sitemap-index.xml exists and references sitemap-0.xml (confirmed via `curl -s https://pruviq.com/sitemap-index.xml` — sitemap contains `<loc>https://pruviq.com/sitemap-0.xml</loc>`).
    - robots.txt: present and allows crawling; contains `Sitemap: https://pruviq.com/sitemap-index.xml` (confirmed via `curl -s https://pruviq.com/robots.txt`).
    - URLs parsed: 2389 (confirmed by counting lines in /Users/openclaw/pruviq/tmp/urls.txt: `wc -l /Users/openclaw/pruviq/tmp/urls.txt` → 2389).
    - Titles: 2389 pages have a non-empty <title> (confirmed by parsing /Users/openclaw/pruviq/tmp/seo_pages.tsv).
    - Meta descriptions: 2389 pages have a non-empty meta description (confirmed in /Users/openclaw/pruviq/tmp/seo_pages.tsv).
    - hreflang: all pages include alternate hreflang links (hreflang_count >= 1 for every URL in seo_pages.tsv).
    - JSON-LD: every crawled page includes at least one `<script type="application/ld+json">`; homepage and /ko/ scripts parse as valid JSON (verified via a quick JSON parse).
    - HTTP status: all pages returned HTTP 200 during the crawl (no 4xx/5xx observed in this run).
    - Build: `npm run build` completed successfully (build output includes lines such as `[build] ✓ Completed in 6.21s.` and `[vite] ✓ built in 2.98s`) — full build logs are available in the build run output.

  - Actions taken:
    - No source-code changes were required — template and i18n copy already produce proper <title>, meta description, hreflang, and JSON-LD across pages.
    - Saved raw crawl output: /Users/openclaw/pruviq/tmp/seo_pages.tsv (use this file to inspect any individual pages).
    - Ran and verified `npm run build` locally to ensure changes would build cleanly (build succeeded).
    - Appended this audit summary to MEMORY.md.

  - Next / Recommendations:
    - Add a lightweight CI check (e.g., GitHub Action) that parses sitemap and asserts each URL has a non-empty <title> and meta description; this would catch regressions on PRs.
    - Re-submit sitemap to Google Search Console if significant content changes are made.
    - Schedule a weekly Lighthouse SEO + Accessibility audit for high-priority pages (index, coins top 20, blog) and store reports in /docs/lighthouse/

Generated and appended to MEMORY.md by PRUVIQ Bot (프루빅) on 2026-02-26 02:30 KST.

- cron:gh-issues-autofix:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix run)
  - Time: 2026-02-26 02:30 KST
  - Action requested: Read open GitHub issues and attempt safe, low-risk fixes. For fixable items: create a branch, implement minimal non-destructive changes, run `npm run build`, commit, push, and open a PR. For others: add an explanatory comment.

  - What I did (step-by-step):
    1. Read SOUL.md and MEMORY.md to confirm governance and the "No Hallucination" policy.
    2. Ran `gh issue list --state open --limit 50 --json number,title,body,labels,url` to fetch open issues (confirmed 12 open issues: 46,45,40,39,21,19,12,11,10,9,8,7) (from `gh` output).
    3. Ran `npm run build` to ensure the site builds before making any changes (build completed successfully; generated `dist/` with `sitemap-index.xml` and `dist/ko/learn/` pages). Evidence: build output and `ls -la dist` (sitemap-index.xml and robots.txt present), and `ls -la dist/ko/learn` (many Learn pages generated).
    4. Assessed each open issue:
       - #21 chore(research): enable BRAVE_API_KEY — FIXABLE (docs-only): created branch `fix/issue-21-document-brave-api`, added `docs/research-agent.md` with provisioning steps (no secrets), ran `git commit` and `git push`, and opened PR #51: https://github.com/poong92/pruviq/pull/51 (confirmed via `git push` and `gh pr create`). Then commented on issue #21 linking the PR and next steps.
       - #10 Task: i18n — complete Learn page translations — NOT REQUIRING FIX: verified `npm run build` generated `/ko/learn/` pages (confirmed under `dist/ko/learn/`); no immediate code changes required. Commented on the issue with evidence (build + `dist/ko/learn` listing).
       - #9 Task: SEO — meta descriptions & sitemap tuning — NOT REQUIRING FIX RIGHT NOW: verified `dist/sitemap-index.xml` and `dist/robots.txt` exist after the build (evidence in `dist/`), and the daily SEO audit previously recorded 2389 URLs with non-empty titles/descriptions (see `/Users/openclaw/pruviq/tmp/seo_pages.tsv`). Added a comment with evidence and recommended CI checks.
       - #19 and #7 OPS: api.pruviq.com 502/503 /coins/stats 503 — NOT FIXABLE FROM REPO: these are production backend issues requiring server logs and Ops access. I attached guidance and requested server logs/Sentry traces. Referenced `reports/api-health-2026-02-23.txt` (confirmed in repo: `/Users/openclaw/pruviq/reports/api-health-2026-02-23.txt`).
       - #46, #45, #40, #39 (auto-discovered improvements / performance hints) — NOT FIXABLE AUTOMATICALLY: left a triage comment requesting prioritization and specific artifacts (Lighthouse trace or audit output) so I can open targeted PRs per item.
       - #12 Task: Trust signals — multi-step PoC (data + frontend) — NOT FIXABLE AUTOMATICALLY: recommended breaking into smaller PRs (criteria design → data PoC → UI) and requested assignment.
       - #11 Task: Mobile touch targets — Requires audit + component-level CSS fixes; recommended running the Playwright touch-target audit (tests/mobile/touch-target-audit.spec.ts) and then opening small, safe PRs. Did not modify site CSS automatically.
       - #8 A11Y color-contrast on /simulate — Needs frontend fixes & accessible color choices; requested the axe JSON artifact (not found in reports/ folder) or asked to re-run Playwright a11y job and upload artifacts.

  - Actions performed on GitHub (evidence):
    - Created branch `fix/issue-21-document-brave-api` and pushed: confirmed in local git push output.
    - Opened PR #51: https://github.com/poong92/pruviq/pull/51 (created via `gh pr create`).
    - Commented on issue #21 linking PR #51 and next steps (confirmed comment URL: https://github.com/poong92/pruviq/issues/21#issuecomment-3960841290).
    - Added short triage comments to the other issues summarizing findings and actions required (comments posted via `gh issue comment`).

  - Evidence (local files / commands):
    - Build output (success) and dist files: `/Users/openclaw/pruviq/dist/sitemap-index.xml`, `/Users/openclaw/pruviq/dist/robots.txt`, `/Users/openclaw/pruviq/dist/ko/learn/` (confirmed via `ls -la`).
    - API health artifact: `/Users/openclaw/pruviq/reports/api-health-2026-02-23.txt` (contains raw curl outputs and timestamps) — useful for Ops.
    - PR created: https://github.com/poong92/pruviq/pull/51 (docs-only change; no secrets added to repo).

  - Results / Status:
    - PR #51: open and awaiting review (docs change explaining where to provision BRAVE_API_KEY).
    - Issues requiring Ops access or manual design/review: #19, #7, #12, #11, #8, #46, #45, #40, #39 — I left triage comments and recommended owners for each.
    - i18n Learn pages: confirmed present in `dist/ko/learn/`; no immediate PR required.

  - Next steps recommended:
    1. Ops/SRE (or JEPO) to provision BRAVE_API_KEY in the deployment environment or add it to GitHub Actions secrets and then confirm; after that I can enable/trigger the research agent to produce Brave-backed results.
    2. Ops: provide server logs / Sentry trace IDs for the 5xx errors (issues #19 and #7) so I can analyze and suggest a follow-up PR or runbook updates.
    3. For auto-discovered improvements (#46, #45, #40, #39): share Lighthouse trace JSON or prioritize which item(s) to fix and I will open targeted PRs.
    4. If you want me to proceed with low-risk cosmetic CSS fixes (mobile touch-targets), reply and I will: a) run the Playwright touch-target audit locally, b) create a small branch with minimal CSS changes, c) run `npm run build`, and d) open a PR for review.

Generated and appended to MEMORY.md by PRUVIQ Bot (프루빅) on 2026-02-26 02:30 KST.

- cron:424c24a9-bdc0-4506-8f39-cafbd917d7cf (i18n-fix)
  - Time: 2026-02-26 06:01 KST
  - Action requested: i18n completeness check (compare en.ts vs ko.ts, ensure /ko/ pages exist for EN pages)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm governance and the "No Hallucination" policy. (confirmed in /Users/openclaw/pruviq/SOUL.md and /Users/openclaw/pruviq/MEMORY.md)
    2. Compared `src/i18n/en.ts` and `src/i18n/ko.ts` for missing translation keys using a small script that extracts translation keys. Result: no missing keys (script output: `[]`).
    3. Scanned `src/pages/` and verified each EN page has a KO equivalent under `src/pages/ko/` (handled `404.astro` ↔ `ko/404/index.astro` normalization). Result: no missing KO pages (script output: `[]`).
    4. Since there were no missing translations or pages, I did not modify source files.
    5. Ran `npm run build` to verify the site still builds. Build completed successfully (excerpt: `2438 page(s) built in 2.46s` and `[build] Complete!`).

  - Results:
    - No translation keys were missing in `src/i18n/ko.ts` (confirmed programmatically).
    - All EN pages under `src/pages/` have KO equivalents under `src/pages/ko/` (confirmed programmatically).
    - Build passed: `npm run build` completed and produced `dist/` (confirmed in build output).
    - No files required edits; no commit was created or pushed.

  - Evidence / Commands run:
    - Key diff check: `node -e "..."` (ran locally; script output `[]` for missing keys).
    - Page check: `/tmp/check_i18n_pages.js` executed (script output `{"enCount":24,"koCount":24,"missing":[]}`).
    - Build: `cd /Users/openclaw/pruviq && npm run build` (build log shows `2438 page(s) built` and `[build] Complete!`).

  - Next / Recommendations:
    - Add a CI check (GitHub Action) that runs a lightweight key-compare between `src/i18n/en.ts` and `src/i18n/ko.ts` on PRs and fails if keys are missing. This prevents regressions.
    - Optionally add a test that ensures every file in `src/pages/` has a corresponding `src/pages/ko/` file (with normalization for `404`) to catch missing localized pages.

Generated and appended to MEMORY.md by PRUVIQ Bot (프루빅) on 2026-02-26 06:01 KST.

## 24/7 Autonomous Loop (Added 2026-02-26 by JEPO)

### OpenClaw Cron Jobs (9 total)
| Job | Schedule | Purpose |
|-----|----------|---------|
| health-check | every 30min | Site + API 200 check → Telegram |
| daily-seo-audit | 00:00 KST daily | 2389 URL crawl, SEO audit, auto-fix |
| build-deploy-check | every 6h | git pull → build → deploy verify → auto-fix |
| i18n-fix | 15:00 KST daily | Korean translation completeness check |
| weekly-comprehensive-audit | Mon 10:00 KST | Full audit + Playwright + report |
| gh-issues-autofix | every 4h | Read GitHub issues → auto-fix → PR |
| **content-creation** | Tue+Fri 03:00 KST | NEW blog posts (EN+KO), 1500-2500 words |
| **performance-lighthouse** | 04:00 KST daily | Core Web Vitals, image optimization, UX |
| **jepo-strategic-review** | 22:00 KST daily | BRAIN: analyze → prioritize → create issues |

### n8n Workflows (jepo user)
| WF | Schedule | Purpose |
|----|----------|---------|
| WF-20: JEPO PR Review | every 5min | Claude Code headless PR review → LGTM → automerge |
| WF-21: Post-Merge Deploy | every 10min | Verify deployment after merge |

### Full Autonomous Loop

strategic-review (22:00 KST) --> Create GitHub Issues with priorities
  |
gh-issues-autofix (every 4h) --> Read issues, create fix, open PR
  |
n8n WF-20 (every 5min) --> JEPO reviews PR --> LGTM --> automerge
  |
GitHub Actions automerge --> Merge to main
  |
Cloudflare Pages auto-deploy
  |
n8n WF-21 (every 10min) --> Verify deployment
  |
health-check (every 30min) --> Monitor site/API --> Telegram
  |
daily-seo-audit + performance-lighthouse + i18n-fix --> Continuous improvement
  |
content-creation (Tue+Fri) --> New content growth
  |
Loop back to strategic-review
