#!/usr/bin/env python3
"""
PRUVIQ Daily Strategy Ranking — SNS Content Generator
매일 KST 09:00 (UTC 00:00)에 실행하여 전략 랭킹 콘텐츠 생성

Usage:
    python3 daily_strategy_ranking.py                           # 전체 실행 (API 호출 + 콘텐츠 생성)
    python3 daily_strategy_ranking.py --dry-run                 # 콘텐츠만 출력 (Telegram 미전송)
    python3 daily_strategy_ranking.py --periods 7d,30d,365d    # 여러 기간 동시 계산
    python3 daily_strategy_ranking.py --groups 30,50,100,BTC   # 그룹 지정
    python3 daily_strategy_ranking.py --telegram               # Telegram으로 전송
"""

import argparse
import json
import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Optional

# === Configuration ===
API_BASE = os.getenv("PRUVIQ_API_BASE", "http://localhost:8080").strip()
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()
TELEGRAM_BOT_TOKEN = os.getenv("PRUVIQ_SNS_BOT_TOKEN", "").strip()  # 8058630215 SNS 봇
TELEGRAM_CHAT_ID = os.getenv("PRUVIQ_SNS_CHAT_ID", "").strip()

AVOID_HOURS_1H = [2, 3, 10, 20, 21, 22, 23]  # 1H 전략용 시간 필터

