"""API endpoint tests."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health():
    """Health endpoint returns OK."""
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.3.0"
    assert isinstance(data["coins_loaded"], int)


def test_strategies():
    """Strategies endpoint lists available strategies."""
    r = client.get("/strategies")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["id"] == "bb-squeeze"
    assert "default_params" in data[0]


def test_coins():
    """Coins endpoint lists loaded coins."""
    r = client.get("/coins")
    assert r.status_code == 200
    data = r.json()
    # May be empty if no data dir in test env
    assert isinstance(data, list)


def test_simulate_unknown_strategy():
    """Unknown strategy returns 400."""
    r = client.post("/simulate", json={"strategy": "magic-indicator"})
    assert r.status_code == 400


def test_simulate_validation():
    """Invalid params rejected."""
    r = client.post("/simulate", json={"sl_pct": 0.1})  # below minimum 1.0
    assert r.status_code == 422


def test_simulate_basic():
    """Simulate endpoint runs (may return 0 trades if no data)."""
    r = client.post("/simulate", json={
        "strategy": "bb-squeeze",
        "direction": "short",
        "sl_pct": 10.0,
        "tp_pct": 8.0,
        "top_n": 5,
    })
    # Either 200 (with data) or 503 (no data)
    assert r.status_code in [200, 503]
    if r.status_code == 200:
        data = r.json()
        assert "total_trades" in data
        assert "win_rate" in data
        assert "equity_curve" in data


if __name__ == "__main__":
    tests = [
        ("Health", test_health),
        ("Strategies", test_strategies),
        ("Coins", test_coins),
        ("Unknown Strategy", test_simulate_unknown_strategy),
        ("Validation", test_simulate_validation),
        ("Simulate Basic", test_simulate_basic),
    ]

    passed = failed = 0
    for name, fn in tests:
        print(f"\n[TEST] {name}")
        try:
            fn()
            print("  PASS")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            failed += 1

    print(f"\n{'=' * 40}")
    print(f"Results: {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
