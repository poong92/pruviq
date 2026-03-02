# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-03-02 06:19 KST

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
npm run dev    #  

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

- .claude/CLAUDE.md  Full project spec (most detailed)
- docs/MASTER_PLAN.md  Architecture + business plan
- docs/BRAND_CONCEPT.md  Brand identity + copy
- docs/UNIFIED_AUDIT_v0.1.0.md  Audit findings
- docs/UX_DESIGN.md  Design system

## Important Rules

- autotrader = Owner's private bot (NEVER touch, no access)
- Backend files = jepo-owned (READ ONLY)
- No code copying from autotrader concepts only
- No live trading results  simulation results only
- n8n API: http://127.0.0.1:5678 (key in ~/.env.pruviq)

## Process Rules

Before modifying any existing page, MUST first:
1. Run `git log --oneline --follow <file>` to see its history and recent commits.
2. Identify all sections added, modified, or removed (compare commits/diffs).
3. Report the current state before making changes (include file path(s), last commit hash(es), and a short summary of what will change).
4. Get explicit approval from the owner or designated reviewer (JEPO) before implementing edits.

Note: TradingView Economic Calendar (iframe widget) was removed in commit `a9c648b` during a Binance API cleanup; it needs to be restored on the Market page unless there is a documented reason not to include it (iframe-only, zero cost).

## No Hallucination Policy (CRITICAL)

You are an AI. AIs confidently produce wrong answers. This is a structural weakness of ALL AI models, including you. Follow these rules strictly.

### 1. Never claim without verification
- **Do NOT state numbers, statistics, or status without checking the actual source first**
- **Do NOT state numbers, statistics, or status without checking the actual source first**
- Only report what you confirmed via: file reads, curl responses, command outputs, build logs
- No phrases like "probably", "usually", "should be around" — state facts or say "unverified"
- If you don't know, say **"needs verification"** honestly

### 2. Never fabricate URLs or links
- Do NOT present any URL you haven't verified exists
- Documentation links, API endpoints, npm packages — confirm they actually exist before citing
- Only report a URL as "working" if you got a 200 response from curl

### 3. Never fabricate numbers or statistics
- Build times, file sizes, page counts — extract from actual command output
- No guessing "about 1200 pages" → quote the exact number from `npm run build` output
- API response times, performance metrics — only report what you actually measured

### 4. Always cite your source
Every claim needs evidence:
- File content → "(confirmed in filename:line_number)"
- API response → "(confirmed via curl https://...)"
- Build result → "(from npm run build output)"
- Web search → "(source: URL)"

### 5. Report failures transparently
- If something errored, do NOT hide the error
- If partially successful, clearly separate what worked vs what failed
- Never say "seems to work fine" → say "confirmed 200 OK" or "got 404 error"

### 6. Never confuse past and present state
- Do NOT assume current state based on what you saw in a previous session
- Always re-read the current file/status/state before reporting
- No "last time it was X, so it's probably still X" — check now

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

- Generated and committed by PRUVIQ Bot (프루빅) on 2026-02-24 03:59 KST.

## Pending Tasks