# === 140 strategy variants: 16 base × (direction + timeframe + SL/TP preset) ===
# Format: (strategy_id, direction, name_ko, name_en, timeframe, sl_pct, tp_pct, max_bars)
STRATEGIES = [
    # ─── BB Squeeze (6 variants) ───
    ("bb-squeeze-short", "short", "볼린저 스퀴즈",          "BB Squeeze",           "1H", 10.0,  8.0, 48),
    ("bb-squeeze-long",  "long",  "볼린저 스퀴즈 LONG",     "BB Squeeze LONG",      "1H", 10.0,  8.0, 48),
    ("bb-squeeze-short", "short", "볼린저 스퀴즈 4H",       "BB Squeeze 4H",        "4H", 10.0, 10.0, 12),
    ("bb-squeeze-long",  "long",  "볼린저 스퀴즈 LONG 4H",  "BB Squeeze LONG 4H",   "4H", 10.0, 10.0, 12),
    ("bb-squeeze-short", "short", "볼린저 스퀴즈 6H",       "BB Squeeze 6H",        "6H", 10.0, 12.0,  8),
    ("bb-squeeze-long",  "long",  "볼린저 스퀴즈 LONG 6H",  "BB Squeeze LONG 6H",   "6H", 10.0, 12.0,  8),

    # ─── HV Squeeze (6 variants) ───
    ("hv-squeeze", "short", "HV 스퀴즈",           "HV Squeeze",        "1H", 10.0,  8.0, 48),
    ("hv-squeeze", "long",  "HV 스퀴즈 LONG",      "HV Squeeze LONG",   "1H", 10.0,  8.0, 48),
    ("hv-squeeze", "both",  "HV 스퀴즈 BOTH",      "HV Squeeze BOTH",   "1H", 10.0,  8.0, 48),
    ("hv-squeeze", "short", "HV 스퀴즈 4H",        "HV Squeeze 4H",     "4H", 12.0, 10.0, 12),
    ("hv-squeeze", "short", "HV 스퀴즈 6H",        "HV Squeeze 6H",     "6H", 12.0, 12.0,  8),
    ("hv-squeeze", "long",  "HV 스퀴즈 LONG 6H",   "HV Squeeze LONG 6H","6H", 12.0, 12.0,  8),

    # ─── Keltner Squeeze (6 variants) ───
    ("keltner-squeeze", "short", "켈트너 스퀴즈",           "Keltner Squeeze",       "1H", 10.0,  8.0, 48),
    ("keltner-squeeze", "long",  "켈트너 스퀴즈 LONG",      "Keltner Squeeze LONG",  "1H", 10.0,  8.0, 48),
    ("keltner-squeeze", "both",  "켈트너 스퀴즈 BOTH",      "Keltner Squeeze BOTH",  "1H", 10.0,  8.0, 48),
    ("keltner-squeeze", "short", "켈트너 스퀴즈 4H",        "Keltner Squeeze 4H",    "4H", 12.0, 10.0, 12),
    ("keltner-squeeze", "short", "켈트너 스퀴즈 6H",        "Keltner Squeeze 6H",    "6H", 12.0, 12.0,  8),
    ("keltner-squeeze", "long",  "켈트너 스퀴즈 LONG 6H",   "Keltner Squeeze LONG 6H","6H",12.0, 12.0,  8),

    # ─── SuperTrend (7 variants) ───
    ("supertrend", "short", "슈퍼트렌드",             "SuperTrend",           "1H", 10.0,  8.0, 48),
    ("supertrend", "long",  "슈퍼트렌드 LONG",        "SuperTrend LONG",      "1H", 10.0,  8.0, 48),
    ("supertrend", "both",  "슈퍼트렌드 BOTH",        "SuperTrend BOTH",      "1H", 10.0,  8.0, 48),
    ("supertrend", "long",  "슈퍼트렌드 LONG 와이드", "SuperTrend LONG Wide", "1H",  8.0, 15.0, 72),
    ("supertrend", "short", "슈퍼트렌드 4H",          "SuperTrend 4H",        "4H", 12.0, 12.0, 12),
    ("supertrend", "long",  "슈퍼트렌드 LONG 4H",     "SuperTrend LONG 4H",   "4H", 12.0, 12.0, 12),
    ("supertrend", "long",  "슈퍼트렌드 LONG 6H",     "SuperTrend LONG 6H",   "6H", 12.0, 15.0,  8),

    # ─── MACD Cross (7 variants) ───
    ("macd-cross", "short", "MACD 크로스",             "MACD Cross",           "1H", 10.0,  8.0, 48),
    ("macd-cross", "long",  "MACD 크로스 LONG",        "MACD Cross LONG",      "1H", 10.0,  8.0, 48),
    ("macd-cross", "both",  "MACD 크로스 BOTH",        "MACD Cross BOTH",      "1H", 10.0,  8.0, 48),
    ("macd-cross", "long",  "MACD 크로스 LONG 와이드", "MACD Cross LONG Wide", "1H",  8.0, 15.0, 72),
    ("macd-cross", "short", "MACD 크로스 4H",          "MACD Cross 4H",        "4H", 12.0, 10.0, 12),
    ("macd-cross", "long",  "MACD 크로스 LONG 4H",     "MACD Cross LONG 4H",   "4H", 12.0, 10.0, 12),
    ("macd-cross", "both",  "MACD 크로스 6H",          "MACD Cross 6H",        "6H", 12.0, 12.0,  8),

    # ─── MA Cross (7 variants) ───
    ("ma-cross", "short", "이평선 크로스",               "MA Cross",            "1H", 10.0,  8.0, 48),
    ("ma-cross", "long",  "이평선 크로스 LONG",          "MA Cross LONG",       "1H", 10.0,  8.0, 48),
    ("ma-cross", "both",  "이평선 크로스 BOTH",          "MA Cross BOTH",       "1H", 10.0,  8.0, 48),
    ("ma-cross", "short", "이평선 크로스 4H",            "MA Cross 4H",         "4H", 12.0, 12.0, 12),
    ("ma-cross", "long",  "이평선 크로스 LONG 4H",       "MA Cross LONG 4H",    "4H", 12.0, 12.0, 12),
    ("ma-cross", "both",  "이평선 크로스 BOTH 4H",       "MA Cross BOTH 4H",    "4H", 12.0, 12.0, 12),
    ("ma-cross", "long",  "이평선 크로스 LONG 6H",       "MA Cross LONG 6H",    "6H", 12.0, 15.0,  8),

    # ─── ADX Trend (7 variants) ───
    ("adx-trend", "short", "ADX 추세",              "ADX Trend",           "1H", 10.0,  8.0, 48),
    ("adx-trend", "long",  "ADX 추세 LONG",         "ADX Trend LONG",      "1H", 10.0,  8.0, 48),
    ("adx-trend", "both",  "ADX 추세 BOTH",         "ADX Trend BOTH",      "1H", 10.0,  8.0, 48),
    ("adx-trend", "long",  "ADX 추세 LONG 와이드",  "ADX Trend LONG Wide", "1H",  8.0, 15.0, 72),
    ("adx-trend", "short", "ADX 추세 4H",           "ADX Trend 4H",        "4H", 12.0, 12.0, 12),
    ("adx-trend", "long",  "ADX 추세 LONG 4H",      "ADX Trend LONG 4H",   "4H", 12.0, 12.0, 12),
    ("adx-trend", "both",  "ADX 추세 6H",           "ADX Trend 6H",        "6H", 12.0, 15.0,  8),

    # ─── Ichimoku (7 variants) ───
    ("ichimoku", "short", "일목균형표",               "Ichimoku",            "1H", 10.0,  8.0, 48),
    ("ichimoku", "long",  "일목균형표 LONG",          "Ichimoku LONG",       "1H", 10.0,  8.0, 48),
    ("ichimoku", "both",  "일목균형표 BOTH",          "Ichimoku BOTH",       "1H", 10.0,  8.0, 48),
    ("ichimoku", "long",  "일목균형표 LONG 와이드",   "Ichimoku LONG Wide",  "1H",  8.0, 15.0, 72),
    ("ichimoku", "short", "일목균형표 4H",            "Ichimoku 4H",         "4H", 12.0, 12.0, 12),
    ("ichimoku", "long",  "일목균형표 LONG 4H",       "Ichimoku LONG 4H",    "4H", 12.0, 12.0, 12),
    ("ichimoku", "both",  "일목균형표 6H",            "Ichimoku 6H",         "6H", 12.0, 15.0,  8),

    # ─── Donchian Breakout (7 variants) ───
    ("donchian-breakout", "short", "돈치안 돌파",               "Donchian Breakout",          "1H", 10.0,  8.0, 48),
    ("donchian-breakout", "long",  "돈치안 돌파 LONG",          "Donchian Breakout LONG",     "1H", 10.0,  8.0, 48),
    ("donchian-breakout", "both",  "돈치안 돌파 BOTH",          "Donchian Breakout BOTH",     "1H", 10.0,  8.0, 48),
    ("donchian-breakout", "long",  "돈치안 돌파 LONG 와이드",   "Donchian Breakout LONG Wide","1H",  8.0, 15.0, 72),
    ("donchian-breakout", "short", "돈치안 돌파 4H",            "Donchian Breakout 4H",       "4H", 12.0, 15.0, 12),
    ("donchian-breakout", "long",  "돈치안 돌파 LONG 4H",       "Donchian Breakout LONG 4H",  "4H", 12.0, 15.0, 12),
    ("donchian-breakout", "both",  "돈치안 돌파 6H",            "Donchian Breakout 6H",       "6H", 12.0, 15.0,  8),

    # ─── ATR Breakout (7 variants) ───
    ("atr-breakout", "both",  "ATR 돌파",               "ATR Breakout",          "1H", 10.0,  8.0, 48),
    ("atr-breakout", "long",  "ATR 돌파 LONG",          "ATR Breakout LONG",     "1H", 10.0,  8.0, 48),
    ("atr-breakout", "short", "ATR 돌파 SHORT",         "ATR Breakout SHORT",    "1H", 10.0,  8.0, 48),
    ("atr-breakout", "long",  "ATR 돌파 LONG 와이드",   "ATR Breakout LONG Wide","1H",  8.0, 15.0, 72),
    ("atr-breakout", "both",  "ATR 돌파 4H",            "ATR Breakout 4H",       "4H", 12.0, 15.0, 12),
    ("atr-breakout", "long",  "ATR 돌파 LONG 4H",       "ATR Breakout LONG 4H",  "4H", 12.0, 15.0, 12),
    ("atr-breakout", "both",  "ATR 돌파 6H",            "ATR Breakout 6H",       "6H", 12.0, 15.0,  8),

    # ─── Momentum (7 variants) ───
    ("momentum-long", "long",  "모멘텀",                "Momentum",           "1H", 10.0,  8.0, 48),
    ("momentum-long", "short", "모멘텀 SHORT",          "Momentum SHORT",     "1H", 10.0,  8.0, 48),
    ("momentum-long", "both",  "모멘텀 BOTH",           "Momentum BOTH",      "1H", 10.0,  8.0, 48),
    ("momentum-long", "long",  "모멘텀 와이드",         "Momentum Wide",      "1H",  8.0, 15.0, 72),
    ("momentum-long", "long",  "모멘텀 4H",             "Momentum 4H",        "4H", 12.0, 15.0, 12),
    ("momentum-long", "short", "모멘텀 SHORT 4H",       "Momentum SHORT 4H",  "4H", 12.0, 15.0, 12),
    ("momentum-long", "long",  "모멘텀 6H",             "Momentum 6H",        "6H", 12.0, 15.0,  8),

    # ─── Mean Reversion (8 variants) ───
    ("mean-reversion", "short", "평균회귀",               "Mean Reversion",          "1H",  8.0,  6.0, 24),
    ("mean-reversion", "long",  "평균회귀 LONG",          "Mean Reversion LONG",     "1H",  8.0,  6.0, 24),
    ("mean-reversion", "both",  "평균회귀 BOTH",          "Mean Reversion BOTH",     "1H",  8.0,  6.0, 24),
    ("mean-reversion", "short", "평균회귀 HighRR",        "Mean Reversion HighRR",   "1H",  5.0, 10.0, 24),
    ("mean-reversion", "long",  "평균회귀 LONG HighRR",   "Mean Reversion LONG HRR", "1H",  5.0, 10.0, 24),
    ("mean-reversion", "short", "평균회귀 4H",            "Mean Reversion 4H",       "4H", 10.0,  8.0,  6),
    ("mean-reversion", "long",  "평균회귀 LONG 4H",       "Mean Reversion LONG 4H",  "4H", 10.0,  8.0,  6),
    ("mean-reversion", "short", "평균회귀 6H",            "Mean Reversion 6H",       "6H", 10.0, 10.0,  4),

    # ─── RSI Divergence (8 variants) ───
    ("rsi-divergence", "short", "RSI 다이버전스",           "RSI Divergence",          "1H",  8.0,  6.0, 48),
    ("rsi-divergence", "long",  "RSI 다이버전스 LONG",      "RSI Divergence LONG",     "1H",  8.0,  6.0, 48),
    ("rsi-divergence", "both",  "RSI 다이버전스 BOTH",      "RSI Divergence BOTH",     "1H",  8.0,  6.0, 48),
    ("rsi-divergence", "short", "RSI 다이버전스 HighRR",    "RSI Divergence HighRR",   "1H",  5.0, 10.0, 48),
    ("rsi-divergence", "long",  "RSI 다이버전스 LONG HighRR","RSI Divergence LONG HRR","1H",  5.0, 10.0, 48),
    ("rsi-divergence", "short", "RSI 다이버전스 4H",        "RSI Divergence 4H",       "4H", 10.0, 10.0, 12),
    ("rsi-divergence", "long",  "RSI 다이버전스 LONG 4H",   "RSI Divergence LONG 4H",  "4H", 10.0, 10.0, 12),
    ("rsi-divergence", "both",  "RSI 다이버전스 6H",        "RSI Divergence 6H",       "6H", 10.0, 12.0,  8),

    # ─── Stochastic RSI (8 variants) ───
    ("stochastic-rsi", "short", "스토캐스틱 RSI",            "Stochastic RSI",          "1H",  8.0,  6.0, 48),
    ("stochastic-rsi", "long",  "스토캐스틱 RSI LONG",       "Stochastic RSI LONG",     "1H",  8.0,  6.0, 48),
    ("stochastic-rsi", "both",  "스토캐스틱 RSI BOTH",       "Stochastic RSI BOTH",     "1H",  8.0,  6.0, 48),
    ("stochastic-rsi", "short", "스토캐스틱 RSI HighRR",     "Stochastic RSI HighRR",   "1H",  5.0, 10.0, 48),
    ("stochastic-rsi", "long",  "스토캐스틱 RSI LONG HighRR","Stochastic RSI LONG HRR", "1H",  5.0, 10.0, 48),
    ("stochastic-rsi", "short", "스토캐스틱 RSI 4H",         "Stochastic RSI 4H",       "4H", 10.0,  8.0, 12),
    ("stochastic-rsi", "long",  "스토캐스틱 RSI LONG 4H",    "Stochastic RSI LONG 4H",  "4H", 10.0,  8.0, 12),
    ("stochastic-rsi", "both",  "스토캐스틱 RSI 6H",         "Stochastic RSI 6H",       "6H", 10.0, 10.0,  8),

    # ─── Heikin Ashi (7 variants) ───
    ("heikin-ashi", "short", "하이킨아시",             "Heikin Ashi",          "1H",  8.0,  7.0, 48),
    ("heikin-ashi", "long",  "하이킨아시 LONG",        "Heikin Ashi LONG",     "1H",  8.0,  7.0, 48),
    ("heikin-ashi", "both",  "하이킨아시 BOTH",        "Heikin Ashi BOTH",     "1H",  8.0,  7.0, 48),
    ("heikin-ashi", "long",  "하이킨아시 LONG 와이드", "Heikin Ashi LONG Wide","1H",  8.0, 15.0, 72),
    ("heikin-ashi", "short", "하이킨아시 4H",          "Heikin Ashi 4H",       "4H", 10.0, 10.0, 12),
    ("heikin-ashi", "long",  "하이킨아시 LONG 4H",     "Heikin Ashi LONG 4H",  "4H", 10.0, 10.0, 12),
    ("heikin-ashi", "both",  "하이킨아시 6H",          "Heikin Ashi 6H",       "6H", 10.0, 12.0,  8),
]

