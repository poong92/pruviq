# PRUVIQ API Rate Limit Risk Audit Report

**Audit Date**: 2026-02-22  
**Auditor**: Risk Manager Agent  
**Scope**: `/Users/jplee/Desktop/pruviq/backend/scripts/refresh_static.py`

---

## Executive Summary

**Overall Status**: ⚠️ WARN (Safe but with critical gaps)

- **CoinGecko**: ✅ PASS (0.2 calls/min average, well under 10/min limit)
- **FRED**: ✅ PASS (0.4 calls/min, trivial vs 120/min limit)
- **Fear & Greed**: ⚠️ WARN (unofficial API, no SLA)
- **RSS**: ✅ PASS (no limits)
- **Critical Issue**: 🔴 CoinGecko has NO fallback on 429 errors

---

## 1. API Usage Analysis

### Architecture
- **Refresh cycle**: 15 minutes (cron)
- **Cycles/month**: 2,880 (4/hour × 24h × 30d)
- **Location**: Mac Mini (`/Users/openclaw/pruviq/`)
- **Output**: 4 JSON files → Cloudflare CDN

### API Calls per Cycle

| API | Calls/Cycle | Location | Purpose |
|-----|-------------|----------|---------|
| CoinGecko `/coins/markets` | 2 | L64-79 | Top 500 coins (2 pages × 250) |
| CoinGecko `/global` | 1 | L83-89 | Total market cap, BTC dominance |
| Fear & Greed Index | 1 | L92-98 | Sentiment indicator |
| FRED CSV | 6 | L348-383 | Macro indicators (DFF, DGS10, etc.) |
| RSS feeds | 7 | L444-482 | News (4 crypto + 3 macro) |
| **Total** | **17** | | |

---

## 2. Rate Limit Status

### 2.1 CoinGecko Free API

**Limit**: 10-30 calls/minute (endpoint-specific)  
**Documentation**: https://docs.coingecko.com/reference/rate-limits

**Current Usage**:
- Average rate: **0.20 calls/min** (3 calls / 15 min)
- Burst rate: **7.5 calls/min** (3 calls in 24 seconds)
- Monthly total: 8,640 calls (tracking only, no monthly cap)

**Safety Measures**:
- 12-second delay between page 1→2 (L78)
- 12-second delay before `/global` (L514)
- Total burst window: 24 seconds for 3 calls

**Assessment**: ✅ **PASS**
- Average usage: 2% of limit (0.2/10)
- Burst usage: 75% of limit (7.5/10) — acceptable with 12s spacing
- Margin: 10× safety factor on average

---

### 2.2 FRED CSV Endpoint

**Limit**: 120 requests/minute  
**Documentation**: https://fred.stlouisfed.org/docs/api/api_key.html

**Current Usage**:
- **0.4 calls/min** (6 calls / 15 min)
- Monthly total: 17,280 calls

**Assessment**: ✅ **PASS**
- Usage: 0.33% of limit
- No API key required (public CSV endpoint)
- 30-day window reduces payload by 80% (L353)

**Optimization Opportunity**:
- FRED data updates **daily** (business days only)
- Fetching every 15 min is **wasteful**
- Recommendation: **Reduce to 1-2 hour interval**
- Savings: 75-87.5% reduction (17,280 → 4,320 or 2,160 calls/month)
- Implementation: Cache previous timestamp, skip if unchanged

---

### 2.3 Fear & Greed Index

**Limit**: Undocumented (unofficial API)  
**Source**: https://api.alternative.me/fng/

**Current Usage**:
- 2,880 calls/month
- No authentication required

**Assessment**: ⚠️ **WARN**
- No official SLA or documented limit
- Could break anytime without notice
- Fallback exists: returns `(0, "Unknown")` on error (L98)

**Impact**: 🟢 LOW — market.json still works with default values

---

### 2.4 RSS Feeds (7 sources)

**Limit**: None (public RSS)

**Current Usage**:
- 20,160 calls/month (7 feeds × 2,880 cycles)
- No authentication

**Assessment**: ✅ **PASS**
- RSS feeds are public, no limits
- Individual feed failures are handled gracefully (L481)

**Optimization Opportunity**:
- News typically updates hourly
- Fetching every 15 min may be excessive
- Recommendation: **Consider 30-60 min interval**
- Savings: 50-75% reduction

---

## 3. Failure Scenario Analysis

### 3.1 CoinGecko 429 (Rate Limit Hit)

**Location**: L70-75 (`fetch_coingecko_markets`)

**Current Behavior**:
```python
data = fetch_json(url)
if data:
    all_coins.extend(data)
else:
    print(f"  WARN: Page {page} failed, continuing...")
```

**Problem**:
- If **both pages fail**, returns empty list
- Line 509: `if not cg_coins: sys.exit(1)`
- Entire refresh fails → no data update

**Impact**: 🔴 **CRITICAL**
- No coins → no coins-stats.json → website shows nothing
- No fallback to stale data
- No retry mechanism

