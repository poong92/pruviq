#!/usr/bin/env python3
"""
PRUVIQ — Static Data Refresher

Fetches CoinGecko market data (top 500 coins by market cap) and merges
with per-coin strategy backtest stats (WR/PF/Return) from daily pipeline.

Called every 15 minutes by cron via refresh_static.sh.
CoinGecko Free API: ~8,640 calls/month (3 calls x 4/hr x 24hr x 30d)
FRED API: 120 req/min (6 calls per cycle = trivial)

Output:
  public/data/coins-stats.json  — market data + strategy overlay
  public/data/market.json       — global market overview
  public/data/macro.json        — macro economic indicators (FRED)
  public/data/news.json         — crypto + macro news (RSS)
"""

from __future__ import annotations

import csv
import io
import json
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Optional

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = REPO_DIR / "public" / "data"
STRATEGY_STATS = SCRIPT_DIR.parent / "data" / "coin-strategy-stats.json"

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


def fetch_coingecko_markets(max_retries: int = 2) -> list[dict]:
    """Fetch top 500 coins from CoinGecko markets endpoint with retry."""
    for attempt in range(max_retries + 1):
        all_coins = []
        for page in [1, 2]:
            url = (
                f"{CG_MARKETS}?vs_currency=usd&order=market_cap_desc"
                f"&per_page=250&page={page}&sparkline=true"
                f"&price_change_percentage=1h,24h,7d"
            )
            print(f"  Fetching CoinGecko markets page {page} (attempt {attempt+1})...")
            data = fetch_json(url)
            if data:
                all_coins.extend(data)
            else:
                print(f"  WARN: Page {page} failed")
            if page == 1:
                time.sleep(12)
        if all_coins:
            print(f"  Got {len(all_coins)} coins from CoinGecko")
            return all_coins
        if attempt < max_retries:
            wait = 30 * (attempt + 1)
            print(f"  WARN: CoinGecko returned 0 coins, retrying in {wait}s...")
            time.sleep(wait)
    print("  ERROR: CoinGecko failed after all retries")
    return []


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


def load_strategy_stats() -> dict:
    """Load per-coin multi-strategy stats from daily-generated JSON.

    Supports both legacy (single strategy) and new (multi-strategy) schema.

    Returns:
        {
            "strategies_meta": {"bb-squeeze-short": {"name": ..., "direction": ...}, ...},
            "best_strategy": {"BTC": "bb-squeeze-short", ...},
            "per_coin": {"BTC": {"bb-squeeze-short": {...}, "rsi-reversal-long": {...}}, ...},
        }
    """
    if not STRATEGY_STATS.exists():
        print("  INFO: No strategy stats file, coins will have market data only")
        return {}
    try:
        with open(STRATEGY_STATS) as f:
            data = json.load(f)

        # Detect schema version
        if "strategies" in data:
            # New multi-strategy schema
            return _load_multi_strategy(data)
        elif "coins" in data:
            # Legacy single-strategy schema (backward compatible)
            return _load_legacy_strategy(data)
        else:
            return {}
    except (json.JSONDecodeError, KeyError) as e:
        print(f"  WARN: Failed to load strategy stats: {e}")
        return {}


def _sym_to_base(sym: str) -> str:
    """Convert BTCUSDT → BTC, 1000PEPEUSDT → 1000PEPE."""
    return sym.replace("USDT", "") if sym.endswith("USDT") else sym


def _load_multi_strategy(data: dict) -> dict:
    """Parse new multi-strategy schema."""
    strategies_meta = {}
    per_coin = {}
    best_strategy_raw = data.get("best_strategy", {})

    for sid, sdata in data.get("strategies", {}).items():
        strategies_meta[sid] = {
            "name": sdata.get("name", sid),
            "direction": sdata.get("direction", "short"),
            "params": sdata.get("params", {}),
            "status": sdata.get("status", "experimental"),
        }
        for sym, stats in sdata.get("coins", {}).items():
            base = _sym_to_base(sym)
            if base not in per_coin:
                per_coin[base] = {}
            per_coin[base][sid] = stats

    # Convert best_strategy keys
    best_strategy = {}
    for sym, sid in best_strategy_raw.items():
        best_strategy[_sym_to_base(sym)] = sid

    print(f"  Strategy stats: {len(per_coin)} coins, {len(strategies_meta)} strategies")
    return {
        "strategies_meta": strategies_meta,
        "best_strategy": best_strategy,
        "per_coin": per_coin,
    }


