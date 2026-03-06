#!/usr/bin/env bash
set -euo pipefail
WORKDIR=/Users/openclaw/pruviq
OUT="$WORKDIR/seo_audit"
mkdir -p "$OUT"
SITEMAP_INDEX="https://pruviq.com/sitemap-index.xml"
# fetch sitemaps
curl -sL "$SITEMAP_INDEX" | sed -n 's:.*<loc>\(.*\)</loc>.*:\1:p' > "$OUT/sitemaps.txt"
# for each sitemap
: > "$OUT/pages.txt"
while read -r sitemap; do
  # skip empty lines
  [ -z "$sitemap" ] && continue
  curl -sL "$sitemap" | sed -n 's:.*<loc>\(.*\)</loc>.*:\1:p' >> "$OUT/pages.txt"
done < "$OUT/sitemaps.txt"
# dedupe and filter for http(s) only
cat "$OUT/pages.txt" | sed '/^\s*$/d' | awk '!seen[$0]++' > "$OUT/pages_unique.txt"
PAGECOUNT=$(wc -l < "$OUT/pages_unique.txt" | tr -d ' ')
echo "$PAGECOUNT" > "$OUT/pages_count.txt"
# Safety limit: if pages > 5000 then sample first 3000
if [ "$PAGECOUNT" -gt 5000 ]; then
  echo "TOO_MANY_PAGES:$PAGECOUNT" >> "$OUT/pages_count.txt"
  head -n 3000 "$OUT/pages_unique.txt" > "$OUT/pages_sample.txt"
else
  cp "$OUT/pages_unique.txt" "$OUT/pages_sample.txt"
fi
# Now for each page in pages_sample, fetch title and meta description
OUTCSV="$OUT/pages_meta.csv"
printf "url|title|title_len|meta_description|meta_len|has_jsonld|has_hreflang\n" > "$OUTCSV"
while read -r url; do
  [ -z "$url" ] && continue
  html=$(curl -sL "$url" | tr '\n' ' ')
  # extract title using perl
  title=$(echo "$html" | perl -0777 -ne 'if (/<title[^>]*>(.*?)<\/title>/is){print $1}')
  title_len=$(echo -n "$title" | wc -c)
  # extract meta description (name="description") using perl
  meta=$(echo "$html" | perl -0777 -ne 'if (/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/is){print $1}')
  meta_len=$(echo -n "$meta" | wc -c)
  has_jsonld=$(echo "$html" | grep -q 'application/ld+json' && echo "yes" || echo "no")
  has_hreflang=$(echo "$html" | grep -q 'hreflang' && echo "yes" || echo "no")
  # escape pipes in fields
  title_esc=$(echo "$title" | sed 's/|/ /g')
  meta_esc=$(echo "$meta" | sed 's/|/ /g')
  printf "%s|%s|%s|%s|%s|%s|%s\n" "$url" "$title_esc" "$title_len" "$meta_esc" "$meta_len" "$has_jsonld" "$has_hreflang" >> "$OUTCSV"
done < "$OUT/pages_sample.txt"

echo "DONE: pages_sample_count=$(wc -l < \"$OUT/pages_sample.txt\")" > "$OUT/run_status.txt"
