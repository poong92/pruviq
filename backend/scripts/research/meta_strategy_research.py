#!/usr/bin/env python3
"""
메타 전략 연구 — "전략을 고르는 전략"의 수학적 검증

핵심 질문: 최근 N일 성과가 다음 M일 성과를 예측하는가?

테스트:
1. Rolling Lookback Strategy Selector
   - lookback: 7, 14, 30, 60일
   - forward: 7, 14, 30일
   - selection: top-1, top-2, top-3, PF-weighted

2. Regime Detection → Strategy Mapping
   - 변동성 레짐 (ATR 기반)
   - 추세 레짐 (EMA 기반)
   - 모멘텀 레짐 (ROC 기반)

3. Anti-Correlation 포트폴리오
   - 전략 간 상관관계 매트릭스
   - 음의 상관 전략 조합 → 리스크 감소

4. Ensemble Voting
   - 다수 전략이 동의하는 방향으로만 진입
"""

import sys
import time
import json
import csv
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine_fast import run_fast

OUT_DIR = Path("/tmp/strategy_analysis")
OUT_DIR.mkdir(exist_ok=True)

DATA_DIR = Path(__file__).parent.parent / "data" / "futures"
FEE, SLIP, FUND = 0.0008, 0.0002, 0.0001

STRATEGIES = list(STRATEGY_REGISTRY.keys())
# 실제 거래 가능한 조합 (direction override)
STRATEGY_CONFIGS = []
for sid in STRATEGIES:
    _, default_dir, _ = get_strategy(sid)
    STRATEGY_CONFIGS.append((sid, default_dir))  # default
    if default_dir != "long":
        STRATEGY_CONFIGS.append((sid, "long"))
    if default_dir != "short":
        STRATEGY_CONFIGS.append((sid, "short"))

# Squeeze 그룹 — 중복 제거용
SQUEEZE_IDS = {"bb-squeeze-short", "bb-squeeze-long", "hv-squeeze", "keltner-squeeze"}


