#!/usr/bin/env python3
"""
Data Parity Check: Static JSON vs API

Compares static JSON files (dist/data/ or backend/data/) against the live API
to detect mismatches in coin counts, rankings, and strategy names.

Exit 0 = PASS, Exit 1 = FAIL

Usage:
    API_BASE=http://127.0.0.1:8080 python3 backend/scripts/check_data_parity.py
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8080")
# Resolve project root (2 levels up from this script)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DIST_DATA = PROJECT_ROOT / "dist" / "data"
BACKEND_DATA = PROJECT_ROOT / "backend" / "data"

errors: list[str] = []
warnings: list[str] = []


def api_get(path: str, timeout: int = 15) -> dict | list | None:
    """Fetch JSON from API. Returns None on failure."""
    url = f"{API_BASE}{path}"
    try:
        resp = urllib.request.urlopen(url, timeout=timeout)
        return json.loads(resp.read())
    except Exception as e:
        errors.append(f"API request failed: {url} -> {e}")
        return None


def load_json(filepath: Path) -> dict | list | None:
    """Load a JSON file. Returns None if not found."""
    if not filepath.exists():
        return None
    with open(filepath) as f:
        return json.load(f)


def find_static_file(name: str) -> Path | None:
    """Find a static JSON file in dist/data/ or backend/data/."""
    for base in [DIST_DATA, BACKEND_DATA]:
        path = base / name
        if path.exists():
            return path
    return None


# ────────────────────────────────────────────────────────────
# Check 1: Coin count — /coins or /health vs static coins-stats.json
# ────────────────────────────────────────────────────────────
def check_coin_count():
    print("\n[1/3] Coin count parity check")

    # Load static coin count
    static_path = find_static_file("coins-stats.json")
    if static_path is None:
        errors.append("Static file not found: coins-stats.json (checked dist/data/ and backend/data/)")
        return

    static_data = load_json(static_path)
    if static_data is None:
        errors.append(f"Failed to parse {static_path}")
        return

    static_count = static_data.get("total_coins", 0)
    print(f"  Static coins-stats.json: total_coins = {static_count} (from {static_path})")

    # Get API coin count via /health endpoint
    api_health = api_get("/health")
    if api_health is None:
        return  # error already recorded

    api_count = api_health.get("coins_loaded", 0)
    print(f"  API /health: coins_loaded = {api_count}")

    # Allow 5% tolerance (coins can be added/delisted between refreshes)
    diff = abs(api_count - static_count)
    tolerance = max(static_count, api_count) * 0.05
    if diff > tolerance:
        errors.append(
            f"Coin count mismatch: static={static_count}, API={api_count}, "
            f"diff={diff} (tolerance={tolerance:.0f})"
        )
    else:
        print(f"  PASS (diff={diff}, tolerance={tolerance:.0f})")


# ────────────────────────────────────────────────────────────
# Check 2: Rankings top 10 — /rankings/daily vs static ranking-fallback.json
# ────────────────────────────────────────────────────────────
def check_rankings():
    print("\n[2/3] Rankings parity check")

    static_path = find_static_file("ranking-fallback.json")
    if static_path is None:
        warnings.append("Static file not found: ranking-fallback.json — skipping rankings check")
        print("  SKIP: ranking-fallback.json not found")
        return

    static_data = load_json(static_path)
    if static_data is None:
        errors.append(f"Failed to parse {static_path}")
        return

    static_top3 = static_data.get("top3", [])
    print(f"  Static ranking-fallback.json: {len(static_top3)} top entries")

    # Get API rankings
    api_data = api_get("/rankings/daily?period=30d&group=top50&top_n=10")
    if api_data is None:
        return

    api_top = api_data.get("top3", api_data.get("rankings", []))
    if isinstance(api_top, list):
        print(f"  API /rankings/daily: {len(api_top)} entries")
    else:
        errors.append(f"Unexpected API /rankings/daily response type: {type(api_top)}")
        return

    # Compare top entries: strategy names should overlap
    if static_top3 and api_top:
        static_strategies = {e.get("strategy", "") for e in static_top3[:10]}
        api_strategies = {e.get("strategy", "") for e in api_top[:10]}
        common = static_strategies & api_strategies
        if not common:
            errors.append(
                f"Rankings strategy mismatch: static has {static_strategies}, "
                f"API has {api_strategies} — zero overlap"
            )
        else:
            print(f"  PASS (common strategies: {common})")

        # Compare #1 rank strategy name
        static_first = static_top3[0].get("strategy", "") if static_top3 else ""
        api_first = api_top[0].get("strategy", "") if api_top else ""
        if static_first and api_first and static_first != api_first:
            warnings.append(
                f"#1 ranked strategy differs: static='{static_first}', API='{api_first}' "
                "(may be OK if rankings were just refreshed)"
            )
            print(f"  WARN: #1 differs (static='{static_first}', API='{api_first}')")
    else:
        if not static_top3:
            errors.append("Static ranking-fallback.json has empty top3")
        if not api_top:
            errors.append("API /rankings/daily returned empty rankings")


# ────────────────────────────────────────────────────────────
# Check 3: Strategy names — /strategies or static strategies.json
# ────────────────────────────────────────────────────────────
def check_strategies():
    print("\n[3/3] Strategy names parity check")

    static_path = find_static_file("strategies.json")
    if static_path is None:
        warnings.append("Static file not found: strategies.json — skipping strategy check")
        print("  SKIP: strategies.json not found")
        return

    static_data = load_json(static_path)
    if static_data is None:
        errors.append(f"Failed to parse {static_path}")
        return

    if isinstance(static_data, list):
        static_names = {s.get("id", s.get("name", "")) for s in static_data}
    elif isinstance(static_data, dict):
        static_names = set(static_data.keys())
    else:
        errors.append(f"Unexpected strategies.json format: {type(static_data)}")
        return

    print(f"  Static strategies.json: {len(static_names)} strategies -> {sorted(static_names)}")

    # Try API /strategies endpoint (may not exist — fall back to /health)
    api_data = api_get("/strategies")
    if api_data is not None:
        if isinstance(api_data, list):
            api_names = {s.get("id", s.get("name", "")) for s in api_data}
        elif isinstance(api_data, dict) and "strategies" in api_data:
            api_names = {s.get("id", s.get("name", "")) for s in api_data["strategies"]}
        else:
            api_names = set()
            warnings.append(f"Unexpected /strategies response format: {type(api_data)}")
    else:
        # Fallback: check /health for strategy count
        print("  /strategies endpoint unavailable, skipping API comparison")
        return

    print(f"  API /strategies: {len(api_names)} strategies -> {sorted(api_names)}")

    # Compare
    only_static = static_names - api_names
    only_api = api_names - static_names
    if only_static:
        errors.append(f"Strategies in static but not API: {sorted(only_static)}")
    if only_api:
        errors.append(f"Strategies in API but not static: {sorted(only_api)}")
    if not only_static and not only_api:
        print(f"  PASS ({len(static_names)} strategies match)")


# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────
def main():
    print(f"Data Parity Check")
    print(f"API: {API_BASE}")
    print(f"Static: {DIST_DATA} / {BACKEND_DATA}")

    check_coin_count()
    check_rankings()
    check_strategies()

    # Report
    print("\n" + "=" * 60)
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print(f"\nFAIL ({len(errors)} errors):")
        for e in errors:
            print(f"  - {e}")
        print("\nResult: FAIL")
        sys.exit(1)
    else:
        print("\nResult: PASS (all checks passed)")
        sys.exit(0)


if __name__ == "__main__":
    main()
