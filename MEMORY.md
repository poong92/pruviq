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

## Content created: Walk-Forward Analysis (2026-03-03)

- Time: 2026-03-03 03:00 KST
- What: Added a new educational blog post in English and its Korean translation covering walk-forward analysis for crypto trading strategies.
- Files added:
  - src/content/blog/walk-forward-analysis.md (English)
  - src/content/blog-ko/walk-forward-analysis.md (Korean)
  (confirmed by file creation in the repository and local build output)
- Branch: content/walk-forward-20260303 (created locally and pushed) (confirmed in git output)
- Commit: 97452ef ("content: add blog post - Walk-Forward Analysis for Crypto Strategies") (confirmed in git commit output)
- Pull request: https://github.com/pruviq/pruviq/pull/149 (PR created) (confirmed via gh PR creation)
- Build: ran `npm run build` locally; the site built and generated the new route `/blog/walk-forward-analysis/index.html` (confirmed in build logs: generation entry for blog/walk-forward-analysis) (from npm run build output)

Short summary: created a 2-language, SEO-ready guide that fills a gap (practical walk-forward validation) in the blog library. Built locally and opened PR #149 for review/merge.

---

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

- cron:i18n-fix
  - Time: 2026-03-03 06:00 KST
  - Action requested: i18n completeness check and repair (compare src/i18n/en.ts vs src/i18n/ko.ts; ensure KO pages exist for all EN pages; add missing translations/pages if any; run build; commit & push; update MEMORY.md).
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (confirmed in files: SOUL.md, MEMORY.md).
    2. Compared translation keys between `src/i18n/en.ts` and `src/i18n/ko.ts` using grep/comm.
       - Command: `grep -o "'[^']\+'\s*:\s*" src/i18n/en.ts | sed "s/'\(.*\)'\s*:.*/\1/" | sort > /tmp/en_keys.txt` and equivalent for ko, then `comm -23 /tmp/en_keys.txt /tmp/ko_keys.txt`.
       - Result: no missing keys (0 lines). (confirmed in `/tmp/missing_in_ko.txt` — empty)
    3. Checked that every EN page under `src/pages/` has a KO equivalent under `src/pages/ko/` (allowed filename variants: `page.astro` → `ko/page.astro` or `ko/page/index.astro`).
       - Scripted check using a Python utility; result: 0 missing pages.
    4. Since there were no missing keys or pages, no translation or page files needed to be added or modified.
    5. Ran `npm run build` to verify site builds after verification.
       - Build output: `[@astrojs/sitemap] sitemap-index.xml created at dist` and `[build] 2446 page(s) built in 37.22s` followed by `[build] Complete!` (from npm run build output). Build exited with code 0.
    6. Updated MEMORY.md with this cron run summary (this entry) and committed the change.

  - Result:
    - No missing translation keys between `en.ts` and `ko.ts` (confirmed).
    - All EN pages have KO equivalents (confirmed).
    - Site build successful after checks: 2446 pages built (confirmed in `npm run build` output).
    - Files changed: only MEMORY.md was updated with this log entry; no changes to src/i18n or src/pages were necessary.

  - Evidence:
    - `/tmp/en_keys.txt` and `/tmp/ko_keys.txt` (generated during the check).
    - `/tmp/missing_in_ko.txt` (empty) — indicates no missing keys.
    - Python page-mapping check script output (0 missing pages).
    - npm run build output: `2446 page(s) built in 37.22s` and `[build] Complete!` (captured from build logs).

  - Generated and committed by PRUVIQ Bot (프루빅) on 2026-03-03 06:00 KST.

---

## CRON RUN LOGS (archived)

(older entries omitted for brevity)