def load_coins(top_n=30):
    files = sorted(DATA_DIR.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
    coins = []
    for f in files[:top_n]:
        sym = f.stem.replace("_1h", "").upper()
        try:
            df = pd.read_csv(f)
            if "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])
            if len(df) > 500:
                coins.append((sym, df))
        except Exception:
            continue
    return coins


def run_period(strategy_id, direction, coins, start, end, sl=7, tp=7, mb=48):
    """Run strategy on a specific date range. Return PnL series by date."""
    strategy, _, _ = get_strategy(strategy_id)
    daily_pnl = defaultdict(float)
    trade_count = 0

    for sym, df_full in coins:
        df = df_full[(df_full["timestamp"] >= pd.Timestamp(start)) &
                     (df_full["timestamp"] <= pd.Timestamp(end))].copy()
        if len(df) < 50:
            continue
        df = strategy.calculate_indicators(df)
        result = run_fast(
            df, strategy, sym, sl_pct=sl/100, tp_pct=tp/100, max_bars=mb,
            fee_pct=FEE, slippage_pct=SLIP, direction=direction,
            market_type="futures", strategy_id=strategy_id, funding_rate_8h=FUND,
        )
        for t in result.trades:
            day = str(t.exit_time)[:10] if hasattr(t, 'exit_time') and t.exit_time else str(t.entry_time)[:10]
            daily_pnl[day] += t.pnl_pct
            trade_count += 1

    pnls = list(daily_pnl.values())
    if not pnls:
        return {"pf": 0, "wr": 0, "trades": 0, "total_pnl": 0, "daily_pnl": daily_pnl}

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    tw = sum(w for w in [t for t in [p for p in pnls] if p > 0]) if wins else 0
    # recalculate from trades
    all_pnls_flat = []
    for sym, df_full in coins:
        df = df_full[(df_full["timestamp"] >= pd.Timestamp(start)) &
                     (df_full["timestamp"] <= pd.Timestamp(end))].copy()
        if len(df) < 50:
            continue
        df = strategy.calculate_indicators(df)
        result = run_fast(
            df, strategy, sym, sl_pct=sl/100, tp_pct=tp/100, max_bars=mb,
            fee_pct=FEE, slippage_pct=SLIP, direction=direction,
            market_type="futures", strategy_id=strategy_id, funding_rate_8h=FUND,
        )
        for t in result.trades:
            all_pnls_flat.append(t.pnl_pct)

    wins_flat = [p for p in all_pnls_flat if p > 0]
    losses_flat = [p for p in all_pnls_flat if p <= 0]
    tw = sum(wins_flat) if wins_flat else 0
    tl = abs(sum(losses_flat)) if losses_flat else 0.001
    pf = tw / tl

    return {
        "pf": round(pf, 2),
        "wr": round(len(wins_flat) / len(all_pnls_flat) * 100, 1) if all_pnls_flat else 0,
        "trades": len(all_pnls_flat),
        "total_pnl": round(sum(all_pnls_flat), 2),
        "daily_pnl": daily_pnl,
    }


def run_period_fast(strategy_id, direction, coins_with_indicators, start, end, sl=7, tp=7, mb=48):
    """Faster version — coins already have indicators calculated."""
    strategy, _, _ = get_strategy(strategy_id)
    all_pnls = []

    for sym, df_full in coins_with_indicators.get(strategy_id, []):
        df = df_full[(df_full["timestamp"] >= pd.Timestamp(start)) &
                     (df_full["timestamp"] <= pd.Timestamp(end))]
        if len(df) < 50:
            continue
        result = run_fast(
            df, strategy, sym, sl_pct=sl/100, tp_pct=tp/100, max_bars=mb,
            fee_pct=FEE, slippage_pct=SLIP, direction=direction,
            market_type="futures", strategy_id=strategy_id, funding_rate_8h=FUND,
        )
        for t in result.trades:
            all_pnls.append(t.pnl_pct)

    if not all_pnls:
        return {"pf": 0, "wr": 0, "trades": 0, "total_pnl": 0}

    wins = [p for p in all_pnls if p > 0]
    losses = [p for p in all_pnls if p <= 0]
    tw = sum(wins) if wins else 0
    tl = abs(sum(losses)) if losses else 0.001

    return {
        "pf": round(tw / tl, 2),
        "wr": round(len(wins) / len(all_pnls) * 100, 1),
        "trades": len(all_pnls),
        "total_pnl": round(sum(all_pnls), 2),
    }


def precompute_indicators(coins):
    """Pre-compute indicators for all strategies to speed up repeated runs."""
    print("  Pre-computing indicators for all strategies...")
    cache = {}
    for sid in STRATEGIES:
        strategy, _, _ = get_strategy(sid)
        coin_list = []
        for sym, df in coins:
            df_ind = strategy.calculate_indicators(df.copy())
            coin_list.append((sym, df_ind))
        cache[sid] = coin_list
    print(f"  Done: {len(cache)} strategies × {len(coins)} coins")
    return cache


# ============================================================
# RESEARCH 1: Rolling Lookback Prediction Power
# ============================================================
def research1_lookback_prediction(coins, indicator_cache):
    print("\n" + "="*70)
    print("RESEARCH 1: Lookback → Forward 예측력")
    print("최근 N일 PF가 다음 M일 PF를 예측하는가?")
    print("="*70)

    lookbacks = [7, 14, 30]
    forwards = [7, 14]

    # Generate date windows
    # Slide by forward_days from 1y ago to now
    results = []

    # Use a subset of strategies for speed
    test_configs = [
        ("atr-breakout", "short"),
        ("bb-squeeze-short", "short"),
        ("keltner-squeeze", "short"),
        ("ichimoku", "short"),
        ("supertrend", "short"),
        ("heikin-ashi", "short"),
        ("donchian-breakout", "short"),
        ("atr-breakout", "long"),
        ("bb-squeeze-short", "long"),
        ("keltner-squeeze", "long"),
        ("atr-breakout", "both"),
        ("bb-squeeze-short", "both"),
    ]

    for lb in lookbacks:
        for fw in forwards:
            print(f"\n  --- Lookback={lb}d, Forward={fw}d ---")

            correlations = []
            correct_predictions = 0
            total_predictions = 0

            # Slide windows
            current = datetime.now() - timedelta(days=365)
            end_limit = datetime.now() - timedelta(days=fw)

            window_results = []

            while current + timedelta(days=lb+fw) <= datetime.now():
                lb_start = current
                lb_end = current + timedelta(days=lb)
                fw_start = lb_end
                fw_end = lb_end + timedelta(days=fw)

                # Run all strategies on lookback period
                lb_scores = {}
                fw_scores = {}

                for sid, direction in test_configs:
                    lb_r = run_period_fast(sid, direction, indicator_cache,
                                          lb_start, lb_end)
                    fw_r = run_period_fast(sid, direction, indicator_cache,
                                          fw_start, fw_end)

                    if lb_r["trades"] >= 5 and fw_r["trades"] >= 5:
                        lb_scores[(sid, direction)] = lb_r["pf"]
                        fw_scores[(sid, direction)] = fw_r["pf"]

                if len(lb_scores) >= 3:
                    # Correlation between lookback PF and forward PF
                    common_keys = set(lb_scores.keys()) & set(fw_scores.keys())
                    if len(common_keys) >= 3:
                        lb_vals = [lb_scores[k] for k in common_keys]
                        fw_vals = [fw_scores[k] for k in common_keys]
                        corr = np.corrcoef(lb_vals, fw_vals)[0, 1]
                        if not np.isnan(corr):
                            correlations.append(corr)

                    # Did top-1 from lookback beat average in forward?
                    best_lb = max(lb_scores, key=lb_scores.get)
                    if best_lb in fw_scores:
                        avg_fw = np.mean(list(fw_scores.values()))
                        if fw_scores[best_lb] > avg_fw:
                            correct_predictions += 1
                        total_predictions += 1

                        window_results.append({
                            "lb_start": lb_start.strftime("%Y-%m-%d"),
                            "best_strategy": f"{best_lb[0]}({best_lb[1]})",
                            "lb_pf": lb_scores[best_lb],
                            "fw_pf": fw_scores[best_lb],
                            "fw_avg": round(avg_fw, 2),
                            "beat_avg": fw_scores[best_lb] > avg_fw,
                        })

                current += timedelta(days=fw)

            avg_corr = np.mean(correlations) if correlations else 0
            pred_rate = correct_predictions / total_predictions * 100 if total_predictions > 0 else 0

            print(f"    Correlation (LB PF ↔ FW PF): {avg_corr:.3f}")
            print(f"    Top-1 beats average: {correct_predictions}/{total_predictions} ({pred_rate:.0f}%)")
            print(f"    Windows tested: {len(window_results)}")

            results.append({
                "lookback": lb,
                "forward": fw,
                "avg_correlation": round(avg_corr, 3),
                "prediction_rate_pct": round(pred_rate, 1),
                "windows": total_predictions,
                "correct": correct_predictions,
            })

    # Save
    if results:
        csv_path = OUT_DIR / "meta_lookback_prediction.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}")

    return results


