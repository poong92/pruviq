#!/usr/bin/env python3
"""
PRUVIQ — Static Data Refresher (v0.2.1 — Binance-first)

PRIMARY: Binance Futures ticker API (575 coins, unlimited, real-time)
SECONDARY: CoinGecko (logos, market cap, sparklines — supplementary only)

This ensures the coin list exactly matches our detail pages (coin-symbols.ts)
and eliminates 404s caused by CoinGecko↔Binance symbol mismatches.

Called every 15 minutes by cron via refresh_static.sh.
Binance ticker: unlimited free API (no key needed)
CoinGecko Free API: ~8,640 calls/month (3 calls x 4/hr x 24hr x 30d)

Output:
  public/data/coins-stats.json  — market data (prices, volume, market cap)
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
COIN_SYMBOLS_TS = REPO_DIR / "src" / "data" / "coin-symbols.ts"

# Binance Futures API (PRIMARY — unlimited, no key needed)
BINANCE_TICKER_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr"

# CoinGecko Free API (SECONDARY — logos, market cap, sparklines)
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


def load_coin_symbols() -> list[str]:
    """Load USDT futures symbols from coin-symbols.ts (source of truth for pages)."""
    if not COIN_SYMBOLS_TS.exists():
        print("  WARN: coin-symbols.ts not found, using Binance ticker symbols")
        return []
    text = COIN_SYMBOLS_TS.read_text()
    import re
    return re.findall(r"'([A-Z0-9]+USDT)'", text)


def fetch_binance_tickers() -> list[dict]:
    """Fetch all USDT futures tickers from Binance (1 API call, unlimited)."""
    print("  Fetching Binance Futures tickers...")
    data = fetch_json(BINANCE_TICKER_URL)
    if not data or not isinstance(data, list):
        print("  ERROR: Binance ticker API failed")
        return []
    # Filter USDT pairs only
    usdt_tickers = [t for t in data if t.get("symbol", "").endswith("USDT")]
    print(f"  Got {len(usdt_tickers)} USDT tickers from Binance")
    return usdt_tickers


def fetch_coingecko_markets(max_retries: int = 2) -> list[dict]:
    """Fetch top 500 coins from CoinGecko (SECONDARY — logos, market cap, sparklines)."""
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
            print(f"  Got {len(all_coins)} coins from CoinGecko (supplementary)")
            return all_coins
        if attempt < max_retries:
            wait = 30 * (attempt + 1)
            print(f"  WARN: CoinGecko returned 0 coins, retrying in {wait}s...")
            time.sleep(wait)
    print("  WARN: CoinGecko unavailable — coins will lack logos/market cap/sparklines")
    return []


def build_coingecko_lookup(cg_coins: list[dict]) -> dict[str, dict]:
    """Build symbol→CoinGecko data lookup for merging into Binance-based list.

    Maps CoinGecko symbols (BTC, ETH) to Binance futures symbols (BTCUSDT).
    Handles special cases like 1000SHIB, 1000PEPE etc.
    """
    # First pass: simple symbol→data mapping
    by_symbol = {}  # e.g. "BTC" → cg_data
    for cg in cg_coins:
        sym = cg.get("symbol", "").upper()
        if sym:
            by_symbol[sym] = cg

    # Build BTCUSDT→cg_data lookup
    lookup = {}  # "BTCUSDT" → cg_data

    # Direct mapping: BTC → BTCUSDT
    for sym, cg in by_symbol.items():
        usdt_sym = f"{sym}USDT"
        lookup[usdt_sym] = cg

    # Special 1000x multiplier coins: SHIB → 1000SHIBUSDT, PEPE → 1000PEPEUSDT etc.
    multiplier_map = {
        "SHIB": "1000SHIBUSDT",
        "PEPE": "1000PEPEUSDT",
        "FLOKI": "1000FLOKIUSDT",
        "BONK": "1000BONKUSDT",
        "SATS": "1000SATSUSDT",
        "RATS": "1000RATSUSDT",
        "LUNC": "1000LUNCUSDT",
        "XEC": "1000XECUSDT",
        "CAT": "1000CATUSDT",
        "WHY": "1000WHYUSDT",
        "CHEEMS": "1000CHEEMSUSDT",
        "MOG": "1000000MOGUSDT",
        "BOB": "1000000BOBUSDT",
        "BABYDOGE": "1MBABYDOGEUSDT",
    }
    for cg_sym, binance_sym in multiplier_map.items():
        if cg_sym in by_symbol:
            lookup[binance_sym] = by_symbol[cg_sym]

    return lookup


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


def build_coins_list(
    our_symbols: list[str],
    binance_tickers: list[dict],
    cg_lookup: dict[str, dict],
) -> list[dict]:
    """Build coins list: Binance tickers (PRIMARY) + CoinGecko (logos/mcap).

    Each coin gets:
    - Binance: price, 24h change, volume (real-time, all 575 coins)
    - CoinGecko: name, logo, market_cap, sparkline, 1h/7d change (when matched)
    """
    # Index Binance tickers by symbol
    bn_by_sym = {t["symbol"]: t for t in binance_tickers}

    coins = []
    cg_merged = 0

    for sym in our_symbols:
        bn = bn_by_sym.get(sym, {})
        cg = cg_lookup.get(sym)

        # Price: Binance is authoritative (futures mark price)
        price = float(bn.get("lastPrice", 0)) if bn else 0
        change_24h = float(bn.get("priceChangePercent", 0)) if bn else 0
        volume_24h = float(bn.get("quoteVolume", 0)) if bn else 0  # USDT volume

        # CoinGecko supplementary data (may be None)
        name = ""
        image = ""
        market_cap = 0
        market_cap_rank = None
        change_1h = 0
        change_7d = 0
        sparkline_7d: list[float] = []

        if cg:
            cg_merged += 1
            name = cg.get("name", "")
            image = cg.get("image", "")
            market_cap = cg.get("market_cap", 0) or 0
            market_cap_rank = cg.get("market_cap_rank")
            change_1h = round(cg.get("price_change_percentage_1h_in_currency", 0) or 0, 2)
            change_7d = round(cg.get("price_change_percentage_7d_in_currency", 0) or 0, 2)
            sparkline_raw = cg.get("sparkline_in_7d", {}).get("price", [])
            sparkline_7d = downsample_sparkline(sparkline_raw)

        coin = {
            "symbol": sym,  # BTCUSDT format (matches detail pages)
            "name": name,
            "image": image,
            "price": price,
            "change_1h": change_1h,
            "change_24h": round(change_24h, 2),
            "change_7d": change_7d,
            "market_cap": market_cap,
            "market_cap_rank": market_cap_rank,
            "volume_24h": round(volume_24h, 2),
            "sparkline_7d": sparkline_7d,
        }

        coins.append(coin)

    print(f"  Built {len(coins)} coins: CoinGecko matched {cg_merged}")
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

    btc = next((c for c in coins if c["symbol"] == "BTCUSDT"), {})
    eth = next((c for c in coins if c["symbol"] == "ETHUSDT"), {})

    # Fallback calculations when global_data is unavailable
    if global_data:
        total_market_cap_usd = global_data.get("total_market_cap", {}).get("usd", 0)
        total_volume_usd = global_data.get("total_volume", {}).get("usd", 0)
        btc_dominance = global_data.get("market_cap_percentage", {}).get("btc", 0)
    else:
        total_market_cap_usd = sum(c.get("market_cap", 0) for c in coins)
        total_volume_usd = sum(c.get("volume_24h", 0) for c in coins)
        btc_market_cap = next((c.get("market_cap", 0) for c in coins if c["symbol"] == "BTCUSDT"), 0)
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
    print(f"=== PRUVIQ Static Refresh (Binance-first) — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")

    # 1. Load our coin symbols (source of truth for detail pages)
    our_symbols = load_coin_symbols()
    if not our_symbols:
        print("  WARN: No coin-symbols.ts found, falling back to all Binance USDT futures")

    # 2. Fetch Binance tickers (PRIMARY — unlimited, real-time)
    binance_tickers = fetch_binance_tickers()
    if not binance_tickers:
        print("WARN: Binance unavailable. Keeping existing stale files.")
        # Still refresh macro + news
        macro_json = build_macro_json()
        if macro_json:
            (OUTPUT_DIR / "macro.json").write_text(json.dumps(macro_json, ensure_ascii=False))
        news_json = build_news_json()
        if news_json:
            (OUTPUT_DIR / "news.json").write_text(json.dumps(news_json, ensure_ascii=False))
        sys.exit(0)

    # If no coin-symbols.ts, use all Binance USDT symbols
    if not our_symbols:
        our_symbols = sorted(t["symbol"] for t in binance_tickers)

    # 3. Fetch CoinGecko (SECONDARY — logos, market cap, sparklines)
    cg_coins = fetch_coingecko_markets()
    cg_lookup = build_coingecko_lookup(cg_coins) if cg_coins else {}

    # 4. Fetch global data
    if cg_coins:
        time.sleep(12)
    global_data = fetch_global_data()

    # 5. Fetch Fear & Greed
    fear_index, fear_label = fetch_fear_greed()
    print(f"  Fear & Greed: {fear_index} ({fear_label})")

    # 6. Build coins list (Binance + CoinGecko)
    coins = build_coins_list(our_symbols, binance_tickers, cg_lookup)

    # 7. Write coins-stats.json
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

    # 8. Write market.json
    market = build_market_json(global_data, fear_index, fear_label, coins)
    market_path = OUTPUT_DIR / "market.json"
    with open(market_path, "w") as f:
        json.dump(market, f, separators=(",", ":"))
    print(f"  Wrote {market_path} ({market_path.stat().st_size / 1024:.1f} KB)")

    # 9. Write macro.json
    macro = build_macro_json()
    macro_path = OUTPUT_DIR / "macro.json"
    with open(macro_path, "w") as f:
        json.dump(macro, f, separators=(",", ":"))
    print(f"  Wrote {macro_path} ({macro_path.stat().st_size / 1024:.1f} KB)")

    # 10. Write news.json
    news = build_news_json()
    news_path = OUTPUT_DIR / "news.json"
    with open(news_path, "w") as f:
        json.dump(news, f, separators=(",", ":"))
    print(f"  Wrote {news_path} ({news_path.stat().st_size / 1024:.1f} KB)")

    print("=== Done ===")


if __name__ == "__main__":
    main()
