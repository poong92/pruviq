# Lessons from autotrader → PRUVIQ OKX

> Owner brief (2026-04-17): "오토트레이더에서 실제로 돌려보면서 논리지만 실제로는 달라서 수정한 결과들이 녹아져 있어. 지금은 더 똑똑해져서 괜찮지만 그런 로직들 결과들 기본적으로 문제되는 설계를 놓치지말고 진행해줘."
>
> Goal of this audit: extract every lesson that autotrader paid for with real
> money, then re-evaluate each against PRUVIQ's architecture and REJECT the
> ones that don't apply. Blind porting is worse than skipping — it adds
> maintenance cost without the original payoff.

## What autotrader is (context)

- `/opt/autotrader/` on DO, Docker container (currently stopped 5+ weeks — legacy).
- One bot, one Binance account, one strategy at a time (ATR Breakout SHORT v0.1.1).
- R1~R23 research series (`/Users/jepo/Desktop/autotrader/src/live/config_atr.py` header).
- Superseded by **PRUVIQ OKX autotrade** (`backend/okx/`) as the real product.

## What PRUVIQ OKX is (target)

- Multi-tenant: each user has a session, optional active strategy, their
  own OKX API keys.
- OKX (not Binance). Different order-type surface.
- Signals come from `signal_scanner.py` globally; each user's strategy
  config decides whether to act.
- Safety layer from P0 audit: clOrdId idempotency, reconciler 5min,
  pnl_sync, telegram_halt, slippage guard, per-trade cap.

## Operational lessons from autotrader — accept / reject

| # | Lesson (autotrader code) | Decision | Why |
|---|---|---|---|
| **L1** | SL/TP order fail → immediate market close | ✅ **Already present** in `orders.py:146-167` and `auto_executor.py:523-536` |
| **L1+** | Close itself can fail → retry w/ back-off → escalated "user must act" alert | ✅ **Added** (`_emergency_close_with_retry` in auto_executor.py; retries 3× exp back-off; 🚨 Telegram) |
| **L2** | SL set / TP fail → keep SL (degraded mode) | ⚪ **N/A** — OKX `/trade/order-algo` submits SL+TP in one call; atomic. Binance's split algos made this relevant there, not here. |
| **L3** | SL set failure → retry with back-off | ✅ **Subsumed by L7 utility** |
| **L4** | Exchange-only position ("orphan") → auto-close | 🔴 **Reject** — on autotrader the bot ran alone so orphans are necessarily bot bugs. On PRUVIQ the user may have opened the position manually in the OKX app. Auto-closing = asset interference. `reconciler.py` correctly ALERTS ONLY. |
| **L5** | Trailing stop update fail → atomic rollback of trailing state (incl. highest_price) | ⚪ **N/A** — PRUVIQ trailing not yet implemented; `auto_executor.py:339` falls back to fixed TP. No multi-var state exists. |
| **L6** | Cancel SL/TP algos BEFORE market close to prevent double-fill | ✅ **API added** (`cancel_algo_orders` in client.py) + wired into emergency path (best-effort). Future user-close path will use it. |
| **L7** | `retry_on_error(max_attempts, initial_delay)` decorator for transient API errors | ✅ **Added** (`backend/okx/retry.py` — async + sync with full-jitter exp back-off, `retry_on` allow-list, `do_not_retry_on` deny-list for fail-fast of business errors) |

## Research-derived filters (R4/R6/R15) — accept / reject / adapt

autotrader applied these **globally** (one bot, one strategy). For PRUVIQ they
must be **per-strategy opt-in** — a user choosing LONG should not have SHORT-only
funding gates, a user trading outside KR hours shouldn't be forced onto those
windows.

| # | Research | autotrader implementation | PRUVIQ adaptation |
|---|---|---|---|
| **R4** | Funding rate filter: only SHORT when FR>0 (PF 1.27→1.54, Sharpe 5.82→7.95 over 2y) | Global in `STRATEGY["short"]["funding_rate_filter"]` | ✅ Per-strategy flag `regime_filters.require_positive_funding_for_short` |
| **R6** | FnG < 25 (Extreme Fear) → skip entry (ATR SHORT PF 0.91 vs Neutral PF 1.93) | Global `STRATEGY["fng_filter"]` | ✅ Per-strategy `regime_filters.fng_min` |
| **R15** | Avoid Tuesday + 08-10 KST (+76% → +95% return, MDD 4.2% → 2.6%) | Global `STRATEGY["time_filter"]` | ✅ Per-strategy `regime_filters.avoid_weekdays_utc` + `avoid_hours_utc` (UTC — DO server's timezone, no implicit-KST trap) |
| **R-MDD** | Max drawdown 20% hard cap on the bot's capital | Global `RISK["max_drawdown"]` | ✅ Per-strategy `max_drawdown_pct`, measured against *budget* (position_size × concurrent), evaluated in reconciler |

## Why "advisory on fetch failure" matters

autotrader's FnG filter returned None on alternative.me outage and skipped
the gate rather than blocking. PRUVIQ does the same (see `filters.py`
`get_fng_value`). Single-origin filter data going dark should not
simultaneously paralyze every PRUVIQ user's autotrade — that failure mode
is worse than the filter being briefly inactive.

## Why the per-strategy model matters

PRUVIQ can't know which research the user agrees with. Some users want
conservative regime gating; others want every signal. Putting these filters
on the user_strategies row makes each user's choice explicit and auditable —
the filter state is part of the strategy they reviewed and activated.

Global filters (like a server-wide kill of low-FnG trading) would also
conflict with user expectations — someone who read the research and
**intentionally** wants to trade through Extreme Fear for the mean
reversion would be silently blocked.

## Code layout summary

```
backend/okx/
├── retry.py                    (new)     L7 utility
├── filters.py                  (new)     R4/R6/R15 per-strategy filter bundle
├── client.py                   (add)     cancel_algo_orders()     L6
├── strategies.py               (extend)  regime_filters + max_drawdown_pct columns
├── auto_executor.py            (extend)  _emergency_close_with_retry  L1+
│                                         filter gate before signal processing  R4/R6/R15
├── reconciler.py               (extend)  check_mdd_and_halt()     R-MDD
└── LESSONS_FROM_AUTOTRADER.md  (this file)
```

## Remaining follow-up work (not this PR)

- `cancel_algo_orders` used only in emergency path today. When a user-initiated
  close endpoint is added (or the existing one is extended), wire it through
  `cancel_algo_orders` first to get the cancel-first guarantee for the normal
  close path too.
- Trailing stops (L5 applicability) require a real implementation before we
  can meaningfully adopt the atomic-rollback pattern.
- Drawdown reference: currently budget-relative. When the product matures to
  require session-level starting capital (e.g., a user explicitly sets "I'm
  allocating $X to this strategy"), swap to that as the drawdown denominator.
