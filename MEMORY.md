# MEMORY.md - PRUVIQ Project Knowledge

Last updated: 2026-03-04 22:12 KST

## CRON RUN LOGS

- cron: strategic-review (autonomous run)
  - Time: 2026-03-04 22:06 KST
  - Actions performed (autonomous):
    1. git pull origin main (confirmed local sync).
    2. Reviewed open PRs and issues via gh CLI (authenticated in this session).
    3. Fixed/merged two high-impact PRs after local validation:
       - Merged PR #166 (feat: IndexNow setup for instant search engine indexing). Confirmed local build: "[build] 2446 page(s) built". (file added: public/5818182d5955f57743a192861969669d.txt — confirmed in repo)
       - Merged PR #164 (fix: static-refresh  push generated snapshots to dedicated branch `generated-data`). Confirmed change in `backend/scripts/refresh_static.sh` and local build succeeded.
    4. Updated repository state and verified `npm run build` on main (build complete: 2446 pages built).
    5. Triage and blocking issues updated (comments posted):
       - Issue #137 (P0): Cloudflare Workers builds failing for PRs #135/#136  posted diagnostic comment requesting Cloudflare build logs and re-run (comment: https://github.com/pruviq/pruviq/issues/137#issuecomment-3997447384).
       - Issue #21 (P1): Missing BRAVE_API_KEY secret  posted guidance asking ops to provision the secret so the research PoC can run (comment: https://github.com/pruviq/pruviq/issues/21#issuecomment-3997449618).

  - Result: two PRs merged and validated locally (IndexNow and static-refresh fix). Two remaining high-priority, ops-dependent blocks require maintainer action (Cloudflare logs + BRAVE_API_KEY).

  - Next steps:
    - Maintainer with Cloudflare access: re-run failing Workers builds (PRs #135/#136) and paste full build logs in issue #137. With logs I will diagnose and open fix PR(s).
    - Ops: provision BRAVE_API_KEY in repository Actions secrets or the agent-runner environment and re-run the research-poc workflow; I will run the PoC and open follow-up PRs once the secret is available.

  - Evidence:
    - Merged PRs: #166 and #164 (confirmed via gh pr merge output and local git history).
    - Local build logs: "[build] 2446 page(s) built" (from `npm run build` during validation).
    - IndexNow verification file present: `public/5818182d5955f57743a192861969669d.txt` (contents: 5818182d5955f57743a192861969669d) (confirmed in repo).
    - Issue comments posted: #137 (https://github.com/pruviq/pruviq/issues/137#issuecomment-3997447384), #21 (https://github.com/pruviq/pruviq/issues/21#issuecomment-3997449618).

---

- cron: daily-seo-audit (autonomous run)
  - Time: 2026-03-05 00:00 KST
  - Actions performed:
    1. Read SOUL.md & MEMORY.md (confirming audit rules and history).
    2. Verified public site endpoints:
       - https://pruviq.com/ (confirmed 200 and parsed HTML)
       - https://pruviq.com/ko/ (confirmed 200 and parsed HTML)
       - https://pruviq.com/robots.txt (confirmed present)
       - https://pruviq.com/sitemap-index.xml (confirmed present)
       Evidence: live checks performed with curl; local copies saved under /tmp (e.g. /tmp/pruviq_home.html, /tmp/pruviq_ko_home.html) (confirmed).
    3. Ran `npm run build` on main to produce a fresh static site under dist/ (commit: 3023c50). Build completed successfully and generated the sitemap files in dist/ (confirmed in build output and dist/).
    4. Ran a site-wide audit against the generated sitemap (dist/sitemap-0.xml): parsed every <loc> and inspected the generated HTML files in dist/ for:
       - <title> presence
       - <meta name="description"> presence and length
       - <script type="application/ld+json"> presence
       - hreflang alternate links for en/ko
       - rel=canonical presence
       Script results written to /tmp/seo_audit_results.tsv and summary at /tmp/seo_summary.txt.

  - Findings (before fixes):
    - TOTAL pages scanned: 2390 (from sitemap-0.xml / initial build)
    - Missing meta descriptions: 2 (builder redirect pages)
    - Pages with JSON-LD missing: 2 (same builder redirect pages)
    - hreflang mismatches: 2 (same builder redirect pages)
    - Many meta descriptions exceed 160 characters (1150 pages) and 11 are shorter than 50 characters (informational; not auto-fixed).
    Evidence files: /tmp/seo_audit_results.tsv and /tmp/seo_summary.txt (raw output available).

  - Fixes applied (autonomously):
    1. Updated astro.config.mjs to exclude redirect routes (/builder/) from sitemap generation so noindex redirect pages are not listed in sitemap (file edited: astro.config.mjs).
    2. Re-ran `npm run build` to regenerate dist/ and the sitemap. New audit run confirmed:
       - TOTAL=2388
       - MISSING_DESC=0
       - NO_JSONLD=0
       - NO_HREFLANG_PAIR=0
       (full summary: /tmp/seo_summary.txt)
    3. Committed and pushed the change to main:
       - Commit: 3023c50 (PRUVIQ Bot) — seo(sitemap): exclude redirect routes (/builder) from sitemap to avoid indexing noindex redirects (confirmed: git rev-parse --short HEAD => 3023c50)

  - Next recommendations (manual):
    - Consider trimming meta descriptions longer than 160 characters for top-priority pages (home, /coins/* top 50, blog posts). I did NOT auto-truncate text because many long descriptions are intentionally descriptive; recommend an editorial pass.
    - Periodically validate sitemap vs robots.txt to ensure noindex pages are not included.
    - If you want, I can open PRs to normalize meta description lengths for high-traffic pages (requires editorial input on copy).

  - Evidence & artifacts:
    - Updated file: astro.config.mjs (commit 3023c50) (confirmed in git history)
    - Generated site files: /Users/openclaw/pruviq/dist/ (local build)
    - Sitemap files: /Users/openclaw/pruviq/dist/sitemap-index.xml and sitemap-0.xml (confirmed)
    - Audit outputs: /tmp/seo_audit_results.tsv and /tmp/seo_summary.txt (summary printed during run)

---

(Previous entries preserved below)
