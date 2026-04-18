#!/usr/bin/env python3
"""
signal_telegram.py — Post new PRUVIQ signals to @PRUVIQ Telegram channel.
Runs via cron every hour. Max 5 per hour. Dedup by signal_time.
"""
import json
import os
import sys
import requests
from datetime import datetime, timezone

API_URL = os.getenv("PRUVIQ_API_URL", "https://api.pruviq.com")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
# Channel target — NOT personal DM. Override via env if needed.
CHANNEL_ID = os.getenv("SIGNAL_TELEGRAM_CHAT_ID", "@PRUVIQ")
MAX_PER_HOUR = 5
STATE_FILE = "/tmp/pruviq-signal-telegram-sent.json"
SITE_URL = "https://pruviq.com"


def load_sent() -> set:
    try:
        with open(STATE_FILE, "r") as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_sent(sent: set):
    items = sorted(sent)[-200:]
    with open(STATE_FILE, "w") as f:
        json.dump(items, f)


def signal_key(s: dict) -> str:
    return f"{s['strategy']}_{s['coin']}_{s['signal_time']}"


def format_message(s: dict) -> str:
    direction = s["direction"].upper()
    emoji = "\U0001f534" if direction == "SHORT" else "\U0001f7e2"
    entry = (
        f"${s['entry_price']:.6f}"
        if s["entry_price"] < 1
        else f"${s['entry_price']:.2f}"
    )
    sim_url = (
        f"{SITE_URL}/simulate?"
        f"strategy={s['strategy']}&symbol={s['coin']}"
        f"&dir={s['direction']}&sl={s['sl_pct']}&tp={s['tp_pct']}"
    )
    return (
        f"{emoji} <b>{s['strategy_name']}</b>\n"
        f"{s['coin']} \u00b7 {direction}\n"
        f"Entry: {entry} \u00b7 SL {s['sl_pct']}% / TP {s['tp_pct']}%\n"
        f"\n"
        f'<a href="{sim_url}">Verify with backtest \u2192</a>'
    )


def send_telegram(text: str) -> bool:
    if not TELEGRAM_TOKEN or not CHANNEL_ID:
        print("TELEGRAM_TOKEN or CHANNEL_ID not set", file=sys.stderr)
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={
                "chat_id": CHANNEL_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=10,
        )
        if not resp.ok:
            print(f"Telegram API error: {resp.text}", file=sys.stderr)
        return resp.ok
    except Exception as e:
        print(f"Telegram send failed: {e}", file=sys.stderr)
        return False


def main():
    try:
        # 2026-04-19: timeout 15→45. DO free RAM 140MB 압박으로 /signals/live 응답 간헐
        # 15s 초과 → 매시간 systemd FAILURE 알림. top_n=30은 30 coin × multi-strategy 계산.
        resp = requests.get(f"{API_URL}/signals/live?top_n=30", timeout=45)
        resp.raise_for_status()
        signals = resp.json()
    except Exception as e:
        print(f"API fetch failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not signals:
        print("No signals available")
        return

    sent = load_sent()
    unsent = [s for s in signals if signal_key(s) not in sent][:MAX_PER_HOUR]
    new_count = 0

    for s in unsent:
        key = signal_key(s)
        msg = format_message(s)
        if send_telegram(msg):
            sent.add(key)
            new_count += 1
            print(f"Sent: {s['strategy_name']} {s['coin']} {s['direction']}")
        else:
            print(f"Failed to send: {key}", file=sys.stderr)

    save_sent(sent)
    print(
        f"Done: {new_count} new signals sent"
        f" ({len(unsent)} unsent, {len(signals)} total, channel={CHANNEL_ID})"
    )


if __name__ == "__main__":
    main()
