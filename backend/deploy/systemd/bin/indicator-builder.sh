#!/bin/bash
set -euo pipefail

VENV_PYTHON="/opt/pruviq/app/.venv/bin/python3"
REPO="/opt/pruviq/current"

cd "$REPO/backend"
export PRUVIQ_DATA_DIR="/opt/pruviq/data/futures"
exec "$VENV_PYTHON" -m api.offline_indicator_build
