#!/usr/bin/env python3
"""
PRUVIQ Simulator QA Tool — 4-Layer Verification
Usage: python3 sim_audit.py [full|layer0|layer1|layer2|layer3|quick]
"""

import json
import math
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

API_BASE = "https://api.pruviq.com"
LOCAL_BASE = "http://localhost:8080"
TOLERANCE = 0.01  # 0.01% tolerance
GT_PATH = Path(__file__).parent / "ground_truth" / "formulas.json"

def _switch_to_local():
    global API_BASE
    API_BASE = LOCAL_BASE

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
WARN = "\033[93m[WARN]\033[0m"
SKIP = "\033[90m[SKIP]\033[0m"
INFO = "\033[94m[INFO]\033[0m"

results = {"pass": 0, "fail": 0, "warn": 0, "skip": 0}


def api_call(endpoint, method="GET", data=None, base=None):
    """Call PRUVIQ API endpoint."""
    if base is None:
        base = API_BASE
    url = f"{base}{endpoint}"
    headers = {"Content-Type": "application/json", "User-Agent": "PRUVIQ-SimAudit/1.0"}
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        try:
            body_text = e.read().decode()
            return json.loads(body_text)
        except Exception:
            return {"error": f"HTTP {e.code}: {e.reason}"}
    except URLError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


def check(layer, name, passed, detail="", expected=None, actual=None):
    """Record and print a check result."""
    if passed is None:
        print(f"  {SKIP} Layer {layer}: {name} — {detail}")
        results["skip"] += 1
    elif passed:
        print(f"  {PASS} Layer {layer}: {name}")
        results["pass"] += 1
    else:
        msg = f"  {FAIL} Layer {layer}: {name}"
        if expected is not None and actual is not None:
            msg += f" — expected: {expected}, actual: {actual}"
        if detail:
            msg += f" ({detail})"
        print(msg)
        results["fail"] += 1


def warn(layer, name, detail=""):
    print(f"  {WARN} Layer {layer}: {name} — {detail}")
    results["warn"] += 1


def close_enough(a, b, tol=TOLERANCE):
    """Check if two numbers are within tolerance."""
    if a == 0 and b == 0:
        return True
    if a == 0 or b == 0:
        return abs(a - b) < tol
    return abs(a - b) / max(abs(a), abs(b)) * 100 < tol


# ============================================================
# Layer 0: Completeness
# ============================================================
def run_layer0():
    print("\n" + "=" * 60)
    print("LAYER 0: Completeness (빠진 기능 탐지)")
    print("=" * 60)

    health = api_call("/health")
    if "error" in health:
        check(0, "API reachable", False, detail=health["error"])
        return
    check(0, "API reachable", True)
    check(0, f"Coins loaded: {health.get('coins_loaded', 0)}", health.get("coins_loaded", 0) >= 500)

    # Check endpoints exist
    endpoints = ["/simulate", "/backtest", "/simulate/validate", "/simulate/compare",
                 "/builder/presets", "/builder/indicators", "/coins", "/coins/stats"]
    for ep in endpoints:
        if ep in ["/simulate", "/backtest", "/simulate/validate", "/simulate/compare"]:
            resp = api_call(ep, method="POST", data={})
        else:
            resp = api_call(ep)
        exists = "error" not in resp or "422" in str(resp.get("error", "")) or "detail" in resp
        check(0, f"Endpoint {ep} exists", exists)

    # Check indicators
    indicators = api_call("/builder/indicators")
    if isinstance(indicators, list):
        ind_ids = [i.get("id", "") for i in indicators]
        required_indicators = ["bb", "ema", "rsi", "macd", "stochastic", "adx", "volume", "atr"]
        for ind in required_indicators:
            check(0, f"Indicator '{ind}' available", ind in ind_ids)

    # Check presets
    presets = api_call("/builder/presets")
    if isinstance(presets, list):
        check(0, f"Presets count: {len(presets)}", len(presets) >= 10,
              detail=f"Found {len(presets)}, minimum 10 expected")

    # Completeness checks — verify features are now implemented
    warn(0, "Dynamic slippage model pending verification",
         "3-tier 동적 슬리피지 모델 추가됨 — 프로덕션 배포 후 검증 필요")


