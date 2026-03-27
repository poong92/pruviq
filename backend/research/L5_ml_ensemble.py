#!/usr/bin/env python3
"""
LEVEL 5: ML 앙상블 (sklearn GradientBoosting)

OHLCV 기반 feature → 다음 8H 방향 예측
Purged Walk-Forward CV로 lookahead bias 방지

Features:
- 기술 인디케이터 (RSI, BB %B, ATR ratio, volume ratio, EMA slope)
- 시계열 통계 (returns skew, kurtosis, Hurst proxy)
- 가격 구조 (higher high/lower low 패턴, 캔들 body ratio)
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics


def build_features(df):
    """Build feature matrix from OHLCV dataframe."""
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]
    open_p = df["open"]

    features = pd.DataFrame(index=df.index)

    # Price-based
    features["return_1h"] = close.pct_change()
    features["return_4h"] = close.pct_change(4)
    features["return_8h"] = close.pct_change(8)
    features["return_24h"] = close.pct_change(24)
    features["return_168h"] = close.pct_change(168)

    # EMA
    ema20 = close.ewm(span=20).mean()
    ema50 = close.ewm(span=50).mean()
    features["ema_ratio"] = ema20 / ema50
    features["ema_slope"] = ema20.pct_change(4)
    features["price_vs_ema20"] = (close - ema20) / ema20

    # Bollinger
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    features["bb_pct_b"] = (close - (sma20 - 2*std20)) / (4*std20)  # %B
    features["bb_width"] = (4*std20) / sma20

    # RSI(14)
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta).where(delta < 0, 0.0).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / loss
    features["rsi"] = 100 - (100 / (1 + rs))

    # ATR ratio
    tr = pd.concat([high-low, (high-close.shift()).abs(), (low-close.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.ewm(span=14, adjust=False).mean()
    atr_ma = atr14.rolling(168).mean()
    features["atr_ratio"] = atr14 / atr_ma

    # Volume
    vol_ma = volume.rolling(24).mean()
    features["volume_ratio"] = volume / vol_ma
    features["volume_trend"] = volume.rolling(24).mean() / volume.rolling(168).mean()

    # Candle structure
    body = (close - open_p).abs()
    total_range = high - low
    features["body_ratio"] = body / total_range.replace(0, np.nan)
    features["upper_wick"] = (high - pd.concat([close, open_p], axis=1).max(axis=1)) / total_range.replace(0, np.nan)

    # Higher high / lower low (trend structure)
    features["hh"] = (high > high.rolling(24).max().shift(1)).astype(int)
    features["ll"] = (low < low.rolling(24).min().shift(1)).astype(int)

    # Rolling statistics
    ret_24 = close.pct_change().rolling(24)
    features["ret_skew"] = ret_24.skew()
    features["ret_kurt"] = ret_24.kurt()
    features["ret_std"] = ret_24.std()

    # Hour of day (cyclical)
    if "timestamp" in df.columns:
        hour = pd.to_datetime(df["timestamp"]).dt.hour
        features["hour_sin"] = np.sin(2 * np.pi * hour / 24)
        features["hour_cos"] = np.cos(2 * np.pi * hour / 24)

    # Target: next 8H return direction (1=up, 0=down)
    features["target"] = (close.shift(-8) > close).astype(int)

    return features


def purged_walk_forward(features_df, n_splits=8, train_pct=0.6, gap_bars=48):
    """Purged walk-forward cross-validation. Gap prevents lookahead."""
    n = len(features_df)
    train_size = int(n * train_pct)
    test_size = (n - train_size) // n_splits

    splits = []
    for i in range(n_splits):
        test_start = train_size + i * test_size
        test_end = min(test_start + test_size, n)
        train_end = test_start - gap_bars  # purge gap

        if train_end < 100 or test_end > n:
            continue

        splits.append((
            list(range(0, train_end)),
            list(range(test_start, test_end)),
        ))

    return splits


def run():
    engine = ResearchEngine(top_n=5, verbose=True)  # BTC + top 4 for speed
    btc = engine.get_btc()

    print("\n" + "="*70)
    print("LEVEL 5: ML 앙상블 (GradientBoosting)")
    print("="*70)

    # Build features
    print("\n  Building features...")
    features_df = build_features(btc)
    features_df = features_df.replace([np.inf, -np.inf], np.nan).dropna()
    print(f"  Samples: {len(features_df)}, Features: {len(features_df.columns) - 1}")

    # Feature columns (exclude target)
    feature_cols = [c for c in features_df.columns if c != "target"]
    X = features_df[feature_cols].values
    y = features_df["target"].values

    print(f"  Class balance: up={y.sum()}/{len(y)} ({y.mean()*100:.1f}%), down={(1-y).sum()}/{len(y)} ({(1-y.mean())*100:.1f}%)")

    # ============================================================
    # TEST 1: Purged Walk-Forward CV
    # ============================================================
    print(f"\n  TEST 1: Purged Walk-Forward CV (8 splits, 48-bar gap)")

    splits = purged_walk_forward(features_df, n_splits=8, gap_bars=48)
    print(f"  Splits: {len(splits)}")

    all_preds = []
    all_true = []
    split_results = []

    for i, (train_idx, test_idx) in enumerate(splits):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        model = GradientBoostingClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.1,
            subsample=0.8, random_state=42,
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)

        all_preds.extend(y_pred)
        all_true.extend(y_test)

        split_results.append({
            "split": i+1,
            "train_size": len(train_idx),
            "test_size": len(test_idx),
            "accuracy": round(acc * 100, 1),
            "f1": round(f1, 3),
        })

        mark = "★" if acc > 0.53 else ("✓" if acc > 0.50 else "✗")
        print(f"    Split {i+1}: train={len(train_idx):5d} test={len(test_idx):4d} acc={acc*100:.1f}% f1={f1:.3f} {mark}")

    overall_acc = accuracy_score(all_true, all_preds)
    overall_f1 = f1_score(all_true, all_preds)
    print(f"\n    Overall: acc={overall_acc*100:.1f}% f1={overall_f1:.3f}")
    print(f"    {'★ EDGE EXISTS' if overall_acc > 0.52 else '✗ NO EDGE (≤52%)'}")

    engine.save("L5_ml_cv_results", split_results)

    # ============================================================
    # TEST 2: Feature Importance
    # ============================================================
    print(f"\n  TEST 2: Feature Importance (last split model)")

    importances = model.feature_importances_
    feat_imp = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)

    print(f"    Top 10 features:")
    for name, imp in feat_imp[:10]:
        bar = "█" * int(imp * 100)
        print(f"      {name:20s}: {imp:.3f} {bar}")

    # ============================================================
    # TEST 3: ML 시그널 → 실제 트레이딩 시뮬레이션
    # ============================================================
    print(f"\n  TEST 3: ML 시그널 → 트레이딩 시뮬레이션")

    # Use last split as OOS
    if splits:
        _, test_idx = splits[-1]
        test_features = features_df.iloc[test_idx]

        # Trade on predictions
        pnls_ml = []
        pnls_random = []

        for idx, (_, row) in zip(test_idx, test_features.iterrows()):
            pred = all_preds[len(all_preds) - len(test_idx) + test_idx.index(idx)] if idx in test_idx else 0

            # Get actual 8H return
            if idx + 8 < len(btc):
                actual_ret = (btc["close"].iloc[idx + 8] / btc["close"].iloc[idx] - 1) * 100

                # ML trade: long if pred=1, short if pred=0
                if pred == 1:
                    ml_pnl = actual_ret - 0.2  # fee
                else:
                    ml_pnl = -actual_ret - 0.2

                pnls_ml.append(ml_pnl)
                pnls_random.append(actual_ret - 0.2 if np.random.random() > 0.5 else -actual_ret - 0.2)

        if pnls_ml:
            m_ml = calc_metrics(pnls_ml)
            m_random = calc_metrics(pnls_random)

            print(f"    ML strategy:     PF={m_ml['pf']:.2f} WR={m_ml['wr']:.1f}% T={m_ml['trades']} Sharpe={m_ml['sharpe']:.2f}")
            print(f"    Random baseline: PF={m_random['pf']:.2f} WR={m_random['wr']:.1f}% T={m_random['trades']} Sharpe={m_random['sharpe']:.2f}")

            ml_edge = m_ml["pf"] > m_random["pf"] and m_ml["pf"] > 1.0
            print(f"\n    ML {'★ HAS EDGE' if ml_edge else '✗ NO EDGE over random'}")

    # ============================================================
    # Summary
    # ============================================================
    print(f"\n{'='*70}")
    print(f"LEVEL 5 CONCLUSION:")
    if overall_acc > 0.53:
        print(f"  ML achieves {overall_acc*100:.1f}% accuracy — edge exists")
        print(f"  Top features: {', '.join(f[0] for f in feat_imp[:5])}")
        print(f"  → 기존 전략의 필터로 사용 가능")
    elif overall_acc > 0.51:
        print(f"  ML achieves {overall_acc*100:.1f}% — marginal edge, needs more features")
        print(f"  → 펀딩레이트/OI 추가 시 개선 가능성")
    else:
        print(f"  ML achieves {overall_acc*100:.1f}% — no meaningful edge")
        print(f"  → OHLCV 기반 ML은 방향 예측에 한계")


if __name__ == "__main__":
    run()