# ============================================================
# RESEARCH 2: Meta-Strategy Walk-Forward
# ============================================================
def research2_meta_walkforward(coins, indicator_cache):
    print("\n" + "="*70)
    print("RESEARCH 2: 메타 전략 Walk-Forward 실전 시뮬레이션")
    print("매 14일마다: 최근 30일 성과 기반으로 전략 선택 → 14일 실행")
    print("="*70)

    test_configs = [
        ("atr-breakout", "short", 7, 7),
        ("bb-squeeze-short", "short", 7, 7),
        ("keltner-squeeze", "short", 7, 7),
        ("ichimoku", "short", 7, 7),
        ("supertrend", "short", 7, 7),
        ("heikin-ashi", "short", 7, 7),
        ("donchian-breakout", "short", 7, 7),
        ("atr-breakout", "long", 7, 7),
        ("bb-squeeze-short", "long", 7, 7),
        ("atr-breakout", "both", 7, 7),
        ("bb-squeeze-short", "both", 7, 7),
        ("keltner-squeeze", "both", 7, 7),
    ]

    LOOKBACK = 30
    FORWARD = 14
    START = datetime.now() - timedelta(days=365)

    # Methods to test
    methods = {
        "top1": lambda scores: [max(scores, key=scores.get)],
        "top2": lambda scores: sorted(scores, key=scores.get, reverse=True)[:2],
        "top3": lambda scores: sorted(scores, key=scores.get, reverse=True)[:3],
        "pf_weighted": lambda scores: sorted(scores, key=scores.get, reverse=True)[:3],  # weighted later
        "static_atr_short": lambda scores: [("atr-breakout", "short", 7, 7)],
        "static_bb_short": lambda scores: [("bb-squeeze-short", "short", 7, 7)],
        "static_keltner_short": lambda scores: [("keltner-squeeze", "short", 7, 7)],
        "equal_weight_all": lambda scores: list(scores.keys()),
    }

    method_equity = {m: [10000] for m in methods}
    method_trades = {m: 0 for m in methods}
    method_periods = {m: [] for m in methods}

    current = START
    period_num = 0

    while current + timedelta(days=LOOKBACK + FORWARD) <= datetime.now():
        lb_start = current
        lb_end = current + timedelta(days=LOOKBACK)
        fw_start = lb_end
        fw_end = lb_end + timedelta(days=FORWARD)
        period_num += 1

        # Score all strategies on lookback
        lb_scores = {}
        for sid, direction, sl, tp in test_configs:
            r = run_period_fast(sid, direction, indicator_cache, lb_start, lb_end, sl, tp)
            if r["trades"] >= 5:
                lb_scores[(sid, direction, sl, tp)] = r["pf"]

        if not lb_scores:
            current += timedelta(days=FORWARD)
            continue

        # For each method, select strategies and measure forward
        for method_name, selector in methods.items():
            if method_name.startswith("static_"):
                # Static: always use the same strategy
                selected = selector(lb_scores)
            else:
                selected = selector(lb_scores)

            # Run forward period for selected strategies
            fw_pnls = []
            for key in selected:
                if isinstance(key, tuple) and len(key) == 4:
                    sid, direction, sl, tp = key
                elif isinstance(key, tuple) and len(key) == 2:
                    sid, direction = key
                    sl, tp = 7, 7
                else:
                    continue
                r = run_period_fast(sid, direction, indicator_cache, fw_start, fw_end, sl, tp)
                if r["trades"] > 0:
                    fw_pnls.append(r["total_pnl"])
                    method_trades[method_name] += r["trades"]

            if fw_pnls:
                if method_name == "pf_weighted" and len(selected) > 1:
                    # Weight by lookback PF
                    weights = [lb_scores.get(k, 1.0) for k in selected if k in lb_scores]
                    total_w = sum(weights)
                    if total_w > 0:
                        avg_pnl = sum(p * w / total_w for p, w in zip(fw_pnls, weights))
                    else:
                        avg_pnl = np.mean(fw_pnls)
                else:
                    avg_pnl = np.mean(fw_pnls)

                # Position sizing: 1% risk per trade equivalent
                capital = method_equity[method_name][-1]
                period_return = avg_pnl / 100 * 0.3  # ~30% of capital deployed
                new_capital = capital * (1 + period_return)
                method_equity[method_name].append(new_capital)
                method_periods[method_name].append({
                    "period": period_num,
                    "fw_start": fw_start.strftime("%Y-%m-%d"),
                    "pnl_pct": round(avg_pnl, 2),
                    "selected": [f"{k[0]}({k[1]})" for k in selected if isinstance(k, tuple)],
                })

        current += timedelta(days=FORWARD)

    # Results
    print(f"\n  {period_num} periods tested (14-day each)")
    print(f"\n  {'Method':<25s} {'Final $':>10s} {'Return':>8s} {'MDD':>6s} {'Periods+':>8s}")
    print("  " + "-"*65)

    results = []
    for method_name in methods:
        eq = method_equity[method_name]
        if len(eq) < 2:
            continue
        final = eq[-1]
        ret = (final / 10000 - 1) * 100
        eq_arr = np.array(eq)
        peaks = np.maximum.accumulate(eq_arr)
        dd = (peaks - eq_arr) / peaks * 100
        mdd = float(np.max(dd))

        profitable_periods = sum(1 for i in range(1, len(eq)) if eq[i] > eq[i-1])
        total_p = len(eq) - 1

        mark = "★" if ret > 50 and mdd < 30 else ("✓" if ret > 0 else "✗")
        print(f"  {method_name:<25s} ${final:>9,.0f} {ret:>+7.1f}% {mdd:>5.1f}% {profitable_periods}/{total_p} {mark}")

        results.append({
            "method": method_name,
            "final_capital": round(final),
            "return_pct": round(ret, 1),
            "mdd_pct": round(mdd, 1),
            "profitable_periods": profitable_periods,
            "total_periods": total_p,
            "total_trades": method_trades[method_name],
        })

    if results:
        csv_path = OUT_DIR / "meta_walkforward.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}")

    return results


