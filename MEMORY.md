# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-03-03 06:19 KST

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

... (file truncated, previous content above preserved)

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

- cron:gh-issues-autofix
  - Time: 2026-03-03 06:19 KST
  - Action requested: autonomous gh-issues-autofix cron run (fix failed PRs and triage open issues)
  - What I did:
    1. `git checkout main` and `git pull origin main` — encountered and resolved a merge conflict in `public/data/news.json`. Resolved by keeping the updated local JSON (commit 9ba3f50) (confirmed via `git log --oneline` and file contents `public/data/news.json`).
    2. Enumerated open PRs (`gh pr list`) and found PR #148 (fix/issue-132-convert-og-image) had a failing external Workers build. Diagnosis: CI failed due to a native binary dependency (`sharp`) being present in devDependencies which can cause Cloudflare Workers build/install failures.
    3. Checked out the PR branch locally, implemented a fix:
       - Moved `sharp` from `devDependencies` to `optionalDependencies` in `package.json`.
       - Updated `scripts/convert-og-image.js` to detect missing `sharp` and exit gracefully (non-fatal) so CI/install won't fail when sharp binaries are unavailable.
       - Committed the change on branch `fix/issue-132-convert-og-image` (commit 8aa5352) and pushed to origin (confirmed via `git log origin/fix/issue-132-convert-og-image` and `git push`).
    4. Ran `npm run build` locally on the PR branch to verify the fix — build completed successfully: `[@astrojs/sitemap] sitemap-index.xml created at dist` and `[build] 2446 page(s) built` (from npm run build output). (confirmed locally)
    5. Pushed the branch (`git push origin fix/issue-132-convert-og-image`) so CI will re-run and hopefully succeed without failing on `sharp` install.
    6. For issues blocked by external access:
       - Issue #137 (Cloudflare Workers logs): I left a detailed comment explaining I cannot access Cloudflare Dash and requested a team member with Cloudflare access to inspect and share logs or re-run builds. (comment posted: https://github.com/pruviq/pruviq/issues/137#issuecomment-3987000848)
       - Issue #21 (BRAVE_API_KEY): I left a comment requesting that the BRAVE_API_KEY be stored in CI secrets/OpenClaw environment and noted I cannot proceed until the secret is provisioned. (comment posted: https://github.com/pruviq/pruviq/issues/21#issuecomment-3987002143)
    7. Restored main branch state; local working tree contains a modified `public/data/coin-metadata.json` (unstaged) that I left as WIP and did not commit to avoid unrelated changes in this run.

  - Result:
    - Resolved an on-disk merge conflict and fixed a CI-failing PR by making `sharp` optional and adding a graceful fallback in the conversion script. PR #148 updated and pushed (CI will re-run).
    - Issues requiring external access (Cloudflare logs, API keys) remain blocked; comments and recommended next steps posted to the respective issues.

  - Evidence:
    - Merge resolution commit: `9ba3f50 chore: resolve merge conflict in public/data/news.json (auto-resolve)` (confirmed via `git log --oneline`) — (confirmed in commit history)
    - PR branch fix commit: `8aa5352 fix(images): make sharp optional + handle missing sharp in conversion script to avoid CI install failures` (confirmed via `git log origin/fix/issue-132-convert-og-image`)
    - Local build output: build completed and reported `2446 page(s) built` (from `npm run build` output captured during the run)
    - Git push to PR branch succeeded (`git push origin fix/issue-132-convert-og-image`) (confirmed by git push output)
    - Issue comments posted:
      - #137: https://github.com/pruviq/pruviq/issues/137#issuecomment-3987000848
      - #21: https://github.com/pruviq/pruviq/issues/21#issuecomment-3987002143

  - Generated and committed by PRUVIQ Bot (프루빅) on 2026-03-03 06:19 KST.

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

  - Generated and committed by PRUVIQ Bot (프루빅) on 2026-02-24 03:59 KST.

---

## CRON RUN LOGS (archived)

(older entries omitted for brevity)

