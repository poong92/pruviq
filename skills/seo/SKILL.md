---
name: seo
description: SEO health audit for pruviq.com - sitemap, robots, meta tags, structured data
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["curl"] }, "emoji": "🔍", "os": ["darwin", "linux"] } }
---

# /seo - SEO Audit

Run SEO health checks on pruviq.com.

## Usage
```
/seo all          # Full audit (all checks below)
/seo sitemap      # Check sitemap-index.xml
/seo robots       # Check robots.txt
/seo meta         # Check meta tags on key pages
/seo structured   # Check JSON-LD structured data
```

## Checks
1. **Sitemap**: Validates sitemap-index.xml accessibility and entry count
2. **Robots.txt**: Checks existence and sitemap reference
3. **Meta Tags**: Title length (max 60ch), description (max 160ch), og:image
4. **Structured Data**: JSON-LD block count on homepage

## Key Pages Checked
- / (homepage)
- /coins/ (coin explorer)
- /simulate/ (strategy builder)
- /strategies/ (strategy comparison)

## SEO Best Practices
- Title: 50-60 characters, include primary keyword
- Description: 120-160 characters, compelling CTA
- OG Image: Required for social sharing
- JSON-LD: WebSite, Organization schema minimum