def _load_legacy_strategy(data: dict) -> dict:
    """Parse legacy single-strategy schema (backward compatible)."""
    sid = data.get("strategy", "bb-squeeze-short")
    per_coin = {}
    for sym, stats in data.get("coins", {}).items():
        base = _sym_to_base(sym)
        per_coin[base] = {sid: stats}

    best_strategy = {base: sid for base in per_coin}
    strategies_meta = {
        sid: {
            "name": "BB Squeeze SHORT",
            "direction": "short",
            "params": data.get("params", {}),
            "status": "verified",
        }
    }
    print(f"  Strategy stats (legacy): {len(per_coin)} coins loaded")
    return {
        "strategies_meta": strategies_meta,
        "best_strategy": best_strategy,
        "per_coin": per_coin,
    }


def build_coins_list(cg_coins: list[dict], strategy_stats: dict) -> list[dict]:
    """Build coins list from CoinGecko data + multi-strategy stats overlay.

    Each coin gets:
    - CoinGecko market data (price, change, market_cap, sparkline)
    - Best strategy summary (trades, win_rate, profit_factor, total_return_pct)
    - All strategies object (for comparison mode)
    """
    per_coin = strategy_stats.get("per_coin", {})
    best_map = strategy_stats.get("best_strategy", {})
    meta = strategy_stats.get("strategies_meta", {})

    coins = []
    merged_count = 0
    for cg in cg_coins:
        sparkline_raw = cg.get("sparkline_in_7d", {}).get("price", [])
        cg_symbol = cg.get("symbol", "").upper()

        coin = {
            "symbol": cg_symbol,
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
            # Best strategy fields (Level 0 — default view)
            "best_strategy": None,
            "best_strategy_name": None,
            "trades": None,
            "win_rate": None,
            "profit_factor": None,
            "total_return_pct": None,
            # All strategies (Level 1 — comparison mode)
            "strategies": None,
        }

        # Merge strategy stats if available
        coin_strategies = per_coin.get(cg_symbol)
        if coin_strategies:
            merged_count += 1

            # Best strategy summary (for default view)
            best_sid = best_map.get(cg_symbol)
            if best_sid and best_sid in coin_strategies:
                best_stats = coin_strategies[best_sid]
                best_meta = meta.get(best_sid, {})
                coin["best_strategy"] = best_sid
                coin["best_strategy_name"] = best_meta.get("name", best_sid)
                coin["trades"] = best_stats.get("trades")
                coin["win_rate"] = best_stats.get("win_rate")
                coin["profit_factor"] = best_stats.get("profit_factor")
                coin["total_return_pct"] = best_stats.get("total_return_pct")

            # All strategies (for comparison table)
            strategies_list = {}
            for sid, stats in coin_strategies.items():
                s_meta = meta.get(sid, {})
                strategies_list[sid] = {
                    "name": s_meta.get("name", sid),
                    "direction": s_meta.get("direction", "short"),
                    "trades": stats.get("trades"),
                    "win_rate": stats.get("win_rate"),
                    "profit_factor": stats.get("profit_factor"),
                    "total_return_pct": stats.get("total_return_pct"),
                }
            coin["strategies"] = strategies_list

        coins.append(coin)

    if per_coin:
        print(f"  Merged strategy stats: {merged_count}/{len(coins)} coins")
    return coins