**Mitigation Required**:
1. Add exponential backoff retry (3 attempts)
2. Keep previous JSON if fetch fails (stale data better than no data)
3. Alert via Telegram if stale data > 1 hour

---

### 3.2 CoinGecko `/global` API Failure

**Location**: L83-89 (`fetch_global_data`)

**Current Behavior**: ✅ Fallback exists
- Calculates totals from coins list (L314-317)
- BTC dominance estimated from coin data

**Impact**: 🟢 **LOW** — market.json still functional

---

### 3.3 FRED Series Unavailable

**Location**: L348-383 (`fetch_fred_series`)

**Current Behavior**: ✅ Partial fallback
- Skips failed series, continues with others
- `macro.json` has fewer indicators

**Impact**: 🟡 **MEDIUM** — some macro data missing

---

### 3.4 RSS Feed Down

**Location**: L444-482 (`parse_rss_feed`)

**Current Behavior**: ✅ Graceful degradation
- Skips failed feed, continues
- Prints warning but doesn't crash

**Impact**: 🟡 **MEDIUM** — news.json has fewer sources

---

### 3.5 Fear & Greed API Failure

**Location**: L92-98 (`fetch_fear_greed`)

**Current Behavior**: ✅ Fallback exists
- Returns `(0, "Unknown")`

**Impact**: 🟢 **LOW** — market.json shows default value

---

## 4. Optimization Recommendations

### 4.1 FRED: Reduce Frequency ⚠️ HIGH PRIORITY

**Current**: 6 calls every 15 min (17,280/month)  
**Optimal**: 6 calls every 1-2 hours

**Rationale**:
- FRED data updates **daily** (business days)
- Fetching every 15 min is 4-8× wasteful

**Implementation**:
```python
# Cache FRED timestamp, skip if unchanged
FRED_CACHE = OUTPUT_DIR / ".fred_cache.json"

def should_fetch_fred():
    if not FRED_CACHE.exists():
        return True
    age = time.time() - FRED_CACHE.stat().st_mtime
    return age > 3600  # 1 hour

# In build_macro_json()
if should_fetch_fred():
    # fetch all 6 series
    # write cache
else:
    # load from cache
```

**Savings**: 75-87.5% reduction (13,000-15,000 calls/month saved)

---

### 4.2 CoinGecko: Add Retry Logic 🔴 CRITICAL

**Current**: Single attempt, fails fast  
**Required**: 3 retries with exponential backoff

**Implementation**:
```python
def fetch_json_with_retry(url, retries=3):
    for attempt in range(retries):
        try:
            # existing fetch logic
            return data
        except Exception as e:
            if attempt < retries - 1:
                sleep_time = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(sleep_time)
            else:
                # Load stale data if exists
                return load_stale_data(url)
```

---

### 4.3 RSS: Reduce Frequency (Optional)

**Current**: 7 feeds every 15 min (20,160/month)  
**Optimal**: 7 feeds every 30-60 min

**Savings**: 50-75% reduction  
**Priority**: LOW (no limits, but reduces bandwidth)

---

## 5. Monitoring Recommendations

### 5.1 Add Metrics to refresh_static.py

Track per-cycle:
- CoinGecko response time
- Failed API calls (by source)
- Stale data age (if using fallback)

### 5.2 Alert Thresholds

- CoinGecko 429 errors → immediate Telegram alert
- Stale data > 1 hour → warning
- Stale data > 6 hours → critical

---

## 6. Final Verdict

| Component | Status | Action Required |
|-----------|--------|-----------------|
| **CoinGecko Rate Limit** | ✅ PASS | Safe with current delays |
| **CoinGecko Fallback** | 🔴 FAIL | Add retry + stale data fallback |
| **FRED Efficiency** | ⚠️ WARN | Reduce to 1-2 hour interval |
| **Fear & Greed** | ⚠️ WARN | Monitor for breakage (no action) |
| **RSS** | ✅ PASS | Optional: reduce frequency |

---

## 7. Action Items

### Priority 1 (Critical)
- [ ] Add exponential backoff retry to `fetch_json()`
- [ ] Implement stale data fallback for CoinGecko
- [ ] Add Telegram alerts on API failures

### Priority 2 (High)
- [ ] Reduce FRED fetch frequency to 1-2 hours
- [ ] Cache FRED data with timestamp check

### Priority 3 (Medium)
- [ ] Add per-API metrics logging
- [ ] Monitor Fear & Greed API reliability

### Priority 4 (Low)
- [ ] Consider reducing RSS frequency to 30-60 min

---

## Appendix: Code References

**CoinGecko Calls**:
- L64-79: `fetch_coingecko_markets()` (2 pages)
- L83-89: `fetch_global_data()` (1 call)

**Error Handling**:
- L50-58: `fetch_json()` (basic try/catch)
- L509: `sys.exit(1)` if no CoinGecko data

**Delays**:
- L78: 12s sleep between market pages
- L514: 12s sleep before global API

**Fallbacks**:
- L314-317: Calculate global totals from coins if API fails
- L382: Skip failed FRED series
- L481: Skip failed RSS feeds
- L98: Return (0, "Unknown") for Fear & Greed

