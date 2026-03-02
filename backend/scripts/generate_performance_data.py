#!/usr/bin/env python3
"""
generate_performance_data.py

AutoTrader 실거래 데이터에서 PRUVIQ 사이트용 performance.json을 생성한다.

데이터 소스: /Users/jplee/Desktop/autotrader/data/server_backup/trades/trades_2026-*.json
출력: /Users/jplee/Desktop/pruviq/public/data/performance.json
"""

import json
import glob
import os
from datetime import datetime, timezone
from pathlib import Path

# ── 경로 설정 ──────────────────────────────────────────────
TRADES_GLOB = "/Users/jplee/Desktop/autotrader/data/server_backup/trades/trades_2026-*.json"
OUTPUT_PATH = "/Users/jplee/Desktop/pruviq/public/data/performance.json"

# ── 전략 메타데이터 ────────────────────────────────────────
STRATEGY_NAME = "BB Squeeze SHORT v1.7.0"
STARTING_BALANCE = 10000.0


def classify_reason(reason: str) -> str:
    """reason 문자열에서 TP / SL / TIMEOUT 을 분류한다."""
    r = reason.upper()
    if "TP" in r or "TRAILING_STOP" in r:
        return "TP"
    if "SL" in r:
        return "SL"
    if "TIMEOUT" in r:
        return "TIMEOUT"
    # MANUAL_PROFIT, MANUAL_LOSS, UNKNOWN 등
    return "OTHER"


def load_trade_files() -> list[dict]:
    """trades_2026-*.json 파일을 날짜순으로 로드하여 리스트로 반환한다."""
    files = sorted(glob.glob(TRADES_GLOB))
    if not files:
        raise FileNotFoundError(f"No trade files found: {TRADES_GLOB}")
    result = []
    for fpath in files:
        with open(fpath, "r") as f:
            result.append(json.load(f))
    return result


def extract_closes(daily_data: dict) -> list[dict]:
    """하루 데이터에서 position_close 이벤트만 추출한다."""
    closes = []
    for event in daily_data.get("events", []):
        if event.get("event_type") == "position_close":
            closes.append(event)
    return closes