def build_market_json(global_data: Optional[dict], fear_index: int, fear_label: str,
                      coins: list[dict]) -> dict:
    """Build market.json from global data + top movers.

    If CoinGecko /global API fails (rate limit), fallback to calculating totals
    from the coins list to avoid zeros showing in the UI.
    """
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

    # Fallback calculations when global_data is unavailable
    if global_data:
        total_market_cap_usd = global_data.get("total_market_cap", {}).get("usd", 0)
        total_volume_usd = global_data.get("total_volume", {}).get("usd", 0)
        btc_dominance = global_data.get("market_cap_percentage", {}).get("btc", 0)
    else:
        total_market_cap_usd = sum(c.get("market_cap", 0) for c in coins)
        total_volume_usd = sum(c.get("volume_24h", 0) for c in coins)
        btc_market_cap = next((c.get("market_cap", 0) for c in coins if c["symbol"] == "BTC"), 0)
        btc_dominance = (btc_market_cap / total_market_cap_usd * 100) if total_market_cap_usd else 0

    return {
        "btc_price": btc.get("price", 0),
        "btc_change_24h": btc.get("change_24h", 0),
        "eth_price": eth.get("price", 0),
        "eth_change_24h": eth.get("change_24h", 0),
        "fear_greed_index": fear_index,
        "fear_greed_label": fear_label,
        "total_market_cap_b": round((total_market_cap_usd / 1e9) if total_market_cap_usd else 0, 1),
        "btc_dominance": round(btc_dominance, 1),
        "total_volume_24h_b": round((total_volume_usd / 1e9) if total_volume_usd else 0, 1),
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "extreme_funding": [],
        "generated": datetime.now(timezone.utc).isoformat(),
    }


# --- Macro Economic Indicators (CNBC primary + FRED fallback for Fed Rate) ---

CNBC_QUOTE_URL = (
    "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol"
    "?symbols={symbols}&requestMethod=itv&no498498=1&partnerId=2"
    "&fund=1&exthrs=1&output=json"
)

# 7 indicators via CNBC batch (1 HTTP call)
CNBC_INDICATORS = [
    {"symbol": ".SPX", "name": "S&P 500", "unit": "Index", "id": "SPX"},
    {"symbol": ".IXIC", "name": "Nasdaq", "unit": "Index", "id": "IXIC"},
    {"symbol": ".DXY", "name": "DXY (US Dollar)", "unit": "Index", "id": "DXY"},
    {"symbol": "US10Y", "name": "US 10Y Treasury", "unit": "%", "id": "US10Y"},
    {"symbol": "US2Y", "name": "US 2Y Treasury", "unit": "%", "id": "US2Y"},
    {"symbol": ".VIX", "name": "VIX", "unit": "Index", "id": "VIX"},
    {"symbol": "@GC.1", "name": "Gold", "unit": "USD", "id": "GOLD"},
]

# Fed Rate only from FRED (CNBC doesn't have this ticker)
FRED_FED_RATE = {"id": "DFF", "name": "Fed Funds Rate", "unit": "%", "source": "FRED"}


def fetch_cnbc_quotes() -> list[dict]:
    """Fetch all macro indicators from CNBC in a single batch call."""
    symbols = "|".join(ind["symbol"] for ind in CNBC_INDICATORS)
    url = CNBC_QUOTE_URL.format(symbols=symbols)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        data = json.loads(resp.read())
        quotes = data.get("FormattedQuoteResult", {}).get("FormattedQuote", [])
        if isinstance(quotes, dict):
            quotes = [quotes]
        return quotes
    except Exception as e:
        print(f"  WARN: CNBC fetch failed: {e}")
        return []


def _parse_cnbc_value(raw: str) -> Optional[float]:
    """Parse CNBC value string like '6,909.51' or '4.086%' to float."""
    if not raw:
        return None
    cleaned = raw.replace(",", "").replace("%", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def fetch_fred_series(series_id: str) -> Optional[dict]:
    """Fetch latest value from FRED public CSV endpoint (no API key needed)."""
    end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}&coed={end}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        text = resp.read().decode("utf-8").strip()
        lines = text.split("\n")
        if len(lines) < 2:
            return None
        latest_line = None
        prev_line = None
        for line in reversed(lines):
            parts = line.strip().split(",")
            if len(parts) == 2 and parts[1] not in (".", ""):
                if latest_line is None:
                    latest_line = parts
                elif prev_line is None:
                    prev_line = parts
                    break
        if not latest_line:
            return None
        result = {"value": float(latest_line[1]), "updated": latest_line[0]}
        if prev_line:
            result["previous"] = float(prev_line[1])
        return result
    except Exception as e:
        print(f"  WARN: FRED fetch failed for {series_id}: {e}")
        return None


