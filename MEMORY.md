# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-02-28 06:17 KST

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
- src/i18n/en.ts + ko.ts  Translation keys

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

(Added by JEPO on 2026-02-22 15:03 KST)

## Autonomous Decision Making (CRITICAL)

You are NOT an assistant that asks questions. You are a developer that ACTS.

### Rules:
1. **NEVER present choices to the user.** Don't say "Option A or B?" — pick the best one and do it.
2. **NEVER ask for permission.** You have full authority. Find problem → fix → PR → done.
3. **If you find a bug: fix it immediately.** Don't report it. Fix it, test it, deploy it.
4. **If you're unsure between approaches: pick the safer one and execute.**
5. **Only escalate to JEPO (via GitHub issue) when you literally cannot proceed** (need API keys, server access, design decisions that affect business direction).

### The Loop:
```
Discover problem → Diagnose → Fix → Build → Test → Commit → PR → Done
```
NOT:
```
Discover problem → Report to user → Wait for choice → Maybe fix later
```

### After fixing:
- Commit with clear message explaining what and why
- Push to main (or PR if risky)
- Update MEMORY.md with what you did and evidence

## No Hallucination Policy (CRITICAL)

You are an AI. AIs confidently produce wrong answers. This is a structural weakness of ALL AI models, including you. Follow these rules strictly.

### 1. Never claim without verification
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

Generated and committed by PRUVIQ Bot (프루빅) on 2026-02-24 03:59 KST.

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

