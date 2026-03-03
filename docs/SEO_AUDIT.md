SEO audit checklist and fixes (automated)

Issue: "SEO — meta descriptions & sitemap tuning" (#9)

Diagnosis performed:
- astro.config.mjs already includes @astrojs/sitemap integration and a sitemap-index.xml is available at https://pruviq.com/sitemap-index.xml (confirmed). The site generates sitemap-0.xml containing pages.
- Meta keys for primary pages are defined in src/i18n/en.ts and src/i18n/ko.ts (meta.home_desc, meta.market_desc, etc.).

What I did:
- Added this audit doc to codify checks and a small reproducible script to verify meta descriptions for every URL in the sitemap.

How to run a quick local audit:

1) Fetch sitemap index and URL list:
   curl -s https://pruviq.com/sitemap-index.xml | xmllint --xpath "//sitemap/loc/text()" - 2>/dev/null
   curl -s https://pruviq.com/sitemap-0.xml | xmllint --xpath "//url/loc/text()" - 2>/dev/null > /tmp/pruviq_urls.txt

2) Sample check for missing meta description:
   while read url; do
     desc=$(curl -s "$url" | sed -n '1,200p' | grep -i "<meta name=\"description\"\|<meta name=\'description\'" || true)
     if [ -z "$desc" ]; then echo "MISSING: $url"; fi
   done < /tmp/pruviq_urls.txt

Recommended next steps:
- Run the above audit daily in CI and open an issue for any missing meta descriptions or pages with empty titles.
- If Google Search Console shows coverage issues, upload sitemap-index.xml to GSC and monitor.

If you want, I can add a GitHub Action job that runs this audit daily and files issues automatically for missing meta descriptions. Let me know if you'd like me to add that workflow (I can create a PR).