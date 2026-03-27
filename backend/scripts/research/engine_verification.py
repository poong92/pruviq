#!/usr/bin/env python3
"""Level 0: 엔진 기초 수학 검증 — 계산이 무결한가?"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.strategies.registry import get_strategy
from src.simulation.engine_fast import run_fast

DATA_DIR = Path(__file__).parent.parent / "data" / "futures"
FEE, SLIP, FUND = 0.0008, 0.0002, 0.0001

df = pd.read_csv(DATA_DIR / "BTCUSDT_1h.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])
print(f"BTC candles: {len(df)}, Range: {df.timestamp.iloc[0]} ~ {df.timestamp.iloc[-1]}")

results = []

# TEST 1: 단일 트레이드 수동 검증
print("\n" + "="*70)
print("TEST 1: 단일 트레이드 수동 검증")
strategy, _, _ = get_strategy("bb-squeeze-short")
df_ind = strategy.calculate_indicators(df.copy())
df_test = df_ind.tail(500).copy()
result = run_fast(
    df_test, strategy, "BTCUSDT",
    sl_pct=0.07, tp_pct=0.07, max_bars=48,
    fee_pct=FEE, slippage_pct=SLIP, direction="short",
    market_type="futures", strategy_id="bb-squeeze-short", funding_rate_8h=FUND,
)

t1_ok = False
if result.trades:
    t = result.trades[0]
    print(f"  Entry: {t.entry_price:.2f} at {t.entry_time}")
    print(f"  Exit:  {t.exit_price:.2f} at {t.exit_time} ({t.exit_reason})")
    print(f"  Direction: {t.direction}, Bars: {t.bars_held}")
    print(f"  Engine PnL: {t.pnl_pct:.4f}%, Gross: {t.pnl_gross_pct:.4f}%, Fee: {t.fee_pct:.4f}%, Fund: {t.funding_pct:.4f}%")

    if t.direction == "short":
        gross = (t.entry_price - t.exit_price) / t.entry_price * 100
    else:
        gross = (t.exit_price - t.entry_price) / t.entry_price * 100
    fee_total = (FEE + SLIP) * 2 * 100
    fund_est = FUND * (t.bars_held / 8) * 100
    manual = gross - fee_total - fund_est

    print(f"  Manual PnL:  {manual:.4f}% (gross={gross:.4f} fee={fee_total:.4f} fund={fund_est:.4f})")
    diff = abs(t.pnl_pct - manual)
    t1_ok = diff < 0.01
    print(f"  Diff: {diff:.4f}% -> {'PASS' if t1_ok else 'FAIL'}")

# TEST 2: PF/WR/MDD 계산 검증
print("\n" + "="*70)
print("TEST 2: PF/WR/MDD 수동 vs 엔진")
result_full = run_fast(
    df_ind, strategy, "BTCUSDT",
    sl_pct=0.10, tp_pct=0.08, max_bars=48,
    fee_pct=FEE, slippage_pct=SLIP, direction="short",
    market_type="futures", strategy_id="bb-squeeze-short", funding_rate_8h=FUND,
)

pnls = [t.pnl_pct for t in result_full.trades]
wins = [p for p in pnls if p > 0]
losses = [p for p in pnls if p <= 0]
manual_pf = sum(wins) / abs(sum(losses)) if losses else 999
manual_wr = len(wins) / len(pnls) * 100 if pnls else 0

equity = [100]
for p in pnls:
    equity.append(equity[-1] * (1 + p / 100))
ea = np.array(equity)
peaks = np.maximum.accumulate(ea)
dd = (peaks - ea) / peaks * 100
manual_mdd = float(np.max(dd))

wr_ok = abs(manual_wr - result_full.win_rate) < 0.1
pf_ok = abs(manual_pf - result_full.profit_factor) < 0.01
mdd_ok = abs(manual_mdd - result_full.max_drawdown_pct) < 0.5

print(f"  Trades: {len(pnls)} (engine: {result_full.total_trades})")
print(f"  WR: {manual_wr:.1f}% vs {result_full.win_rate:.1f}% -> {'PASS' if wr_ok else 'FAIL'}")
print(f"  PF: {manual_pf:.2f} vs {result_full.profit_factor:.2f} -> {'PASS' if pf_ok else 'FAIL'}")
print(f"  MDD: {manual_mdd:.1f}% vs {result_full.max_drawdown_pct:.1f}% -> {'PASS' if mdd_ok else 'FAIL'}")

# TEST 3: SL/TP 히트 정확성
print("\n" + "="*70)
print("TEST 3: SL/TP 정확성")
sl_trades = [t for t in result_full.trades if t.exit_reason == "sl"]
tp_trades = [t for t in result_full.trades if t.exit_reason == "tp"]
to_trades = [t for t in result_full.trades if t.exit_reason == "timeout"]

sl_ok = tp_ok2 = True
if sl_trades:
    sl_pnls = [t.pnl_gross_pct for t in sl_trades]
    sl_ok = all(p <= 0 for p in sl_pnls)
    print(f"  SL: {len(sl_trades)} trades, gross range [{min(sl_pnls):.2f}%, {max(sl_pnls):.2f}%], all_neg={sl_ok} -> {'PASS' if sl_ok else 'FAIL'}")

if tp_trades:
    tp_pnls = [t.pnl_gross_pct for t in tp_trades]
    tp_ok2 = all(p >= 0 for p in tp_pnls)
    print(f"  TP: {len(tp_trades)} trades, gross range [{min(tp_pnls):.2f}%, {max(tp_pnls):.2f}%], all_pos={tp_ok2} -> {'PASS' if tp_ok2 else 'FAIL'}")

if to_trades:
    bars = [t.bars_held for t in to_trades]
    print(f"  Timeout: {len(to_trades)} trades, bars range [{min(bars)}, {max(bars)}] (expect ~48)")

# TEST 4: 시간 순서 + 겹침 없음
print("\n" + "="*70)
print("TEST 4: 시간 순서 + 겹침")
times = [t.entry_time for t in result_full.trades]
sorted_ok = all(times[i] <= times[i + 1] for i in range(len(times) - 1))
no_overlap = all(
    result_full.trades[i].exit_time <= result_full.trades[i + 1].entry_time
    for i in range(len(result_full.trades) - 1)
)
print(f"  Sorted: {'PASS' if sorted_ok else 'FAIL'}")
print(f"  No overlap: {'PASS' if no_overlap else 'FAIL'}")

# TEST 5: 전략 독립성
print("\n" + "="*70)
print("TEST 5: 전략 독립성")
strats = ["bb-squeeze-short", "atr-breakout", "ichimoku", "supertrend"]
trade_counts = {}
for sid in strats:
    s, _, _ = get_strategy(sid)
    d = s.calculate_indicators(df.copy())
    r = run_fast(d, s, "BTCUSDT", sl_pct=0.07, tp_pct=0.07, max_bars=48,
                 fee_pct=FEE, slippage_pct=SLIP, direction="short",
                 market_type="futures", strategy_id=sid, funding_rate_8h=FUND)
    trade_counts[sid] = r.total_trades
    print(f"  {sid:20s}: {r.total_trades} trades, PF={r.profit_factor:.2f}")

indep_ok = len(set(trade_counts.values())) == len(trade_counts)
print(f"  All unique: {'PASS' if indep_ok else 'FAIL (duplicate counts)'}")

# TEST 6: 방향 일관성
print("\n" + "="*70)
print("TEST 6: 방향 일관성")
s, _, _ = get_strategy("bb-squeeze-short")
d = s.calculate_indicators(df.copy())
r_s = run_fast(d, s, "BTCUSDT", sl_pct=0.07, tp_pct=0.07, max_bars=48,
               fee_pct=FEE, slippage_pct=SLIP, direction="short",
               market_type="futures", strategy_id="bb-squeeze-short", funding_rate_8h=FUND)
r_l = run_fast(d, s, "BTCUSDT", sl_pct=0.07, tp_pct=0.07, max_bars=48,
               fee_pct=FEE, slippage_pct=SLIP, direction="long",
               market_type="futures", strategy_id="bb-squeeze-short", funding_rate_8h=FUND)

print(f"  SHORT: {r_s.total_trades} trades, PF={r_s.profit_factor:.2f}")
print(f"  LONG:  {r_l.total_trades} trades, PF={r_l.profit_factor:.2f}")
dir_ok = r_s.total_trades != r_l.total_trades or r_s.profit_factor != r_l.profit_factor
print(f"  Different results: {'PASS' if dir_ok else 'FAIL'}")

# SUMMARY
print("\n" + "="*70)
tests = [
    ("T1 Manual PnL", t1_ok),
    ("T2 WR", wr_ok), ("T2 PF", pf_ok), ("T2 MDD", mdd_ok),
    ("T3 SL neg", sl_ok), ("T3 TP pos", tp_ok2),
    ("T4 Sorted", sorted_ok), ("T4 No overlap", no_overlap),
    ("T5 Independence", indep_ok),
    ("T6 Direction", dir_ok),
]
passed = sum(1 for _, ok in tests if ok)
total = len(tests)
print(f"LEVEL 0 RESULT: {passed}/{total} PASS")
for name, ok in tests:
    print(f"  {'PASS' if ok else 'FAIL'} {name}")

if passed == total:
    print("\nENGINE MATH IS SOUND. Proceeding to Level 1.")
else:
    print("\nWARNING: Engine has calculation issues!")
