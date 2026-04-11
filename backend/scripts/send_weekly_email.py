#!/usr/bin/env python3
"""Weekly strategy email sender — runs every Monday 09:00 KST.

Usage:
    python -m backend.scripts.send_weekly_email
    # or directly:
    python backend/scripts/send_weekly_email.py

Requires:
    SENDGRID_API_KEY  — SendGrid API key (skip send if missing)
    UNSUBSCRIBE_SECRET — HMAC secret for unsubscribe tokens (default: pruviq-unsub-2026)
"""

import json
import os
import sys
import hmac
import hashlib
from pathlib import Path
from datetime import datetime
from urllib.parse import quote

import httpx

SUBSCRIBERS_FILE = Path("/Users/jepo/pruviq-data/subscribers.json")
API_URL = "http://localhost:8080"
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
UNSUBSCRIBE_SECRET = os.environ.get("UNSUBSCRIBE_SECRET", "pruviq-unsub-2026")
FROM_EMAIL = "alerts@pruviq.com"


def get_rankings() -> dict:
    """Fetch latest daily rankings from the local API."""
    r = httpx.get(f"{API_URL}/rankings/daily", timeout=10)
    r.raise_for_status()
    return r.json()


def make_unsubscribe_url(email: str) -> str:
    """Generate a signed unsubscribe URL."""
    token = hmac.new(
        UNSUBSCRIBE_SECRET.encode(), email.encode(), hashlib.sha256
    ).hexdigest()
    return f"https://api.pruviq.com/api/unsubscribe?email={quote(email)}&token={token}"


def build_html(rankings: dict, lang: str, unsub_url: str) -> str:
    """Build a simple HTML email with top/worst performers."""
    top3 = rankings.get("top3", [])
    worst3 = rankings.get("worst3", [])
    date = rankings.get("date", datetime.utcnow().strftime("%Y-%m-%d"))

    # Header text by language
    if lang == "ko":
        title = f"PRUVIQ 주간 전략 알림 — {date}"
        top_label = "Top 3 전략"
        worst_label = "Worst 3 전략"
        footer_text = "이 이메일을 더 이상 받고 싶지 않다면"
        unsub_label = "구독 해지"
    else:
        title = f"PRUVIQ Weekly Strategy Alert — {date}"
        top_label = "Top 3 Strategies"
        worst_label = "Worst 3 Strategies"
        footer_text = "Don't want these emails?"
        unsub_label = "Unsubscribe"

    def _row(item: dict) -> str:
        name = item.get("strategy", item.get("name", "—"))
        ret = item.get("total_return_pct", 0)
        wr = item.get("win_rate", 0)
        color = "#22c55e" if ret >= 0 else "#ef4444"
        return (
            f"<tr>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #eee'>{name}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #eee;color:{color};font-weight:600'>"
            f"{ret:+.1f}%</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #eee'>{wr:.0f}%</td>"
            f"</tr>"
        )

    def _table(label: str, items: list) -> str:
        if not items:
            return ""
        rows = "".join(_row(i) for i in items[:3])
        return (
            f"<h3 style='margin:24px 0 8px'>{label}</h3>"
            f"<table style='width:100%;border-collapse:collapse;font-size:14px'>"
            f"<tr style='background:#f8f9fa'>"
            f"<th style='padding:8px 12px;text-align:left'>Strategy</th>"
            f"<th style='padding:8px 12px;text-align:left'>Return</th>"
            f"<th style='padding:8px 12px;text-align:left'>Win Rate</th>"
            f"</tr>"
            f"{rows}</table>"
        )

    html = (
        f"<!DOCTYPE html>"
        f"<html><head><meta charset='utf-8'></head>"
        f"<body style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;"
        f"max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a'>"
        f"<h2 style='color:#6366f1'>{title}</h2>"
        f"{_table(top_label, top3)}"
        f"{_table(worst_label, worst3)}"
        f"<p style='margin-top:32px'>"
        f"<a href='https://pruviq.com/simulate' style='background:#6366f1;color:#fff;"
        f"padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600'>"
        f"Run Your Own Simulation</a></p>"
        f"<hr style='margin:32px 0;border:none;border-top:1px solid #eee'>"
        f"<p style='font-size:12px;color:#888'>"
        f"{footer_text} <a href='{unsub_url}'>{unsub_label}</a></p>"
        f"</body></html>"
    )
    return html


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via SendGrid API. Returns True on success."""
    if not SENDGRID_API_KEY:
        print(f"  SKIP (no API key): {to}")
        return False

    r = httpx.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": FROM_EMAIL, "name": "PRUVIQ"},
            "subject": subject,
            "content": [{"type": "text/html", "value": html}],
        },
        timeout=10,
    )
    if r.status_code == 202:
        return True
    print(f"  FAIL ({r.status_code}): {to} — {r.text[:200]}")
    return False


def main():
    if not SUBSCRIBERS_FILE.exists():
        print("No subscribers file found.")
        return

    data = json.loads(SUBSCRIBERS_FILE.read_text())
    active = [s for s in data["subscribers"] if s.get("active", True)]
    print(f"Active subscribers: {len(active)}")

    if not active:
        print("No active subscribers. Exiting.")
        return

    rankings = get_rankings()
    sent = 0

    for sub in active:
        lang = sub.get("lang", "en")
        unsub_url = make_unsubscribe_url(sub["email"])
        html = build_html(rankings, lang, unsub_url)
        date = rankings.get("date", "")
        subject = f"[PRUVIQ] Weekly Strategy Alert — {date}"
        if send_email(sub["email"], subject, html):
            sent += 1

    print(f"Sent: {sent}/{len(active)}")


if __name__ == "__main__":
    main()
