# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-02-24 03:59 KST

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

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 02:30 KST
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #21, #19, #12 → #7.
    3. For each open issue I read it and assessed fixability, then acted as follows:
       - #21 (chore/research: enable BRAVE_API_KEY): This requires provisioning a secret (BRAVE_API_KEY) to CI/Gateway/Cloudflare Pages. I cannot set secrets from the repo. I posted a status comment explaining where to add the secret (GitHub Actions secret or Cloudflare env) and offered to draft a small workflow demo or re-run the research PoC after the secret is provisioned. (Comment URL: https://github.com/poong92/pruviq/issues/21#issuecomment-3946213197)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue. I posted an ops runbook-style comment requesting server logs, Sentry traces, and host-level checks (journalctl, ss, local health endpoint) and offered to analyze artifacts if provided. (Comment URL: https://github.com/poong92/pruviq/issues/19#issuecomment-3946214024)
       - #12 (Trust signals / reproducible package): Frontend PoC merged (PR #13). Demo reproducible package PR #15 open (mergeable). I previously posted options (merge demo PR vs draft CI for reproducible packages).
       - #11 (Mobile touch targets): PR #14 adds CSS fallbacks; PR #17 adds a non-failing Playwright touch-target audit (writes reports/touch-targets.json). I previously opened PR #17 (agents/mobile-audit-20260223). Next step: run audit and patch elements <44x44 or enforce via CI.
       - #10 (i18n Learn pages): Verified parity between src/i18n/en.ts and src/i18n/ko.ts; /ko/learn pages are generated by build — no code changes required.
       - #9 (SEO): sitemap-index.xml and robots.txt present; I offered to draft a focused PR updating meta descriptions for prioritized pages (index, simulate, strategies).
       - #8 (A11Y /simulate): Fixed in branch agents/a11y-simulate-20260223; PR #16 is open (a11y fixes + axe test). Build + full axe run reported no violations for /simulate. I requested review/merge of PR #16.
       - #7 (OPS /coins/stats 503): I reproduced 503 via curl. Ops/SRE must collect logs/Sentry traces and investigate; cannot be fixed from the static repo.
    4. Actions performed: posted status comments to issues #21 and #19 (new), and reconfirmed/updated comments on existing issues #12, #11, #10, #9, #8, #7. No new code changes were made in this run (comments only).
    5. Artifacts / references:
       - PR #17: https://github.com/poong92/pruviq/pull/17 (mobile touch-target audit test)
       - PR #16: https://github.com/poong92/pruviq/pull/16 (a11y fixes + axe test)
       - PR #15: https://github.com/poong92/pruviq/pull/15 (demo reproducible package)
       - PR #20: https://github.com/poong92/pruviq/pull/20 (agents/upgrade-automation-20260223)
    6. Next steps:
       - Provision BRAVE_API_KEY as a secret (Actions/Cloudflare/Gateway) or assign to ops to set it; I will re-run the research PoC after it's set.
       - Run the mobile touch-target audit locally or in CI to generate `reports/touch-targets.json` and review failing elements.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate.
       - For #19/#7: ops/SRE should collect logs/traces and attach them here; I will analyze and propose remediation.

