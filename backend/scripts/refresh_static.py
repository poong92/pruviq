#!/usr/bin/env python3
"""
PRUVIQ — Static Data Refresher

Fetches CoinGecko market data (top 500 coins by market cap) as real-time
market data. Pure CoinGecko data — no strategy/backtest overlay.

Called every 15 minutes by cron via refresh_static.sh.
CoinGecko Free API: ~8,640 calls/month (3 calls x 4/hr x 24hr x 30d)

Output:
  public/data/coins-stats.json  — real-time coin market data
  public/data/market.json       — global market overview
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = REPO_DIR / "public" / "data"

# CoinGecko Free API (no key needed)
CG_BASE = "https://api.coingecko.com/api/v3"
CG_MARKETS = f"{CG_BASE}/coins/markets"
CG_GLOBAL = f"{CG_BASE}/global"
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"

HEADERS = {"User-Agent": "PRUVIQ/1.0 (https://pruviq.com)"}
TIMEOUT = 15


def fetch_json(url: str) -> Optional[dict]:
    """Fetch JSON from URL with error handling."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        print(f"  WARN: Failed to fetch {url}: {e}")
        return None


def fetch_coingecko_markets() -> list[dict]:
    """Fetch top 500 coins from CoinGecko markets endpoint."""
    all_coins = []
    for page in [1, 2]:
        url = (
            f"{CG_MARKETS}?vs_currency=usd&order=market_cap_desc"
            f"&per_page=250&page={page}&sparkline=true"
            f"&price_change_percentage=1h,24h,7d"
        )
        print(f"  Fetching CoinGecko markets page {page}...")
        data = fetch_json(url)
        if data:
            all_coins.extend(data)
        else:
            print(f"  WARN: Page {page} failed, continuing...")
        if page == 1:
            time.sleep(6)
    print(f"  Got {len(all_coins)} coins from CoinGecko")
    return all_coins


def fetch_global_data() -> Optional[dict]:
    """Fetch global market data from CoinGecko."""
    print("  Fetching CoinGecko global data...")
    data = fetch_json(CG_GLOBAL)
    if data and "data" in data:
        return data["data"]
    return None


def fetch_fear_greed() -> tuple[int, str]:
    """Fetch Fear & Greed Index."""
    data = fetch_json(FEAR_GREED_URL)
    if data and "data" in data and len(data["data"]) > 0:
        entry = data["data"][0]
        return int(entry.get("value", 0)), entry.get("value_classification", "Unknown")
    return 0, "Unknown"


def downsample_sparkline(prices: list[float], target: int = 42) -> list[float]:
    """Downsample 168-point hourly sparkline to ~42 points (4h intervals)."""
    if not prices or len(prices) < 2:
        return prices or []
    if len(prices) <= target:
        return [round(p, 2) for p in prices]
    step = len(prices) / target
    return [round(prices[int(i * step)], 2) for i in range(target)]


def build_coins_list(cg_coins: list[dict]) -> list[dict]:
    """Build coins list from CoinGecko data. Pure market data."""
    coins = []
    for cg in cg_coins:
        sparkline_raw = cg.get("sparkline_in_7d", {}).get("price", [])
        coins.append({
            "symbol": cg.get("symbol", "").upper(),
            "name": cg.get("name", ""),
            "image": cg.get("image", ""),
            "price": cg.get("current_price", 0) or 0,
            "change_1h": round(cg.get("price_change_percentage_1h_in_currency", 0) or 0, 2),
            "change_24h": round(cg.get("price_change_percentage_24h_in_currency", 0) or 0, 2),
            "change_7d": round(cg.get("price_change_percentage_7d_in_currency", 0) or 0, 2),
            "market_cap": cg.get("market_cap", 0) or 0,
            "market_cap_rank": cg.get("market_cap_rank"),
            "volume_24h": cg.get("total_volume", 0) or 0,
            "sparkline_7d": downsample_sparkline(sparkline_raw),
        })
    return coins


def build_market_json(global_data: Optional[dict], fear_index: int, fear_label: str,
                      coins: list[dict]) -> dict:
    """Build market.json from global data + top movers."""
    by_change = sorted(coins, key=lambda c: c.get("change_24h", 0), reverse=True)

    top_gainers = [
        {"symbol": c["symbol"], "name": c["name"], "image": c["image"], "price": c["price"],
         "change_24h": c["change_24h"], "volume_24h": c.get("volume_24h", 0)}
        for c in by_change[:10] if c.get("change_24h", 0) > 0
    ]
    top_losers = [
        {"symbol": c["symbol"], "name": c["name"], "image": c["image"], "price": c["price"],
         "change_24h": c["change_24h"], "volume_24h": c.get("volume_24h", 0)}
        for c in reversed(by_change) if c.get("change_24h", 0) < 0
    ][:10]

    btc = next((c for c in coins if c["symbol"] == "BTC"), {})
    eth = next((c for c in coins if c["symbol"] == "ETH"), {})

    return {
        "btc_price": btc.get("price", 0),
        "btc_change_24h": btc.get("change_24h", 0),
        "eth_price": eth.get("price", 0),
        "eth_change_24h": eth.get("change_24h", 0),
        "fear_greed_index": fear_index,
        "fear_greed_label": fear_label,
        "total_market_cap_b": round(
            (global_data.get("total_market_cap", {}).get("usd", 0) / 1e9) if global_data else 0, 1
        ),
        "btc_dominance": round(
            global_data.get("market_cap_percentage", {}).get("btc", 0) if global_data else 0, 1
        ),
        "total_volume_24h_b": round(
            (global_data.get("total_volume", {}).get("usd", 0) / 1e9) if global_data else 0, 1
        ),
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "extreme_funding": [],
        "generated": datetime.now(timezone.utc).isoformat(),
    }


def main():
    print(f"=== PRUVIQ Static Refresh — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")

    # 1. Fetch CoinGecko market data (PRIMARY source)
    cg_coins = fetch_coingecko_markets()
    if not cg_coins:
        print("ERROR: CoinGecko returned no data. Keeping existing files.")
        sys.exit(1)

    # 2. Fetch global data
    time.sleep(4)
    global_data = fetch_global_data()

    # 3. Fetch Fear & Greed
    fear_index, fear_label = fetch_fear_greed()
    print(f"  Fear & Greed: {fear_index} ({fear_label})")

    # 4. Build coins list (pure CoinGecko)
    coins = build_coins_list(cg_coins)

    # 5. Write coins-stats.json
    output = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_coins": len(coins),
        "coins": coins,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    coins_path = OUTPUT_DIR / "coins-stats.json"
    with open(coins_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    print(f"  Wrote {coins_path} ({coins_path.stat().st_size / 1024:.1f} KB)")

    # 6. Write market.json
    market = build_market_json(global_data, fear_index, fear_label, coins)
    market_path = OUTPUT_DIR / "market.json"
    with open(market_path, "w") as f:
        json.dump(market, f, separators=(",", ":"))
    print(f"  Wrote {market_path} ({market_path.stat().st_size / 1024:.1f} KB)")

    print("=== Done ===")


if __name__ == "__main__":
    main()