# ============================================================
# RESEARCH 3: Strategy Correlation Matrix
# ============================================================
def research3_correlation(coins, indicator_cache):
    print("\n" + "="*70)
    print("RESEARCH 3: 전략 간 상관관계 매트릭스")
    print("="*70)

    test_configs = [
        ("atr-breakout", "short"),
        ("bb-squeeze-short", "short"),
        ("keltner-squeeze", "short"),
        ("ichimoku", "short"),
        ("supertrend", "short"),
        ("heikin-ashi", "short"),
        ("donchian-breakout", "short"),
        ("atr-breakout", "long"),
        ("bb-squeeze-short", "long"),
    ]

    # Compute weekly PnL for each strategy over 2 years
    weekly_pnls = {}
    start = datetime.now() - timedelta(days=730)

    for sid, direction in test_configs:
        label = f"{sid}({direction})"
        pnls = []
        current = start
        while current + timedelta(days=7) <= datetime.now():
            r = run_period_fast(sid, direction, indicator_cache,
                              current, current + timedelta(days=7))
            pnls.append(r["total_pnl"])
            current += timedelta(days=7)
        weekly_pnls[label] = pnls

    # Correlation matrix
    labels = list(weekly_pnls.keys())
    n = len(labels)
    corr_matrix = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            a = np.array(weekly_pnls[labels[i]])
            b = np.array(weekly_pnls[labels[j]])
            min_len = min(len(a), len(b))
            if min_len > 5:
                c = np.corrcoef(a[:min_len], b[:min_len])[0, 1]
                corr_matrix[i, j] = c if not np.isnan(c) else 0

    print(f"\n  Correlation Matrix (weekly PnL, 2y):")
    print(f"  {'':30s}", end="")
    for l in labels:
        print(f" {l[:8]:>8s}", end="")
    print()

    results = []
    for i in range(n):
        print(f"  {labels[i]:30s}", end="")
        for j in range(n):
            c = corr_matrix[i, j]
            mark = "█" if c > 0.5 else ("▓" if c > 0.2 else ("░" if c > -0.2 else "○"))
            print(f" {c:>7.2f}{mark}", end="")
        print()

    # Find best anti-correlated pairs
    print(f"\n  Best anti-correlated pairs (for portfolio diversification):")
    pairs = []
    for i in range(n):
        for j in range(i+1, n):
            pairs.append((labels[i], labels[j], corr_matrix[i, j]))
            results.append({
                "strategy_a": labels[i],
                "strategy_b": labels[j],
                "correlation": round(corr_matrix[i, j], 3),
            })

    pairs.sort(key=lambda x: x[2])
    for a, b, c in pairs[:10]:
        mark = "★" if c < 0 else ""
        print(f"    {a:30s} ↔ {b:30s}: r={c:+.3f} {mark}")

    if results:
        csv_path = OUT_DIR / "meta_correlation.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}")

    return results