def build_macro_json() -> dict:
    """Build macro.json from CNBC (primary) + FRED (Fed Rate only)."""
    indicators = []

    # 1. CNBC batch: 7 indicators in 1 call
    print("  Fetching CNBC macro indicators (batch)...")
    quotes = fetch_cnbc_quotes()
    symbol_map = {ind["symbol"]: ind for ind in CNBC_INDICATORS}

    for q in quotes:
        sym = q.get("symbol", "")
        ind = symbol_map.get(sym)
        if not ind:
            continue
        value = _parse_cnbc_value(q.get("last", ""))
        change = _parse_cnbc_value(q.get("change", ""))
        if value is not None:
            indicators.append({
                "id": ind["id"],
                "name": ind["name"],
                "value": value,
                "change": change,
                "unit": ind["unit"],
                "updated": q.get("last_timedate", ""),
                "source": "CNBC",
            })
    print(f"  Got {len(indicators)}/7 CNBC indicators")

    # 2. FRED: Fed Funds Rate only (changes ~8x/year at FOMC)
    print("  Fetching Fed Funds Rate from FRED...")
    fed = fetch_fred_series(FRED_FED_RATE["id"])
    if fed:
        indicators.append({
            "id": FRED_FED_RATE["id"],
            "name": FRED_FED_RATE["name"],
            "value": fed["value"],
            "change": round(fed["value"] - fed.get("previous", fed["value"]), 3) if fed.get("previous") else None,
            "unit": FRED_FED_RATE["unit"],
            "updated": fed.get("updated", ""),
            "source": "FRED",
        })
        print(f"  Fed Rate: {fed['value']}%")

    return {
        "indicators": indicators,
        "generated": datetime.now(timezone.utc).isoformat(),
    }


# --- RSS News Aggregation ---

RSS_FEEDS = [
    # Crypto news
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss", "crypto"),
    ("CoinTelegraph", "https://cointelegraph.com/rss", "crypto"),
    ("Decrypt", "https://decrypt.co/feed", "crypto"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/feed", "crypto"),
    # Macro economic news
    ("Bloomberg", "https://feeds.bloomberg.com/business/news.rss", "macro"),
    ("CNBC Economy", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", "macro"),
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/", "macro"),
]


def _parse_pub_date(raw: str) -> str:
    """Parse various RSS date formats into ISO 8601 string."""
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw)
        return dt.isoformat()
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    return raw


def parse_rss_feed(source: str, url: str, category: str) -> list[dict]:
    """Parse a single RSS feed into news items."""
    items = []
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=10)
        text = resp.read().decode("utf-8", errors="replace")
        root = ET.fromstring(text)

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        rss_items = root.findall(".//item")
        if not rss_items:
            rss_items = root.findall(".//atom:entry", ns)

        for item in rss_items[:15]:
            title = item.findtext("title") or item.findtext("atom:title", namespaces=ns) or ""
            link = item.findtext("link") or ""
            if not link:
                link_el = item.find("atom:link", ns)
                link = link_el.get("href", "") if link_el is not None else ""
            published_raw = item.findtext("pubDate") or item.findtext("atom:published", namespaces=ns) or ""
            published = _parse_pub_date(published_raw)
            desc = item.findtext("description") or item.findtext("atom:summary", namespaces=ns) or ""
            if "<" in desc:
                desc = desc[:desc.find("<")]
            desc = desc.strip()[:200]

            if title and link:
                items.append({
                    "title": title.strip(),
                    "link": link.strip(),
                    "source": source,
                    "category": category,
                    "published": published,
                    "summary": desc,
                })
    except Exception as e:
        print(f"  WARN: RSS fetch failed for {source}: {e}")
    return items