Generated and committed by 프루빅 on 2026-02-24 02:30 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 06:37 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm project context and applicable process rules.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` and inspected open issues: #21, #19, #12, #11, #10, #9, #8, #7.
    3. Actions taken per issue:
       - #21 (chore/research: enable BRAVE_API_KEY): Cannot provision secrets from the repository. The string `BRAVE_API_KEY` only appears in MEMORY.md and internal reports; no runtime code currently reads it. I posted a comment explaining how to provision the secret (GitHub Actions secret or Cloudflare Pages env) and offered to draft a workflow that uses the secret once it is available. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3947465560)
       - #19 (OPS: api.pruviq.com returning 502/503): Tested endpoints at 2026-02-24 06:37 KST — https://api.pruviq.com/market → 200, https://api.pruviq.com/coins/stats → 200, https://pruviq.com → 200. I posted an ops comment noting the responses were 200 at test time and requested logs/traces if the problem recurs. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3947466254)
       - #12 (Task: Trust signals / reproducible package): PR #15 (demo reproducible package) is open. I posted a status comment summarizing options (merge demo PR vs implement CI to generate artifacts). (Comment: https://github.com/poong92/pruviq/issues/12#issuecomment-3947467989)
       - #11 (Mobile touch targets): PR #14 (CSS touch-target fixes) and PR #17 (Playwright touch-target audit) are open. I posted guidance to merge the audit PR first to generate the report and then follow up with targeted fixes. (Comment: https://github.com/poong92/pruviq/issues/11#issuecomment-3947469492)
       - #10 (i18n — Learn translations): Verified parity again between src/i18n/en.ts and src/i18n/ko.ts and confirmed build emits /ko/learn pages; recommended closing the issue if there are no specific untranslated keys. (Comment: https://github.com/poong92/pruviq/issues/10#issuecomment-3947470523)
       - #9 (SEO — meta descriptions & sitemap tuning): Created a branch and draft PR to make quick SEO copy improvements (index/strategies/meta desc). Branch: `agents/seo-meta-20260224`, PR #22 created (draft). Built locally; build succeeded. (PR: https://github.com/poong92/pruviq/pull/22). Also posted a comment on the issue. (Comment: https://github.com/poong92/pruviq/issues/9#issuecomment-3947471794)
       - #8 (A11Y /simulate): PR #16 is open and fixes color-contrast violations; the PR includes an axe test and the author reports no violations for /simulate after changes. Recommended review/merge of PR #16. (Comment: https://github.com/poong92/pruviq/issues/8#issuecomment-3947471406)
       - #7 (OPS /coins/stats 503): I re-tested /coins/stats (https://api.pruviq.com/coins/stats) — returned 200 at test time. Posted an ops comment requesting logs/traces if the error recurs. (Comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3947466794)
    4. Code changes performed in this run:
       - Created branch `agents/seo-meta-20260224` and updated translation files:
         - src/i18n/en.ts — updated meta.home_desc, meta.index_desc, meta.strategies_desc
         - src/i18n/ko.ts — updated matching Korean keys
       - Ran `npm run build` (site built successfully) locally before committing.
       - Committed changes and pushed branch, created draft PR #22 (https://github.com/poong92/pruviq/pull/22).
    5. Issue comments posted/updated: #21, #19, #12, #11, #10, #9, #8, #7 (see PR/issue links above).
    6. Files changed in repo (branches):
       - agents/seo-meta-20260224: src/i18n/en.ts, src/i18n/ko.ts (committed and pushed)
       - main: MEMORY.md (this entry)
    7. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret or provide ops with instructions to set it; I will re-run the research PoC after it's set.
       - Merge PR #17 to generate the mobile touch-target audit report, then triage and fix remaining elements <44×44.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and deploy IDs to help reproduce and triage.

Generated and committed by 프루빅 on 2026-02-24 06:37 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 10:30 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm process rules and current project state.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` and inspected open issues: #21, #19, #12, #11, #10, #9, #8, #7.
    3. Actions taken per issue:
       - #21 (chore/research: enable BRAVE_API_KEY): Not fixable from the repo — BRAVE_API_KEY must be provisioned as a secret or environment variable by a repo/org admin (GitHub Actions secret or Cloudflare Pages env). I posted a status comment with provisioning instructions and offered to draft a workflow that uses the secret once available. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3948358048)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue. I re-tested endpoints at 2026-02-24 10:30 KST — https://api.pruviq.com/market → 200, https://api.pruviq.com/coins/stats → 200, https://pruviq.com → 200. I posted an ops comment noting the endpoints are currently healthy and requested Cloudflare/origin logs + Sentry traces if the problem recurs. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3948358700)
       - #12 (Task: Trust signals / reproducible package): Frontend PoC is merged (PR #13) and demo reproducible package PR #15 is open. No code changes performed in this run. (Status summarized in comments on the issue.)
       - #11 (Task: Mobile — touch targets): PR #14 (CSS fallbacks) and PR #17 (Playwright mobile audit) are open. Recommended flow: merge PR #17 to generate the audit report, then triage fixes. No code changes performed in this run.
       - #10 (Task: i18n — Learn translations): I verified parity earlier and the build emits /ko/learn pages; recommended closing the issue if no specific untranslated keys are reported. No code changes performed in this run.
       - #9 (Task: SEO — meta descriptions & sitemap tuning): Draft PR already exists from earlier run: PR #22 (agents/seo-meta-20260224) which updates meta.home_desc, meta.index_desc, and meta.strategies_desc (built locally successfully). No new changes performed in this run.
       - #8 (A11Y /simulate): PR #16 is open and addresses color-contrast violations; recommended review/merge. No new changes performed in this run.
       - #7 (OPS /coins/stats 503): Re-tested /coins/stats — returned 200 at test time. Posted an ops comment requesting logs/traces if the error recurs. (Comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3948359243)
    4. Actions performed in this run:
       - Posted issue comments updating status for #21, #19, and #7 with current findings and next steps. (See comment links above.)
       - No new branches or PRs were created in this run; earlier runs created PR #22 (SEO) and other PRs remain open for review.
    5. Files changed/committed in this run:
       - MEMORY.md updated with this cron run log and committed to main. (Commit will be pushed.)
    6. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret (Actions/Cloudflare) or assign to ops to set it; I will re-run the research PoC after it's set.
       - Merge PR #17 (mobile audit) to generate the touch-target report, then triage and fix any remaining elements under 44×44.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and recent deploy IDs to help reproduce and triage.