# ============================================================
# RESEARCH 4: Volatility Regime Adaptive Strategy
# ============================================================
def research4_volatility_regime(coins, indicator_cache):
    print("\n" + "="*70)
    print("RESEARCH 4: 변동성 레짐 → 전략 자동 매핑")
    print("="*70)

    # Compute BTC ATR regime over time
    btc_df = None
    for sym, df in coins:
        if sym == "BTCUSDT":
            btc_df = df.copy()
            break

    if btc_df is None:
        print("  BTC data not found!")
        return []

    # Calculate ATR-based volatility regime
    btc_df["atr14"] = btc_df["high"].rolling(14).max() - btc_df["low"].rolling(14).min()
    btc_df["atr_ma"] = btc_df["atr14"].rolling(168).mean()  # 7-day MA of ATR
    btc_df["vol_regime"] = "normal"
    btc_df.loc[btc_df["atr14"] > btc_df["atr_ma"] * 1.3, "vol_regime"] = "high_vol"
    btc_df.loc[btc_df["atr14"] < btc_df["atr_ma"] * 0.7, "vol_regime"] = "low_vol"

    # EMA trend regime
    btc_df["ema20"] = btc_df["close"].ewm(span=20).mean()
    btc_df["ema50"] = btc_df["close"].ewm(span=50).mean()
    btc_df["trend_regime"] = "sideways"
    btc_df.loc[btc_df["ema20"] > btc_df["ema50"] * 1.01, "trend_regime"] = "uptrend"
    btc_df.loc[btc_df["ema20"] < btc_df["ema50"] * 0.99, "trend_regime"] = "downtrend"

    # Combined regime
    btc_df["regime"] = btc_df["vol_regime"] + "_" + btc_df["trend_regime"]

    # For each month, determine regime and test all strategies
    test_configs = [
        ("atr-breakout", "short"), ("atr-breakout", "long"), ("atr-breakout", "both"),
        ("bb-squeeze-short", "short"), ("bb-squeeze-short", "long"), ("bb-squeeze-short", "both"),
        ("keltner-squeeze", "short"), ("keltner-squeeze", "long"),
        ("ichimoku", "short"), ("ichimoku", "long"),
        ("supertrend", "short"), ("supertrend", "long"),
        ("heikin-ashi", "short"),
        ("donchian-breakout", "short"),
    ]

    results = []
    current = datetime.now() - timedelta(days=700)

    while current + timedelta(days=30) <= datetime.now():
        month_start = current
        month_end = current + timedelta(days=30)

        # Determine dominant regime in this month
        mask = (btc_df["timestamp"] >= pd.Timestamp(month_start)) & \
               (btc_df["timestamp"] <= pd.Timestamp(month_end))
        month_data = btc_df[mask]

        if len(month_data) < 100:
            current += timedelta(days=30)
            continue

        vol_regime = month_data["vol_regime"].mode().iloc[0] if len(month_data) > 0 else "normal"
        trend_regime = month_data["trend_regime"].mode().iloc[0] if len(month_data) > 0 else "sideways"
        combined = f"{vol_regime}_{trend_regime}"

        # Test all strategies in this month
        month_scores = {}
        for sid, direction in test_configs:
            r = run_period_fast(sid, direction, indicator_cache,
                              month_start, month_end)
            if r["trades"] >= 5:
                month_scores[(sid, direction)] = r

        if month_scores:
            best_key = max(month_scores, key=lambda k: month_scores[k]["pf"])
            best = month_scores[best_key]

            results.append({
                "month": month_start.strftime("%Y-%m"),
                "vol_regime": vol_regime,
                "trend_regime": trend_regime,
                "combined": combined,
                "best_strategy": f"{best_key[0]}({best_key[1]})",
                "best_pf": best["pf"],
                "best_wr": best["wr"],
                "best_trades": best["trades"],
                "best_pnl": best["total_pnl"],
                "n_profitable": sum(1 for v in month_scores.values() if v["pf"] > 1.0),
                "n_tested": len(month_scores),
            })

        current += timedelta(days=30)

    # Analyze: which regime → which strategy?
    print(f"\n  {len(results)} monthly periods analyzed")
    print(f"\n  Regime → Best Strategy mapping:")

    regime_best = defaultdict(list)
    for r in results:
        regime_best[r["combined"]].append(r["best_strategy"])

    for regime, strategies in sorted(regime_best.items()):
        # Count most common
        from collections import Counter
        counts = Counter(strategies)
        top = counts.most_common(3)
        print(f"    {regime:30s} ({len(strategies)} months):")
        for strat, cnt in top:
            print(f"      {strat:40s} {cnt}/{len(strategies)} ({cnt/len(strategies)*100:.0f}%)")

    if results:
        csv_path = OUT_DIR / "meta_regime_mapping.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}")

    return results