# Walk-Forward 검증 실패 전략 — 랭킹 표시 제외 (구조적 손실 확인)
# 키: (strategy_id, direction, timeframe)
# 근거: scripts/daily_strategy_ranking.py 검증 보고서 (2026-03-14)
WF_FAILED = {
    # Mean Reversion SHORT 4H/6H: WF 0/4, MC 양수확률 0%, PF avg 0.77
    # 원인: SL>TP 구조 (R:R 0.74) + 상승장에서 역추세 SHORT 치명적
    ("mean-reversion", "short", "4H"),
    ("mean-reversion", "short", "6H"),
    # RSI Divergence LONG 4H: 36건 샘플 부족 + PF 8.99 비현실적
    ("rsi-divergence", "long", "4H"),
}

# BTC Only symbols
BTC_SYMBOLS = ["BTCUSDT"]


def parse_period(period_str: str) -> tuple[str, str]:
    """Parse period string (e.g., '7d', '30d', '90d') into start/end dates."""
    end = datetime.utcnow()
    days = int(period_str.replace("d", ""))
    start = end - timedelta(days=days)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def run_simulation(
    strategy: str, direction: str, top_n: int,
    start_date: str, end_date: str,
    timeframe: str = "1H", sl_pct: float = 10.0,
    tp_pct: float = 8.0, max_bars: int = 48,
    timeout: int = 60,
    symbols: Optional[list] = None,
) -> Optional[dict]:
    """Call PRUVIQ /simulate API and return results."""
    # 4H 전략은 시간 필터 제거 (4H 캔들에서 hourly 필터 비효율)
    avoid_hours = AVOID_HOURS_1H if timeframe == "1H" else None

    payload = {
        "strategy": strategy,
        "direction": direction,
        "top_n": top_n,
        "start_date": start_date,
        "end_date": end_date,
        "sl_pct": sl_pct,
        "tp_pct": tp_pct,
        "max_bars": max_bars,
        "timeframe": timeframe,
    }
    if avoid_hours:
        payload["avoid_hours"] = avoid_hours
    if symbols:
        payload["symbols"] = symbols

    for attempt in range(3):
        try:
            hdrs = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
            resp = requests.post(
                f"{API_BASE}/simulate",
                json=payload,
                headers=hdrs,
                timeout=timeout,
            )
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait = 2 ** (attempt + 1)
                print(f" 429→{wait}s", end="", flush=True)
                time.sleep(wait)
                continue
            else:
                print(f"  ⚠ {strategy}/{direction}/{timeframe}/top{top_n}: HTTP {resp.status_code}", file=sys.stderr)
                return None
        except requests.exceptions.Timeout:
            print(f"  ⚠ {strategy}/{direction}/{timeframe}/top{top_n}: Timeout", file=sys.stderr)
            return None
        except requests.exceptions.ConnectionError as e:
            # 2026-04-19: pruviq-api 재시작 시점(deploy 직후) Connection refused 감내.
            # save_results 의 Layer 1 validation 이 6 errors 로 차단하던 뿌리.
            # 지수 backoff 재시도로 일시적 재시작 창 (≤30s) 감내.
            if attempt < 2:
                wait = 5 * (2 ** attempt)  # 5s, 10s
                print(f"  ⟳ {strategy}/{direction}/{timeframe}/top{top_n}: "
                      f"ConnectionError, retry in {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            print(f"  ⚠ {strategy}/{direction}/{timeframe}/top{top_n}: "
                  f"ConnectionError (3 attempts failed): {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  ⚠ {strategy}/{direction}/{timeframe}/top{top_n}: {e}", file=sys.stderr)
            return None
    return None


