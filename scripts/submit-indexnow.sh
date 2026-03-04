#!/bin/bash
# PRUVIQ IndexNow Submission Script
# Sends changed URLs to Bing/Naver/Yandex for immediate indexing
# Usage: bash scripts/submit-indexnow.sh [url1 url2 ...]

set -euo pipefail

DOMAIN="pruviq.com"
KEY="5818182d5955f57743a192861969669d"
ENDPOINT="https://api.indexnow.org/indexnow"

# If specific URLs passed as args, use those. Otherwise submit core pages.
if [ $# -gt 0 ]; then
  URLS="$@"
else
  URLS=(
    "https://${DOMAIN}/"
    "https://${DOMAIN}/ko/"
    "https://${DOMAIN}/simulate/"
    "https://${DOMAIN}/ko/simulate/"
    "https://${DOMAIN}/coins/"
    "https://${DOMAIN}/ko/coins/"
    "https://${DOMAIN}/blog/"
    "https://${DOMAIN}/ko/blog/"
    "https://${DOMAIN}/about/"
    "https://${DOMAIN}/api/"
    "https://${DOMAIN}/strategies/"
    "https://${DOMAIN}/performance/"
  )
fi

# Build JSON url list
URL_JSON=$(printf '"%s",' "${URLS[@]}" | sed 's/,$//')

PAYLOAD=$(cat <<EOF
{
  "host": "${DOMAIN}",
  "key": "${KEY}",
  "keyLocation": "https://${DOMAIN}/${KEY}.txt",
  "urlList": [${URL_JSON}]
}
EOF
)

echo "=== PRUVIQ IndexNow Submission ==="
echo "URLs: ${#URLS[@]}"
echo "Endpoint: ${ENDPOINT}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
  echo "✓ Submitted ${#URLS[@]} URLs (HTTP ${HTTP_CODE})"
else
  echo "✗ Failed (HTTP ${HTTP_CODE})"
  echo "Response: ${BODY}"
  exit 1
fi
