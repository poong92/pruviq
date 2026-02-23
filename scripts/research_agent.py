#!/usr/bin/env python3
"""
Research agent (free-mode) PoC
- Collects signals about autonomous-agent ecosystems using free/public sources (no API keys required):
  - Hacker News (Algolia search API)
  - arXiv (export.arxiv.org)
  - GitHub public search (REST, unauthenticated)
  - Optional RSS/feeds if provided by --feeds

Usage examples:
  python3 scripts/research_agent.py --out reports/agent-research-$(date +%F).md
  python3 scripts/research_agent.py --out reports/agent-research.md --topics "Auto-GPT,LangChain,BabyAGI"

Notes:
- This PoC uses only public/free endpoints. Rate limits may apply.
- The script is defensive: network failures will be noted in the report but will not expose secrets.
"""
import argparse
import requests
import feedparser
import xml.etree.ElementTree as ET
from datetime import datetime
import time
import sys

USER_AGENT = 'pruviq-research-agent/1.0 (+https://pruviq.com)'


def hn_search(query, hits=5):
    url = 'https://hn.algolia.com/api/v1/search'
    params = {'query': query, 'tags': 'story', 'hitsPerPage': hits}
    headers = {'User-Agent': USER_AGENT}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=20)
        r.raise_for_status()
        data = r.json()
        hits = data.get('hits', [])
        results = []
        for h in hits:
            title = h.get('title') or h.get('story_title') or h.get('comment_text') or ''
            link = h.get('url') or h.get('story_url') or ''
            author = h.get('author')
            points = h.get('points')
            results.append({'title': title, 'link': link, 'author': author, 'points': points})
        return results
    except Exception as e:
        return {'error': str(e)}


def arxiv_search(query, max_results=3):
    base = 'http://export.arxiv.org/api/query'
    params = {'search_query': f'all:{query}', 'start': 0, 'max_results': max_results}
    headers = {'User-Agent': USER_AGENT}
    try:
        r = requests.get(base, params=params, headers=headers, timeout=20)
        r.raise_for_status()
        root = ET.fromstring(r.text)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns).text.strip()
            id_ = entry.find('atom:id', ns).text.strip()
            summary_el = entry.find('atom:summary', ns)
            summary = summary_el.text.strip() if summary_el is not None else ''
            entries.append({'title': title, 'link': id_, 'summary': summary})
        return entries
    except Exception as e:
        return {'error': str(e)}


def github_search_repos(query, per_page=5):
    url = 'https://api.github.com/search/repositories'
    params = {'q': query, 'sort': 'stars', 'order': 'desc', 'per_page': per_page}
    headers = {'User-Agent': USER_AGENT, 'Accept': 'application/vnd.github.v3+json'}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=20)
        r.raise_for_status()
        data = r.json()
        items = data.get('items', [])
        results = []
        for it in items:
            results.append({'name': it.get('full_name'), 'link': it.get('html_url'), 'stars': it.get('stargazers_count'), 'description': it.get('description')})
        return results
    except Exception as e:
        return {'error': str(e)}


def fetch_feeds(feed_urls, max_items=5):
    results = []
    for url in feed_urls:
        try:
            feed = feedparser.parse(url)
            items = []
            for e in feed.entries[:max_items]:
                items.append({'title': e.get('title'), 'link': e.get('link'), 'published': e.get('published', '')})
            results.append({'feed': url, 'title': feed.feed.get('title', ''), 'items': items})
        except Exception as e:
            results.append({'feed': url, 'error': str(e)})
    return results


def make_report(outpath, topics, feeds):
    lines = []
    now = datetime.utcnow().isoformat() + 'Z'
    lines.append('# Agent Research Report')
    lines.append('')
    lines.append(f'- Generated: {now}')
    lines.append('')
    lines.append('## Summary')
    lines.append('This report aggregates recent signals from public sources (Hacker News Algolia, arXiv, GitHub search, and optional RSS feeds).')
    lines.append('')

    for topic in topics:
        lines.append(f'---')
        lines.append(f'### Topic: {topic}')
        lines.append('')
        lines.append('#### Hacker News (Algolia)')
        hn = hn_search(topic)
        if isinstance(hn, dict) and hn.get('error'):
            lines.append(f'- Error fetching Hacker News: {hn.get("error")}')
        else:
            if not hn:
                lines.append('- No recent HN stories found')
            for h in hn:
                title = h.get('title') or '(no title)'
                link = h.get('link') or ''
                author = h.get('author') or ''
                points = h.get('points')
                lines.append(f'- [{title}]({link}) — {author} ({points} pts)')
        lines.append('')

        lines.append('#### arXiv (papers)')
        ax = arxiv_search(topic)
        if isinstance(ax, dict) and ax.get('error'):
            lines.append(f'- Error fetching arXiv: {ax.get("error")}')
        else:
            if not ax:
                lines.append('- No recent arXiv results')
            for a in ax:
                lines.append(f'- [{a.get("title")} ]({a.get("link")})')
                summary = a.get('summary', '')
                if summary:
                    short = summary.replace('\n', ' ')[:250]
                    lines.append(f'  - {short}...')
        lines.append('')

        lines.append('#### GitHub (repositories)')
        gh = github_search_repos(topic)
        if isinstance(gh, dict) and gh.get('error'):
            lines.append(f'- Error fetching GitHub: {gh.get("error")}')
        else:
            if not gh:
                lines.append('- No GitHub repositories found')
            for g in gh:
                lines.append(f'- [{g.get("name")}]({g.get("link")}) — ⭐ {g.get("stars")}, {g.get("description") or ""}')
        lines.append('\n')
        # polite pause to avoid aggressive requests
        time.sleep(1)

    if feeds:
        lines.append('---')
        lines.append('## Feeds')
        feed_results = fetch_feeds(feeds)
        for fr in feed_results:
            if fr.get('error'):
                lines.append(f'- Feed {fr.get("feed")}: Error: {fr.get("error")}')
                continue
            lines.append(f'### {fr.get("title") or fr.get("feed")}')
            for it in fr.get('items', []):
                lines.append(f'- [{it.get("title")}]({it.get("link")}) — {it.get("published") or ""}')
            lines.append('')

    lines.append('\n')
    lines.append('---')
    lines.append('Notes:')
    lines.append('- This is a PoC that uses public/free endpoints only. If you want more coverage, add more seed feeds or enable authenticated APIs.')
    lines.append('- Rate limits may apply; job should be scheduled conservatively.')

    os_mkdir = None
    try:
        import os
        os.makedirs(os.path.dirname(outpath), exist_ok=True)
        with open(outpath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(outpath)
    except Exception as e:
        print('ERROR:', e)
        sys.exit(2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', '-o', required=True, help='Output report path')
    parser.add_argument('--topics', '-t', help='Comma-separated topics to search')
    parser.add_argument('--feeds', '-f', help='Comma-separated RSS/Atom feed URLs to include')
    args = parser.parse_args()
    if args.topics:
        topics = [t.strip() for t in args.topics.split(',') if t.strip()]
    else:
        topics = [
            'Auto-GPT',
            'LangChain',
            'autonomous agents',
            'BabyAGI',
            'agent evaluation'
        ]
    feeds = [u.strip() for u in (args.feeds or '').split(',') if u.strip()]
    make_report(args.out, topics, feeds)