def extract_metrics(result: dict) -> dict:
    """Extract key metrics from API response."""
    metrics = result.get("metrics", result)
    return {
        "total_trades": metrics.get("total_trades", result.get("total_trades", 0)),
        "win_rate": metrics.get("win_rate", result.get("win_rate", 0)),
        "profit_factor": metrics.get("profit_factor", result.get("profit_factor", 0)),
        "total_return": metrics.get("total_return_pct", result.get("total_return_pct", 0)),
        "sharpe": metrics.get("sharpe_ratio", result.get("sharpe_ratio", 0)),
        "max_drawdown": metrics.get("max_drawdown_pct", result.get("max_drawdown_pct", 0)),
        "sortino": metrics.get("sortino_ratio", result.get("sortino_ratio", 0)),
    }


def _run_single_sim(task: dict) -> dict:
    """Worker function for parallel execution. Returns task dict with result."""
    result = run_simulation(
        task["strat_id"], task["direction"], task["top_n"],
        task["start_date"], task["end_date"],
        timeframe=task["timeframe"], sl_pct=task["sl"],
        tp_pct=task["tp"], max_bars=task["max_bars"],
        symbols=task.get("symbols"),
    )
    task["api_result"] = result
    return task


def run_group_simulations(
    start_date: str, end_date: str,
    top_n: int, group_key: str,
    symbols: Optional[list] = None,
    max_workers: int = 5,
) -> list:
    """Run simulations for all strategies in a single group, in parallel."""
    tasks = []
    for strat_id, direction, cat_ko, cat_en, timeframe, sl, tp, max_bars in STRATEGIES:
        tasks.append({
            "strat_id": strat_id,
            "direction": direction,
            "cat_ko": cat_ko,
            "cat_en": cat_en,
            "timeframe": timeframe,
            "sl": sl,
            "tp": tp,
            "max_bars": max_bars,
            "top_n": top_n,
            "start_date": start_date,
            "end_date": end_date,
            "symbols": symbols,
        })

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_run_single_sim, t): t for t in tasks}
        done_count = 0
        total = len(tasks)
        for future in as_completed(futures):
            done_count += 1
            try:
                task = future.result()
            except Exception as e:
                print(f"  ⚠ worker exception: {e}", file=sys.stderr)
                continue

            cat_en = task["cat_en"]
            direction = task["direction"]
            timeframe = task["timeframe"]
            api_result = task["api_result"]

            if api_result:
                m = extract_metrics(api_result)
                m["strategy"] = task["strat_id"]
                m["direction"] = direction
                m["category_ko"] = task["cat_ko"]
                m["category_en"] = cat_en
                m["timeframe"] = timeframe
                m["sl_pct"] = task["sl"]
                m["tp_pct"] = task["tp"]
                results.append(m)
                pf = m["profit_factor"]
                wr = m["win_rate"]
                ret = m["total_return"]
                print(f"  [{done_count}/{total}] {group_key} {cat_en}/{direction}/{timeframe} WR={wr:.0f}% PF={pf:.2f} ret={ret:+.1f}%")
            else:
                print(f"  [{done_count}/{total}] {group_key} {cat_en}/{direction}/{timeframe} FAILED")

    return results


