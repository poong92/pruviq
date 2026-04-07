#!/bin/bash
# PRUVIQ API — Mac Mini Deployment Script
# Usage: ./deploy_macmini.sh
#
# Prerequisites:
#   - Python 3.12+ on Mac Mini
#   - OHLCV data in ~/pruviq-data/futures/
#   - cloudflared installed (brew install cloudflare/cloudflare/cloudflared)

set -e

REPO_DIR="$HOME/pruviq"
DATA_DIR="$HOME/pruviq-data/futures"
VENV_DIR="$REPO_DIR/backend/.venv"
PORT=8080

echo "=== PRUVIQ API Deployment ==="

# 1. Clone/update repo
if [ -d "$REPO_DIR" ]; then
    echo "Updating repo..."
    cd "$REPO_DIR" && git pull
else
    echo "Cloning repo..."
    git clone git@github.com:pruviq/pruviq.git "$REPO_DIR"
    cd "$REPO_DIR"
fi

# 2. Python venv
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtualenv..."
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

echo "Installing dependencies..."
pip install -r backend/requirements.txt -q

# 3. Run tests
echo "Running tests..."
cd "$REPO_DIR/backend"
python tests/test_engine.py
python tests/test_api.py
echo "Tests passed."

# 4. Check data
if [ ! -d "$DATA_DIR" ]; then
    echo "ERROR: Data directory not found: $DATA_DIR"
    echo "Copy OHLCV data first: scp -r autotrader/data/futures/ macmini:~/pruviq-data/futures/"
    exit 1
fi
FILE_COUNT=$(ls "$DATA_DIR"/*_1h.csv 2>/dev/null | wc -l)
echo "Data: $FILE_COUNT coins in $DATA_DIR"

# 5. Create LaunchAgent for API
PLIST_FILE="$HOME/Library/LaunchAgents/com.pruviq.api.plist"
cat > "$PLIST_FILE" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pruviq.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>${VENV_DIR}/bin/uvicorn</string>
        <string>api.main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>${PORT}</string>
        <string>--workers</string>
        <string>4</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}/backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PRUVIQ_DATA_DIR</key>
        <string>${DATA_DIR}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/pruviq-api.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/pruviq-api-error.log</string>
</dict>
</plist>
PLISTEOF

echo "LaunchAgent created: $PLIST_FILE"

# 6. Load/reload
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"
echo "API started on port $PORT"

# 7. Health check
sleep 3
if curl -s "http://localhost:$PORT/health" | grep -q '"status":"ok"'; then
    echo "Health check: OK"
    curl -s "http://localhost:$PORT/health" | python3 -m json.tool
else
    echo "Health check: FAILED (check ~/pruviq-api-error.log)"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Local:  http://localhost:$PORT/health"
echo "Docs:   http://localhost:$PORT/docs"
echo "Next:   Set up Cloudflare Tunnel for api.pruviq.com"
