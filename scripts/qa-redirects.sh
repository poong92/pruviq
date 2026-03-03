#!/bin/bash
# QA: _redirects vs 실제 생성 페이지 충돌 검사
# Cloudflare Pages에서 _redirects가 HTML보다 우선하므로
# 실제 콘텐츠 페이지가 리다이렉트에 의해 가려지는지 검사
#
# 사용법: bash scripts/qa-redirects.sh

set -euo pipefail
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

REDIRECTS="public/_redirects"
DIST="dist"
ERRORS=0

if [ ! -f "$REDIRECTS" ]; then
  echo -e "${GREEN}PASS${NC}: _redirects 파일 없음 (충돌 없음)"
  exit 0
fi

if [ ! -d "$DIST" ]; then
  echo "ERROR: dist/ 없음. 먼저 npm run build 실행"
  exit 1
fi

echo "=== _redirects vs dist/ 충돌 검사 ==="
echo ""

is_redirect_page() {
  local html_file="$1"
  if [ -f "$html_file" ]; then
    grep -q 'Redirecting to:' "$html_file" 2>/dev/null && return 0
  fi
  return 1
}

while IFS= read -r line; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue

  src=$(echo "$line" | awk '{print $1}')
  dst=$(echo "$line" | awk '{print $2}')
  base_src="${src%%/\*}"

  html_file="${DIST}${base_src}/index.html"

  if [ -f "$html_file" ]; then
    if is_redirect_page "$html_file"; then
      echo -e "${YELLOW}INFO${NC}: ${src} → ${dst} (Astro redirect + _redirects 이중 리다이렉트)"
    else
      echo -e "${RED}CONFLICT${NC}: ${src} → ${dst}"
      echo "         dist${base_src}/index.html 이 실제 콘텐츠 페이지입니다!"
      echo "         _redirects가 이 페이지를 가립니다 (Cloudflare Pages)"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo -e "${GREEN}OK${NC}: ${src} → ${dst} (dist에 없음, 리다이렉트 정상)"
  fi
done < "$REDIRECTS"

echo ""
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAIL${NC}: ${ERRORS}개 충돌 발견! _redirects에서 해당 규칙을 제거하세요."
  exit 1
else
  echo -e "${GREEN}PASS${NC}: 콘텐츠 페이지 충돌 없음."
  exit 0
fi
