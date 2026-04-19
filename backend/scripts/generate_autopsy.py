#!/usr/bin/env python3
"""Generate weekly Strategy Autopsy blog post."""
import json, sys, os, httpx
from pathlib import Path
from datetime import datetime

# 2026-04-19: env-ify Mac-only hardcoded paths. Same treatment as the
# send_weekly_email.py fix — DO systemd can now run this with
# PRUVIQ_BLOG_DIR=... injected, while Mac ops still works via the
# project-root fallback (repo layout preserves src/content/blog[-ko]).
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

API = os.environ.get("PRUVIQ_API_URL", "http://localhost:8080").rstrip("/")
BLOG_DIR = Path(
    os.environ.get("PRUVIQ_BLOG_DIR", str(_PROJECT_ROOT / "src" / "content" / "blog"))
)
BLOG_KO_DIR = Path(
    os.environ.get(
        "PRUVIQ_BLOG_KO_DIR",
        str(_PROJECT_ROOT / "src" / "content" / "blog-ko"),
    )
)
POSTED_FILE = Path(
    os.environ.get(
        "POSTED_AUTOPSIES_FILE",
        os.path.expanduser("~/pruviq-data/posted_autopsies.json"),
    )
)

# 전략 우선순위: PF 가장 낮은 것부터
STRATEGIES = [
    ("momentum-long", "long", 5, 10),
    ("bb-squeeze-long", "long", 7, 6),
    ("atr-breakout", "long", 7, 10),
    ("hv-squeeze", "short", 10, 6),
    ("rsi-divergence", "both", 7, 5),
    ("macd-cross", "both", 8, 6),
    ("donchian-breakout", "both", 8, 10),
    ("mean-reversion", "both", 5, 4),
    ("supertrend", "both", 8, 8),
    ("keltner-squeeze", "both", 7, 6),
    ("stochastic-rsi", "both", 7, 5),
    ("ma-cross", "both", 8, 10),
    ("adx-trend", "both", 8, 10),
    ("ichimoku", "both", 8, 10),
    ("heikin-ashi", "both", 7, 8),
    ("bb-squeeze-short", "short", 10, 8),  # 성공 대조군 (마지막)
]

def get_next_strategy():
    posted = json.loads(POSTED_FILE.read_text()) if POSTED_FILE.exists() else []
    for s in STRATEGIES:
        if s[0] not in posted:
            return s
    return STRATEGIES[0]  # 사이클 반복

def simulate(strategy, direction, sl, tp):
    r = httpx.post(f"{API}/simulate", json={
        "strategy": strategy, "direction": direction,
        "sl_pct": sl, "tp_pct": tp, "top_n": 50
    }, timeout=30)
    return r.json()