## CRON_run: build-deploy-check
- Time: 2026-03-03 08:40 KST
- Action: Automated build-deploy check run by cron.
- Steps performed:
  1. git pull origin main (merge conflicts in public/data/*.json)
  2. Resolved merge conflicts by keeping local versions for: public/data/coins-stats.json, public/data/macro.json, public/data/market.json, public/data/news.json. Committed resolution.
  3. npm run build — build completed successfully (2446 pages built).
  4. Pushed commit to origin main.
  5. Waited ~2 minutes for Cloudflare Pages and verified https://pruviq.com returned 200 OK.
  6. Verified key pages returned 200: /simulate/, /coins/, /market/, /strategies/, /fees/, /ko/.
- Result: Site is healthy; no user-facing issues found.
- Evidence: local git commit 7281b30 (merge resolution), build output "[build] Complete!" and "2446 page(s) built", remote push succeeded, https://pruviq.com and key pages returned HTTP 200.

Generated by PRUVIQ Bot (프루빅).

## CRON RUN - gh-issues-autofix
- Time: 2026-03-03 10:19 KST
- Action: Autonomous fix/triage run (fix failed PRs, triage open issues)
- What I changed/fixed:
  - Resolved local merge conflicts in generated public data files and committed the resolution (commit afcc22d) — kept local versions for public/data/coins-stats.json, public/data/macro.json, public/data/market.json, public/data/news.json. (confirmed via `git log --oneline`)
  - Implemented an optional og-image conversion pipeline and layout preload:
    - Added scripts/convert-og-image.mjs which converts public/og-image.png → og-image.webp / og-image.avif using sharp when available (non-fatal when sharp is missing).
    - Updated scripts/render-assets.mjs to spawn the conversion script after rendering the PNG.
    - Updated src/layouts/Layout.astro to preload AVIF/WebP variants for modern browsers.
    - Committed on branch fix/issue-132-convert-og-image (commit f1bd9ac) and pushed. Opened PR #150 to link and close issue #132. (PR: https://github.com/pruviq/pruviq/pull/150)
  - Verified the change by running `npm run build` locally — build succeeded: "[build] 2446 page(s) built" (local build output).
- What I could NOT fix (blocked / external):
  - Issue #137 (Cloudflare Workers builds failing for PRs #136 and #135) — blocked because I cannot access Cloudflare Pages/Workers dashboard logs from this environment. I left a detailed comment on the issue requesting logs or dashboard access. (https://github.com/pruviq/pruviq/issues/137)
  - Issue #21 (BRAVE_API_KEY) — blocked by missing secret. I commented recommending adding BRAVE_API_KEY to repo/CI/OpenClaw secrets and offered to run the PoC once the secret is available. (https://github.com/pruviq/pruviq/issues/21)
- Next steps:
  - Wait for Cloudflare build logs or an engineer with Cloudflare access to investigate / share logs for issue #137.
  - Wait for BRAVE_API_KEY to be provisioned (issue #21) or add a smoke-check to the PoC script (I can open a small PR for the smoke-check if desired).
  - Monitor PR #150 CI run for Cloudflare/Jobs failures and patch further if native modules cause install-time failures.


## PENDING TASKS (prioritized) — 2026-03-03 22:05 KST

1) P0 — Cloudflare Workers builds failing (issue #137)
   - Why: External Cloudflare check-runs for PRs show failures; GitHub check-runs contain only Cloudflare Dash links (no textual logs). I cannot access Cloudflare Dash from this environment.
   - Current status: Blocked (issue #137, labeled P0-critical). I posted an updated comment requesting a maintainer with Cloudflare access to inspect logs and re-run builds: https://github.com/pruviq/pruviq/issues/137#issuecomment-3990938132
   - Next step (needs human w/Cloudflare access): open Cloudflare build links, copy failing-step logs here, or re-run the build. I will triage and patch immediately once logs are available.

2) P1 — Convert og-image.png → WebP/AVIF & prefer modern formats (issue #132 / PR #150)
   - Why: OG PNG is large (~476 KB) and affects Lighthouse image-format checks. Converting to WebP/AVIF reduces bytes served and improves performance/SEO evidence.
   - What I did (autonomously): resolved PR merge conflicts, added generated `public/og-image.webp` and `public/og-image.avif` to the PR branch, and verified `npm run build` completes locally. Commits: `2dd1e51` (add generated images), `0a28acb` (merge resolution). Local evidence: `ls -l public/og-image.*` → webp 66,936 bytes, avif 21,684 bytes; `npm run build` → "[@astrojs/sitemap] sitemap-index.xml created at dist" and "[build] 2446 page(s) built".
   - Next step: monitor PR #150 CI checks and merge when required checks pass. Link: https://github.com/pruviq/pruviq/pull/150

3) P1 — Reduce recurring merge conflicts from the static data refresh (public/data/*.json) (issue #153)
   - Why: Cron-driven generated JSON commits frequently cause merge conflicts that require manual resolution and can block builds.
   - Proposed fix: push generated files to a dedicated "generated/static-refresh" branch and open PRs; or make refresh script rebase and fail safely (open PR/manual review on conflict); add schema validation CI step.
   - Action taken: I created issue #153 with detailed proposal and labeled it P1-high. Link: https://github.com/pruviq/pruviq/issues/153

---

I will continue monitoring PR #150 CI (build & E2E). If Cloudflare logs for #137 are provided, I will triage immediately. Memory and task logs updated (this file).
