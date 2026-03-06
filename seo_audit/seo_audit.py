#!/usr/bin/env python3
import sys
import urllib.request
import re
from urllib.error import URLError, HTTPError

OUT_DIR = '/Users/jepo/pruviq/seo_audit'
SITEMAP_INDEX = 'https://pruviq.com/sitemap-index.xml'

def fetch(url, timeout=20):
    # Some servers / Cloudflare may block the default Python user-agent.
    # Use a common browser/curl UA to increase chance of success.
    req = urllib.request.Request(url, headers={
        'User-Agent': 'curl/7.79.1'
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception:
        return ''

def extract_locs(xml_text):
    return re.findall(r'<loc>(.*?)</loc>', xml_text, flags=re.I|re.S)

if __name__ == '__main__':
    import os
    os.makedirs(OUT_DIR, exist_ok=True)
    sidx = fetch(SITEMAP_INDEX)
    sitemaps = extract_locs(sidx)
    with open(os.path.join(OUT_DIR, 'sitemaps.txt'), 'w') as f:
        f.write('\n'.join(sitemaps))
    pages = []
    for sm in sitemaps:
        txt = fetch(sm)
        locs = extract_locs(txt)
        pages.extend(locs)
    # dedupe
    seen = set()
    pages_unique = []
    for p in pages:
        if p not in seen:
            seen.add(p)
            pages_unique.append(p)
    with open(os.path.join(OUT_DIR, 'pages_unique.txt'), 'w') as f:
        f.write('\n'.join(pages_unique))
    with open(os.path.join(OUT_DIR, 'pages_count.txt'), 'w') as f:
        f.write(str(len(pages_unique)))
    # limit
    MAX = 5000
    sample = pages_unique[:MAX]
    with open(os.path.join(OUT_DIR, 'pages_sample.txt'), 'w') as f:
        f.write('\n'.join(sample))
    outcsv = os.path.join(OUT_DIR, 'pages_meta.csv')
    with open(outcsv, 'w') as f:
        f.write('url|title|title_len|meta_description|meta_len|has_jsonld|has_hreflang\n')
        for url in sample:
            html = fetch(url)
            title = ''
            m = re.search(r'<title[^>]*>(.*?)</title>', html, flags=re.I|re.S)
            if m:
                title = re.sub(r'\s+', ' ', m.group(1)).strip()
            meta = ''
            m2 = re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']', html, flags=re.I|re.S)
            if m2:
                meta = re.sub(r'\s+', ' ', m2.group(1)).strip()
            has_jsonld = 'yes' if 'application/ld+json' in html else 'no'
            has_hreflang = 'yes' if 'hreflang' in html else 'no'
            # sanitize pipes and newlines
            title = title.replace('|', ' ').replace('\n', ' ').replace('\r', ' ')
            meta = meta.replace('|', ' ').replace('\n', ' ').replace('\r', ' ')
            f.write(f"{url}|{title}|{len(title)}|{meta}|{len(meta)}|{has_jsonld}|{has_hreflang}\n")
    print('DONE')