# ============================================================
# RESEARCH 5: Optimal Meta-Strategy (Combined)
# ============================================================
def research5_optimal_meta(coins, indicator_cache):
    print("\n" + "="*70)
    print("RESEARCH 5: 최적 메타 전략 구현 + 백테스트")
    print("매 7일마다: regime 판단 + lookback 30일 → top2 전략 선택 → 실행")
    print("="*70)

    # Load BTC for regime detection
    btc_df = None
    for sym, df in coins:
        if sym == "BTCUSDT":
            btc_df = df.copy()
            break

    if btc_df is None:
        print("  No BTC data!")
        return []

    btc_df["atr14"] = btc_df["high"].rolling(14).max() - btc_df["low"].rolling(14).min()
    btc_df["atr_ma"] = btc_df["atr14"].rolling(168).mean()
    btc_df["ema20"] = btc_df["close"].ewm(span=20).mean()
    btc_df["ema50"] = btc_df["close"].ewm(span=50).mean()

    test_configs = [
        ("atr-breakout", "short", 7, 7),
        ("atr-breakout", "both", 7, 7),
        ("bb-squeeze-short", "short", 7, 7),
        ("bb-squeeze-short", "both", 7, 7),
        ("keltner-squeeze", "short", 7, 7),
        ("keltner-squeeze", "both", 7, 7),
        ("ichimoku", "short", 7, 7),
        ("supertrend", "short", 7, 7),
        ("heikin-ashi", "short", 7, 7),
        ("donchian-breakout", "short", 7, 7),
    ]

    LOOKBACK = 30
    REBALANCE = 7
    CAPITAL = 10000
    RISK_PER_TRADE = 0.01

    # Track equity for meta vs each static strategy
    meta_equity = [CAPITAL]
    static_equities = {f"{c[0]}({c[1]})": [CAPITAL] for c in test_configs}

    current = datetime.now() - timedelta(days=365)
    selections_log = []

    while current + timedelta(days=LOOKBACK + REBALANCE) <= datetime.now():
        lb_start = current
        lb_end = current + timedelta(days=LOOKBACK)
        fw_start = lb_end
        fw_end = lb_end + timedelta(days=REBALANCE)

        # Regime at rebalance point
        mask = (btc_df["timestamp"] >= pd.Timestamp(lb_end - timedelta(days=7))) & \
               (btc_df["timestamp"] <= pd.Timestamp(lb_end))
        regime_data = btc_df[mask]

        vol_regime = "normal"
        trend_regime = "sideways"
        if len(regime_data) > 10:
            last = regime_data.iloc[-1]
            if last["atr14"] > last["atr_ma"] * 1.3:
                vol_regime = "high_vol"
            elif last["atr14"] < last["atr_ma"] * 0.7:
                vol_regime = "low_vol"
            if last["ema20"] > last["ema50"] * 1.01:
                trend_regime = "uptrend"
            elif last["ema20"] < last["ema50"] * 0.99:
                trend_regime = "downtrend"

        # Score strategies on lookback
        lb_scores = {}
        for sid, direction, sl, tp in test_configs:
            r = run_period_fast(sid, direction, indicator_cache, lb_start, lb_end, sl, tp)
            if r["trades"] >= 3:
                lb_scores[(sid, direction, sl, tp)] = r["pf"]

        # Meta selection: top 2 non-conflicting
        if lb_scores:
            sorted_strats = sorted(lb_scores.items(), key=lambda x: x[1], reverse=True)
            selected = [sorted_strats[0][0]]

            for key, pf in sorted_strats[1:]:
                # Check conflict with already selected
                conflict = False
                for sel in selected:
                    base_a = sel[0].replace("-short", "").replace("-long", "")
                    base_b = key[0].replace("-short", "").replace("-long", "")
                    if base_a == base_b:
                        conflict = True
                        break
                    if sel[0] in SQUEEZE_IDS and key[0] in SQUEEZE_IDS and sel[1] == key[1]:
                        conflict = True
                        break
                if not conflict:
                    selected.append(key)
                if len(selected) >= 2:
                    break
        else:
            selected = [("atr-breakout", "short", 7, 7)]  # fallback

        # Run forward for meta
        meta_pnls = []
        for sid, direction, sl, tp in selected:
            r = run_period_fast(sid, direction, indicator_cache, fw_start, fw_end, sl, tp)
            if r["trades"] > 0:
                meta_pnls.append(r["total_pnl"])

        meta_period_pnl = np.mean(meta_pnls) if meta_pnls else 0
        meta_cap = meta_equity[-1] * (1 + meta_period_pnl / 100 * 0.3)
        meta_equity.append(meta_cap)

        # Run forward for each static
        for sid, direction, sl, tp in test_configs:
            label = f"{sid}({direction})"
            r = run_period_fast(sid, direction, indicator_cache, fw_start, fw_end, sl, tp)
            cap = static_equities[label][-1]
            pnl = r["total_pnl"] if r["trades"] > 0 else 0
            static_equities[label].append(cap * (1 + pnl / 100 * 0.3))

        selections_log.append({
            "date": fw_start.strftime("%Y-%m-%d"),
            "vol_regime": vol_regime,
            "trend_regime": trend_regime,
            "selected": [f"{s[0]}({s[1]})" for s in selected],
            "selected_lb_pf": [lb_scores.get(s, 0) for s in selected],
            "meta_pnl": round(meta_period_pnl, 2),
        })

        current += timedelta(days=REBALANCE)

    # Final comparison
    print(f"\n  {len(selections_log)} rebalance periods")
    print(f"\n  {'Strategy':<35s} {'Final $':>10s} {'Return':>8s} {'MDD':>6s}")
    print("  " + "-"*65)

    def calc_mdd(eq):
        ea = np.array(eq)
        peaks = np.maximum.accumulate(ea)
        dd = (peaks - ea) / peaks * 100
        return float(np.max(dd))

    # Meta first
    meta_ret = (meta_equity[-1] / CAPITAL - 1) * 100
    meta_mdd = calc_mdd(meta_equity)
    print(f"  {'★ META (adaptive top2)':35s} ${meta_equity[-1]:>9,.0f} {meta_ret:>+7.1f}% {meta_mdd:>5.1f}%")

    results = [{
        "strategy": "META_adaptive_top2",
        "final": round(meta_equity[-1]),
        "return_pct": round(meta_ret, 1),
        "mdd_pct": round(meta_mdd, 1),
    }]

    for sid, direction, sl, tp in test_configs:
        label = f"{sid}({direction})"
        eq = static_equities[label]
        ret = (eq[-1] / CAPITAL - 1) * 100
        mdd = calc_mdd(eq)
        mark = "✓" if ret > 0 else "✗"
        print(f"  {label:35s} ${eq[-1]:>9,.0f} {ret:>+7.1f}% {mdd:>5.1f}% {mark}")
        results.append({
            "strategy": label,
            "final": round(eq[-1]),
            "return_pct": round(ret, 1),
            "mdd_pct": round(mdd, 1),
        })

    # Selection log
    print(f"\n  Selection history (last 10):")
    for entry in selections_log[-10:]:
        print(f"    {entry['date']} [{entry['vol_regime']:8s} {entry['trend_regime']:9s}] → {entry['selected']} pnl={entry['meta_pnl']:+.1f}%")

    if results:
        csv_path = OUT_DIR / "meta_optimal.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}")

    return results, selections_log


# ============================================================
if __name__ == "__main__":
    start = time.time()
    print(f"Meta Strategy Research — {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    coins = load_coins(top_n=30)
    print(f"Loaded {len(coins)} coins")

    indicator_cache = precompute_indicators(coins)

    r1 = research1_lookback_prediction(coins, indicator_cache)
    r2 = research2_meta_walkforward(coins, indicator_cache)
    r3 = research3_correlation(coins, indicator_cache)
    r4 = research4_volatility_regime(coins, indicator_cache)
    r5, log = research5_optimal_meta(coins, indicator_cache)

    elapsed = time.time() - start
    print(f"\n{'='*70}")
    print(f"COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}m)")
    print(f"\nKey findings saved to {OUT_DIR}/meta_*.csv")
