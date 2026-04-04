#!/usr/bin/env python3
"""
Weekly blog auto-generator — rankings API data to EN+KO markdown.
Run every Monday via cron. Generates src/content/blog/ and blog-ko/ files.

Usage:
    python backend/scripts/generate_weekly_blog.py
    python backend/scripts/generate_weekly_blog.py --auto-pr   # create PR after generation

Cron:
    # Monday 06:00 UTC (15:00 KST)
    0 6 * * 1 cd /Users/jepo/pruviq && /usr/bin/python3 backend/scripts/generate_weekly_blog.py >> /Users/jepo/logs/weekly-blog.log 2>&1
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import httpx

# ── Config ───────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BLOG_EN_DIR = PROJECT_ROOT / "src" / "content" / "blog"
BLOG_KO_DIR = PROJECT_ROOT / "src" / "content" / "blog-ko"
API_URL = os.environ.get("API_BASE_URL", "https://api.pruviq.com")
TIMEOUT = 15


# ── API ──────────────────────────────────────────────────────────────
def fetch_rankings(period: str) -> dict:
    """Fetch rankings from local API. Raises on failure (no fallback)."""
    r = httpx.get(
        f"{API_URL}/rankings/daily",
        params={"period": period, "group": "top50"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


# ── Template helpers ─────────────────────────────────────────────────
def _sign(val: float) -> str:
    return f"+{val:.1f}" if val >= 0 else f"{val:.1f}"


def _rank_change_str(rc, lang: str) -> str:
    if rc is None:
        return "NEW" if lang == "en" else "신규"
    if rc > 0:
        return f"▲{rc}"
    if rc < 0:
        return f"▼{abs(rc)}"
    return "—"


def _strategy_link(strategy: str, direction: str) -> str:
    return f"https://pruviq.com/simulate?strategy={strategy}&direction={direction}"


# ── EN template ──────────────────────────────────────────────────────
def build_en(weekly: dict, monthly: dict, date_str: str) -> str:
    top3 = weekly["top3"]
    worst3 = weekly["worst3"]
    n_strategies = weekly["summary"]["total"]
    wr50 = weekly["summary"]["wr_50plus"]

    title_top = top3[0]["name_en"]
    title_worst = worst3[0]["name_en"]

    # Top 3 table
    top_rows = []
    for s in top3:
        top_rows.append(
            f"| {s['rank']} | [{s['name_en']}]({_strategy_link(s['strategy'], s['direction'])}) "
            f"| {s['win_rate']:.1f}% | {s['profit_factor']:.2f} "
            f"| {_sign(s['total_return'])}% | {_rank_change_str(s['rank_change'], 'en')} |"
        )

    # Worst 3 table
    worst_rows = []
    for s in worst3:
        worst_rows.append(
            f"| {s['rank']} | [{s['name_en']}]({_strategy_link(s['strategy'], s['direction'])}) "
            f"| {s['win_rate']:.1f}% | {s['profit_factor']:.2f} "
            f"| {_sign(s['total_return'])}% | {_rank_change_str(s['rank_change'], 'en')} |"
        )

    # Monthly context
    m_top = monthly["top3"][0] if monthly.get("top3") else None
    monthly_note = ""
    if m_top:
        monthly_note = (
            f"Over the past 30 days, **{m_top['name_en']}** holds the top spot "
            f"with {_sign(m_top['total_return'])}% return and a {m_top['profit_factor']:.2f} profit factor."
        )

    return f"""---
title: "Week of {date_str}: {title_top} leads, {title_worst} drops"
description: "Weekly crypto strategy rankings — {n_strategies} strategies tested across top-50 coins."
date: "{date_str}"
category: "weekly"
tags: ["weekly", "ranking", "strategy"]
---

{n_strategies} strategies. Top-50 coins. 7-day window. Here's what happened.

## Top 3

| Rank | Strategy | WR | PF | Return | Move |
|------|----------|----|----|--------|------|
{chr(10).join(top_rows)}

{wr50} out of {n_strategies} strategies posted a win rate above 50% this week.

## Bottom 3

| Rank | Strategy | WR | PF | Return | Move |
|------|----------|----|----|--------|------|
{chr(10).join(worst_rows)}

## Monthly Context

{monthly_note}

## So What

Rankings shift every week. Past performance doesn't predict future results — that's exactly why we re-run every strategy on fresh data. Pick one that fits your risk tolerance and test it yourself.

