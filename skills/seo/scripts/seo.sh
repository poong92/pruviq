#!/bin/bash
# Skill: seo
# Description: PRUVIQ SEO 상태 점검 (sitemap, robots, meta, structured data)

set -e

CHECK="${1:-all}"

echo "🔍 **PRUVIQ SEO Audit**"
echo ""

check_sitemap() {
    echo "## Sitemap"
    SITEMAP_CODE=$(curl -sI --max-time 5 "https://pruviq.com/sitemap-index.xml" | head -1 | awk '{print $2}')
    if [[ "$SITEMAP_CODE" == "200" ]]; then
        PAGE_COUNT=$(curl -s --max-time 10 "https://pruviq.com/sitemap-index.xml" | grep -c "<loc>" || echo "0")
        echo "  ✅ sitemap-index.xml: OK (${PAGE_COUNT} entries)"
    else
        echo "  ❌ sitemap-index.xml: HTTP ${SITEMAP_CODE}"
    fi
}

check_robots() {
    echo "## Robots.txt"
    ROBOTS=$(curl -s --max-time 5 "https://pruviq.com/robots.txt")
    if [[ -n "$ROBOTS" ]]; then
        SITEMAP_REF=$(echo "$ROBOTS" | grep -i "sitemap" || echo "")
        DISALLOW=$(echo "$ROBOTS" | grep -i "disallow" || echo "")
        echo "  ✅ robots.txt: Accessible"
        if [[ -n "$SITEMAP_REF" ]]; then
            echo "  ✅ Sitemap reference found"
        else
            echo "  ⚠️ No sitemap reference in robots.txt"
        fi
    else
        echo "  ❌ robots.txt: Not found"
    fi
}

check_meta() {
    echo "## Meta Tags (Key Pages)"
    for PAGE in "/" "/coins/" "/simulate/" "/strategies/"; do
        HTML=$(curl -s --max-time 10 "https://pruviq.com${PAGE}" 2>/dev/null)
        TITLE=$(echo "$HTML" | grep -oP '<title[^>]*>\K[^<]+' | head -1 || echo "MISSING")
        DESC=$(echo "$HTML" | grep -oP 'name="description"[^>]*content="\K[^"]+' | head -1 || echo "MISSING")
        OG_IMG=$(echo "$HTML" | grep -oP 'property="og:image"[^>]*content="\K[^"]+' | head -1 || echo "MISSING")

        echo "  ${PAGE}:"
        if [[ "$TITLE" != "MISSING" ]]; then
            TITLE_LEN=${#TITLE}
            if [[ $TITLE_LEN -le 60 ]]; then
                echo "    ✅ Title: ${TITLE} (${TITLE_LEN}ch)"
            else
                echo "    ⚠️ Title too long: ${TITLE_LEN}ch (max 60)"
            fi
        else
            echo "    ❌ Title: MISSING"
        fi

        if [[ "$DESC" != "MISSING" ]]; then
            DESC_LEN=${#DESC}
            if [[ $DESC_LEN -le 160 ]]; then
                echo "    ✅ Description: ${DESC_LEN}ch"
            else
                echo "    ⚠️ Description too long: ${DESC_LEN}ch (max 160)"
            fi
        else
            echo "    ❌ Description: MISSING"
        fi

        if [[ "$OG_IMG" != "MISSING" ]]; then
            echo "    ✅ OG Image: present"
        else
            echo "    ⚠️ OG Image: MISSING"
        fi
    done
}

check_structured() {
    echo "## Structured Data (JSON-LD)"
    HTML=$(curl -s --max-time 10 "https://pruviq.com/" 2>/dev/null)
    JSONLD_COUNT=$(echo "$HTML" | grep -c 'application/ld+json' || echo "0")
    if [[ "$JSONLD_COUNT" -gt 0 ]]; then
        echo "  ✅ JSON-LD blocks: ${JSONLD_COUNT}"
    else
        echo "  ⚠️ No JSON-LD found on homepage"
    fi
}

case $CHECK in
  all)
    check_sitemap
    echo ""
    check_robots
    echo ""
    check_meta
    echo ""
    check_structured
    ;;
  sitemap) check_sitemap ;;
  robots) check_robots ;;
  meta) check_meta ;;
  structured) check_structured ;;
  *)
    echo "Usage: /seo [all|sitemap|robots|meta|structured]"
    ;;
esac

echo ""
echo "⏰ $(date -u '+%Y-%m-%d %H:%M UTC')"
