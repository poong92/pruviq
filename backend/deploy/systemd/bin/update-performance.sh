#!/bin/bash
# PRUVIQ — Daily performance snapshot (DO-native, once per day).
#
# Reads /opt/autotrader/logs/trades/trades_*.json (same host — no SSH),
# aggregates into public/data/performance.json in the PRUVIQ repo checkout,
# commits with the pruviq-bot identity, pushes via the deploy key. The
# GitHub push triggers data-deploy.yml (Phase 5-B) to build + deploy the site.
#
# Difference from Mac version:
#   - Mac version did `ssh + scp root@DO:/opt/autotrader/logs/trades/...`
#     to pull files over the network. Here we're on the same host so we read
#     the files directly — one network round-trip fewer, and no SSH key
#     exposure on the fetch side.
#   - Git push still requires /opt/pruviq/.ssh/id_ed25519 to be registered
#     as a repo Deploy key (write). Owner action: see LESSONS_FROM_AUTOTRADER.md.
set -uo pipefail

AUTOTRADER_TRADES="/opt/autotrader/logs/trades"
REPO_DIR="/opt/pruviq/current"
VENV_PY="/opt/pruviq/app/.venv/bin/python"
# Seed balance baseline used by the Mac script (unchanged so the generated
# performance.json remains comparable across the cutover).
STARTING_BALANCE="${PRUVIQ_PERF_STARTING_BALANCE:-3102.0}"

notify_fail() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="🚨 PRUVIQ update-performance failed (DO): $1" >/dev/null 2>&1 || true
}

if [ ! -d "$AUTOTRADER_TRADES" ]; then
    notify_fail "autotrader trades dir not found: $AUTOTRADER_TRADES"
    exit 1
fi

TMP_OUT="/tmp/pruviq_performance_$$.json"
trap 'rm -f "$TMP_OUT"' EXIT

STARTING_BALANCE="$STARTING_BALANCE" TRADES_DIR="$AUTOTRADER_TRADES" OUT="$TMP_OUT" \
"$VENV_PY" - <<'PYEOF'
import json, glob, os
from datetime import datetime, timezone

TRADES_DIR = os.environ["TRADES_DIR"]
OUTPUT     = os.environ["OUT"]
STARTING   = float(os.environ["STARTING_BALANCE"])

files = sorted(glob.glob(os.path.join(TRADES_DIR, "trades_*.json")))
trades = []
for f in files:
    with open(f) as fp:
        day = json.load(fp)
    date = day.get("date") or os.path.basename(f).replace("trades_", "").replace(".json", "")
    for e in day.get("events", []):
        if e.get("event_type") == "position_close":
            trades.append({
                "date": date,
                "pnl": float(e.get("pnl_amount", 0) or 0),
                "symbol": e.get("symbol", ""),
                "reason": e.get("reason", "UNKNOWN"),
            })

daily = {}
for t in trades:
    d = t["date"]
    row = daily.setdefault(d, {"date": d, "pnl": 0.0, "trades": 0, "wins": 0})
    row["trades"] += 1
    row["pnl"] += t["pnl"]
    if t["pnl"] > 0:
        row["wins"] += 1

daily_list = sorted(daily.values(), key=lambda r: r["date"])
cum = 0.0
for d in daily_list:
    cum += d["pnl"]
    d["cum_pnl"] = round(cum, 2)
    d["pnl"] = round(d["pnl"], 2)

total = len(trades)
wins = sum(1 for t in trades if t["pnl"] > 0)
gross_profit = sum(t["pnl"] for t in trades if t["pnl"] > 0)
gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] <= 0))
total_pnl = sum(t["pnl"] for t in trades)

peak = 0.0
max_dd = 0.0
eq = 0.0
for d in daily_list:
    eq += d["pnl"]
    if eq > peak:
        peak = eq
    dd = (peak - eq) / STARTING * 100 if STARTING else 0
    if dd > max_dd:
        max_dd = dd

dates = [d["date"] for d in daily_list]
out = {
    "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "strategy": "BB Squeeze SHORT",
    "period": {"from": dates[0] if dates else "N/A", "to": dates[-1] if dates else "N/A"},
    "summary": {
        "total_trades": total,
        "win_rate": round(wins / total * 100, 2) if total else 0,
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss else 0,
        "total_pnl": round(total_pnl, 2),
        "starting_balance": STARTING,
        "current_balance": round(STARTING + total_pnl, 2),
        "max_drawdown_pct": round(max_dd, 1),
    },
    "daily": [
        {"date": d["date"], "pnl": d["pnl"], "trades": d["trades"], "cum_pnl": d["cum_pnl"]}
        for d in daily_list
    ],
}

with open(OUTPUT, "w") as f:
    json.dump(out, f, indent=2)
print(f'Generated: {total} trades, WR {out["summary"]["win_rate"]}%, PnL ${out["summary"]["total_pnl"]}')
PYEOF

if [ ! -s "$TMP_OUT" ]; then
    notify_fail "performance.json generation yielded empty output"
    exit 1
fi

cd "$REPO_DIR"

# Stay on main. Any divergence surfaces as an error — we shouldn't silently
# drop an out-of-band commit.
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$BRANCH" != "main" ]; then
    notify_fail "not on main (on $BRANCH)"
    exit 1
fi
if ! git fetch origin main --quiet 2>/dev/null; then
    notify_fail "git fetch failed"
    exit 1
fi
if ! git merge --ff-only origin/main 2>&1 | tail -1; then
    notify_fail "local branch diverged from origin/main"
    exit 1
fi

DEST="$REPO_DIR/public/data/performance.json"
cp "$TMP_OUT" "$DEST"

if git diff --quiet -- public/data/performance.json 2>/dev/null; then
    echo "no performance change — skip commit"
    exit 0
fi

TRADES_COUNT=$("$VENV_PY" -c "import json; d=json.load(open('$DEST')); print(d['summary']['total_trades'])")
PERIOD_END=$("$VENV_PY" -c "import json; d=json.load(open('$DEST')); print(d['period']['to'])")

git add public/data/performance.json
git -c user.email='pruviq-bot@pruviq.com' -c user.name='pruviq-bot' \
    commit -m "chore(data): update performance.json (${PERIOD_END}, ${TRADES_COUNT} trades)" >/dev/null

if git push origin main 2>&1 | tail -2; then
    echo "pushed performance update"
else
    notify_fail "git push failed (deploy key missing?)"
    exit 1
fi