def generate_post(strategy_id, direction, result, lang="en"):
    date = datetime.now().strftime("%Y-%m-%d")
    name = strategy_id.replace("-", " ").title()

    wr = result.get("win_rate", 0)
    pf = result.get("profit_factor", 0)
    ret = result.get("total_return_pct", 0)
    trades = result.get("total_trades", 0)
    mdd = result.get("max_drawdown_pct", 0)
    params = result.get("params", {})
    sl_pct = params.get("sl_pct", "?")
    tp_pct = params.get("tp_pct", "?")
    data_range = result.get("data_range", "2024-2026")
    coins_used = result.get("coins_used", 50)

    if lang == "en":
        title = f"Strategy Autopsy: {name}"
        content = f"""---
title: "{title}"
description: "Why {name} {'lost money' if ret < 0 else 'underperformed'} — data-driven analysis on 50 coins over 2+ years."
date: "{date}"
category: "autopsy"
tags: ["autopsy", "{strategy_id}", "{direction}"]
---

## The Strategy

| Parameter | Value |
|-----------|-------|
| **Name** | {name} |
| **Direction** | {direction.upper()} |
| **Stop Loss** | {sl_pct}% |
| **Take Profit** | {tp_pct}% |
| **Period** | {data_range} |
| **Coins** | {coins_used} |

## The Numbers

| Metric | Value |
|--------|-------|
| Total Trades | {trades:,} |
| Win Rate | {wr:.1f}% |
| Profit Factor | {pf:.2f} |
| Max Drawdown | {mdd:.1f}% |
| Total Return | {'+' if ret >= 0 else ''}{ret:.1f}% |

## What Went Wrong

{'This strategy lost money because the profit factor is below 1.0 — meaning losses exceeded gains.' if pf < 1.0 else 'While technically profitable, this strategy has a thin edge that may not survive real-world conditions.'}

{'The win rate of ' + str(round(wr, 1)) + '% means more trades lost than won.' if wr < 50 else ''}
{'A max drawdown of ' + str(round(mdd, 1)) + '% means significant capital at risk.' if mdd > 30 else ''}

## The Lesson

{'Not every strategy works in every market. ' + direction.upper() + ' strategies struggle in ' + ('bullish' if direction == 'short' else 'bearish') + ' markets.' if direction != 'both' else 'Bidirectional strategies can cancel out their edge when market regime shifts.'}

**PRUVIQ publishes failures because that's how you learn. 66% of strategies lose money — knowing which ones is the first step.**

## Try It Yourself

Think different parameters could save this strategy? Test it yourself:

[Simulate {name} →](/simulate?strategy={strategy_id}&dir={direction})
"""
    else:  # ko
        title = f"전략 부검: {name}"
        content = f"""---
title: "{title}"
description: "{name} {'손실' if ret < 0 else '부진'} 원인 분석 — 50개 코인, 2년+ 데이터 기반."
date: "{date}"
category: "autopsy"
tags: ["autopsy", "{strategy_id}", "{direction}"]
---

## 전략 개요

| 항목 | 값 |
|------|-----|
| **이름** | {name} |
| **방향** | {direction.upper()} |
| **손절** | {sl_pct}% |
| **익절** | {tp_pct}% |
| **기간** | {data_range} |
| **코인** | {coins_used}개 |

## 성과 데이터

| 지표 | 값 |
|------|-----|
| 총 거래 | {trades:,}회 |
| 승률 | {wr:.1f}% |
| 수익 팩터 | {pf:.2f} |
| 최대 낙폭 | {mdd:.1f}% |
| 총 수익률 | {'+' if ret >= 0 else ''}{ret:.1f}% |

## 실패 원인

{'수익 팩터가 1.0 미만 — 손실이 이익을 초과했습니다.' if pf < 1.0 else '기술적으로는 수익이지만, 실전에서 살아남기 어려운 얇은 엣지입니다.'}

## 교훈

**PRUVIQ는 실패를 공개합니다. 전략의 66%가 손실입니다 — 어떤 전략이 실패하는지 아는 것이 첫 번째 단계입니다.**

## 직접 테스트

다른 파라미터로 이 전략을 살릴 수 있을까요?

[{name} 시뮬레이션 →](/ko/simulate?strategy={strategy_id}&dir={direction})
"""
    return content

def main():
    strategy_id, direction, sl, tp = get_next_strategy()
    print(f"Generating autopsy for: {strategy_id}")

    result = simulate(strategy_id, direction, sl, tp)
    print(f"  trades={result.get('total_trades')}, WR={result.get('win_rate')}%, PF={result.get('profit_factor')}")

    date_str = datetime.now().strftime("%Y%m%d")

    # EN
    en_content = generate_post(strategy_id, direction, result, "en")
    en_file = BLOG_DIR / f"autopsy-{strategy_id}-{date_str}.md"
    en_file.write_text(en_content)
    print(f"  EN: {en_file}")

    # KO
    ko_content = generate_post(strategy_id, direction, result, "ko")
    ko_file = BLOG_KO_DIR / f"autopsy-{strategy_id}-{date_str}.md"
    ko_file.write_text(ko_content)
    print(f"  KO: {ko_file}")

    # 기록
    posted = json.loads(POSTED_FILE.read_text()) if POSTED_FILE.exists() else []
    posted.append(strategy_id)
    POSTED_FILE.write_text(json.dumps(posted, indent=2))

    print("Done!")

if __name__ == "__main__":
    main()
