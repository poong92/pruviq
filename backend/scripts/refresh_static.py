#!/usr/bin/env python3
"""
PRUVIQ — Static Data Refresher (v0.2.2 — Binance-first)

PRIMARY: Binance Futures ticker API (575 coins, unlimited, no API key)
SECONDARY: CoinGecko (logos, market cap, sparklines — supplementary only)

This ensures the coin list exactly matches our detail pages (coin-symbols.ts)
and eliminates 404s caused by CoinGecko↔Binance symbol mismatches.

Called every HOUR by cron via refresh_static.sh.
Binance ticker: unlimited free API (no key needed, PUBLIC endpoint, weight 40)
CoinGecko Free API: ~2,160 calls/month (3 calls x 1/hr x 24hr x 30d)

NOTE: Binance Futures PUBLIC API does NOT affect AutoTrader bot.
  - Different hosts: Mac Mini (internal LAN) vs DO server (public)
  - AutoTrader uses Private API (different endpoints, different rate limits)
  - Weight budget: 40/2400 per minute = 1.7% (negligible)

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
import defusedxml.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Optional

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = REPO_DIR / "public" / "data"
COIN_SYMBOLS_TS = REPO_DIR / "src" / "data" / "coin-symbols.ts"
COIN_METADATA = OUTPUT_DIR / "coin-metadata.json"  # fallback names/logos when CoinGecko is down

# Binance Spot API (PRIMARY — unlimited, no key needed)
# Changed from Futures (fapi) to Spot (api) for dashboard consistency
BINANCE_SPOT_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr"
# Futures fallback for coins not listed on Spot (e.g. KASUSDT, TRUMPUSDT, 1000RATSUSDT...)
BINANCE_FUTURES_TICKER_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr"

# Spot symbol → internal (futures-style) symbol mapping for 1000x coins
SPOT_TO_INTERNAL = {
    "SHIBUSDT": "1000SHIBUSDT", "PEPEUSDT": "1000PEPEUSDT",
    "FLOKIUSDT": "1000FLOKIUSDT", "BONKUSDT": "1000BONKUSDT",
    "SATSUSDT": "1000SATSUSDT", "RATSUSDT": "1000RATSUSDT",
    "LUNCUSDT": "1000LUNCUSDT", "XECUSDT": "1000XECUSDT",
    "CATUSDT": "1000CATUSDT", "WHYUSDT": "1000WHYUSDT",
    "CHEEMSUSDT": "1000CHEEMSUSDT",
    "MOGUSDT": "1000000MOGUSDT", "BOBUSDT": "1000000BOBUSDT",
    "BABYDOGEUSDT": "1MBABYDOGEUSDT",
}
SPOT_MULTIPLIER: dict[str, int] = {k: 1000 for k in [
    "SHIBUSDT", "PEPEUSDT", "FLOKIUSDT", "BONKUSDT", "SATSUSDT",
    "RATSUSDT", "LUNCUSDT", "XECUSDT", "CATUSDT", "WHYUSDT", "CHEEMSUSDT",
]}
SPOT_MULTIPLIER.update({"MOGUSDT": 1_000_000, "BOBUSDT": 1_000_000, "BABYDOGEUSDT": 1_000_000})

# CoinGecko Free API (SECONDARY — logos, market cap, sparklines)
CG_BASE = "https://api.coingecko.com/api/v3"
CG_MARKETS = f"{CG_BASE}/coins/markets"
CG_GLOBAL = f"{CG_BASE}/global"
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"

HEADERS = {"User-Agent": "PRUVIQ/1.0 (https://pruviq.com)"}
TIMEOUT = 15


def fetch_json(url: str, max_retries: int = 1) -> Optional[dict]:
    """Fetch JSON from URL with error handling and 429 backoff."""
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            resp = urllib.request.urlopen(req, timeout=TIMEOUT)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries:
                retry_after = int(e.headers.get("Retry-After", 30))
                wait = max(retry_after, 15) * (2 ** attempt)
                short_url = url.split("?")[0]
                print(f"  WARN: 429 on {short_url}, waiting {wait}s ({attempt+1}/{max_retries+1})")
                time.sleep(wait)
                continue
            print(f"  WARN: Failed to fetch {url}: {e}")
            return None
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            print(f"  WARN: Failed to fetch {url}: {e}")
            return None
    return None


def load_coin_metadata() -> dict[str, dict]:
    """Load static coin metadata (names/logos) as fallback when CoinGecko is down."""
    if COIN_METADATA.exists():
        try:
            return json.loads(COIN_METADATA.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_coin_metadata(coins: list[dict]) -> None:
    """Update coin-metadata.json with latest CoinGecko names/logos."""
    metadata = {}
    for c in coins:
        if c.get("name") and c.get("image"):
            metadata[c["symbol"]] = {"name": c["name"], "image": c["image"]}
    if metadata:
        COIN_METADATA.write_text(json.dumps(metadata, separators=(",", ":")))
        print(f"  Updated coin-metadata.json ({len(metadata)} coins)")


def load_coin_symbols() -> list[str]:
    """Load USDT futures symbols from coin-symbols.ts (source of truth for pages)."""
    if not COIN_SYMBOLS_TS.exists():
        print("  WARN: coin-symbols.ts not found, using Binance ticker symbols")
        return []
    text = COIN_SYMBOLS_TS.read_text()
    import re
    return re.findall(r"'([A-Z0-9]+USDT)'", text)


def fetch_binance_tickers() -> list[dict]:
    """Fetch USDT tickers: Spot (primary) + Futures fallback for Spot-missing coins.

    Applies SPOT_TO_INTERNAL reverse mapping so that Spot symbols (SHIBUSDT)
    become internal symbols (1000SHIBUSDT) with price × multiplier.
    Futures-only coins (KASUSDT, TRUMPUSDT, etc.) are fetched via Futures API
    to avoid price=0 gaps. Total weight: 40 (Spot) + 40 (Futures) = 80.
    """
    print("  Fetching Binance Spot tickers...")
    data = fetch_json(BINANCE_SPOT_TICKER_URL)
    if not data or not isinstance(data, list):
        print("  ERROR: Binance Spot ticker API failed")
        return []
    # Filter USDT pairs, remap 1000x symbols
    usdt_tickers = []
    spot_internal_symbols: set[str] = set()
    for t in data:
        sym = t.get("symbol", "")
        if not sym.endswith("USDT"):
            continue
        mul = SPOT_MULTIPLIER.get(sym, 1)
        mapped_sym = SPOT_TO_INTERNAL.get(sym, sym)
        ticker = dict(t)
        ticker["symbol"] = mapped_sym
        # NOTE: Only lastPrice needs multiplier. priceChangePercent is %, quoteVolume is USDT.
        if mul != 1:
            ticker["lastPrice"] = str(float(t.get("lastPrice", 0)) * mul)
        usdt_tickers.append(ticker)
        spot_internal_symbols.add(mapped_sym)
    print(f"  Got {len(usdt_tickers)} USDT tickers from Binance Spot")

    # Futures fallback: fill gaps for Futures-only symbols
    our_symbols = load_coin_symbols()
    if our_symbols:
        missing = set(our_symbols) - spot_internal_symbols
        if missing:
            print(f"  {len(missing)} symbols missing from Spot, fetching Futures fallback...")
            futures_data = fetch_json(BINANCE_FUTURES_TICKER_URL)
            if futures_data and isinstance(futures_data, list):
                added = 0
                for t in futures_data:
                    sym = t.get("symbol", "")
                    if sym in missing:
                        usdt_tickers.append(t)
                        added += 1
                print(f"  Added {added}/{len(missing)} from Futures fallback")

    return usdt_tickers


def fetch_coingecko_markets(max_retries: int = 2) -> list[dict]:
    """Fetch top 500 coins from CoinGecko (SECONDARY — logos, market cap, sparklines)."""
    for attempt in range(max_retries + 1):
        all_coins = []
        for page in [1, 2, 3]:
            url = (
                f"{CG_MARKETS}?vs_currency=usd&order=market_cap_desc"
                f"&per_page=250&page={page}&sparkline=true"
                f"&price_change_percentage=1h,24h,7d"
            )
            print(f"  Fetching CoinGecko markets page {page} (attempt {attempt+1})...")
            data = fetch_json(url, max_retries=2)
            if data:
                all_coins.extend(data)
            else:
                print(f"  WARN: Page {page} failed")
            time.sleep(15)  # CoinGecko free tier: ~10 calls/min
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
    data = fetch_json(CG_GLOBAL, max_retries=2)
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


def downsample_sparkline(prices: list[float], target: int = 12) -> list[float]:
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
    metadata: dict[str, dict] | None = None,
) -> list[dict]:
    """Build coins list: Binance tickers (PRIMARY) + CoinGecko (logos/mcap).

    Each coin gets:
    - Binance: price, 24h change, volume (real-time, all 575 coins)
    - CoinGecko: name, logo, market_cap, sparkline, 1h/7d change (when matched)
    - Metadata fallback: name, logo from coin-metadata.json (when CoinGecko is down)
    """
    # Index Binance tickers by symbol
    bn_by_sym = {t["symbol"]: t for t in binance_tickers}
    metadata = metadata or {}

    coins = []
    cg_merged = 0

    for sym in our_symbols:
        bn = bn_by_sym.get(sym, {})
        cg = cg_lookup.get(sym)
        meta = metadata.get(sym, {})

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
        elif meta:
            # Fallback: use cached metadata for name/image when CoinGecko is down
            name = meta.get("name", "")
            image = meta.get("image", "")

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
        print("ERROR: Binance unavailable. market.json NOT updated.")
        # Still refresh macro + news
        macro_json = build_macro_json()
        if macro_json:
            (OUTPUT_DIR / "macro.json").write_text(json.dumps(macro_json, ensure_ascii=False))
        news_json = build_news_json()
        if news_json:
            (OUTPUT_DIR / "news.json").write_text(json.dumps(news_json, ensure_ascii=False))
        sys.exit(1)

    # If no coin-symbols.ts, use all Binance USDT symbols
    if not our_symbols:
        our_symbols = sorted(t["symbol"] for t in binance_tickers)

    # 3. Load cached metadata (fallback for when CoinGecko is down)
    metadata = load_coin_metadata()
    if metadata:
        print(f"  Loaded coin-metadata.json ({len(metadata)} cached names/logos)")

    # 4. Fetch CoinGecko (SECONDARY — logos, market cap, sparklines)
    cg_coins = fetch_coingecko_markets()
    cg_lookup = build_coingecko_lookup(cg_coins) if cg_coins else {}

    # Try to improve coverage for low-cap coins by using CoinGecko /coins/list (cached weekly)
    def fetch_coingecko_all_ids(cache_days: int = 7) -> list[dict]:
        # Write the heavy CoinGecko /coins/list cache to repo-root data_cache/ so
        # it does not get copied to public/ or dist/ (avoid bloating deployed assets).
        CACHE_DIR = REPO_DIR / "data_cache"
        CACHE = CACHE_DIR / "coingecko-coins-list.json"
        try:
            if CACHE.exists():
                mtime = datetime.fromtimestamp(CACHE.stat().st_mtime, timezone.utc)
                if datetime.now(timezone.utc) - mtime < timedelta(days=cache_days):
                    print(f"  Loaded CoinGecko coin-list cache ({CACHE})")
                    return json.loads(CACHE.read_text())
        except Exception:
            pass
        print("  Fetching CoinGecko /coins/list (cached weekly)...")
        url = f"{CG_BASE}/coins/list"
        data = fetch_json(url)
        if data:
            try:
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                CACHE.write_text(json.dumps(data, separators=(',', ':')))
                print(f"  Saved coin-list ({len(data)} items) to {CACHE}")
            except Exception as e:
                print(f"  WARN: Failed to write coin-list cache: {e}")
        return data or []

    # If coverage is low (<75%), try an expansion step:
    if len(our_symbols) > 0:
        matched = sum(1 for s in our_symbols if cg_lookup.get(s))
        match_rate = matched / len(our_symbols)
        print(f"  CoinGecko initial match: {matched}/{len(our_symbols)} ({match_rate:.2%})")
        if match_rate < 0.75:
            coin_list = fetch_coingecko_all_ids()
            if coin_list:
                # build symbol->ids map
                sym_to_ids: dict[str, list[str]] = {}
                for c in coin_list:
                    sym = c.get("symbol", "")
                    cid = c.get("id")
                    if not sym or not cid:
                        continue
                    sym_to_ids.setdefault(sym.lower(), []).append(cid)
                ids_to_fetch = set()
                unmatched = []
                for s in our_symbols:
                    if cg_lookup.get(s):
                        continue
                    base = s.replace("USDT", "").lower()
                    ids = sym_to_ids.get(base)
                    if ids:
                        ids_to_fetch.update(ids)
                        unmatched.append(s)
                if ids_to_fetch:
                    ids_list = list(ids_to_fetch)
                    print(f"  Fetching CoinGecko markets for {len(ids_list)} candidate ids to improve matching (unmatched: {len(unmatched)})...")
                    for i in range(0, len(ids_list), 250):
                        chunk = ids_list[i:i+250]
                        ids_param = ",".join(chunk)
                        url = (
                            f"{CG_MARKETS}?vs_currency=usd&order=market_cap_desc&ids={ids_param}"
                            f"&per_page=250&page=1&sparkline=true&price_change_percentage=1h,24h,7d"
                        )
                        data = fetch_json(url, max_retries=2)
                        if data:
                            by_sym = {cg.get("symbol", "").upper(): cg for cg in data if cg.get("symbol")}
                            for sym_upper, cg in by_sym.items():
                                cg_usdt = f"{sym_upper}USDT"
                                if cg_usdt not in cg_lookup:
                                    cg_lookup[cg_usdt] = cg
                        time.sleep(15)  # CoinGecko free tier rate limit
                    matched_after = sum(1 for s in our_symbols if cg_lookup.get(s))
                    print(f"  After expansion, CoinGecko matched {matched_after}/{len(our_symbols)} ({matched_after/len(our_symbols):.2%})")

    # 5. Fetch global data
    if cg_coins:
        time.sleep(12)
    global_data = fetch_global_data()

    # 6. Fetch Fear & Greed
    fear_index, fear_label = fetch_fear_greed()
    print(f"  Fear & Greed: {fear_index} ({fear_label})")

    # 7. Build coins list (Binance + CoinGecko + metadata fallback)
    coins = build_coins_list(our_symbols, binance_tickers, cg_lookup, metadata)
    # Sort by market_cap descending (시총순) — coins without mcap go to the end
    coins.sort(key=lambda c: (c.get("market_cap") or 0), reverse=True)

    # Update metadata cache if CoinGecko succeeded
    if cg_coins:
        save_coin_metadata(coins)

    # 8. Write coins-stats.json
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

    # 9. Write market.json
    market = build_market_json(global_data, fear_index, fear_label, coins)
    market_path = OUTPUT_DIR / "market.json"
    with open(market_path, "w") as f:
        json.dump(market, f, separators=(",", ":"))
    print(f"  Wrote {market_path} ({market_path.stat().st_size / 1024:.1f} KB)")

    # 10. Write macro.json
    macro = build_macro_json()
    macro_path = OUTPUT_DIR / "macro.json"
    with open(macro_path, "w") as f:
        json.dump(macro, f, separators=(",", ":"))
    print(f"  Wrote {macro_path} ({macro_path.stat().st_size / 1024:.1f} KB)")

    # 11. Write news.json
    news = build_news_json()
    news_path = OUTPUT_DIR / "news.json"
    with open(news_path, "w") as f:
        json.dump(news, f, separators=(",", ":"))
    print(f"  Wrote {news_path} ({news_path.stat().st_size / 1024:.1f} KB)")

    print("=== Done ===")


if __name__ == "__main__":
    main()