def run_all_simulations_matrix(
    periods: list[str],
    groups: list[str],
    max_workers: int = 5,
) -> dict:
    """Run all period × group combinations and return nested results dict.

    Returns:
        {
            "7d":   {"top30": [...], "top50": [...], "top100": [...], "btc": [...]},
            "30d":  {...},
            "365d": {...},
        }
    """
    all_results = {}

    for period in periods:
        start_date, end_date = parse_period(period)
        all_results[period] = {}
        print(f"\n{'='*60}")
        print(f"Period: {period} ({start_date} ~ {end_date})")
        print(f"{'='*60}")

        for group in groups:
            group_key_lower = group.lower()
            if group_key_lower == "btc":
                top_n = 1
                symbols = BTC_SYMBOLS
                display = "BTC Only"
            else:
                top_n = int(group)
                symbols = None
                display = f"Top {top_n}"

            print(f"\n  Group: {display} ({len(STRATEGIES)} strategies × parallel {max_workers})")
            t0 = time.time()
            results = run_group_simulations(
                start_date, end_date,
                top_n=top_n, group_key=display,
                symbols=symbols,
                max_workers=max_workers,
            )
            elapsed = time.time() - t0

            # Normalize key: "30" → "top30", "btc" stays "btc"
            storage_key = group_key_lower if group_key_lower == "btc" else f"top{group_key_lower}"
            all_results[period][storage_key] = results
            valid = [s for s in results if s["total_trades"] >= 10]
            wr50 = len([s for s in valid if s["win_rate"] >= 50])
            print(f"  {display}: {len(results)} results ({len(valid)} valid, WR50+: {wr50}) in {elapsed:.0f}s")

    return all_results


def run_all_simulations(start_date: str, end_date: str, coin_groups: list) -> dict:
    """Legacy: Run simulations for all strategies × coin groups (sequential).
    Kept for backward compatibility with existing callers.
    """
    results = {}
    total = len(STRATEGIES) * len(coin_groups)
    done = 0

    for top_n, group_name in coin_groups:
        results[group_name] = []
        for strat_id, direction, cat_ko, cat_en, timeframe, sl, tp, max_bars in STRATEGIES:
            done += 1
            print(f"  [{done}/{total}] {cat_en}/{direction}/{timeframe} × {group_name}...", end="", flush=True)

            result = run_simulation(
                strat_id, direction, top_n, start_date, end_date,
                timeframe=timeframe, sl_pct=sl, tp_pct=tp, max_bars=max_bars,
            )

            if result:
                m = extract_metrics(result)
                m["strategy"] = strat_id
                m["direction"] = direction
                m["category_ko"] = cat_ko
                m["category_en"] = cat_en
                m["timeframe"] = timeframe
                m["sl_pct"] = sl
                m["tp_pct"] = tp
                results[group_name].append(m)
                pf = m["profit_factor"]
                wr = m["win_rate"]
                ret = m["total_return"]
                print(f" WR={wr:.0f}% PF={pf:.2f} ret={ret:+.1f}%")
            else:
                print(" FAILED")

            time.sleep(2.1)  # Rate limit 보호 (API: 30 req/min)

    return results


