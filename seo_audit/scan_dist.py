#!/usr/bin/env python3
import os,re
OUT='/Users/jepo/pruviq/seo_audit/dist_pages_meta.csv'
ROOT='/Users/jepo/pruviq/dist'
rows=["url|title|title_len|meta|meta_len|has_jsonld|has_hreflang"]
for dirpath,dirnames,filenames in os.walk(ROOT):
    for fn in filenames:
        if not fn.endswith('.html'):
            continue
        path=os.path.join(dirpath,fn)
        rel=os.path.relpath(path,ROOT)
        # convert to url path
        if rel=='index.html':
            url='https://pruviq.com/'
        else:
            if rel.endswith('/index.html'):
                url_path='/' + rel[:-len('/index.html')]
            else:
                url_path='/' + rel
            url='https://pruviq.com' + url_path
        with open(path,'r',encoding='utf-8',errors='replace') as f:
            html=f.read()
        # normalize whitespace
        s=html
        title=''
        m=re.search(r'<title[^>]*>(.*?)</title>',s,flags=re.I|re.S)
        if m:
            title=re.sub(r'\s+',' ',m.group(1)).strip()
        meta=''
        m2=re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']',s,flags=re.I|re.S)
        if m2:
            meta=re.sub(r'\s+',' ',m2.group(1)).strip()
        has_jsonld='yes' if 'application/ld+json' in s else 'no'
        has_hreflang='yes' if 'hreflang' in s else 'no'
        title_clean=title.replace('|',' ')
        meta_clean=meta.replace('|',' ')
        rows.append(f"{url}|{title_clean}|{len(title_clean)}|{meta_clean}|{len(meta_clean)}|{has_jsonld}|{has_hreflang}")
with open(OUT,'w',encoding='utf-8') as f:
    f.write('\n'.join(rows))
print('WROTE',OUT)