(Update this section as tasks are completed or added)
- [ ] SEO: meta tags optimization
- [ ] i18n: complete learn page translations
- [ ] Mobile: touch targets 44px minimum
- [x] Trust: add more trust signals — small footer trust badges PR created (#138 - https://github.com/pruviq/pruviq/pull/138) (build verified locally)
- [P0] Cloudflare Workers preview builds failing for PRs #136 and #135 — blocked; requires Cloudflare dashboard access (issue #137) (labelled P0-critical)
- [P1] Convert public/og-image.png to WebP/AVIF and update OG references — issue #132 (labelled P1-high); PR #136 exists but is blocked by Cloudflare preview failures
- [P1] BRAVE_API_KEY provisioning for issue #21 — requires adding secret to repository/CI (issue #21)

Notes: Quick-wins copy (hero/nav) applied and meta.index_desc synced with hero.desc on 2026-02-21. See JEPO Review for details.

## CRON RUN LOGS

- cron:gh-issues-autofix
  - Time: 2026-02-28 17:17 KST
  - Action requested: autonomous gh-issues-autofix cron run (fix failed PRs and triage open issues)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (local file reads confirmed).
    2. Synchronized `main`: `git checkout main && git pull origin main` (workspace on branch `main`, working tree had local modifications: `M MEMORY.md`, `M public/data/coin-metadata.json`, `M public/data/coins-stats.json`, `M public/data/macro.json`, `M public/data/market.json`, `M public/data/news.json`) (confirmed via `git status --porcelain`).
    3. Inspected open PRs: `gh pr list --state open --json number,title,headRefName,statusCheckRollup,comments` — result: only PR #123 (fix/issue-115-builder-indicators-fallback) is currently open and all status checks report `SUCCESS` (confirmed via GH JSON output).
    4. Inspected open issues: `gh issue list --state open --limit 50 --json number,title,body,labels` — found issues #118 (P1-high), #117 (P2), #115 (P2), #113 (P2), #111 (P1), #21 (P1) (confirmed via GH JSON output).
    5. For each issue (priority order P1 > P2):
       - #118: PR exists (fix/issue-112-118, PR #120) — skipping (PR open).
       - #111: PR exists (fix/issue-111-simulate-compare-timeout, PR #122) — skipping (PR open/handled).
       - #21: PR exists / previously handled (PR #110 / earlier) — skipping.
       - #115: PR exists and was created by the agent (PR #123) — monitoring.
       - #117: PR exists (PR #121) — skipping.
       - #113: No PR found. I inspected issue #113 and confirmed diagnostic comments already exist explaining that `GET https://api.pruviq.com/macro` returns `"derivatives": null` and that this requires backend/ops intervention. (Confirmed via `gh issue view 113 --comments` — multiple triage comments present.)
    6. Actions taken:
       - No code changes were required or applied in this run.
       - No failed PRs required patching.
       - Issue #113 remains backend-blocked; diagnostic triage exists and the issue is assigned for ops/backend follow-up.

  - Result:
    - No PRs required automated fixes this run.
    - Issue #113 remains blocked and requires backend access to fix (diagnosis posted).

  - Evidence (commands / outputs):
    - `git status --porcelain` → `M MEMORY.md`, `M public/data/coin-metadata.json`, `M public/data/coins-stats.json`, `M public/data/macro.json`, `M public/data/market.json`, `M public/data/news.json` (confirmed)
    - `gh pr list --state open --json ...` → PR #123 present with checks `SUCCESS` (confirmed)
    - `gh issue list --state open --limit 50 --json ...` → issues #118, #117, #115, #113, #111, #21 (confirmed)
    - `gh issue view 113 --comments` → diagnostic triage comments present from this agent explaining `derivatives: null` and recommending backend fixes (confirmed)

  - Generated by PRUVIQ Bot (프루빅) on 2026-02-28 17:17 KST.

- cron:daily-seo-audit
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
    - Meta descriptions: 2389 pages have a non-empty meta description (confirmed in /User... (truncated for brevity)

---


## cron:gh-issues-autofix

Time: 2026-03-02 10:19 KST — automated run

What I did:
1) Repo sync
- `cd /Users/openclaw/pruviq && git checkout main && git pull origin main` (confirmed)

2) Inspect & triage
- Listed open PRs and issues using `gh pr list` and `gh issue list`.
- Found no open PR that required an immediate code fix in this run that I could handle locally.
- Two prior PRs (PR #136 and PR #135) produced failing preview build checks whose check-runs point to Cloudflare Dashboard build pages (external logs). Those failing check-runs include only a Cloudflare details URL and no log text accessible via the GitHub API.

3) Blockers identified
- Cloudflare Dashboard access is required to read failing preview build logs for the Cloudflare "Workers Builds: pruviq-website" check (see links below). I cannot access these logs from this environment.

Affected check-run details (from GitHub check metadata):
- PR #136 (fix/issue-132-convert-og-image): https://dash.cloudflare.com/9314e06569c4da23e48fd088d45707dd/workers/services/view/pruviq-website/production/builds/7831dabc-b29f-4f6f-99ce-aa3d755288f0
- PR #135 (fix/issue-21-enable-brave-key): https://dash.cloudflare.com/9314e06569c4da23e48fd088d45707dd/workers/services/view/pruviq-website/production/builds/c2526525-7992-4fa1-b745-654f12535128

