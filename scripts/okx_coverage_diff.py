"""Phase A: OKX vs Binance coverage diff + history depth probe.

Usage: python3 scripts/okx_coverage_diff.py [--probe-history]
Outputs:
  /tmp/pruviq_keep.json    — symbols in both exchanges
  /tmp/pruviq_remove.json  — Binance-only (to be dropped)
  /tmp/pruviq_okx_only.json — OKX-only (potential future coverage)
  /tmp/pruviq_1000x.json   — 1000X meme-coin pairs (need product decision)

With --probe-history, also probes earliest history-candles for 3 majors.
"""

import argparse
import json
import sys
import time
import urllib.request


OKX_INST_URL = "https://www.okx.com/api/v5/public/instruments?instType=SWAP"
OKX_HIST_URL = "https://www.okx.com/api/v5/market/history-candles"


def fetch_okx_swaps():
    req = urllib.request.Request(OKX_INST_URL, headers={"User-Agent": "pruviq-diff/1"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    if data.get("code") != "0":
        raise RuntimeError(f"OKX error: {data}")
    linear = [x for x in data["data"] if x["settleCcy"] == "USDT" and x["state"] == "live"]
    syms = set()
    detail = {}
    for x in linear:
        parts = x["instId"].split("-")
        if len(parts) == 3 and parts[1] == "USDT" and parts[2] == "SWAP":
            sym = (parts[0] + "USDT").upper()
            syms.add(sym)
            detail[sym] = x["instId"]
    return syms, detail


def probe_history_depth(inst_id: str, bar: str = "1H") -> dict:
    """Return earliest timestamp available via OKX history-candles for instId.

    We page backward with `after` param. One page = 100 candles.
    Stop when a page returns empty or repeats the same oldest ts.
    """
    oldest_ts = None
    pages = 0
    after = ""
    while True:
        url = f"{OKX_HIST_URL}?instId={inst_id}&bar={bar}&limit=100"
        if after:
            url += f"&after={after}"
        req = urllib.request.Request(url, headers={"User-Agent": "pruviq-diff/1"})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                resp = json.loads(r.read())
        except Exception as e:
            return {"instId": inst_id, "error": str(e), "pages": pages, "oldest_ts": oldest_ts}
        if resp.get("code") != "0":
            return {"instId": inst_id, "err_api": resp, "pages": pages, "oldest_ts": oldest_ts}
        rows = resp.get("data") or []
        if not rows:
            break
        new_oldest = rows[-1][0]
        if new_oldest == oldest_ts:
            break
        oldest_ts = new_oldest
        after = new_oldest
        pages += 1
        time.sleep(0.15)  # gentle — OKX limit is 20 req/2s on this endpoint
        if pages > 200:  # 20k candles = ~2.3y on 1h, ~55y on 1d — enough
            break
    return {
        "instId": inst_id,
        "bar": bar,
        "pages": pages,
        "approx_candles": pages * 100,
        "oldest_ts_ms": oldest_ts,
        "oldest_utc": _ms_to_utc(oldest_ts) if oldest_ts else None,
    }


def _ms_to_utc(ms: str) -> str:
    import datetime
    return datetime.datetime.fromtimestamp(int(ms) / 1000, tz=datetime.timezone.utc).isoformat()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe-history", action="store_true")
    args = ap.parse_args()

    # 1. Our Binance coverage
    with open("public/data/coins-stats.json") as f:
        binance = {c["symbol"].upper() for c in json.load(f)["coins"]}

    # 2. OKX USDT-SWAPs
    okx, okx_detail = fetch_okx_swaps()

    # 3. Diff
    keep = sorted(binance & okx)
    remove = sorted(binance - okx)
    okx_only = sorted(okx - binance)

    # 4. 1000X mapping — Binance's 1000FOO vs OKX's FOO-USDT-SWAP
    thousand_x = []
    for rm in remove:
        if rm.startswith("1000") and not rm.startswith("10000"):
            base = rm[4:-4]  # 1000PEPEUSDT → PEPE
            okx_equiv = f"{base}USDT"
            if okx_equiv in okx:
                thousand_x.append({
                    "binance": rm,
                    "okx_equivalent": okx_equiv,
                    "okx_inst_id": okx_detail.get(okx_equiv),
                    "note": "1000x contract-size difference; historical data not comparable",
                })
        elif rm.startswith("1000000"):
            base = rm[7:-4]
            okx_equiv = f"{base}USDT"
            if okx_equiv in okx:
                thousand_x.append({
                    "binance": rm,
                    "okx_equivalent": okx_equiv,
                    "okx_inst_id": okx_detail.get(okx_equiv),
                    "note": "1Mx contract-size difference",
                })

    json.dump(keep, open("/tmp/pruviq_keep.json", "w"), indent=2)
    json.dump(remove, open("/tmp/pruviq_remove.json", "w"), indent=2)
    json.dump(okx_only, open("/tmp/pruviq_okx_only.json", "w"), indent=2)
    json.dump(thousand_x, open("/tmp/pruviq_1000x.json", "w"), indent=2)

    print(f"=== Coverage diff ===")
    print(f"  Binance current:   {len(binance)}")
    print(f"  OKX USDT-SWAPs:    {len(okx)}")
    print(f"  Keep (intersect):  {len(keep)}")
    print(f"  Remove (B-only):   {len(remove)}")
    print(f"  OKX-only:          {len(okx_only)}")
    print()
    print(f"=== 1000X contract-size collisions ({len(thousand_x)}) ===")
    print("These are SAME asset with different contract multiplier.")
    print("Strict match drops them. Normalization = re-derive historical price (non-trivial).")
    for t in thousand_x[:15]:
        print(f"  {t['binance']:20s} ↔ {t['okx_equivalent']:12s} ({t['okx_inst_id']})")
    if len(thousand_x) > 15:
        print(f"  ... and {len(thousand_x) - 15} more")

    if args.probe_history:
        print()
        print(f"=== OKX history-candles depth probe (1H) ===")
        for inst in ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "LINK-USDT-SWAP"]:
            r = probe_history_depth(inst, bar="1H")
            print(f"  {inst}: ~{r.get('approx_candles'):>6} candles, oldest={r.get('oldest_utc')}")


if __name__ == "__main__":
    main()
