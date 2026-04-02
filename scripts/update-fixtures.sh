#!/bin/bash
# Update E2E test fixtures from live API
set -euo pipefail
DIR="tests/fixtures"
mkdir -p "$DIR"
echo "Updating fixtures from api.pruviq.com..."
curl -sf https://api.pruviq.com/health -o "$DIR/health.json"
curl -sf -X POST https://api.pruviq.com/simulate \
  -H "Content-Type: application/json" \
  -d '{"strategy":"bb-squeeze","direction":"short","sl_pct":10,"tp_pct":8,"top_n":10}' \
  -o "$DIR/simulate-response.json"
curl -sf https://api.pruviq.com/builder/presets -o "$DIR/builder-presets.json"
curl -sf https://api.pruviq.com/indicators -o "$DIR/indicators.json"
curl -sf "https://api.pruviq.com/coins" -o "$DIR/coins.json"
echo "Done. Run 'npx playwright test' to verify."
