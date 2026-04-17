"""Phase B: Purge Binance-only coins from the repo after OKX cutover.

Reads the same live OKX instrument list the Phase-A diff used, then:
  * public/data/coins-stats.json      — filters the `coins` array
  * public/data/coin-metadata.json    — filters the top-level dict
  * backend/data/coin-strategy-stats.json — filters `best_strategy`
  * backend/data/futures/<sym>_1h.csv — deletes files for off-coverage syms

Everything keyed by symbol stays intersected with OKX USDT-SWAP live list.

`--dry-run` previews counts without touching files.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

OKX_INST_URL = "https://www.okx.com/api/v5/public/instruments?instType=SWAP"


def fetch_okx_usdt_swaps() -> set[str]:
    req = urllib.request.Request(OKX_INST_URL, headers={"User-Agent": "pruviq-purge/1"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    if data.get("code") != "0":
        raise RuntimeError(f"OKX error: {data}")
    syms: set[str] = set()
    for x in data["data"]:
        if x.get("state") != "live" or x.get("settleCcy") != "USDT":
            continue
        parts = x["instId"].split("-")
        if len(parts) == 3 and parts[1] == "USDT" and parts[2] == "SWAP":
            syms.add((parts[0] + "USDT").upper())
    return syms


def filter_coins_stats(path: Path, keep: set[str], dry: bool) -> tuple[int, int]:
    d = json.loads(path.read_text())
    before = len(d["coins"])
    d["coins"] = [c for c in d["coins"] if c["symbol"].upper() in keep]
    d["total_coins"] = len(d["coins"])
    if not dry:
        path.write_text(json.dumps(d, indent=2))
    return before, len(d["coins"])


def filter_coin_metadata(path: Path, keep: set[str], dry: bool) -> tuple[int, int]:
    d = json.loads(path.read_text())
    before = len(d)
    kept = {k: v for k, v in d.items() if k.upper() in keep}
    if not dry:
        path.write_text(json.dumps(kept, indent=2))
    return before, len(kept)


def filter_coin_strategy_stats(path: Path, keep: set[str], dry: bool) -> tuple[int, int]:
    d = json.loads(path.read_text())
    before = len(d.get("best_strategy", {}))
    d["best_strategy"] = {k: v for k, v in d.get("best_strategy", {}).items() if k.upper() in keep}
    d["total_coins"] = len(d["best_strategy"])
    if not dry:
        path.write_text(json.dumps(d, indent=2))
    return before, len(d["best_strategy"])


def purge_futures_csvs(futures_dir: Path, keep: set[str], dry: bool) -> tuple[int, int]:
    if not futures_dir.is_dir():
        return 0, 0
    kept = 0
    removed = 0
    for f in futures_dir.glob("*_1h.csv"):
        sym = f.stem.replace("_1h", "").upper()
        if sym in keep:
            kept += 1
            continue
        removed += 1
        if not dry:
            f.unlink()
    return kept, removed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--repo-root", type=str, default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()

    root = Path(args.repo_root)
    okx_syms = fetch_okx_usdt_swaps()
    print(f"OKX USDT-SWAP live: {len(okx_syms)}")

    # coins-stats
    cs = root / "public" / "data" / "coins-stats.json"
    b, a = filter_coins_stats(cs, okx_syms, args.dry_run)
    print(f"coins-stats.json:      {b} → {a}   (removed {b - a})")

    # coin-metadata
    cm = root / "public" / "data" / "coin-metadata.json"
    b, a = filter_coin_metadata(cm, okx_syms, args.dry_run)
    print(f"coin-metadata.json:    {b} → {a}   (removed {b - a})")

    # coin-strategy-stats
    css = root / "backend" / "data" / "coin-strategy-stats.json"
    b, a = filter_coin_strategy_stats(css, okx_syms, args.dry_run)
    print(f"coin-strategy-stats:   {b} → {a}   (removed {b - a})")

    # futures CSVs
    fut = root / "backend" / "data" / "futures"
    kept, removed = purge_futures_csvs(fut, okx_syms, args.dry_run)
    print(f"futures/*_1h.csv:      kept {kept}, removed {removed}")

    if args.dry_run:
        print("\n(dry run — no files modified)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
