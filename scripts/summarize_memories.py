#!/usr/bin/env python3
"""
Simple memory summarizer PoC
Usage:
  python3 scripts/summarize_memories.py --input memory/2026-02-23.md --out memory/summaries/2026-02-23.summary.md
  python3 scripts/summarize_memories.py --recent 7 --out memory/summaries/latest.summary.md

This PoC extracts top-level bullet points and first lines of section headings to produce a short summary.
"""
import argparse
import os
import glob


def summarize_file(path, outpath):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    bullets = [l.strip() for l in lines if l.strip().startswith('- ')]
    headings = [l.strip() for l in lines if l.strip().startswith('## ')]

    summary_lines = []
    summary_lines.append(f"Summary of {os.path.basename(path)}")
    summary_lines.append('')

    if headings:
        summary_lines.append('Sections:')
        for h in headings[:6]:
            summary_lines.append('- ' + h[3:])
        summary_lines.append('')

    if bullets:
        summary_lines.append('Top bullets:')
        for b in bullets[:12]:
            summary_lines.append(b)
    else:
        # fallback: include first non-empty lines
        first_lines = [l.strip() for l in lines if l.strip()][:12]
        summary_lines.append('Top lines:')
        for l in first_lines:
            summary_lines.append('- ' + l)

    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary_lines))


def summarize_recent(days, outpath):
    # PoC: include all files in memory/ modified within last `days` days (simple glob order)
    files = sorted(glob.glob('memory/*.md'))
    collected = []
    for p in files:
        with open(p, 'r', encoding='utf-8') as f:
            collected.append(f.read())
    combined = '\n\n'.join(collected)
    tmp_in = '.tmp/combined_memory_poC.md'
    os.makedirs('.tmp', exist_ok=True)
    with open(tmp_in, 'w', encoding='utf-8') as f:
        f.write(combined)
    summarize_file(tmp_in, outpath)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', '-i', help='Input memory file')
    parser.add_argument('--out', '-o', required=True, help='Output summary path')
    parser.add_argument('--recent', type=int, help='Summarize recent N days (PoC: include all memory/*.md)')
    args = parser.parse_args()

    if args.recent:
        summarize_recent(args.recent, args.out)
    elif args.input:
        summarize_file(args.input, args.out)
    else:
        print('Specify --input or --recent')
        raise SystemExit(2)