def build_news_json() -> dict:
    """Build news.json from all RSS feeds (crypto + macro)."""
    print("  Fetching RSS news feeds...")
    all_items = []
    for source, url, category in RSS_FEEDS:
        items = parse_rss_feed(source, url, category)
        all_items.extend(items)
        print(f"    {source}: {len(items)} items")

    all_items.sort(key=lambda x: x.get("published", ""), reverse=True)
    print(f"  Total news: {len(all_items)} items ({sum(1 for i in all_items if i['category']=='crypto')} crypto, {sum(1 for i in all_items if i['category']=='macro')} macro)")

    return {
        "items": all_items[:60],
        "generated": datetime.now(timezone.utc).isoformat(),
    }


def main():
    print(f"=== PRUVIQ Static Refresh — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")

    # 1. Fetch CoinGecko market data (PRIMARY source)
    cg_coins = fetch_coingecko_markets()
    if not cg_coins:
        print("WARN: CoinGecko unavailable. Keeping existing stale files (next cron will retry).")
        # Still refresh macro + news (independent of CoinGecko)
        macro_json = build_macro_json()
        if macro_json:
            (OUTPUT_DIR / "macro.json").write_text(json.dumps(macro_json, ensure_ascii=False))
            print("  Updated macro.json (FRED + stale coins)")
        news_json = build_news_json()
        if news_json:
            (OUTPUT_DIR / "news.json").write_text(json.dumps(news_json, ensure_ascii=False))
            print("  Updated news.json (RSS)")
        sys.exit(0)  # exit 0 so cron doesn't spam error logs

    # 2. Fetch global data
    # Wait longer between markets and global to avoid CoinGecko rate limits on free tier
    time.sleep(12)
    global_data = fetch_global_data()

    # 3. Fetch Fear & Greed
    fear_index, fear_label = fetch_fear_greed()
    print(f"  Fear & Greed: {fear_index} ({fear_label})")

    # 4. Load strategy stats (generated daily by full_pipeline.sh)
    strategy_stats = load_strategy_stats()

    # 5. Build coins list (CoinGecko + strategy overlay)
    coins = build_coins_list(cg_coins, strategy_stats)

    # 6. Write coins-stats.json
    strategies_meta = strategy_stats.get("strategies_meta", {
        "bb-squeeze-short": {"name": "BB Squeeze SHORT", "direction": "short",
                             "params": {"sl_pct": 10.0, "tp_pct": 8.0}}
    })
    output = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_strategies": len(strategies_meta),
        "strategies_meta": strategies_meta,
        "total_coins": len(coins),
        "coins": coins,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    coins_path = OUTPUT_DIR / "coins-stats.json"
    with open(coins_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    print(f"  Wrote {coins_path} ({coins_path.stat().st_size / 1024:.1f} KB)")

    # 7. Write market.json
    market = build_market_json(global_data, fear_index, fear_label, coins)
    market_path = OUTPUT_DIR / "market.json"
    with open(market_path, "w") as f:
        json.dump(market, f, separators=(",", ":"))
    print(f"  Wrote {market_path} ({market_path.stat().st_size / 1024:.1f} KB)")

    # 8. Write macro.json (FRED indicators)
    macro = build_macro_json()
    macro_path = OUTPUT_DIR / "macro.json"
    with open(macro_path, "w") as f:
        json.dump(macro, f, separators=(",", ":"))
    print(f"  Wrote {macro_path} ({macro_path.stat().st_size / 1024:.1f} KB)")

    # 9. Write news.json (crypto + macro RSS)
    news = build_news_json()
    news_path = OUTPUT_DIR / "news.json"
    with open(news_path, "w") as f:
        json.dump(news, f, separators=(",", ":"))
    print(f"  Wrote {news_path} ({news_path.stat().st_size / 1024:.1f} KB)")

    print("=== Done ===")


if __name__ == "__main__":
    main()