def build_performance(trade_days: list[dict]) -> dict:
    """모든 일별 데이터로부터 performance.json 구조를 생성한다."""

    all_closes: list[dict] = []     # 전체 position_close 이벤트
    daily_records: list[dict] = []  # 일별 집계

    # ── 일별 집계 ──────────────────────────────────────────
    cum_pnl = 0.0
    total_trades = 0
    total_wins = 0
    total_losses = 0
    gross_profit = 0.0
    gross_loss = 0.0
    tp_count = 0
    sl_count = 0
    timeout_count = 0
    other_count = 0
    best_day_pnl = None
    worst_day_pnl = None

    for day_data in trade_days:
        date_str = day_data["date"]
        closes = extract_closes(day_data)
        all_closes.extend(closes)

        day_pnl = 0.0
        day_trades = 0
        day_wins = 0
        day_losses = 0

        for c in closes:
            pnl = c.get("pnl_amount", 0.0) or 0.0
            reason = c.get("reason", "") or ""

            day_pnl += pnl
            day_trades += 1

            if pnl > 0:
                day_wins += 1
                gross_profit += pnl
            else:
                day_losses += 1
                gross_loss += pnl  # 음수

            category = classify_reason(reason)
            if category == "TP":
                tp_count += 1
            elif category == "SL":
                sl_count += 1
            elif category == "TIMEOUT":
                timeout_count += 1
            else:
                other_count += 1

        total_trades += day_trades
        total_wins += day_wins
        total_losses += day_losses
        cum_pnl += day_pnl

        if best_day_pnl is None or day_pnl > best_day_pnl:
            best_day_pnl = day_pnl
        if worst_day_pnl is None or day_pnl < worst_day_pnl:
            worst_day_pnl = day_pnl

        daily_records.append({
            "date": date_str,
            "pnl": round(day_pnl, 2),
            "trades": day_trades,
            "cum_pnl": round(cum_pnl, 2),
            "wins": day_wins,
            "losses": day_losses,
        })

    # ── summary 계산 ───────────────────────────────────────
    win_rate = round((total_wins / total_trades * 100) if total_trades > 0 else 0.0, 2)
    profit_factor = round((gross_profit / abs(gross_loss)) if gross_loss != 0 else 0.0, 2)
    total_pnl = round(cum_pnl, 2)
    current_balance = round(STARTING_BALANCE + total_pnl, 2)
    avg_trade_pnl = round((total_pnl / total_trades) if total_trades > 0 else 0.0, 2)

    # max_drawdown_pct: 잔고 기준 고점 대비 최대 낙폭
    running_balance = STARTING_BALANCE
    peak_balance = STARTING_BALANCE
    max_dd_pct = 0.0
    for rec in daily_records:
        running_balance += rec["pnl"]
        if running_balance > peak_balance:
            peak_balance = running_balance
        dd = (peak_balance - running_balance) / peak_balance * 100 if peak_balance > 0 else 0.0
        if dd > max_dd_pct:
            max_dd_pct = dd
    max_dd_pct = round(max_dd_pct, 2)

    # period
    dates = [d["date"] for d in daily_records]
    period_from = dates[0] if dates else ""
    period_to = dates[-1] if dates else ""

    # ── recent_trades (최근 50건, timestamp 내림차순) ──────
    all_closes_sorted = sorted(
        all_closes,
        key=lambda x: x.get("timestamp", ""),
        reverse=True,
    )
    recent_trades = []
    for c in all_closes_sorted[:50]:
        details = c.get("details", {}) or {}
        entry_price = details.get("entry_price")
        reason_raw = c.get("reason", "") or ""
        category = classify_reason(reason_raw)

        recent_trades.append({
            "symbol": c.get("symbol", ""),
            "entry_price": entry_price,
            "exit_price": c.get("price"),
            "pnl_pct": round(c.get("pnl_pct", 0.0) or 0.0, 2),
            "pnl_usd": round(c.get("pnl_amount", 0.0) or 0.0, 2),
            "reason": category,
            "closed_at": c.get("timestamp", ""),
        })

    # ── 최종 JSON 조립 ────────────────────────────────────
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    performance = {
        "generated": now_utc,
        "strategy": STRATEGY_NAME,
        "period": {
            "from": period_from,
            "to": period_to,
        },
        "summary": {
            "total_trades": total_trades,
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "total_pnl": total_pnl,
            "starting_balance": STARTING_BALANCE,
            "current_balance": current_balance,
            "max_drawdown_pct": max_dd_pct,
            "avg_trade_pnl": avg_trade_pnl,
            "best_day_pnl": round(best_day_pnl or 0.0, 2),
            "worst_day_pnl": round(worst_day_pnl or 0.0, 2),
            "tp_count": tp_count,
            "sl_count": sl_count,
            "timeout_count": timeout_count,
            "other_count": other_count,
        },
        "daily": daily_records,
        "recent_trades": recent_trades,
    }

    return performance


def main():
    print("Loading trade files...")
    trade_days = load_trade_files()
    print(f"  Loaded {len(trade_days)} daily files")

    print("Building performance data...")
    performance = build_performance(trade_days)

    # 출력 디렉토리 생성
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(performance, f, indent=2, ensure_ascii=False)

    print(f"  Output: {OUTPUT_PATH}")
    print()

    # 요약 출력
    s = performance["summary"]
    print("=== Performance Summary ===")
    print(f"  Period: {performance['period']['from']} ~ {performance['period']['to']}")
    print(f"  Total trades: {s['total_trades']}")
    print(f"  Win rate: {s['win_rate']}%")
    print(f"  Profit factor: {s['profit_factor']}")
    print(f"  Total PnL: ${s['total_pnl']}")
    print(f"  Starting balance: ${s['starting_balance']}")
    print(f"  Current balance: ${s['current_balance']}")
    print(f"  Max drawdown: {s['max_drawdown_pct']}%")
    print(f"  Avg trade PnL: ${s['avg_trade_pnl']}")
    print(f"  Best day: ${s['best_day_pnl']}")
    print(f"  Worst day: ${s['worst_day_pnl']}")
    print(f"  TP: {s['tp_count']}, SL: {s['sl_count']}, TIMEOUT: {s['timeout_count']}, OTHER: {s['other_count']}")
    print(f"  Daily records: {len(performance['daily'])}")
    print(f"  Recent trades: {len(performance['recent_trades'])}")


if __name__ == "__main__":
    main()