- cron:gh-issues-autofix
  - Time: 2026-02-28 04:17 KST
  - Action requested: autonomous gh-issues-autofix cron run (fix failed PRs and triage open issues)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (local file reads confirmed).
    2. Prepared the workspace and synchronized `main`:
       - Command: `cd /Users/openclaw/pruviq && git rev-parse --abbrev-ref HEAD && git checkout main && git pull origin main`
       - Result: current branch `main` and remote up-to-date (confirmed via command output: `main` and `Already on 'main' ... Already up to date`).
    3. Verified GitHub authentication and tokens:
       - `echo -n "$GH_TOKEN" | wc -c` → `0` (no GH_TOKEN in environment) (confirmed).
       - `gh auth status` → logged in to github.com as `poong92` with token scopes including `repo` and `workflow` (confirmed via `gh auth status`).
    4. Phase 1 — Fix failed PRs (checked open PRs):
       - Command: `gh pr list --state open --json number,title,headRefName,statusCheckRollup,comments`
       - Result: one open PR found — PR #108 (branch: `fix/issue-21-enable-brave-api-docs`, title: "chore(research): document BRAVE_API_KEY and gracefully detect it in research_agent PoC"). Status checks are currently `SUCCESS` (Accessibility, Playwright E2E, validate, Workers Builds) (confirmed via `gh pr list` JSON output).
       - No failed PRs requiring code fixes were detected during this run.
    5. Phase 2 — Open issues (P0 > P1 > P2):
       - Command: `gh issue list --state open --limit 50 --json number,title,body,labels`
       - Result: one open issue found — Issue #21 ("chore(research): enable BRAVE_API_KEY for automated agent research", labels: `P1`) (confirmed via `gh issue list`).
       - Found an existing open PR for issue #21 (PR #108, branch `fix/issue-21-enable-brave-api-docs`) — per policy I skipped creating a duplicate fix branch or PR.
    6. Local verification build:
       - Command: `npm run build` (ran in workspace)
       - Result: build completed successfully (example output: `[build] 2446 page(s) built in 34.27s` and `[build] Complete!`) (confirmed via build output).
    7. Actions taken:
       - No source-code fixes were required or applied in this run.
       - Issue #21 is currently blocked by missing BRAVE_API_KEY (secrets provisioning). There is already a PR addressing it (PR #108). I left the issue and PR for maintainers/ops to provision the required secret.

  - Result:
    - No PRs fixed in this run (no failing PRs found).
    - Issue #21 skipped because PR #108 already exists and checks are green (monitor PR #108 for merge).

  - Blockers / Next steps:
    - Ops/SRE or repo admin must provision BRAVE_API_KEY (repo Actions secret or Gateway env) to fully enable the research PoC automation (issue #21 remains blocked until the secret is available).
    - Monitor PR #108 and merge when CI/maintainer approval is ready.

  - Evidence (commands / outputs):
    - `git rev-parse --abbrev-ref HEAD` → `main` (confirmed in local git output)
    - `git checkout main && git pull origin main` → `Already on 'main'` / `Already up to date` (confirmed)
    - `echo -n "$GH_TOKEN" | wc -c` → `0` (GH_TOKEN not set in environment)
    - `gh auth status` → logged in as `poong92` (token scopes include `repo`, `workflow`) (confirmed via `gh auth status` output)
    - `gh pr list --state open --json ...` → PR #108 present with status checks `SUCCESS` (confirmed via GH JSON output)
    - `gh issue list --state open --limit 50 --json ...` → Issue #21 (P1) present and linked to PR #108 (confirmed)
    - `npm run build` → build succeeded (`[build] Complete!` and `2446 page(s) built` in this run's output)

  - Generated by PRUVIQ Bot (프루빅) on 2026-02-28 04:17 KST.

- cron:gh-issues-autofix
  - Time: 2026-02-28 05:19 KST
  - Action requested: autonomous gh-issues-autofix cron run (fix failed PRs and triage open issues)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (local file reads confirmed).
    2. Synchronized `main`:
       - Command: `cd /Users/openclaw/pruviq && git checkout main && git pull origin main`
       - Result: branch `main` is up-to-date with origin (confirmed via git output).
    3. Phase 1 — Fix failed PRs (checked open PRs):
       - Command: `gh pr list --state open --json number,title,headRefName,statusCheckRollup,comments`
       - Result: two open PRs found — PR #109 (branch: `perf/lighthouse-fix-20260228`) and PR #108 (branch: `fix/issue-21-enable-brave-api-docs`). Both PRs have passing status checks (`conclusion: SUCCESS`) in the latest rollup (confirmed via `gh pr list` JSON output).
       - No failed PRs requiring code fixes were detected during this run.
    4. Phase 2 — Open issues (P0 > P1 > P2):
       - Command: `gh issue list --state open --limit 20 --json number,title,body,labels`
       - Result: one open issue found — Issue #21 ("chore(research): enable BRAVE_API_KEY for automated agent research", labels: `P1`) (confirmed via `gh issue list`).
       - Found an existing open PR for issue #21 (PR #108) — skipped creating a duplicate fix branch or PR.
    5. Local verification build:
       - Command: `npm run build`
       - Result: build completed successfully (output: `[build] 2446 page(s) built in 33.78s` and `[build] Complete!`) (confirmed via build output).
    6. Follow-up actions:
       - I left a comment on Issue #21 explaining that I cannot provision secrets from this environment and requesting Ops/SRE to add BRAVE_API_KEY to repository/CI/Gateway environment. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3974914551)
       - No source-code changes were made in this run.

  - Result:
    - No PRs fixed in this run (no failing PRs found).
    - Issue #21 remains blocked by missing BRAVE_API_KEY. PR #108 exists and is ready to be re-run/merged once the secret is provisioned.

  - Blockers / Next steps:
    - Ops/SRE or a repo admin must provision BRAVE_API_KEY (repo Actions secret or Gateway env) to fully enable the research PoC.
    - After the secret is added, re-run CI or push a no-op commit to trigger workflows; I will pick this up on the next cron run.

  - Evidence (commands / outputs):
    - `git checkout main && git pull origin main` → branch up-to-date with origin (confirmed)
    - `gh pr list --state open --json ...` → PR #109 and PR #108 present; statusCheckRollup conclusions `SUCCESS` (confirmed)
    - `gh issue list --state open --limit 20 --json ...` → Issue #21 (P1) present (confirmed)
    - `npm run build` → build succeeded (`[build] Complete!` and `2446 page(s) built` in this run's output)
    - Issue comment posted: https://github.com/poong92/pruviq/issues/21#issuecomment-3974914551

  - Generated by PRUVIQ Bot (프루빅) on 2026-02-28 05:19 KST.

- cron:gh-issues-autofix
  - Time: 2026-02-28 07:21 KST
  - Action requested: autonomous gh-issues-autofix cron run (fix failed PRs and triage open issues)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (confirmed by local file reads).
    2. Prepared the workspace and synchronized `main`:
       - `git rev-parse --abbrev-ref HEAD` → `main` (confirmed)
       - `git checkout main` → output: `M\tpublic/data/coin-metadata.json` and `Your branch is up to date with 'origin/main'.` (confirmed)
       - `git pull origin main` → `Already up to date.` (confirmed)
    3. Verified GitHub authentication:
       - `gh auth status` → Logged in to github.com as `poong92` (token scopes: `read:org`, `read:user`, `repo`, `workflow`) (confirmed)
    4. Phase 1 — Fix failed PRs (checked open PRs):
       - `gh pr list --state open --limit 100 --json number,title,headRefName,statusCheckRollup,comments`
       - Result: two open PRs found — PR #109 (branch: `perf/lighthouse-fix-20260228`) and PR #108 (branch: `fix/issue-21-enable-brave-api-docs`). Both PRs show passing status checks (statusCheckRollup conclusion: `SUCCESS`) (confirmed via GH JSON output).
    5. Phase 2 — Open issues (P0 > P1 > P2):
       - `gh issue list --state open --limit 50 --json number,title,body,labels`
       - Result: one open issue — Issue #21 ("chore(research): enable BRAVE_API_KEY for automated agent research", labels: `P1`). Found existing PR #108 for issue #21 (branch `fix/issue-21-enable-brave-api-docs`) — skipping duplicate fix.
    6. Local verification build:
       - `npm run build` → build completed successfully. Sample lines from build output:
         - `07:20:46 [build] ✓ Completed in 1.25s.`
         - `07:20:54 [vite] ✓ built in 5.43s`
         - `07:20:58 [vite] ✓ built in 3.17s`
         - Build finished without errors (process exit code 0).
    7. Actions taken:
       - No source changes were required or applied.
       - Did not create new branches or PRs since issue #21 already has PR #108.

  - Result:
    - No failed PRs detected, nothing to fix in code this run.
    - Issue #21 remains blocked pending secret provisioning (BRAVE_API_KEY).

  - Blockers / Next steps:
    - Ops/SRE or repo admin must provision BRAVE_API_KEY (repo Actions secret or Gateway env) so PR #108 and the research PoC can fully function.
    - After secret provisioning, re-run CI or push a no-op commit to re-run workflows; I will attempt fixes if CI fails.

  - Evidence (commands / outputs):
    - `git rev-parse --abbrev-ref HEAD` → `main` (confirmed)
    - `git checkout main` → `M\tpublic/data/coin-metadata.json` (confirmed)
    - `git pull origin main` → `Already up to date.` (confirmed)
    - `gh auth status` → logged in as `poong92` (scopes: `repo`, `workflow`) (confirmed)
    - `gh pr list --state open --json ...` → PRs #109 and #108 present; statusCheckRollup conclusions `SUCCESS` (confirmed)
    - `gh issue list --state open --json ...` → Issue #21 (P1) present (confirmed)
    - `npm run build` → build succeeded (sample output lines captured above)

  - Generated by PRUVIQ Bot (프루빅) on 2026-02-28 07:21 KST.

- cron:gh-issues-autofix
  - Time: 2026-02-27 08:11 KST
  - Action requested: autonomously fix failed PRs and process open issues (gh-issues-autofix)
  - What I did:
    1. Prepared workspace and ensured main was up-to-date: `git checkout main && git pull origin main` (confirmed). Resolved a local merge conflict in `public/data/coin-metadata.json`, committed local changes to MEMORY.md and coin metadata (`chore: update MEMORY.md and coin metadata (autonomous cron run)`, commit 0142433) and pushed main  origin (confirmed: commit 0142433 pushed to main).
    2. Listed open PRs (`gh pr list`) and found an open PR for issue #8: fix/issue-8-a11y-simulate (PR #61) which had a failing SEO-related check in a prior run. I reproduced the relevant checks locally: `npm run build` passed and `node scripts/check-seo.js` reports only non-fatal warnings. Because CI logs for the failing job were not accessible from the GH run API, I retried CI by pushing a no-op commit to the same PR branch (branch: fix/issue-8-a11y-simulate, empty commit 135a26e) and added an [E2E-AUTOFIX] comment to PR #61 documenting the retry (comment: https://github.com/poong92/pruviq/pull/61#issuecomment-3969809773).

  - ... (previous logs preserved) ...

Generated by PRUVIQ Bot (프루빅).

## Pending Tasks (updated)
- [ ] Monitor PR #108 and merge when CI passes.  (evidence: PR #108 exists, checks currently SUCCESS) 
- [ ] Ops: provision BRAVE_API_KEY to enable full research PoC automation (issue #21 remains blocked until secret is available).



- cron:424c24a9-bdc0-4506-8f39-cafbd917d7cf (i18n-fix)
  - Time: 2026-02-28 06:01 KST
  - Action requested: i18n completeness check and fix (compare en.ts vs ko.ts; ensure KO pages present for EN pages)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules. (confirmed)
    2. Loaded translation files: `src/i18n/en.ts` and `src/i18n/ko.ts` and compared keys programmatically.
    3. Checked `src/pages/` and `src/pages/ko/` to ensure Korean page equivalents exist for English pages.
    4. Ran `npm run build` to verify the site builds cleanly after validation.

  - Findings (evidence):
    - Translation key comparison: no missing keys in `ko.ts` vs `en.ts` (confirmed via programmatic diff; source files: src/i18n/en.ts, src/i18n/ko.ts).
    - Page parity: every English page under `src/pages/` has a Korean equivalent under `src/pages/ko/` (checked file/dir mapping; confirmed).
    - Build: `npm run build` completed successfully: "[build] 2446 page(s) built in 33.91s" and "[build] Complete!" (from local build output).

  - Actions taken:
    - No source changes required: `ko.ts` already contains translations for all keys and Korean pages exist for all English pages.
    - Did NOT modify `src/i18n/ko.ts` or create any new `/ko/` pages.
    - Did NOT commit or push any changes.

  - Result:
    - i18n completeness check passed. No missing translations or missing Korean pages found.

  - Evidence (commands / outputs):
    - Programmatic diff confirmed en/ko key parity (script run on local files src/i18n/en.ts and src/i18n/ko.ts).
    - Directory check confirmed page parity between src/pages/ and src/pages/ko/ (script run locally).
    - `npm run build` → build succeeded (`[build] Complete!`, 2446 pages built). (build log from local run)

  - Generated by PRUVIQ Bot (프루빅) on 2026-02-28 06:01 KST.
