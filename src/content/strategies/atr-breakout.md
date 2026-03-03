---
name: "ATR Breakout"
description: "Average True Range based breakout detection. Shelved — tested 12 configurations across SHORT and LONG, none outperformed BB Squeeze."
status: "shelved"
category: "breakout"
direction: "both"
difficulty: "intermediate"
winRate: 48.7
profitFactor: 0.91
timeframe: "1H"
coins: 577
dateAdded: "2026-01-18"
tags: ["atr", "breakout", "shelved"]
---

## Overview

ATR Breakout triggers trades when price moves beyond a multiple of ATR (Average True Range) from a moving average, indicating a volatility breakout. Unlike BB Squeeze which detects compression-then-expansion, ATR Breakout detects the expansion itself.

The hypothesis: ATR directly measures "true" price movement including gaps, potentially catching breakouts that Bollinger Bands miss.

## How It Works

1. **Calculate ATR** — 14-period Average True Range (includes high-low range and gaps)
2. **Set Breakout Threshold** — Price must move > N × ATR from 20-period MA
3. **Volume Confirmation** — Volume >= 2.0x average
4. **Enter Position** — SHORT if price breaks below, LONG if above
5. **Risk Management** — SL based on ATR multiple, TP at fixed %, 48h max hold

## Configurations Tested

| Config | ATR Multiple | Direction | Win Rate | PF | PnL |
|--------|-------------|-----------|----------|-----|-----|
| A1 | 1.5x | SHORT | 52.3% | 1.08 | +$31 |
| A2 | 2.0x | SHORT | 49.1% | 0.94 | -$47 |
| A3 | 2.5x | SHORT | 46.8% | 0.87 | -$112 |
| A4 | 3.0x | SHORT | 44.2% | 0.79 | -$189 |
| B1 | 1.5x | LONG | 48.1% | 0.88 | -$98 |
| B2 | 2.0x | LONG | 45.6% | 0.81 | -$167 |
| ... | ... | ... | ... | ... | ... |

**Best result (A1)**: +$31 — marginally profitable but nowhere near BB Squeeze's +$794.

12 configurations tested across ATR multiples (1.5x to 3.0x) and both directions. None came close to BB Squeeze performance.

## Why It Was Shelved

1. **No configuration outperformed BB Squeeze** — Best case: +$31 vs BB Squeeze's +$794 (25x worse)
2. **Higher false signal rate** — ATR breakout triggers on any large move, including noise. BB Squeeze's compression-first requirement filters out most false breakouts
3. **Less precise timing** — BB/KC squeeze pinpoints the exact moment of compression release. ATR just measures "big move happened" without context
4. **Direction problem** — SHORT configurations were marginal, LONG configurations all negative (same structural issue as other LONG strategies)

## Lesson Learned

> Breakout detection without compression context is just noise detection.

The key insight: what makes BB Squeeze work isn't detecting the breakout — it's detecting the compression *before* the breakout. ATR measures volatility expansion but can't distinguish between meaningful expansion (from a squeeze) and random large candles.

This is why BB Squeeze uses the Bollinger-inside-Keltner condition: it specifically identifies the quiet-before-the-storm pattern that precedes directional moves.

## Comparison with BB Squeeze

| Aspect | ATR Breakout | BB Squeeze |
|--------|-------------|-----------|
| Detection | Expansion only | Compression → Expansion |
| False signals | High (any big candle) | Low (requires prior squeeze) |
| Best PnL | +$31 | +$794 |
| Signal quality | Low | High |
| Complexity | Simple | Moderate |

## Status: SHELVED

Not actively traded. Tested January 2026 on 577 coins with 2+ years of data. All 12 configurations archived. May be revisited if combined with BB Squeeze as a confirmation signal.