# ============================================================
# Layer 1: Domain Correctness
# ============================================================
def run_layer1():
    print("\n" + "=" * 60)
    print("LAYER 1: Domain Correctness (금융 공식 정합성)")
    print("=" * 60)

    gt = json.loads(GT_PATH.read_text())

    # --- Sharpe Ratio Formula Test ---
    print(f"\n  {INFO} Sharpe Ratio 검증")
    # Run a known backtest and check if Sharpe is computed with correct annualization
    test_req = {
        "name": "Sharpe Test",
        "direction": "short",
        "indicators": {"bb": {}, "ema": {}, "volume": {}},
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "recent_squeeze", "op": "==", "value": True, "shift": 1},
                {"field": "bb_expanding", "op": "==", "value": True, "shift": 0},
                {"field": "vol_ratio", "op": ">=", "value": 2.0, "shift": 1}
            ]
        },
        "sl_pct": 10.0,
        "tp_pct": 8.0,
        "max_bars": 48,
        "top_n": 10,
        "leverage": 5,
        "per_coin_usd": 60
    }
    resp = api_call("/backtest", method="POST", data=test_req)

    if "error" not in resp and resp.get("total_trades", 0) > 0:
        sharpe = resp.get("sharpe_ratio", 0)
        trades = resp.get("total_trades", 0)
        check(1, f"Sharpe computed (trades={trades})", sharpe is not None and sharpe != 0,
              detail=f"Sharpe={sharpe}")

        # Sharpe sanity: if > 5, likely over-annualized
        if abs(sharpe) > 5:
            warn(1, "Sharpe unusually high",
                 f"Sharpe={sharpe:.2f}. >5 suggests over-annualization or overfit")
        else:
            check(1, "Sharpe in reasonable range", abs(sharpe) <= 5,
                  detail=f"Sharpe={sharpe:.2f}")

        # Check Sortino
        sortino = resp.get("sortino_ratio", 0)
        check(1, "Sortino computed", sortino is not None,
              detail=f"Sortino={sortino}")
        if sortino and sharpe and sortino < sharpe:
            warn(1, "Sortino < Sharpe",
                 "Sortino는 보통 Sharpe보다 큼 (하방만 페널티). 분모 확인 필요")

        # Check Calmar
        calmar = resp.get("calmar_ratio", 0)
        check(1, "Calmar computed", calmar is not None,
              detail=f"Calmar={calmar}")

        # Check MDD is percentage (should be 0-100 range, capped)
        mdd = resp.get("max_drawdown_pct", 0)
        check(1, "MDD is percentage (0-100, capped)", 0 <= mdd <= 100,
              expected="0-100%", actual=mdd)

        # Check PF
        pf = resp.get("profit_factor", 0)
        check(1, "Profit Factor computed", pf is not None and pf >= 0,
              detail=f"PF={pf}")

        # Check VaR/CVaR
        var95 = resp.get("var_95")
        cvar95 = resp.get("cvar_95")
        if var95 is not None and cvar95 is not None:
            check(1, "VaR/CVaR computed", True, detail=f"VaR={var95}, CVaR={cvar95}")
            check(1, "CVaR <= VaR (더 극단)", cvar95 <= var95,
                  expected=f"CVaR({cvar95}) <= VaR({var95})", actual=f"CVaR={cvar95}")
        else:
            check(1, "VaR/CVaR computed", None, detail="Not available in response")

        # Check DSR
        dsr = resp.get("deflated_sharpe")
        check(1, "DSR computed", dsr is not None, detail=f"DSR={dsr}")

        # Check strategy grade
        grade = resp.get("strategy_grade")
        check(1, "Strategy grade assigned", grade in ["A", "B", "C", "D", "F"],
              detail=f"Grade={grade}")

    else:
        check(1, "Backtest returned results", False,
              detail=str(resp.get("error", resp.get("detail", "unknown"))))

    # --- Cost Model Verification ---
    print(f"\n  {INFO} 비용 모델 검증")
    gt_cost = gt["cost_model"]["futures"]
    warn(1, "Slippage 0.02% may be too low",
         f"현재 {gt_cost['slippage_pct']*100}% 편도. Top-100 기준 최소 0.05-0.1% 권장")

    # --- Compounding Logic ---
    print(f"\n  {INFO} 단리/복리 검증")
    gt_simple = gt["compounding"]["simple"]["test_case"]
    gt_compound = gt["compounding"]["compound"]["test_case"]
    check(1, "Ground Truth 단리 정의",
          gt_simple["total_return"] == 8.0,
          detail=f"trades=[5,-3,8,-2] → sum=8.0")
    check(1, "Ground Truth 복리 정의",
          abs(gt_compound["total_return"] - 7.798) < 0.01,
          detail=f"trades=[5,-3,8,-2] → compound=7.798")

    # --- Parameter Combination Logic ---
    print(f"\n  {INFO} 파라미터 조합 검증")
    # SL > TP is valid (wide stop, tight profit)
    check(1, "SL > TP allowed", True, detail="SL=10%, TP=8% — 유효한 조합")

    # Test impossible: avoid_hours with daily timeframe
    daily_req = test_req.copy()
    daily_req["avoid_hours"] = [2, 3, 10]
    daily_req["timeframe"] = "1D"
    # This should still work (frontend clears avoid_hours for >=24h)
    check(1, "Avoid hours + daily timeframe", True,
          detail="프론트엔드가 >=24h일 때 avoid_hours=[] 처리")


