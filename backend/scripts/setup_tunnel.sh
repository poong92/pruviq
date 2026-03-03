#!/bin/bash
# PRUVIQ API — Cloudflare Tunnel Setup
# Exposes Mac Mini API as api.pruviq.com
#
# Prerequisites:
#   - brew install cloudflare/cloudflare/cloudflared
#   - cloudflared login (authenticate with Cloudflare)
#   - API running on localhost:8080

set -e

TUNNEL_NAME="pruviq-api"
HOSTNAME="api.pruviq.com"
LOCAL_PORT=8080

echo "=== Cloudflare Tunnel Setup ==="

# 1. Create tunnel
echo "Creating tunnel: $TUNNEL_NAME"
cloudflared tunnel create "$TUNNEL_NAME"

# 2. Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

# 3. Create config
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.yml" << CFEOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/${TUNNEL_ID}.json

ingress:
  - hostname: $HOSTNAME
    service: http://localhost:$LOCAL_PORT
    originRequest:
      connectTimeout: 10s
      noTLSVerify: false
  - service: http_status:404
CFEOF

echo "Config written to $CONFIG_DIR/config.yml"

# 4. Create DNS route
echo "Creating DNS route: $HOSTNAME -> $TUNNEL_NAME"
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"

# 5. Create LaunchAgent for tunnel
PLIST_FILE="$HOME/Library/LaunchAgents/com.pruviq.tunnel.plist"
cat > "$PLIST_FILE" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pruviq.tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--config</string>
        <string>${CONFIG_DIR}/config.yml</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/pruviq-tunnel.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/pruviq-tunnel-error.log</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo ""
echo "=== Tunnel Setup Complete ==="
echo "Public URL:  https://$HOSTNAME"
echo "Health:      https://$HOSTNAME/health"
echo "API Docs:    https://$HOSTNAME/docs"
echo ""
echo "Verify: curl https://$HOSTNAME/health"
