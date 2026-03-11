# PRUVIQ Simulator QA — Progress (2026-03-11)

## Phase 1: Core Bug Fixes (COMPLETE)

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| B1 | MDD > 100% (no equity floor in simple mode) | MDD capped at 100% in 5 sites (engine.py, engine_fast.py, main.py x3) | DONE |
| B2 | engine_fast.py MDD absolute points | Changed to % of peak | DONE |
| B3 | /simulate/compare MDD absolute points | Changed to % of peak | DONE |
| B3b | monte_carlo.py MDD absolute points | Changed to % of peak | DONE |
| B3c | generate_demo_data.py MDD absolute points | Changed to % of peak | DONE |
| B4 | Calmar CAGR simple annualization | Changed to compound CAGR | DONE |
| B4b | engine.py MDD absolute points | Changed to % of peak | DONE |

## Phase 2: PR#312 Metric Accuracy (COMPLETE)

| # | Fix | Status |
|---|-----|--------|
| M1 | Compound equity curve | DONE |
| M2 | Sharpe capital-weighted (/backtest) | DONE |
| M3 | Sortino TDD: N_down -> N (4 sites) | DONE |
| M4 | MDD: % of peak (2 sites) | DONE |
| M5 | /simulate daily PnL: entry_time -> exit_time | DONE |
| M6 | PF sentinel: 0.001 -> 999.99 (7 sites) | DONE |
| M7 | "LIVE SETTINGS" -> "DEFAULT SETTINGS" | DONE |
| M8 | Compound OFF coinMode restore | DONE |
| M9 | LONG exit slippage (engine.py) | DONE |

## Phase 3: QA Enhancements (COMPLETE)

| # | Enhancement | Status |
|---|-------------|--------|
| E1 | MDD cap at 100% — 5 locations (engine.py, engine_fast.py, main.py /simulate, /compare, /backtest) | DONE |
| E2 | New /backtest warnings: moderate sample (<100), Sharpe>3 overfit, holding period, missing symbols | DONE |
| E3 | Missing symbols tracking in /backtest (_missing_symbols) | DONE |
| E4 | Walk-Forward renamed to "Anchored Walk-Forward" | DONE |
| E5 | Dynamic slippage helper `_get_dynamic_slippage()` — 3-tier by market cap rank | DONE (TODO: integrate per-coin) |
| E6 | Market regime performance (bull/bear/sideways) via BTC SMA20/SMA50 | DONE |
| E7 | `RegimeMetrics` + `RegimePerformance` schemas | DONE |
| E8 | `formatPF()` utility — 999.99 sentinel displays as infinity | DONE |
| E9 | `formatPF` integrated in ResultsPanel, PerformanceDashboard, StrategyComparison, DemoRunner | DONE |
| E10 | ResultsCard: Sharpe/Sortino tooltip mentions sqrt(365) annualization (en+ko) | DONE |
| E11 | ResultsCard: PF MetricBox shows infinity for sentinel value | DONE |
| E12 | ResultsCard: survivorship bias disclaimer at bottom | DONE |
| E13 | sim_audit.py: 6 hardcoded WARNs replaced with 1 dynamic slippage verification note | DONE |
| E14 | sim_audit.py: MDD check updated to verify 0-100 cap | DONE |

## Phase 4: Full Coverage + CI + Deploy (COMPLETE — PR#336)

| # | Enhancement | Status |
|---|-------------|--------|
| F1 | Dynamic slippage integrated in 6 call sites (/simulate, /backtest, /validate, /compare, /coin, _build_coin_stats) | DONE |
| F2 | sim_audit.py expanded: 607→1060+ lines, 146 tests | DONE |
| F3 | All 26 presets validated via /backtest × BTCUSDT | DONE |
| F4 | 6 boundary value tests (SL 0.5-50%, TP 0.5-100%, leverage 125x, max_bars 1-168) | DONE |
| F5 | Cross-engine deep comparison: 12 fields (/simulate vs /backtest) | DONE |
| F6 | Simple/Compound full metric comparison (7 fields) | DONE |
| F7 | Frontend label ↔ backend mapping (7 new fields verified) | DONE |
| F8 | api_call error normalization (HTTPError "detail" → "error") | DONE |
| F9 | 429 rate-limit retry with exponential backoff | DONE |
| F10 | Auto-detect localhost on Mac Mini | DONE |
| F11 | CI integration: post-deploy-pipeline.yml sim_audit quick mode | DONE |
| F12 | Production deploy + verification: 146 PASS / 0 FAIL / 2 WARN | DONE |

## Final Score: 146 PASS / 0 FAIL / 2 WARN / 0 SKIP (2026-03-11)

## Phase 5: Final Metric Fixes (COMPLETE — PR#337)

| # | Fix | Status |
|---|-----|--------|
| G1 | /simulate Sharpe: raw pnl_pct → capital-weighted (÷ n_coins) | DONE |
| G2 | /simulate Calmar CAGR: `(equity+100)/100` → `equity/100` (100-based) | DONE |
| G3 | /backtest Calmar CAGR: same fix (100-based equity) | DONE |

## Remaining TODO

(none)

## Files

```
tests/
├── sim_audit.py              # Main QA script (4-layer)
├── SIM_AUDIT_PROGRESS.md     # This file (progress tracking)
└── ground_truth/
    ├── README.md             # GT dataset description
    └── formulas.json         # Manual calculation ground truth data
```