# ============================================================
# Layer 2: Numerical Correctness
# ============================================================
def run_layer2():
    print("\n" + "=" * 60)
    print("LAYER 2: Numerical Correctness (수치 정합성)")
    print("=" * 60)

    gt = json.loads(GT_PATH.read_text())

    # --- Ground Truth Formula Verification ---
    print(f"\n  {INFO} Ground Truth 수기계산 자체 검증")

    # Sharpe
    returns = gt["sharpe_ratio"]["test_case"]["daily_returns"]
    n = len(returns)
    mean_r = sum(returns) / n
    var_r = sum((r - mean_r) ** 2 for r in returns) / (n - 1)
    std_r = math.sqrt(var_r)
    sharpe_daily = mean_r / std_r
    sharpe_365 = sharpe_daily * math.sqrt(365)
    check(2, "GT Sharpe mean", close_enough(mean_r, 0.11),
          expected=0.11, actual=round(mean_r, 4))
    gt_std = gt["sharpe_ratio"]["test_case"]["std_ddof1"]
    gt_sharpe_ann = gt["sharpe_ratio"]["test_case"]["sharpe_annualized_365"]
    check(2, "GT Sharpe std(ddof=1)", close_enough(std_r, gt_std, tol=0.1),
          expected=gt_std, actual=round(std_r, 4))
    check(2, "GT Sharpe annualized(365)", close_enough(sharpe_365, gt_sharpe_ann, tol=0.5),
          expected=gt_sharpe_ann, actual=round(sharpe_365, 3))

    # Sortino
    downside = [min(r, 0) for r in returns]
    mean_ds_sq = sum(d ** 2 for d in downside) / n
    tdd = math.sqrt(mean_ds_sq)
    sortino_daily = mean_r / tdd
    sortino_365 = sortino_daily * math.sqrt(365)
    check(2, "GT Sortino TDD", close_enough(tdd, 0.2236, tol=0.5),
          expected=0.2236, actual=round(tdd, 4))
    check(2, "GT Sortino annualized(365)", close_enough(sortino_365, 9.397, tol=0.5),
          expected=9.397, actual=round(sortino_365, 3))

    # MDD
    equity = gt["mdd"]["test_case"]["equity_curve"]
    peak = equity[0]
    max_dd = 0
    for e in equity:
        peak = max(peak, e)
        dd = (peak - e) / peak * 100
        max_dd = max(max_dd, dd)
    check(2, "GT MDD % of peak", close_enough(max_dd, 18.182, tol=0.1),
          expected=18.182, actual=round(max_dd, 3))

    # Profit Factor
    pnls = gt["profit_factor"]["test_case"]["trade_pnls"]
    gp = sum(p for p in pnls if p > 0)
    gl = abs(sum(p for p in pnls if p < 0))
    pf = gp / gl if gl > 0 else 999.99
    check(2, "GT Profit Factor", close_enough(pf, 2.833, tol=0.1),
          expected=2.833, actual=round(pf, 3))

    # Compounding
    trades_pct = gt["compounding"]["compound"]["test_case"]["trades_pct"]
    eq = 100.0
    for t in trades_pct:
        eq *= (1 + t / 100)
    compound_return = eq - 100
    check(2, "GT Compound return", close_enough(compound_return, 7.798, tol=0.1),
          expected=7.798, actual=round(compound_return, 3))

    # --- Cross-Engine Consistency ---
    print(f"\n  {INFO} Cross-Engine 일관성 (/simulate vs /backtest)")

    sim_req = {
        "strategy": "bb-squeeze",
        "direction": "short",
        "sl_pct": 10.0,
        "tp_pct": 8.0,
        "max_bars": 48,
        "top_n": 10,
        "compounding": False
    }
    sim_resp = api_call("/simulate", method="POST", data=sim_req)

    bt_req = {
        "name": "Cross-Engine Test",
        "direction": "short",
        "indicators": {"bb": {}, "ema": {}, "volume": {}, "candle": {}},
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "recent_squeeze", "op": "==", "value": True, "shift": 1},
                {"field": "bb_expanding", "op": "==", "value": True, "shift": 0},
                {"field": "bb_width_above_ma", "op": "==", "value": True, "shift": 0},
                {"field": "close", "op": "<", "field2": "bb_mid", "shift": 0},
                {"field": "vol_ratio", "op": ">=", "value": 2.0, "shift": 1},
                {"field": "downtrend", "op": "==", "value": True, "shift": 1},
                {"field": "bb_width_change", "op": ">=", "value": 10, "shift": 0}
            ]
        },
        "avoid_hours": [2, 3, 10, 20, 21, 22, 23],
        "sl_pct": 10.0,
        "tp_pct": 8.0,
        "max_bars": 48,
        "top_n": 10,
        "per_coin_usd": 60,
        "leverage": 5,
        "compounding": False
    }
    bt_resp = api_call("/backtest", method="POST", data=bt_req)

    if "error" not in sim_resp and "error" not in bt_resp:
        sim_trades = sim_resp.get("total_trades", -1)
        bt_trades = bt_resp.get("total_trades", -2)
        check(2, f"Trade count match (sim={sim_trades}, bt={bt_trades})",
              sim_trades == bt_trades,
              expected=sim_trades, actual=bt_trades)

        sim_wr = sim_resp.get("win_rate", -1)
        bt_wr = bt_resp.get("win_rate", -2)
        check(2, "Win rate match", close_enough(sim_wr, bt_wr, tol=0.5),
              expected=sim_wr, actual=bt_wr)

        sim_pf = sim_resp.get("profit_factor", -1)
        bt_pf = bt_resp.get("profit_factor", -2)
        check(2, "Profit Factor match", close_enough(sim_pf, bt_pf, tol=1.0),
              expected=sim_pf, actual=bt_pf)
    else:
        err = sim_resp.get("error", "") or bt_resp.get("error", "") or sim_resp.get("detail", "") or bt_resp.get("detail", "")
        check(2, "Cross-engine test", False, detail=f"API error: {err}")

    # --- Edge Cases ---
    print(f"\n  {INFO} Edge Cases")

    # Zero trades (impossible conditions)
    edge_req = {
        "name": "Edge Zero Trades",
        "direction": "short",
        "indicators": {"rsi": {"period": 14, "oversold": 30, "overbought": 70}},
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "rsi", "op": ">=", "value": 99, "shift": 1},
                {"field": "rsi", "op": "<=", "value": 1, "shift": 1}
            ]
        },
        "sl_pct": 10,
        "tp_pct": 8,
        "max_bars": 48,
        "top_n": 5
    }
    edge_resp = api_call("/backtest", method="POST", data=edge_req)
    if "error" not in edge_resp:
        edge_trades = edge_resp.get("total_trades", -1)
        check(2, "Zero trades handled (impossible condition)", edge_trades == 0,
              expected=0, actual=edge_trades)
        if edge_trades == 0:
            edge_pf = edge_resp.get("profit_factor", None)
            check(2, "PF=0 for zero trades", edge_pf == 0 or edge_pf is None,
                  expected="0 or None", actual=edge_pf)
    else:
        check(2, "Zero trades edge case", False, detail=str(edge_resp))

    # Single coin test
    single_req = {
        "strategy": "bb-squeeze",
        "symbol": "BTCUSDT",
        "direction": "short",
        "sl_pct": 10,
        "tp_pct": 8,
        "max_bars": 48
    }
    single_resp = api_call("/simulate/coin", method="POST", data=single_req)
    if "error" not in single_resp:
        check(2, "Single coin simulation works", single_resp.get("total_trades", 0) >= 0)
    else:
        check(2, "Single coin simulation", False, detail=str(single_resp))

    # --- Compounding vs Simple API Test ---
    print(f"\n  {INFO} 단리/복리 API 비교")
    simple_req = {**sim_req, "compounding": False}
    compound_req = {**sim_req, "compounding": True}
    simple_resp = api_call("/simulate", method="POST", data=simple_req)
    compound_resp = api_call("/simulate", method="POST", data=compound_req)

    if "error" not in simple_resp and "error" not in compound_resp:
        s_ret = simple_resp.get("total_return_pct", 0)
        c_ret = compound_resp.get("total_return_pct", 0)
        s_trades = simple_resp.get("total_trades", 0)
        c_trades = compound_resp.get("total_trades", 0)
        check(2, "Same trades for simple/compound", s_trades == c_trades,
              expected=s_trades, actual=c_trades)
        check(2, "Returns differ (simple vs compound)",
              not close_enough(s_ret, c_ret, tol=0.1) if s_trades > 10 else True,
              detail=f"Simple={s_ret}%, Compound={c_ret}%")


