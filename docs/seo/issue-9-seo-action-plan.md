# SEO Action Plan — Issue #9

This document summarizes concrete, testable steps to address Issue #9 (SEO — meta descriptions & sitemap tuning).

1. Run the project SEO check locally:
   - npm run build
   - node scripts/check-seo.js

2. Priority pages to review and update (content + meta):
   - / (homepage)
   - /simulate/
   - /coins/
   - /market/
   - /strategies/
   - /fees/
   - /learn/ and top blog posts

3. Update meta description sources:
   - For static pages, update frontmatter or Layout.astro where title/description are set.
   - For dynamic pages, ensure server/route adds proper meta tags during SSG (check src/pages and components).

4. Sitemap and hreflang:
   - Confirm sitemap-index.xml references all per-language sitemaps under public/ or build-time generation.
   - Ensure each page includes hreflang alternates for en/ko.

5. CI integration:
   - The repository already includes .github/workflows/seo-check.yml which runs `scripts/check-seo.js` after build.
   - If missing pages are found, open PRs that update the source files listed by the script.

6. Suggested small quick-fix PRs:
   - Fill missing meta descriptions identified by `scripts/check-seo.js` with short, SEO-friendly descriptions.
   - Add or correct hreflang links in src/layouts/Layout.astro if missing.

7. Testing & verification:
   - Run `npm run build` and `node scripts/check-seo.js` locally to confirm no missing titles/descriptions.
   - After PR merge, verify `SEO: title & meta check` CI job passes for the PR.

---

Generated automatically by PRUVIQ Bot (프루빅) to provide an actionable checklist for Issue #9.
