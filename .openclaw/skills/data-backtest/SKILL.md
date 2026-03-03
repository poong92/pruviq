# SKILL: data-backtest

Role
- Run, package, and validate backtest runs. Produce reproducible packages (data snapshot + run script) for auditability.

When to use
- When a new backtest is requested for publication or verification

Inputs
- Backtest parameters (strategy, coins, date range, fees/slippage settings)

Outputs
- Result JSON, trades CSV, reproducible package (.tar.gz) upload link, result_hash, engine_version metadata

Example tasks
- "Run backtest for BB Squeeze SHORT on preset X over 2 years and produce reproducible package"

Required permissions
- Access to backtest worker or ability to submit job to backend; S3 write to store packages

Safety constraints
- Ensure datasets used have licensing/consent; do not upload secrets

Notes
- Full automation requires backend worker and storage; agent will prepare PR and packaging scripts if backend access restricted.