def generate_content_ko(results: dict, period: str, start_date: str, end_date: str) -> str:
    """Generate Korean SNS content from results dict.

    results: {"group_name": [...entries...]} (legacy flat format) or
             the top50 slice for backward compat.
    """
    now_kst = datetime.utcnow() + timedelta(hours=9)
    date_str = now_kst.strftime("%Y-%m-%d")
    lines = []

    lines.append(f"📊 PRUVIQ 전략 데일리 랭킹")
    lines.append(f"📅 {date_str} | 기간: 최근 {period}")
    lines.append(f"🔗 pruviq.com/simulator")
    lines.append("")

    for group_name, strats in results.items():
        if not strats:
            continue

        # 최소 10건 이상만 신뢰
        valid = [s for s in strats if s["total_trades"] >= 10]
        if not valid:
            valid = strats

        # Walk-Forward 실패 전략 제외 (구조적 손실 확인)
        valid = [s for s in valid
                 if (s["strategy"], s["direction"], s.get("timeframe", "1H")) not in WF_FAILED]

        # 승률 기준 정렬 (SNS는 win_rate가 더 직관적)
        ranked_by_wr = sorted(valid, key=lambda x: x["win_rate"], reverse=True)

        lines.append(f"━━━ {group_name} ({len(valid)}개 전략) ━━━")
        lines.append("")

        # Top 3 by win_rate
        lines.append("🏆 오늘의 Best 전략 (승률 기준)")
        for i, s in enumerate(ranked_by_wr[:3], 1):
            medal = ["🥇", "🥈", "🥉"][i - 1]
            tf_tag = f" [{s['timeframe']}]" if s.get("timeframe", "1H") != "1H" else ""
            lines.append(
                f"{medal} {s['category_ko']}{tf_tag} {s['direction'].upper()}"
                f" | 승률 {s['win_rate']:.1f}%"
                f" | PF {s['profit_factor']:.2f}"
                f" | {s['total_trades']}건"
            )
        lines.append("")

        # Worst 3 by win_rate
        worst = sorted(valid, key=lambda x: x["win_rate"])[:3]
        lines.append("⚠️ 오늘의 Worst 전략")
        for i, s in enumerate(worst, 1):
            tf_tag = f" [{s['timeframe']}]" if s.get("timeframe", "1H") != "1H" else ""
            lines.append(
                f"  {i}. {s['category_ko']}{tf_tag} {s['direction'].upper()}"
                f" | 승률 {s['win_rate']:.1f}%"
                f" | PF {s['profit_factor']:.2f}"
                f" | {s['total_trades']}건"
            )
        lines.append("")

        # 50% 이상 승률 전략 개수 (의미있는 지표)
        wr50 = len([s for s in valid if s["win_rate"] >= 50])
        profitable = len([s for s in valid if s["total_return"] > 0])
        avg_pf = sum(s["profit_factor"] for s in valid) / len(valid)
        lines.append(
            f"📈 승률 50%+ 전략: {wr50}/{len(valid)}개"
            f" | 수익 전략: {profitable}/{len(valid)}개"
            f" | 평균 PF: {avg_pf:.2f}"
        )
        lines.append("")

    lines.append("━━━━━━━━━━━━━━━━━")
    lines.append("💡 모든 전략을 직접 테스트: pruviq.com/simulator")
    lines.append("")
    lines.append("#PRUVIQ #알트코인 #퀀트전략 #자동매매 #백테스트")

    return "\n".join(lines)


def generate_content_en(results: dict, period: str, start_date: str, end_date: str) -> str:
    """Generate English SNS content."""
    now_utc = datetime.utcnow()
    date_str = now_utc.strftime("%Y-%m-%d")
    lines = []

    lines.append(f"📊 PRUVIQ Strategy Daily Rankings")
    lines.append(f"📅 {date_str} | Period: Last {period}")
    lines.append(f"🔗 pruviq.com/simulator")
    lines.append("")

    for group_name, strats in results.items():
        if not strats:
            continue

        valid = [s for s in strats if s["total_trades"] >= 10]
        if not valid:
            valid = strats

        valid = [s for s in valid
                 if (s["strategy"], s["direction"], s.get("timeframe", "1H")) not in WF_FAILED]

        ranked_by_wr = sorted(valid, key=lambda x: x["win_rate"], reverse=True)

        lines.append(f"━━━ {group_name} ({len(valid)} strategies) ━━━")
        lines.append("")

        lines.append("🏆 Best Strategies (by Win Rate)")
        for i, s in enumerate(ranked_by_wr[:3], 1):
            medal = ["🥇", "🥈", "🥉"][i - 1]
            tf_tag = f" [{s['timeframe']}]" if s.get("timeframe", "1H") != "1H" else ""
            lines.append(
                f"{medal} {s['category_en']}{tf_tag} ({s['direction'].upper()})"
                f" | WR {s['win_rate']:.1f}%"
                f" | PF {s['profit_factor']:.2f}"
                f" | {s['total_trades']} trades"
            )
        lines.append("")

        worst = sorted(valid, key=lambda x: x["win_rate"])[:3]
        lines.append("⚠️ Worst Strategies")
        for i, s in enumerate(worst, 1):
            tf_tag = f" [{s['timeframe']}]" if s.get("timeframe", "1H") != "1H" else ""
            lines.append(
                f"  {i}. {s['category_en']}{tf_tag} ({s['direction'].upper()})"
                f" | WR {s['win_rate']:.1f}%"
                f" | PF {s['profit_factor']:.2f}"
                f" | {s['total_trades']} trades"
            )
        lines.append("")

        wr50 = len([s for s in valid if s["win_rate"] >= 50])
        profitable = len([s for s in valid if s["total_return"] > 0])
        avg_pf = sum(s["profit_factor"] for s in valid) / len(valid)
        lines.append(
            f"📈 WR 50%+: {wr50}/{len(valid)}"
            f" | Profitable: {profitable}/{len(valid)}"
            f" | Avg PF: {avg_pf:.2f}"
        )
        lines.append("")

    lines.append("━━━━━━━━━━━━━━━━━")
    lines.append("💡 Test all strategies: pruviq.com/simulator")
    lines.append("")
    lines.append("#PRUVIQ #Altcoin #QuantStrategy #AlgoTrading #Backtest")

    return "\n".join(lines)


def generate_weekly_summary(results: dict) -> str:
    """Generate weekly summary section (appended on Mondays)."""
    now_kst = datetime.utcnow() + timedelta(hours=9)
    if now_kst.weekday() != 0:  # Monday only
        return ""

    lines = []
    lines.append("")
    lines.append("━━━ 📊 주간 요약 (Weekly) ━━━")
    lines.append("")

    for group_name, strats in results.items():
        if not strats:
            continue

        strats = [s for s in strats
                  if (s["strategy"], s["direction"], s.get("timeframe", "1H")) not in WF_FAILED]
        ranked = sorted(strats, key=lambda x: x["win_rate"], reverse=True)
        wr50 = len([s for s in ranked if s["win_rate"] >= 50])

        lines.append(f"🎯 {group_name} 이번주 베스트")
        if ranked:
            top = ranked[0]
            tf_tag = f" [{top['timeframe']}]" if top.get("timeframe", "1H") != "1H" else ""
            lines.append(
                f"  1위: {top['category_ko']}{tf_tag} ({top['direction'].upper()})"
                f" — 승률 {top['win_rate']:.1f}%"
            )
        lines.append(f"  승률 50%+ 전략: {wr50}/{len(ranked)}개")
        lines.append("")

    return "\n".join(lines)


