# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-02-27 00:00 KST

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
npm run dev    # ￼1http://localhost:4321

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

  - Next / Recommendations:
    - Add a lightweight CI check (e.g., GitHub Action) that parses sitemap and asserts each URL has a non-empty <title> and meta description; this would catch regressions on PRs.
    - Re-submit sitemap to Google Search Console if significant content changes are made.
    - Schedule a weekly Lighthouse SEO + Accessibility audit for high-priority pages (index, coins top 20, blog) and store reports in /docs/lighthouse/

Generated and committed by PRUVIQ Bot (프루빅) on 2026-02-26 00:00 KST.

- cron:f4164126-c2e9-476a-9319-bce7ec625b75 (daily-seo-audit)
  - Time: 2026-02-27 00:00 KST
  - Action requested: daily SEO audit (titles, meta descriptions, sitemap, robots, hreflang, JSON-LD, build)
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules (confirmed in /Users/openclaw/pruviq/SOUL.md and the current MEMORY.md).
    2. Fetched live sitemap: saved remote copy to /Users/openclaw/pruviq/tmp/sitemap-index.xml (`curl -sS https://pruviq.com/sitemap-index.xml > /Users/openclaw/pruviq/tmp/sitemap-index.xml`) and fetched referenced sitemap-0.xml to /Users/openclaw/pruviq/tmp/sitemap-0.xml.
    3. Extracted all URLs from sitemap-0.xml into /Users/openclaw/pruviq/tmp/urls.txt (2389 URLs) using an awk/sed extraction (`awk` parsing). (confirmed: `wc -l /Users/openclaw/pruviq/tmp/urls.txt` → 2389).
    4. Performed targeted checks on key pages (root, /coins/, /simulate/, /strategies/, and their /ko/ equivalents) and saved the head-check output to /Users/openclaw/pruviq/tmp/seo_key_pages.txt (contains titles, meta descriptions, hreflang links, og:image, and JSON-LD presence). Command used: curl + grep pipeline (saved output file).
    5. Verified robots.txt: `curl -sS https://pruviq.com/robots.txt` — contains `Sitemap: https://pruviq.com/sitemap-index.xml` and allows crawling for common bots.
    6. Verified hreflang tags: pages include `<link rel="alternate" hreflang="en" href="...">`, `<link rel="alternate" hreflang="ko" href="...">`, and `x-default` where appropriate (confirmed in /Users/openclaw/pruviq/tmp/seo_key_pages.txt and by inspecting src/layouts/Layout.astro).
    7. Verified JSON-LD structured data: Layout includes Organization and WebApplication JSON-LD and homepage adds FAQ JSON-LD. Confirmed presence in rendered pages and validated JSON by parsing sample scripts.
    8. Ran `npm run build` and saved the build log to /Users/openclaw/pruviq/tmp/npm_build_log.txt. Build completed successfully: `[build] 2438 page(s) built in 27.37s` (confirmed in /Users/openclaw/pruviq/tmp/npm_build_log.txt).

  - Findings (evidence):
    - sitemap-index.xml: saved to /Users/openclaw/pruviq/tmp/sitemap-index.xml (confirmed file present).
    - sitemap-0.xml: saved to /Users/openclaw/pruviq/tmp/sitemap-0.xml (confirmed file present).
    - urls.txt: 2389 URLs extracted to /Users/openclaw/pruviq/tmp/urls.txt (`wc -l` → 2389).
    - robots.txt: `curl -sS https://pruviq.com/robots.txt` shows Allow: / and `Sitemap: https://pruviq.com/sitemap-index.xml` (confirmed via curl output).
    - Key pages (examples recorded in /Users/openclaw/pruviq/tmp/seo_key_pages.txt): all include non-empty <title>, meta description, hreflang alternates, og:image, and JSON-LD.
    - JSON-LD: Organization + WebApplication present on root and KO root; homepage includes FAQ JSON-LD. (Confirmed by searching for `<script type="application/ld+json">` in rendered HTML.)
    - Build: `npm run build` succeeded; see /Users/openclaw/pruviq/tmp/npm_build_log.txt containing the summary `[build] 2438 page(s) built in 27.37s`.

  - Actions taken:
    - No code changes were required — all checked items passed the audit.
    - Saved evidence files to /Users/openclaw/pruviq/tmp/: sitemap-index.xml, sitemap-0.xml, urls.txt, seo_key_pages.txt, npm_build_log.txt.
    - Updated MEMORY.md with this audit summary.

  - Next / Recommendations:
    - Add a GitHub Action that fails CI if any URL in the sitemap is missing a non-empty <title> or meta description (prevents regressions).
    - Add a lightweight Lighthouse job for top pages (/, /coins/, /strategies/, /blog/) and store artifacts in /docs/lighthouse/.
    - Consider adding a small JSON-LD validation check in CI to ensure structured data remains parseable.