4) Actions taken
- Posted diagnostic comment on issue #137 summarizing the situation and requesting that a maintainer with Cloudflare access paste the full Cloudflare build logs here (see issue #137).
- Posted diagnostic comment on issue #21 explaining that `BRAVE_API_KEY` must be provisioned as a repository/CI secret (I cannot set secrets from this environment) and describing next steps for ops.
- Resolved a local merge conflict that occurred during `git pull` by accepting the remote (theirs) versions for generated data files under `public/data/` (coins-stats.json, macro.json, market.json, news.json), committed the merge resolution, and pushed to origin/main.

5) Local verification
- Commit: `8dce0a0` — "chore: resolve merge conflicts - accept remote generated data files" (confirmed via `git log -1`)
- npm run build: completed successfully in this environment. Evidence from build output: "[build] 2446 page(s) built in 30.76s" and "[build] Complete!" (from npm run build output)
- Open PRs at time of run (checked via `gh pr list`): #143 (fix/issue-132-prefer-webp), #142 (i18n-check/2026-03-02), #141 (perf/lighthouse-2026-03-02), #138 (feat/trust-badges-2026-03-01) — all with statusCheckRollup => SUCCESS for GitHub checks (confirmed via GH JSON output)

6) Result / Next steps
- Merged conflicts on main and pushed commit 8dce0a0 to origin/main.
- Build verified locally (2446 pages built). (from npm run build output)
- Posted comments on issues #137 and #21 describing blockers and required ops actions.
- Blocked items requiring human/ops action:
  - Cloudflare Dashboard access or pasted build logs (issue #137) to debug preview build failures.
  - Repository/CI secret `BRAVE_API_KEY` to enable the research agent flow (issue #21).

Generated by PRUVIQ Bot (프루빅) on 2026-03-02 14:19 KST.

## cron:gh-issues-autofix

Time: 2026-03-02 22:19 KST — automated run

What I did (verified):

1) Repo sync
- Ran: `git checkout main && git pull origin main` — a merge was attempted but produced conflicts in generated data files under public/data/. (observed via `git status` during pull)
- Action: aborted the merge (`git merge --abort`), created a backup branch to preserve local changes and committed them: `backup/local-main-2026-03-02-2219` (commit a72e634, "chore: backup local main changes before sync") (confirmed via `git rev-parse --short backup/local-main-2026-03-02-2219 -> a72e634`).
- Synced main to remote: `git fetch origin && git reset --hard origin/main` (main now at commit 60bd99f) (confirmed via `git rev-parse --short HEAD -> 60bd99f`).

2) Inspect open PRs / failed PRs
- Ran: `gh pr list --state open --json number,title,headRefName,statusCheckRollup,comments` — no currently open PRs required an immediate code fix; no PRs had failing status checks requiring local code changes (confirmed via GH JSON output).

3) Triage open issues (P0 > P1 > P2)
- Checked open issues via `gh issue list --state open --limit 20 --json number,title,body,labels` and inspected their PR linkage.
- Issue #137 (P0-critical): Root cause is external — Cloudflare Workers preview/deployments are failing for certain PRs (Cloudflare's build system shows "Deployment failed" and provides a dashboard logs link). I cannot access Cloudflare Dashboard logs from this environment.
  - Action: Posted a diagnostic comment on issue #137 summarizing findings and requesting a maintainer with Cloudflare access to paste the Cloudflare build logs or grant access. Comment link: https://github.com/pruviq/pruviq/issues/137#issuecomment-3984372732 (confirmed in command output).
- Issue #132 (P1-high): Already has an open PR that addresses it (skipped).
- Issue #21 (P1-high): Already has an open PR addressing it (skipped). If BRAVE_API_KEY needs to be provisioned, a repo secret must be added by a maintainer (I cannot set secrets from this environment).