def send_telegram(text: str, bot_token: str, chat_id: str) -> bool:
    """Send content to Telegram for approval."""
    if not bot_token or not chat_id:
        print("⚠ Telegram credentials not set. Skipping.", file=sys.stderr)
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            print("✅ Telegram sent successfully")
            return True
        else:
            print(f"⚠ Telegram error: {resp.status_code} {resp.text}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"⚠ Telegram exception: {e}", file=sys.stderr)
        return False


# ── Layer 1: Data Integrity Validation ────────────────────────────────────────
VALID_PERIOD_KEYS = {"1d", "7d", "30d", "365d"}
VALID_GROUP_KEYS = {"top30", "top50", "top100", "btc"}
REQUIRED_ENTRY_FIELDS = {
    "total_trades", "win_rate", "profit_factor",
    "total_return", "strategy", "direction", "timeframe",
}
MIN_ENTRIES_PER_GROUP = 10


def validate_periods_data(periods_data: dict) -> list:
    """Validate ranking data schema before saving.

    Returns list of error strings. Empty list = valid.
    Rejects: wrong period/group keys, too few entries, missing required fields.
    """
    errors = []
    if not isinstance(periods_data, dict) or not periods_data:
        return ["periods_data is empty or not a dict"]

    for period_key, groups in periods_data.items():
        if period_key not in VALID_PERIOD_KEYS:
            errors.append(f"Invalid period key: {period_key!r} (expected one of {VALID_PERIOD_KEYS})")
            continue
        if not isinstance(groups, dict):
            errors.append(f"{period_key}: groups is not a dict")
            continue
        for group_key, entries in groups.items():
            if group_key not in VALID_GROUP_KEYS:
                errors.append(
                    f"Invalid group key: {period_key}/{group_key!r} "
                    f"(expected one of {VALID_GROUP_KEYS})"
                )
                continue
            if not isinstance(entries, list):
                errors.append(f"{period_key}/{group_key}: entries is not a list")
                continue
            if len(entries) < MIN_ENTRIES_PER_GROUP:
                errors.append(
                    f"{period_key}/{group_key}: only {len(entries)} entries "
                    f"(min {MIN_ENTRIES_PER_GROUP})"
                )
            for i, entry in enumerate(entries[:3]):  # spot-check first 3
                for field in REQUIRED_ENTRY_FIELDS:
                    if field not in entry:
                        errors.append(
                            f"{period_key}/{group_key}[{i}] missing required field: {field!r}"
                        )
    return errors
# ──────────────────────────────────────────────────────────────────────────────


def save_results(
    periods_data: dict,
    content_ko: str,
    content_en: str,
    target_date: Optional[datetime] = None,
    legacy_results: Optional[dict] = None,
):
    """Save results to JSON for archival.

    New format: top-level 'periods' key with 7d/30d/365d × top30/top50/top100/btc.
    Backward compat: 'results' key preserved (30d top50 or provided legacy_results).
    Layer 1 validation runs before write — rejects corrupt data and sends Telegram alert.
    """
    # ── Layer 1 gate ──────────────────────────────────────────────────────────
    validation_errors = validate_periods_data(periods_data)
    if validation_errors:
        err_summary = "\n".join(f"  • {e}" for e in validation_errors)
        msg = (
            f"🚨 [Layer 1] Ranking data integrity FAILED — file NOT saved\n"
            f"{err_summary}\n"
            f"Fix: check daily_strategy_ranking.py storage_key logic"
        )
        print(msg, file=sys.stderr)
        send_telegram(msg, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
        raise ValueError(f"periods_data validation failed ({len(validation_errors)} errors)")
    # ─────────────────────────────────────────────────────────────────────────

    if target_date:
        date_str = target_date.strftime("%Y%m%d")
        now = target_date
    else:
        now = datetime.utcnow()
        date_str = now.strftime("%Y%m%d")
    out_dir = "/Users/jepo/Desktop/autotrader/data/daily_rankings"
    os.makedirs(out_dir, exist_ok=True)

    out_path = os.path.join(out_dir, f"ranking_{date_str}.json")

    # Build backward-compat 'results' from 30d top50 (or top30 if top50 absent)
    if legacy_results is not None:
        bc_results = legacy_results
    else:
        bc_results = {}
        period_30d = periods_data.get("30d", {})
        if "top50" in period_30d:
            bc_results["Market Cap Top 50"] = period_30d["top50"]
        elif "top30" in period_30d:
            bc_results["Market Cap Top 30"] = period_30d["top30"]

    data = {
        "date": now.strftime("%Y-%m-%d"),
        "generated_at": now.isoformat(),
        "periods": periods_data,
        "results": bc_results,
        "content_ko": content_ko,
        "content_en": content_en,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Saved to {out_path}")


def main():
    parser = argparse.ArgumentParser(description="PRUVIQ Daily Strategy Ranking")
    parser.add_argument("--period", default=None, help="Single lookback period (legacy, e.g., 7d, 30d). Use --periods for multi-period.")
    parser.add_argument("--periods", default="1d,7d,30d,365d", help="Comma-separated periods (e.g., 1d,7d,30d,365d)")
    parser.add_argument("--dry-run", action="store_true", help="Print content only, no Telegram")
    parser.add_argument("--telegram", action="store_true", help="Send to Telegram")
    parser.add_argument("--groups", default="30,50,100,BTC", help="Coin groups (e.g., 30,50,100,BTC)")
    parser.add_argument("--api-base", default=None, help="API base URL override")
    parser.add_argument("--date", default=None, help="Backfill date (YYYY-MM-DD). If set, compute period from this date to next day")
    parser.add_argument("--workers", default=5, type=int, help="Parallel worker threads per group (default: 5)")
    args = parser.parse_args()

    if args.api_base:
        global API_BASE
        API_BASE = args.api_base

    # --period (legacy single period) overrides --periods
    if args.period:
        periods = [args.period]
    else:
        periods = [p.strip() for p in args.periods.split(",") if p.strip()]

    # Parse groups
    groups_raw = [g.strip() for g in args.groups.split(",") if g.strip()]

    # Backfill date mode: single period override (date to date+1 = single day)
    if args.date:
        target = datetime.strptime(args.date, "%Y-%m-%d")
        # In backfill mode, override periods with a single-day window
        single_start = target.strftime("%Y-%m-%d")
        single_end = (target + timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🔁 Backfill mode: {single_start} ~ {single_end}")
        # Use legacy path for backfill
        coin_groups = []
        for g in groups_raw:
            if g.lower() == "btc":
                continue  # skip BTC in backfill for simplicity
            coin_groups.append((int(g), f"Market Cap Top {g}"))
        if not coin_groups:
            coin_groups = [(50, "Market Cap Top 50")]
        t0 = time.time()
        legacy_results = run_all_simulations(single_start, single_end, coin_groups)
        elapsed = time.time() - t0
        print(f"\n⏱ Total time: {elapsed:.0f}s")
        content_ko = generate_content_ko(legacy_results, "1d", single_start, single_end)
        content_en = generate_content_en(legacy_results, "1d", single_start, single_end)
        weekly = generate_weekly_summary(legacy_results)
        if weekly:
            content_ko += weekly
            content_en += weekly
        print("\n" + "=" * 60)
        print("📱 Korean Content:")
        print("=" * 60)
        print(content_ko)
        print("\n" + "=" * 60)
        print("📱 English Content:")
        print("=" * 60)
        print(content_en)
        save_results(
            {},
            content_ko, content_en,
            target_date=target,
            legacy_results=legacy_results,
        )
        if args.telegram and not args.dry_run:
            print("\n📤 Sending to Telegram...")
            send_telegram(content_ko, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
            time.sleep(1)
            send_telegram(content_en, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
        return

    total_sims = len(STRATEGIES) * len(groups_raw) * len(periods)
    # With parallel workers, effective time is much lower than sequential
    est_minutes = (len(STRATEGIES) * len(periods) / args.workers) * 1.8 / 60

    print(f"🚀 PRUVIQ Daily Strategy Ranking (Matrix Mode)")
    print(f"   Periods: {', '.join(periods)}")
    print(f"   Groups: {', '.join(groups_raw)}")
    print(f"   Strategies: {len(STRATEGIES)} variants (16 base × direction/timeframe)")
    print(f"   Total simulations: {total_sims} (parallel {args.workers} workers/group)")
    print(f"   Est. time: ~{est_minutes:.0f} min")
    print()

    # Run all period × group simulations
    t0 = time.time()
    periods_data = run_all_simulations_matrix(
        periods=periods,
        groups=groups_raw,
        max_workers=args.workers,
    )
    elapsed = time.time() - t0
    print(f"\n⏱ Total time: {elapsed:.0f}s ({elapsed/60:.1f} min)")

    # Summary
    for period_key, period_groups in periods_data.items():
        for group_key, strats in period_groups.items():
            valid = [s for s in strats if s["total_trades"] >= 10]
            wr50 = len([s for s in valid if s["win_rate"] >= 50])
            if valid:
                best = max(valid, key=lambda x: x["win_rate"])
                print(f"  {period_key}/{group_key}: {len(valid)} valid | WR50+: {wr50} | Best: {best['category_ko']} {best['direction'].upper()} {best['win_rate']:.1f}%")

    # Generate SNS content using 30d / top30 (SNS standard)
    # Build legacy results dict for content generators
    sns_results = {}
    period_30d = periods_data.get("30d", {})
    if "top30" in period_30d and period_30d["top30"]:
        sns_results["Market Cap Top 30"] = period_30d["top30"]
    elif "top50" in period_30d and period_30d["top50"]:
        sns_results["Market Cap Top 50"] = period_30d["top50"]

    # Fallback: use first available period and group
    if not sns_results:
        for p_key in periods:
            for g_key in ["top30", "top50", "top100"]:
                if periods_data.get(p_key, {}).get(g_key):
                    sns_results[f"Top {g_key.replace('top','')}"] = periods_data[p_key][g_key]
                    break
            if sns_results:
                break

    sns_period = "30d" if "30d" in periods else periods[0]
    content_ko = generate_content_ko(sns_results, sns_period, *parse_period(sns_period))
    content_en = generate_content_en(sns_results, sns_period, *parse_period(sns_period))

    # Weekly summary (Monday only)
    weekly = generate_weekly_summary(sns_results)
    if weekly:
        content_ko += weekly
        content_en += weekly

    # Output
    print("\n" + "=" * 60)
    print("📱 Korean Content (30d / Top 30):")
    print("=" * 60)
    print(content_ko)
    print("\n" + "=" * 60)
    print("📱 English Content (30d / Top 30):")
    print("=" * 60)
    print(content_en)

    # Save results
    save_results(periods_data, content_ko, content_en)

    # Send to Telegram (30d top30 기준 유지)
    if args.telegram and not args.dry_run:
        print("\n📤 Sending to Telegram...")
        send_telegram(content_ko, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
        time.sleep(1)
        send_telegram(content_en, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
    elif not args.dry_run:
        print("\n💡 Use --telegram to send to Telegram")


if __name__ == "__main__":
    main()
