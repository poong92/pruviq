#!/usr/bin/env python3
import sys, urllib.request, urllib.error, ssl, time
from html.parser import HTMLParser

class MyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ''
        self.meta_description = ''
        self.hreflang_count = 0
        self.jsonld_count = 0
        self.canonical = ''
        self.og_image = ''

    def handle_starttag(self, tag, attrs):
        attrs = {k.lower(): v for k, v in attrs}
        if tag.lower() == 'title':
            self.in_title = True
        if tag.lower() == 'meta':
            name = attrs.get('name','').lower()
            prop = attrs.get('property','').lower()
            if name == 'description' and 'content' in attrs:
                self.meta_description = attrs.get('content','')
            if prop == 'og:image' and 'content' in attrs:
                self.og_image = attrs.get('content','')
        if tag.lower() == 'link':
            rel = attrs.get('rel','').lower()
            if 'alternate' in rel and 'hreflang' in attrs:
                self.hreflang_count += 1
            if 'canonical' in rel and 'href' in attrs:
                self.canonical = attrs.get('href','')
        if tag.lower() == 'script':
            t = attrs.get('type','').lower()
            if t == 'application/ld+json':
                self.jsonld_count += 1

    def handle_endtag(self, tag):
        if tag.lower() == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'PRUVIQ-Bot/1.0 (+https://pruviq.com)'
    })
    try:
        start = time.time()
        resp = urllib.request.urlopen(req, timeout=timeout)
        code = resp.getcode()
        body = resp.read()
        # Attempt decode
        try:
            text = body.decode('utf-8')
        except Exception:
            try:
                text = body.decode('latin-1')
            except Exception:
                text = body.decode('utf-8','replace')
        return code, text
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            text = body.decode('utf-8','replace')
        except Exception:
            text = ''
        return e.code, text
    except Exception as e:
        return 0, str(e)


def sanitize(s):
    if s is None:
        return ''
    return ' '.join(s.split())


def main(urls_file, out_file):
    import os
    with open(urls_file, 'r') as f:
        urls = [u.strip() for u in f if u.strip()]
    total = len(urls)
    with open(out_file, 'w') as out:
        out.write('url\thttp_code\ttitle\ttitle_len\tdescription\tdesc_len\threflang_count\tjsonld_count\tcanonical\tog_image_present\n')
        for i, url in enumerate(urls, 1):
            code, text = fetch(url)
            parser = MyParser()
            try:
                parser.feed(text)
            except Exception:
                pass
            title = sanitize(parser.title)
            desc = sanitize(parser.meta_description)
            canonical = parser.canonical or ''
            og_present = 'yes' if parser.og_image else 'no'
            title_len = len(title)
            desc_len = len(desc)
            out.write(f"{url}\t{code}\t{title}\t{title_len}\t{desc}\t{desc_len}\t{parser.hreflang_count}\t{parser.jsonld_count}\t{canonical}\t{og_present}\n")
            if i % 50 == 0 or i==total:
                print(f"Processed {i}/{total} -> {url} (code={code})")
                sys.stdout.flush()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: seo_audit.py urls.txt out.tsv')
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
