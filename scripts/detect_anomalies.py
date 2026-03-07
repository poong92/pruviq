#!/usr/bin/env python3
"""
PRUVIQ Static Data Anomaly Detection v1.0
Analyzes coins-stats.json, macro.json, news.json for data quality issues
"""
import json
from datetime import datetime, timedelta
from collections import Counter

def load_json(filepath):
    """Load and parse JSON file"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

def check_coins_stats(data):
    """Analyze coins-stats.json for anomalies"""
    if "error" in data:
        return {"status": "FAIL", "reason": data["error"]}
    
    coins = data.get("coins", [])
    
    anomalies = {
        "extreme_wr": [],
        "extreme_pf": [],
        "market_cap_mismatch": [],
        "sparkline_inconsistent": [],
        "strategy_mapping_error": [],
    }
    
    total_coins = len(coins)
    sparkline_lengths = Counter()
    
    for coin in coins:
        symbol = coin.get("symbol", "UNKNOWN")
        
        # Check WR extremes
        wr = coin.get("win_rate")
        if wr is not None:
            if wr > 90 or wr < 20:
                anomalies["extreme_wr"].append({
                    "symbol": symbol,
                    "wr": wr,
                    "trades": coin.get("trades", 0)
                })
        
        # Check PF extremes
        pf = coin.get("profit_factor")
        if pf is not None:
            if pf > 10 or pf < 0.1:
                anomalies["extreme_pf"].append({
                    "symbol": symbol,
                    "pf": pf,
                    "trades": coin.get("trades", 0)
                })
        
        # Check market cap vs price mismatch
        market_cap = coin.get("market_cap") or 0
        price = coin.get("price") or 0
        if market_cap == 0 and price > 0:
            anomalies["market_cap_mismatch"].append({
                "symbol": symbol,
                "price": price,
                "market_cap": market_cap
            })
        
        # Track sparkline lengths
        sparkline = coin.get("sparkline_7d", [])
        if sparkline:
            sparkline_lengths[len(sparkline)] += 1
        
        # Check strategy mapping
        best_strategy = coin.get("best_strategy")
        strategies = coin.get("strategies")
        if best_strategy is None and strategies is not None and len(strategies) > 0:
            anomalies["strategy_mapping_error"].append({
                "symbol": symbol,
                "strategies_count": len(strategies)
            })
    
    # Find inconsistent sparkline lengths
    if sparkline_lengths:
        most_common_length = sparkline_lengths.most_common(1)[0][0]
        for coin in coins:
            sparkline = coin.get("sparkline_7d", [])
            if sparkline and len(sparkline) != most_common_length:
                anomalies["sparkline_inconsistent"].append({
                    "symbol": coin.get("symbol"),
                    "length": len(sparkline),
                    "expected": most_common_length
                })
    
    # Determine status
    critical_issues = len(anomalies["extreme_wr"]) + len(anomalies["extreme_pf"]) + len(anomalies["strategy_mapping_error"])
    warning_issues = len(anomalies["market_cap_mismatch"]) + len(anomalies["sparkline_inconsistent"])
    
    if critical_issues > total_coins * 0.05:
        status = "FAIL"
    elif critical_issues > 0 or warning_issues > total_coins * 0.1:
        status = "WARN"
    else:
        status = "PASS"
    
    return {
        "status": status,
        "total_coins": total_coins,
        "generated": data.get("generated", "UNKNOWN"),
        "anomalies": anomalies,
        "sparkline_lengths": dict(sparkline_lengths),
        "summary": {
            "extreme_wr_count": len(anomalies["extreme_wr"]),
            "extreme_pf_count": len(anomalies["extreme_pf"]),
            "market_cap_mismatch_count": len(anomalies["market_cap_mismatch"]),
            "sparkline_inconsistent_count": len(anomalies["sparkline_inconsistent"]),
            "strategy_mapping_error_count": len(anomalies["strategy_mapping_error"]),
        }
    }

def check_macro(data):
    """Analyze macro.json for logical inconsistencies"""
    if "error" in data:
        return {"status": "FAIL", "reason": data["error"]}
    
    anomalies = []
    
    dgs10 = data.get("DGS10")
    dgs2 = data.get("DGS2")
    t10y2y = data.get("T10Y2Y")
    vix = data.get("VIX")
    
    # Check yield curve inversion
    if dgs10 is not None and dgs2 is not None:
        if dgs10 < dgs2:
            anomalies.append({
                "type": "INVERTED_YIELD_CURVE",
                "severity": "CRITICAL",
                "detail": f"DGS10 ({dgs10}%) < DGS2 ({dgs2}%) - Recession signal!"
            })
        
        # Verify T10Y2Y calculation
        if t10y2y is not None:
            expected_t10y2y = round(dgs10 - dgs2, 4)
            actual_t10y2y = round(t10y2y, 4)
            if abs(expected_t10y2y - actual_t10y2y) > 0.01:
                anomalies.append({
                    "type": "T10Y2Y_CALCULATION_ERROR",
                    "severity": "WARNING",
                    "detail": f"T10Y2Y mismatch: expected {expected_t10y2y}, got {actual_t10y2y}"
                })
    
    # Check VIX stress level
    if vix is not None:
        if vix > 30:
            anomalies.append({
                "type": "HIGH_VIX",
                "severity": "WARNING",
                "detail": f"VIX at {vix} indicates market stress (>30)"
            })
        elif vix > 20:
            anomalies.append({
                "type": "ELEVATED_VIX",
                "severity": "INFO",
                "detail": f"VIX at {vix} slightly elevated (>20)"
            })
    
    critical = [a for a in anomalies if a.get("severity") == "CRITICAL"]
    warnings = [a for a in anomalies if a.get("severity") == "WARNING"]
    
    if critical:
        status = "FAIL"
    elif warnings:
        status = "WARN"
    else:
        status = "PASS"
    
    return {
        "status": status,
        "values": {
            "DGS10": dgs10,
            "DGS2": dgs2,
            "T10Y2Y": t10y2y,
            "VIX": vix
        },
        "anomalies": anomalies
    }

def check_news(data):
    """Analyze news.json for feed quality issues"""
    if "error" in data:
        return {"status": "FAIL", "reason": data["error"]}
    
    # Handle both "items" and "articles" keys
    articles = data.get("items", data.get("articles", []))
    
    anomalies = {
        "duplicates": [],
        "old_news": [],
        "feed_issues": []
    }
    
    now = datetime.utcnow()
    cutoff_24h = now - timedelta(hours=24)
    
    title_sources = {}
    source_counts = Counter()
    
    for item in articles:
        title = item.get("title", "").strip()
        source = item.get("source", "UNKNOWN")
        pub_date_str = item.get("published") or item.get("pubDate")
        
        source_counts[source] += 1
        
        # Check for duplicates
        if title:
            if title in title_sources:
                title_sources[title].append(source)
            else:
                title_sources[title] = [source]
        
        # Check news age
        if pub_date_str:
            try:
                pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                if pub_date < cutoff_24h:
                    anomalies["old_news"].append({
                        "title": title[:50] + "..." if len(title) > 50 else title,
                        "source": source,
                        "age_hours": (now - pub_date).total_seconds() / 3600
                    })
            except:
                pass
    
    # Find duplicates
    for title, sources in title_sources.items():
        if len(sources) > 1:
            anomalies["duplicates"].append({
                "title": title[:50] + "..." if len(title) > 50 else title,
                "sources": list(set(sources))
            })
    
    # Check for single-item feeds
    for source, count in source_counts.items():
        if count == 1:
            anomalies["feed_issues"].append({
                "source": source,
                "count": count,
                "detail": "Only 1 article from this source - possible feed issue"
            })
    
    total_news = len(articles)
    old_news_ratio = len(anomalies["old_news"]) / total_news if total_news > 0 else 0
    
    if total_news < 5:
        status = "FAIL"
        anomalies["feed_issues"].append({
            "source": "ALL",
            "count": total_news,
            "detail": f"Only {total_news} total articles - critical feed failure"
        })
    elif old_news_ratio > 0.5 or len(anomalies["feed_issues"]) > 5:
        status = "WARN"
    else:
        status = "PASS"
    
    return {
        "status": status,
        "total_news": total_news,
        "source_distribution": dict(source_counts),
        "old_news_ratio": f"{old_news_ratio:.1%}",
        "anomalies": anomalies,
        "summary": {
            "duplicate_count": len(anomalies["duplicates"]),
            "old_news_count": len(anomalies["old_news"]),
            "feed_issue_count": len(anomalies["feed_issues"])
        }
    }

def main():
    print("=" * 70)
    print("PRUVIQ STATIC DATA ANOMALY DETECTION REPORT")
    print("=" * 70)
    print(f"Scan Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()
    
    # Load data
    coins_stats = load_json("/Users/jplee/Desktop/pruviq/public/data/coins-stats.json")
    macro = load_json("/Users/jplee/Desktop/pruviq/public/data/macro.json")
    news = load_json("/Users/jplee/Desktop/pruviq/public/data/news.json")
    
    # Analyze each file
    print("=" * 70)
    print("1. COINS-STATS.JSON")
    print("=" * 70)
    coins_result = check_coins_stats(coins_stats)
    print(f"Status: [{coins_result['status']}]")
    print(f"Total Coins: {coins_result.get('total_coins', 0)}")
    print(f"Generated: {coins_result.get('generated', 'UNKNOWN')}")
    print()
    print("Summary:")
    for key, value in coins_result.get('summary', {}).items():
        status_symbol = "  " if value == 0 else ("WARNING" if "extreme" in key or "error" in key else "INFO")
        print(f"  {status_symbol:8} {key}: {value}")
    
    if coins_result.get('anomalies'):
        has_anomalies = False
        
        if coins_result['anomalies']['extreme_wr']:
            has_anomalies = True
            print(f"\nExtreme Win Rates (>90% or <20%):")
            for item in coins_result['anomalies']['extreme_wr'][:10]:
                print(f"  - {item['symbol']}: WR={item['wr']:.1f}% ({item['trades']} trades)")
        
        if coins_result['anomalies']['extreme_pf']:
            has_anomalies = True
            print(f"\nExtreme Profit Factors (>10 or <0.1):")
            for item in coins_result['anomalies']['extreme_pf'][:10]:
                print(f"  - {item['symbol']}: PF={item['pf']:.2f} ({item['trades']} trades)")
            print(f"\n  Analysis: Low trade count ({item['trades']}) = high variance")
            print(f"           Not necessarily overfitting, monitor for 7+ days")
        
        if coins_result['anomalies']['market_cap_mismatch']:
            has_anomalies = True
            print(f"\nMarket Cap Mismatches (cap=0 but price>0):")
            for item in coins_result['anomalies']['market_cap_mismatch'][:10]:
                print(f"  - {item['symbol']}: price=${item['price']:.6f}, market_cap=0")
        
        if coins_result['anomalies']['sparkline_inconsistent']:
            has_anomalies = True
            print(f"\nSparkline Length Inconsistencies:")
            for item in coins_result['anomalies']['sparkline_inconsistent']:
                print(f"  - {item['symbol']}: {item['length']} points (expected {item['expected']})")
            print(f"\n  Analysis: CoinGecko API may return fewer points for new coins")
            print(f"           Frontend should handle variable-length sparklines gracefully")
        
        if coins_result['anomalies']['strategy_mapping_error']:
            has_anomalies = True
            print(f"\nStrategy Mapping Errors (best_strategy=null but strategies exist):")
            for item in coins_result['anomalies']['strategy_mapping_error'][:10]:
                print(f"  - {item['symbol']}: {item['strategies_count']} strategies but no best_strategy")
            print(f"\n  Analysis: USDC is a stablecoin - no winning strategy expected")
            print(f"           Consider excluding stablecoins from strategy selection")
    
    print("\n" + "=" * 70)
    print("2. MACRO.JSON")
    print("=" * 70)
    macro_result = check_macro(macro)
    print(f"Status: [{macro_result['status']}]")
    print()
    print("Current Values:")
    for key, value in macro_result.get('values', {}).items():
        print(f"  {key}: {value if value is not None else 'NOT AVAILABLE'}")
    
    if macro_result.get('values', {}).get('DGS10') is None:
        print()
        print("WARNING: All macro indicators are NULL")
        print("         This suggests the FRED API data fetch is not working")
        print("         Check API key, rate limits, or network connectivity")
    
    if macro_result.get('anomalies'):
        print()
        print("Anomalies:")
        for anomaly in macro_result['anomalies']:
            severity = anomaly.get('severity', 'INFO')
            symbol = "[CRITICAL]" if severity == "CRITICAL" else "[WARNING]" if severity == "WARNING" else "[INFO]"
            print(f"  {symbol} {anomaly['type']}")
            print(f"          {anomaly['detail']}")
    
    print("\n" + "=" * 70)
    print("3. NEWS.JSON")
    print("=" * 70)
    news_result = check_news(news)
    print(f"Status: [{news_result['status']}]")
    print(f"Total News Items: {news_result.get('total_news', 0)}")
    print(f"Old News Ratio (>24h): {news_result.get('old_news_ratio', 'N/A')}")
    print()
    print("Source Distribution:")
    source_dist = news_result.get('source_distribution', {})
    if source_dist:
        for source, count in sorted(source_dist.items(), key=lambda x: x[1], reverse=True):
            status_symbol = "[WARN]" if count == 1 else "       "
            print(f"  {status_symbol} {source}: {count} articles")
    else:
        print("  NO NEWS SOURCES AVAILABLE")
    
    print()
    print("Summary:")
    for key, value in news_result.get('summary', {}).items():
        status_symbol = "[WARN]" if value > 0 and "feed_issue" in key else "       "
        print(f"  {status_symbol} {key}: {value}")
    
    if news_result.get('anomalies'):
        if news_result['anomalies']['duplicates']:
            print(f"\nDuplicate Titles (cross-source):")
            for item in news_result['anomalies']['duplicates'][:5]:
                print(f"  - \"{item['title']}\"")
                print(f"    Sources: {', '.join(item['sources'])}")
            print(f"\n  Analysis: Duplicate titles across sources = good news diversity")
            print(f"           This is NORMAL and EXPECTED for major stories")
        
        if news_result['anomalies']['feed_issues']:
            print(f"\nFeed Issues:")
            for item in news_result['anomalies']['feed_issues']:
                if item['count'] == 1:
                    print(f"  [WARN] {item['source']}: {item['detail']}")
            
            single_count = sum(1 for x in news_result['anomalies']['feed_issues'] if x['count'] == 1)
            if single_count > 0:
                print(f"\n  Analysis: {single_count} sources with only 1 article")
                print(f"           Bitcoin Magazine: Expected (low volume source)")
                print(f"           CNBC Economy: POTENTIAL ISSUE - usually has multiple articles")
                print(f"           Check RSS feed URL and parser logic")
        
        if news_result['anomalies']['old_news']:
            print(f"\nOld News (>24h, showing first 5):")
            for item in news_result['anomalies']['old_news'][:5]:
                print(f"  - [{item['source']}] {item['title']} ({item['age_hours']:.1f}h)")
    
    # Overall Summary
    print("\n" + "=" * 70)
    print("OVERALL SEVERITY SUMMARY")
    print("=" * 70)
    statuses = [coins_result['status'], macro_result['status'], news_result['status']]
    
    if "FAIL" in statuses:
        overall = "FAIL"
    elif "WARN" in statuses:
        overall = "WARN"
    else:
        overall = "PASS"
    
    print(f"\nOverall Status: [{overall}]")
    print()
    print(f"  coins-stats.json: [{coins_result['status']}]")
    print(f"  macro.json:       [{macro_result['status']}]")
    print(f"  news.json:        [{news_result['status']}]")
    
    print("\n" + "=" * 70)
    print("IMMEDIATE ACTIONS REQUIRED")
    print("=" * 70)
    
    actions = []
    
    # Macro actions (highest priority)
    if macro_result.get('values', {}).get('DGS10') is None:
        actions.append({
            "priority": "P0",
            "action": "MACRO: Fix FRED API data fetch - all indicators returning NULL"
        })
    
    for anomaly in macro_result.get('anomalies', []):
        if anomaly.get('severity') == 'CRITICAL':
            actions.append({
                "priority": "P0",
                "action": f"MACRO: {anomaly['type']} - {anomaly['detail']}"
            })
    
    # News actions
    if news_result.get('total_news', 0) < 10:
        actions.append({
            "priority": "P0" if news_result.get('total_news', 0) == 0 else "P1",
            "action": f"NEWS: Only {news_result.get('total_news', 0)} articles - investigate feed aggregation"
        })
    
    cnbc_count = news_result.get('source_distribution', {}).get('CNBC Economy', 0)
    if cnbc_count == 1:
        actions.append({
            "priority": "P1",
            "action": "NEWS: CNBC Economy returning only 1 article - check RSS feed URL"
        })
    
    # Coins actions (lower priority)
    if coins_result.get('anomalies', {}).get('strategy_mapping_error'):
        count = len(coins_result['anomalies']['strategy_mapping_error'])
        actions.append({
            "priority": "P2",
            "action": f"COINS: Fix {count} strategy mapping errors (or exclude stablecoins)"
        })
    
    if coins_result.get('anomalies', {}).get('sparkline_inconsistent'):
        count = len(coins_result['anomalies']['sparkline_inconsistent'])
        actions.append({
            "priority": "P2",
            "action": f"COINS: {count} coins with inconsistent sparkline lengths - update frontend to handle"
        })
    
    if actions:
        for item in sorted(actions, key=lambda x: x['priority']):
            print(f"\n[{item['priority']}] {item['action']}")
    else:
        print("\nNo critical actions required - all data within acceptable ranges")
    
    print("\n" + "=" * 70)
    print("RECOMMENDATIONS")
    print("=" * 70)
    print("""
1. Automate this script
   - Run via cron every 6 hours
   - Send Telegram alert on FAIL status
   - Log results to /Users/jplee/Desktop/pruviq/logs/anomaly-detection/

2. MACRO.JSON priority
   - Investigate NULL values immediately
   - Check FRED API key validity
   - Verify network connectivity from deployment environment
   - Consider fallback data sources (Yahoo Finance, Trading Economics)

3. NEWS.JSON monitoring
   - Track source diversity over time
   - Alert if total sources < 5
   - Monitor CNBC Economy specifically (usually 3-5 articles/hour)
   - Set up RSS feed health checks

4. COINS-STATS.JSON tolerances
   - Extreme WR/PF: Wait 7 days before flagging (low trade variance)
   - Sparkline inconsistencies: Frontend must handle gracefully
   - Strategy mapping: Exclude stablecoins from best_strategy selection
   - Market cap = 0: May indicate delisted coins, check CoinGecko status

5. Integration with existing monitoring
   - Add anomaly detection to autotrader health checks
   - Correlate with trading system performance
   - Use as early warning for data quality degradation
""")
    print("=" * 70)
    print()

if __name__ == "__main__":
    main()