4) Attempts to fix
- For the Cloudflare-failing PRs I attempted local verification: checked out their branches where available and ran `npm run build` locally — local builds succeeded, supporting the diagnosis that the failure is in Cloudflare's build/deploy environment rather than in the site code.
- Without Cloudflare Dashboard access or the ability to modify Workers settings/secrets, I could not reproduce the failing build logs to implement a fix.

5) Cleanup / housekeeping
- Preserved local changes in `backup/local-main-2026-03-02-2219` (commit a72e634).
- Left main synchronized to origin/main (HEAD: 60bd99f).

6) Next steps / unblockers (requires human/ops):
- Provide Cloudflare Dashboard build logs for the failed preview builds (or grant access) so I can inspect and fix the underlying cause.
- If build failures are caused by missing repo secrets or Worker config, a maintainer needs to update Cloudflare settings or repository secrets (e.g., Workers env or wrangler config).
- For BRAVE integration (issue #21), add `BRAVE_API_KEY` as a repository secret if desired; I can then re-run builds / PRs that depend on it.

Evidence / commands used (verified outputs):
- `git rev-parse --short backup/local-main-2026-03-02-2219` -> a72e634
- `git rev-parse --short HEAD` -> 60bd99f
- `gh issue comment 137` -> https://github.com/pruviq/pruviq/issues/137#issuecomment-3984372732
- `gh pr list --state open --json ...` -> open PRs listed; no failing checks requiring code fixes (see GH output logs)



## cron:gh-issues-autofix
Time: 2026-03-03 02:32 KST

Actions performed in this run:
- Synced `main`: ran `git checkout main && git pull origin main`. The pull had merge conflicts in public/data/*.json; I resolved them by accepting the remote versions and committed: "merge: accept remote updates for public/data/*.json to resolve pull conflicts" (confirmed via git commit).
- Inspected open PRs: none required fixes at the start of the run (confirmed via `gh pr list`).
- Inspected open issues: found #137 (P0), #132 (P1), #21 (P1) (confirmed via `gh issue list`).

Work done:
- Issue #132 (og-image conversion): branch `fix/issue-132-convert-og-image` already contained an implementation (conversion script + Layout changes). I ran `npm install` (attempted to install `sharp`), ran `npm run build` locally and confirmed the site builds successfully: "2446 page(s) built in 39.71s" (from `npm run build` output). I created PR #148 to merge the changes: https://github.com/pruviq/pruviq/pull/148 (confirmed via `gh pr create`).
- Issue #137 (Cloudflare Workers builds failing): posted a diagnostic comment explaining that the failing check is external (Cloudflare Workers build) and I do not have Cloudflare access to view logs or re-run builds. Comment: https://github.com/pruviq/pruviq/issues/137#issuecomment-3985800281 (confirmed via gh command output).
- Issue #21 (BRAVE_API_KEY): confirmed this is blocked by a missing repository secret. I posted a triage comment requesting ops/repo-admin to provision the BRAVE_API_KEY as a repo secret or Gateway env. Comment: https://github.com/pruviq/pruviq/issues/21#issuecomment-3985801763 (confirmed via gh command output).

Result / Status:
- PR #148 opened to address image conversion/layout preference. Local build: OK (2446 pages built). However the Cloudflare Workers build check on the PR is failing (external to repo) and requires someone with Cloudflare access to inspect the dashboard logs and re-run the worker build.
- Research PoC remains blocked until BRAVE_API_KEY is provisioned (ops action required).

Next steps:
- Await ops/repo admin to provide Cloudflare access or paste build logs for the failing Cloudflare Workers job referenced in the PR checks.
- Await BRAVE_API_KEY provisioning to re-run the research PoC and attach results.

Evidence (commands / outputs):
- `git pull` -> merge conflict -> resolved via `git checkout --theirs public/data/*.json` + `git commit` (confirmed in git log)
- `npm run build` -> "2446 page(s) built in 39.71s" (from build output)
- PR created: https://github.com/pruviq/pruviq/pull/148
- Issue comments posted: https://github.com/pruviq/pruviq/issues/137#issuecomment-3985800281, https://github.com/pruviq/pruviq/issues/21#issuecomment-3985801763

Generated by PRUVIQ Bot (프루빅) on 2026-03-03 02:32 KST.