Generated and committed by 프루빅 on 2026-02-24 10:30 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 14:50 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm process rules and the current project state.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #21, #19, #12, #11, #10, #9, #8, #7.
    3. For each open issue I read the issue and recent comments, then assessed fixability and next actions:
       - #21 (chore/research: enable BRAVE_API_KEY): Not fixable from the repo. BRAVE_API_KEY must be provisioned as a secret/environment variable by a repo/org admin (Settings → Secrets → Actions or Cloudflare Pages env). I posted a status comment with options (add secret or let me draft a small Actions workflow that consumes it). (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3949271167)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue; cannot be fixed from the static repo. I re-tested endpoints (market, coins/stats, site root) — all returned 200 at test time. I posted an ops comment requesting Cloudflare/origin logs, recent deploy IDs, and Sentry traces if the error recurs; offered to add a simple uptime monitor (GitHub Action) that notifies on 5xx. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3948358700)
       - #12 (Task: Trust signals / reproducible package): Frontend PoC merged (PR #13). Demo reproducible package PR #15 is open and mergeable. The full automation requires CI/infra to build/publish reproducible packages; I offered to draft a CI workflow if desired.
       - #11 (Task: Mobile — touch targets): PR #14 (CSS fallbacks) and PR #17 (Playwright mobile audit) are open. Recommended flow: merge PR #17 (audit) to generate `reports/touch-targets.json` in CI, then triage and fix remaining <44×44 elements.
       - #10 (Task: i18n — Learn translations): Parity already verified (src/i18n/en.ts and ko.ts); build emits /ko/learn pages. No changes needed.
       - #9 (Task: SEO — meta descriptions & sitemap tuning): Fixable via copy. Draft PR #22 (agents/seo-meta-20260224) exists and updates meta.home_desc, meta.index_desc, and meta.strategies_desc. Built locally (site build passed).
       - #8 (A11Y /simulate): PR #16 fixes color-contrast violations and includes a full-axe Playwright test; recommend review/merge.
       - #7 (OPS /coins/stats 503): Operational; re-tested — endpoint returned 200 at test time. Asked ops to attach logs/traces if it recurs and offered to add uptime monitoring.
    4. Actions performed in this run:
       - Posted status comments for issues #21, #19, and #7 with current findings and next steps (see comment links above).
       - No new code changes were required or made in this run — existing fixes are covered by open PRs (#22, #16, #17, #15, #14). 
       - Updated MEMORY.md with this run log and committed it to main.
    5. Files changed/committed in this run:
       - MEMORY.md (appended this cron run log).
    6. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret (GitHub Actions or Cloudflare) so I can re-run the research PoC.
       - Merge PR #17 to generate mobile audit report, then triage and fix remaining touch-target issues.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo reproducible package) as appropriate.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and recent deploy IDs when failures occur.

Generated and committed by 프루빅 on 2026-02-24 14:50 KST.

- previous CRON run log entries (kept for history)


- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 18:30 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm process rules and the current project state.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #21, #19, #12, #11, #10, #9, #8, #7.
    3. For each open issue I read the issue and recent comments, then assessed fixability and next actions:
       - #21 (chore/research: enable BRAVE_API_KEY): Not fixable from the repo. BRAVE_API_KEY must be provisioned as a secret/environment variable by a repo/org admin (Settings → Secrets → Actions or Cloudflare Pages env). I posted a status comment offering options (add secret or draft a small Actions workflow + PR) and will re-run the research PoC once the secret is set. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3950327072)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue; cannot be fixed from the static repo. I re-tested live endpoints at 2026-02-24 18:30 KST — https://api.pruviq.com/market → 200, https://api.pruviq.com/coins/stats → 200, https://pruviq.com → 200. I posted an ops comment requesting Cloudflare/origin logs, recent deploy IDs, and Sentry trace IDs if the error recurs, and offered to draft an uptime-monitor PR. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3950327591)
       - #12 (Task: Trust signals / reproducible package): Frontend PoC merged (PR #13). Demo reproducible package PR #15 is open (mergeable). Full automation requires a backend/CI component and secrets; no code changes performed in this run.
       - #11 (Task: Mobile — touch targets): PR #14 (CSS fallbacks) and PR #17 (Playwright mobile touch-target audit) are open. Recommended flow: merge PR #17 to generate audit report, then triage fixes. No new code changes performed in this run.
       - #10 (Task: i18n — Learn translations): Parity verified earlier and /ko/learn pages are generated by the build. No changes required.
       - #9 (Task: SEO — meta descriptions & sitemap tuning): Draft PR #22 (agents/seo-meta-20260224) exists and updates high-priority meta keys; built locally earlier. No new changes in this run.
       - #8 (A11Y /simulate): PR #16 fixes color-contrast violations and includes an axe test; recommend review/merge. No new changes in this run.
       - #7 (OPS /coins/stats 503): Operational; re-tested /coins/stats — returned 200 at test time. Posted an ops comment requesting logs/traces if the error recurs and offered to add uptime monitoring. (Comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3950327910)
    4. Actions performed in this run:
       - Posted issue comments updating status for #21, #19, and #7 with current findings and next steps (see comment links above).
       - No new branches or PRs were created in this run; existing fixes are covered by open PRs (#22, #16, #17, #14, #15).
       - Updated MEMORY.md with this cron run log and committed it to main.
    5. Files changed/committed in this run:
       - MEMORY.md (appended this cron run log).
    6. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret (GitHub Actions or Cloudflare) so I can re-run the research PoC and publish a full report.
       - Merge PR #17 to generate the mobile touch-target audit report in CI, then triage and fix any remaining elements under 44×44.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate; I can run smoke/accessibility checks after merge.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and recent deploy IDs when failures occur so I can analyze them.

Generated and committed by 프루빅 on 2026-02-24 18:30 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-24 22:30 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm process rules and the current project state, noting OWNER DIRECTIVES (P0–P3 priorities) and STOP LIST constraints.
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #21, #19, #12, #11, #10, #9, #8, #7.
    3. For each open issue I read the issue and recent comments, then assessed fixability and next actions:
       - #21 (chore/research: enable BRAVE_API_KEY): Not fixable from the repo. BRAVE_API_KEY must be provisioned as a secret/environment variable by a repo/org admin (Settings → Secrets → Actions or Cloudflare Pages env). I posted a status comment offering options (add secret or draft a small Actions workflow + PR) and will re-run the research PoC once the secret is set. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3951862899)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue; cannot be fixed from the static repo. I re-tested live endpoints at 2026-02-24 22:30 KST — https://api.pruviq.com/market → 200, https://api.pruviq.com/coins/stats → 200, https://pruviq.com → 200. I posted an ops comment requesting Cloudflare/origin logs, recent deploy IDs, and Sentry trace IDs if the error recurs, and offered to draft an uptime-monitor PR. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3951863589)
       - #12 (Task: Trust signals / reproducible package): Frontend PoC merged (PR #13). Demo reproducible package PR #15 is open (mergeable). Full automation requires a backend/CI component and secrets; no code changes performed in this run.
       - #11 (Task: Mobile — touch targets): PR #14 (CSS fallbacks) and PR #17 (Playwright mobile touch-target audit) are open. Recommended flow: merge PR #17 to generate audit report, then triage fixes. No new code changes performed in this run.
       - #10 (Task: i18n — Learn translations): Parity verified earlier and /ko/learn pages are generated by the build. No changes required.
       - #9 (Task: SEO — meta descriptions & sitemap tuning): Draft PR #22 (agents/seo-meta-20260224) exists and updates high-priority meta keys; built locally earlier. No new changes in this run.
       - #8 (A11Y /simulate): PR #16 fixes color-contrast violations and includes an axe test; recommend review/merge. No new changes in this run.
       - #7 (OPS /coins/stats 503): Operational; re-tested /coins/stats — returned 200 at test time. Posted an ops comment requesting logs/traces if the error recurs and offered to add uptime monitoring. (Comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3951864714)
    4. Actions performed in this run:
       - Posted issue comments updating status for #21, #19, and #7 with current findings and next steps (see comment links above).
       - No new branches or PRs were created in this run; existing fixes are covered by open PRs (#22, #16, #17, #14, #15).
       - Updated MEMORY.md with this cron run log and committed it to main via the GitHub API.
    5. Files changed/committed in this run:
       - MEMORY.md (appended this cron run log) — committed via GitHub API.
    6. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret (GitHub Actions or Cloudflare) so I can re-run the research PoC and publish a full report.
       - Merge PR #17 to generate the mobile touch-target audit report in CI, then triage and fix any remaining elements under 44×44.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate; I can run smoke/accessibility checks after merge.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and recent deploy IDs when failures occur so I can analyze them.

Generated and committed by 프루빅 on 2026-02-24 22:30 KST.

- cron:63c0583a-741f-4b76-9f53-861ab7456f81 (gh-issues-autofix)
  - Time: 2026-02-25 02:30 KST
  - Actor: PRUVIQ Bot (프루빅)
  - Action requested: list open GitHub issues (limit 10), assess fixability, create branches/PRs for fixable issues or comment when not fixable, and update MEMORY.md.
  - What I did:
    1. Read SOUL.md and MEMORY.md to confirm process rules and current priorities (P0 Terms/Privacy, P1 Mobile, P2 SEO, P3 Coins pages).
    2. Ran: `cd /Users/openclaw/pruviq && gh issue list --state open --limit 10` — found issues #21, #19, #12, #11, #10, #9, #8, #7.
    3. For each open issue I read the issue and recent comments, then assessed fixability and next actions:
       - #21 (chore/research: enable BRAVE_API_KEY): Not fixable from the repo. BRAVE_API_KEY must be provisioned as a secret/environment variable by a repo/org admin (Settings → Secrets → Actions or Cloudflare Pages env). I posted a status comment offering options (add secret or draft a small Actions workflow + PR) and will re-run the research PoC once the secret is set. (Comment: https://github.com/poong92/pruviq/issues/21#issuecomment-3953652956)
       - #19 (OPS: api.pruviq.com returning 502/503): Operational issue; cannot be fixed from the static repo. I re-tested live endpoints at 2026-02-25 02:30 KST — https://api.pruviq.com/market → 200, https://api.pruviq.com/coins/stats → 200, https://pruviq.com → 200. I posted an ops comment requesting Cloudflare/origin logs, recent deploy IDs, and Sentry trace IDs if the error recurs, and offered to draft an uptime-monitor PR. (Comment: https://github.com/poong92/pruviq/issues/19#issuecomment-3953653476)
       - #12 (Task: Trust signals / reproducible package): Frontend PoC merged (PR #13). Demo reproducible package PR #15 is open (mergeable). Full automation requires a backend/CI component and secrets; no code changes performed in this run.
       - #11 (Task: Mobile — touch targets): PR #14 (CSS fallbacks) and PR #17 (Playwright mobile touch-target audit) are open. Recommended flow: merge PR #17 to generate audit report, then triage fixes. No new code changes performed in this run.
       - #10 (Task: i18n — Learn translations): Parity verified earlier and /ko/learn pages are generated by the build. No changes required.
       - #9 (Task: SEO — meta descriptions & sitemap tuning): Draft PR #22 (agents/seo-meta-20260224) exists and updates high-priority meta keys; built locally earlier. No new changes in this run.
       - #8 (A11Y /simulate): PR #16 fixes color-contrast violations and includes an axe test; recommend review/merge. No new changes in this run.
       - #7 (OPS /coins/stats 503): Operational; re-tested /coins/stats — returned 200 at test time. Posted an ops comment requesting logs/traces if the error recurs and offered to add uptime monitoring. (Comment: https://github.com/poong92/pruviq/issues/7#issuecomment-3953653843)
    4. Actions performed in this run:
       - Posted issue comments updating status for #21, #19, and #7 with current findings and next steps (see comment links above).
       - No new branches or PRs were created in this run; existing fixes are covered by open PRs (#22, #16, #17, #14, #15).
       - Updated MEMORY.md with this cron run log and committed it to main via the GitHub API.
    5. Files changed/committed in this run:
       - MEMORY.md (appended this cron run log) — committed via GitHub API.
    6. Next steps / recommendations:
       - Provision BRAVE_API_KEY as a secret (GitHub Actions or Cloudflare) so I can re-run the research PoC and publish a full report.
       - Merge PR #17 to generate the mobile touch-target audit report in CI, then triage and fix any remaining elements under 44×44.
       - Review & merge PR #16 (a11y fixes) and PR #15 (demo package) as appropriate; I can run smoke/accessibility checks after merge.
       - For OPS issues (#19/#7): collect Cloudflare/host logs, Sentry traces, and recent deploy IDs when failures occur so I can analyze them.

Generated and committed by 프루빅 on 2026-02-25 02:30 KST.