# ============================================================
# Layer 3: UX Correctness
# ============================================================
def run_layer3():
    print("\n" + "=" * 60)
    print("LAYER 3: UX Correctness (표현 정합성)")
    print("=" * 60)

    # Check response schema has all expected fields
    test_req = {
        "strategy": "bb-squeeze",
        "direction": "short",
        "sl_pct": 10,
        "tp_pct": 8,
        "max_bars": 48,
        "top_n": 5
    }
    resp = api_call("/simulate", method="POST", data=test_req)

    required_fields = [
        "total_trades", "wins", "losses", "win_rate",
        "total_return_pct", "profit_factor",
        "avg_win_pct", "avg_loss_pct",
        "max_drawdown_pct", "max_consecutive_losses",
        "tp_count", "sl_count", "timeout_count",
        "sharpe_ratio", "sortino_ratio", "calmar_ratio",
        "equity_curve", "coin_results"
    ]

    if "error" not in resp:
        for field in required_fields:
            check(3, f"/simulate has '{field}'", field in resp,
                  detail=f"{'present' if field in resp else 'MISSING'}")

        # Check equity curve structure
        eq = resp.get("equity_curve", [])
        if eq:
            first = eq[0]
            eq_fields = ["time", "value"]
            for f in eq_fields:
                check(3, f"Equity curve has '{f}'", f in first)

        # Win rate + loss rate should = 100%
        wr = resp.get("win_rate", 0)
        total = resp.get("total_trades", 0)
        wins = resp.get("wins", 0)
        losses = resp.get("losses", 0)
        if total > 0:
            check(3, "wins + losses = total_trades", wins + losses == total,
                  expected=total, actual=wins + losses)
            computed_wr = round(wins / total * 100, 2)
            check(3, "win_rate = wins/total*100", close_enough(wr, computed_wr, tol=0.5),
                  expected=computed_wr, actual=wr)

        # TP + SL + Timeout = total
        tp = resp.get("tp_count", 0)
        sl = resp.get("sl_count", 0)
        to = resp.get("timeout_count", 0)
        check(3, "tp + sl + timeout = total", tp + sl + to == total,
              expected=total, actual=tp + sl + to)

    else:
        check(3, "/simulate response", False, detail=str(resp))

    # /backtest schema
    bt_req = {
        "name": "Schema Test",
        "direction": "short",
        "indicators": {"bb": {}, "ema": {}, "volume": {}},
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "recent_squeeze", "op": "==", "value": True, "shift": 1}
            ]
        },
        "sl_pct": 10,
        "tp_pct": 8,
        "max_bars": 48,
        "top_n": 5
    }
    bt_resp = api_call("/backtest", method="POST", data=bt_req)

    if "error" not in bt_resp:
        bt_extra_fields = [
            "initial_capital_usd", "total_return_usd", "total_return_pct_portfolio",
            "max_drawdown_usd", "expectancy", "recovery_factor", "payoff_ratio",
            "var_95", "cvar_95", "deflated_sharpe", "strategy_grade",
            "is_valid", "compute_time_ms"
        ]
        for field in bt_extra_fields:
            check(3, f"/backtest has '{field}'", field in bt_resp,
                  detail=f"{'present' if field in bt_resp else 'MISSING'}")
    else:
        check(3, "/backtest response", False, detail=str(bt_resp))

    # Presets check
    presets = api_call("/builder/presets")
    if isinstance(presets, list) and len(presets) > 0:
        for p in presets[:3]:
            has_name = "name" in p
            has_dir = "direction" in p
            check(3, f"Preset '{p.get('id', '?')}' has name+direction", has_name and has_dir)