[Open the Simulator](https://pruviq.com/simulate)
"""


# ── KO template ──────────────────────────────────────────────────────
def build_ko(weekly: dict, monthly: dict, date_str: str) -> str:
    top3 = weekly["top3"]
    worst3 = weekly["worst3"]
    n_strategies = weekly["summary"]["total"]
    wr50 = weekly["summary"]["wr_50plus"]

    title_top = top3[0]["name_ko"]
    title_worst = worst3[0]["name_ko"]

    top_rows = []
    for s in top3:
        top_rows.append(
            f"| {s['rank']} | [{s['name_ko']}]({_strategy_link(s['strategy'], s['direction'])}) "
            f"| {s['win_rate']:.1f}% | {s['profit_factor']:.2f} "
            f"| {_sign(s['total_return'])}% | {_rank_change_str(s['rank_change'], 'ko')} |"
        )

    worst_rows = []
    for s in worst3:
        worst_rows.append(
            f"| {s['rank']} | [{s['name_ko']}]({_strategy_link(s['strategy'], s['direction'])}) "
            f"| {s['win_rate']:.1f}% | {s['profit_factor']:.2f} "
            f"| {_sign(s['total_return'])}% | {_rank_change_str(s['rank_change'], 'ko')} |"
        )

    m_top = monthly["top3"][0] if monthly.get("top3") else None
    monthly_note = ""
    if m_top:
        monthly_note = (
            f"최근 30일 기준, **{m_top['name_ko']}**가 "
            f"{_sign(m_top['total_return'])}% 수익률, PF {m_top['profit_factor']:.2f}로 1위를 유지하고 있습니다."
        )

    return f"""---
title: "{date_str} 주간 리포트: {title_top} 1위, {title_worst} 하락"
description: "주간 크립토 전략 랭킹 — {n_strategies}개 전략, top-50 코인 대상 테스트 결과."
date: "{date_str}"
category: "weekly"
tags: ["weekly", "ranking", "strategy"]
---

{n_strategies}개 전략. Top-50 코인. 7일 기준. 이번 주 결과입니다.

## Top 3

| 순위 | 전략 | 승률 | PF | 수익률 | 변동 |
|------|------|------|----|--------|------|
{chr(10).join(top_rows)}

{n_strategies}개 전략 중 {wr50}개가 이번 주 승률 50%를 넘었습니다.

## Bottom 3

| 순위 | 전략 | 승률 | PF | 수익률 | 변동 |
|------|------|------|----|--------|------|
{chr(10).join(worst_rows)}

## 월간 맥락

{monthly_note}

## 결론

랭킹은 매주 바뀝니다. 과거 성과가 미래를 보장하지 않습니다. 그래서 매번 새 데이터로 전략을 다시 돌립니다. 본인의 리스크 성향에 맞는 전략을 골라서 직접 테스트해 보세요.

[시뮬레이터 열기](https://pruviq.com/ko/simulate)
"""


# ── Main ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Generate weekly blog posts from rankings API")
    parser.add_argument("--auto-pr", action="store_true", help="Create a git branch + PR after generation")
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing files")
    args = parser.parse_args()

    print(f"[weekly-blog] Fetching 7d rankings...")
    try:
        weekly = fetch_rankings("7d")
    except Exception as e:
        print(f"[weekly-blog] ERROR: Failed to fetch 7d rankings: {e}")
        sys.exit(1)

    print(f"[weekly-blog] Fetching 30d rankings...")
    try:
        monthly = fetch_rankings("30d")
    except Exception as e:
        print(f"[weekly-blog] WARN: Failed to fetch 30d rankings, continuing without monthly context: {e}")
        monthly = {"top3": [], "worst3": [], "summary": {"total": 0, "wr_50plus": 0}}

    # Use the Monday of this week as the date
    today = datetime.utcnow()
    monday = today - timedelta(days=today.weekday())
    date_str = monday.strftime("%Y-%m-%d")
    slug = f"weekly-{date_str}"

    en_content = build_en(weekly, monthly, date_str)
    ko_content = build_ko(weekly, monthly, date_str)

    if args.dry_run:
        print("=== EN ===")
        print(en_content)
        print("=== KO ===")
        print(ko_content)
        return

    en_path = BLOG_EN_DIR / f"{slug}.md"
    ko_path = BLOG_KO_DIR / f"{slug}.md"

    if en_path.exists():
        print(f"[weekly-blog] SKIP: {en_path} already exists")
        sys.exit(0)

    en_path.write_text(en_content, encoding="utf-8")
    ko_path.write_text(ko_content, encoding="utf-8")
    print(f"[weekly-blog] Created: {en_path}")
    print(f"[weekly-blog] Created: {ko_path}")

    if args.auto_pr:
        _create_pr(slug, date_str)


def _create_pr(slug: str, date_str: str):
    """Create a branch and open a PR via gh CLI."""
    branch = f"blog/{slug}"
    try:
        subprocess.run(["git", "checkout", "-b", branch], check=True, cwd=PROJECT_ROOT)
        subprocess.run(["git", "add", f"src/content/blog/{slug}.md", f"src/content/blog-ko/{slug}.md"],
                        check=True, cwd=PROJECT_ROOT)
        subprocess.run(["git", "commit", "-m", f"content: add weekly blog {date_str}"],
                        check=True, cwd=PROJECT_ROOT)
        subprocess.run(["git", "push", "-u", "origin", branch], check=True, cwd=PROJECT_ROOT)
        subprocess.run(
            ["gh", "pr", "create",
             "--title", f"Weekly blog: {date_str}",
             "--body", f"Auto-generated weekly rankings blog post for {date_str}.\n\nReview before merging."],
            check=True, cwd=PROJECT_ROOT,
        )
        print(f"[weekly-blog] PR created for {branch}")
    except subprocess.CalledProcessError as e:
        print(f"[weekly-blog] ERROR creating PR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