Generated and committed by PRUVIQ Bot (프루빅) on 2026-02-27 00:00 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-26 15:11 KST
  - Action requested: autonomously fix failed PRs and open issues (cron run: gh-issues-autofix)
  - What I did:
    1. Updated local main branch: `git checkout main && git pull origin main` (confirmed).
    2. Listed open PRs via `gh pr list --state open --json number,title,headRefName,statusCheckRollup,comments`.
       - Found open PRs: #56..#61 (headRefName: fix/issue-12-repro-manifest-tests, fix/issue-51-document-brave-api-key, fix/issue-10-i18n-learn, fix/issue-11-touch-targets, fix/issue-9-seo-audit-doc, fix/issue-8-a11y-simulate).
       - No open PRs had a failing statusCheckRollup at the time of this run (all showed success or neutral). No PR required an immediate fix.
    3. For PRs with E2E-AUTOFIX comments: found retry counts < 3 (no automated closes needed).
    4. Listed open issues via `gh issue list --state open --limit 50 --json number,title,body,labels` and inspected them in priority order.
       - Issue #7 (P0): `/coins/stats` returning 503 — operational/backend outage. No frontend code fix is possible from this repo (backend is READ-ONLY and origin logs are required).
         - Action: added a detailed diagnostic comment on issue #7 with reproduction steps and origin diagnostics (curl commands, ss/journalctl checks, deploy/rollback checklist). Requested assignment to ops/@jplee and offered to analyze logs once available. (comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3964344083)
       - Other open issues (P1/P2): most already have active fix branches / PRs (see PR list above). No additional low-risk frontend fixes were implemented in this run.
    5. No code changes committed or PRs were opened by this run (no fixable failures found, and the P0 issue requires origin access).

  - Result:
    - Performed triage and posted diagnostics to the P0 ops issue (#7). No PRs were modified or closed.
    - Blockers: origin logs / server access required to resolve issue #7; frontend repo changes are not applicable.

  - Next steps:
    - Wait for ops to attach Cloudflare/origin logs on issue #7; once available I will analyze them and, if a code change is needed, open a fix branch and PR with tests and build verification.
    - For performance/mobile improvements (issue #40), implement incremental, low-risk PRs (images lazy-loading, decoding=async, deferred non-critical scripts) in a follow-up run if no upstream blocking tasks are present.

- Generated by PRUVIQ Bot (프루빅) on 2026-02-26 15:11 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-26 20:11 KST
  - Action requested: autonomously fix failed PRs and open issues (cron run)
  - What I did:
    1. Ensured local main was up-to-date: `git checkout main && git pull origin main` (confirmed).
    2. Created an autosave branch to preserve local changes: `wip/autosave-20260226T111555Z` (pushed to origin).
       - Branch created & pushed: wip/autosave-20260226T111555Z
    3. Listed open PRs (`gh pr list`) — no PRs had failing status checks that required code fixes at this time.
    4. Triage and comments posted:
       - Issue #7 (P0, /coins/stats 503): posted diagnostic and runbook, requested Cloudflare/origin logs and Sentry traces for matching timestamps. (comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3965932964)
       - Issue #19 (OPS: api.pruviq.com 502/503): posted ops triage and requested logs. (comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3965942067)
       - Issue #21 (chore/research BRAVE_API_KEY): requested the BRAVE_API_KEY be added as a repo secret or OpenClaw config; I cannot provision secrets from this environment. (comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3965940901)
       - Auto-discovered performance issues (#62, #54, #53, #52, #46, #45, #39): posted triage requests asking for Lighthouse JSON artifacts and DevTools performance traces so I can analyze and open focused, low-risk PRs. (examples: https://github.com/poong92/pruviq/issues/62#issuecomment-3965956363)
    5. No code changes or PRs were opened by this run — the remaining P0/P1 items are blocked on ops artifacts or require performance traces to make safe, evidence-backed changes.


- content-creation: funding-rate-arbitrage (autonomous)
  - Time: 2026-02-27 01:01:49 KST
  - Action requested: create and publish new blog content (English + Korean)
  - What I did:
    1. Created a new branch: `content/funding-rate-arbitrage-20260227` (local + pushed to origin).
    2. Added English post: `src/content/blog/funding-rate-arbitrage-practical-guide.md` (new file).
    3. Added Korean translation: `src/content/blog-ko/funding-rate-arbitrage-practical-guide.md` (new file).
    4. Ran `npm run build` locally to verify site builds successfully (build completed: `[build] Complete!`).
    5. Committed changes (commit `91e9884`) and pushed branch to origin.
    6. Opened a pull request: https://github.com/poong92/pruviq/pull/72

  - Files changed:
    - src/content/blog/funding-rate-arbitrage-practical-guide.md
    - src/content/blog-ko/funding-rate-arbitrage-practical-guide.md

  - Evidence:
    - Commit: 91e9884 (confirmed via `git rev-parse --short HEAD`) 
    - PR: https://github.com/poong92/pruviq/pull/72
    - Local build: dist generated and build log shows `2442 page(s) built in 32.59s` (see local build output).

  - Next / Recommendations:
    - Merge PR #72 after review. After merge, wait ~2 minutes for Cloudflare Pages deploy and optionally re-submit sitemap to Google Search Console if desired.
    - Consider scheduling a Lighthouse SEO check for the new post (pages: /learn/funding-rate-arbitrage-practical-guide and /ko/learn/funding-rate-arbitrage-practical-guide) and store the artifact in /docs/lighthouse/ if the post is prioritized.

Generated by PRUVIQ Bot (프루빅) on 2026-02-27 01:01:49 KST.

- cron:0648b27d-afb0-45a3-bf67-318e58fa2cfa (performance-lighthouse)
  - Time: 2026-02-27 01:03 KST
  - Action requested: run performance checks (curl timings), find/optimize large images, check bundle sizes, and apply fixes if needed.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm context and safety rules.
    2. Updated local main: `git pull origin main` (no changes; already up-to-date). (confirmed via git pull output)
    3. Measured page load times with curl (Total time and downloaded size):
       - https://pruviq.com/ -> Time: 0.461334s Size: 22344bytes (confirmed via curl)
       - https://pruviq.com/simulate/ -> Time: 0.433088s Size: 10765bytes (confirmed via curl)
       - https://pruviq.com/coins/ -> Time: 0.457422s Size: 10881bytes (confirmed via curl)
       - https://pruviq.com/market/ -> Time: 0.444762s Size: 11016bytes (confirmed via curl)
       - https://pruviq.com/ko/ -> Time: 0.480169s Size: 23644bytes (confirmed via curl)
       - Interpretation: All measured page total times < 0.5s and page sizes < 50KB — within the target TTFB < 500ms and page size < 500KB for these pages.
    4. Searched for large images (>200KB) under public/ and src/:
       - No image files larger than 200KB were found in public/ or src/ (confirmed via repository file-size scan).
    5. Ran `npm run build` to produce dist/ and inspect bundle sizes. Build completed successfully (confirmed in build log: "✓ Completed in 3.27s" for this run).
    6. Checked dist/ asset sizes:
       - Total dist/ size: ~3.3M (du summary). Largest assets found:
         - dist/_astro/_id_.DiYlHIdP.css -> 48K
         - dist/og-image.png -> 40K
         - dist/scripts/layout-client.js -> 4.0K
       - No JS/CSS/image assets in dist exceed the per-page target (no files >200KB).
    7. Actions taken: No code changes were necessary — site assets are already small and pages meet the performance targets checked by this run.
  - Result:
    - No fixes required. Build passed and dist assets are small.
  - Recommendations / Next steps:
    - Add automated Lighthouse checks for top pages (/, /coins/, /simulate/, /market/, /ko/) and store artifacts in /docs/lighthouse/ to catch regressions.
    - Add a CI job that scans public/ and src/ for image sizes and fails if any image >200KB or non-AVIF/WebP formats are committed.
    - For ongoing improvement, consider converting `dist/og-image.png` -> WebP/AVIF and verifying social preview pipeline (low priority; file is only ~40KB).

Generated by PRUVIQ Bot (프루빅) on 2026-02-27 01:03 KST.