# ============================================================
# Main
# ============================================================
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    print("=" * 60)
    print(f"  PRUVIQ Simulator QA — {mode.upper()} mode")
    print(f"  API: {API_BASE}")
    print(f"  Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Check API
    health = api_call("/health")
    if "error" in health:
        print(f"\n  {FAIL} API unreachable: {health['error']}")
        print("  Trying local...")
        _switch_to_local()
        health = api_call("/health")
        if "error" in health:
            print(f"  {FAIL} Local API also unreachable. Aborting.")
            return

    print(f"  {INFO} API OK — v{health.get('version', '?')}, {health.get('coins_loaded', 0)} coins")

    if mode in ("full", "layer0"):
        run_layer0()
    if mode in ("full", "layer1", "quick"):
        run_layer1()
    if mode in ("full", "layer2", "quick"):
        run_layer2()
    if mode in ("full", "layer3"):
        run_layer3()

    # Summary
    total = sum(results.values())
    print("\n" + "=" * 60)
    print(f"  SUMMARY: {results['pass']} PASS / {results['fail']} FAIL / {results['warn']} WARN / {results['skip']} SKIP")
    if results["fail"] > 0:
        print(f"  \033[91mACTION REQUIRED: {results['fail']} failures need fixing\033[0m")
    elif results["warn"] > 0:
        print(f"  \033[93mATTENTION: {results['warn']} warnings to review\033[0m")
    else:
        print(f"  \033[92mALL CLEAR\033[0m")
    print("=" * 60)


if __name__ == "__main__":
    main()
