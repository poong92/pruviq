# backend/scripts/disabled/

Dead scripts kept for historical reference. **These files are NOT executed
by any cron / systemd timer / CI workflow.** They're archived rather than
deleted so that:

1. Git blame and file history survive any potential revival
2. Documented hard-coded paths reveal original development context
   (useful for forensic / audit purposes)

## Archived contents

| File | Archived | Reason |
|------|----------|--------|
| `generate_performance_data.py.legacy` | 2026-04-20 | AutoTrader decommissioned 2026-04-18; `public/data/performance.json` now produced by `deploy/systemd/bin/update-performance.sh` (inline Python, does NOT call this script). Zero callers at archive time. |

## Before reviving any file here

1. Verify the replacement path is still missing or broken
2. Update hard-coded paths to env-var based (this directory's files still
   have pre-cleanup hardcodes — do NOT commit a revived version with
   `/Users/jplee/...` or similar private paths)
3. Re-run tests — most archived scripts predate the current test suite

## Why not just delete?

- `test_data_pipeline_path_cleanup.py` asserts `/Users/jplee` literal is
  preserved as a historical artifact (regression guard on how path
  cleanup was done)
- Git blame surface for legacy path migrations remains intact
- Cheap (few KB) to keep; expensive (loss of context) to remove
