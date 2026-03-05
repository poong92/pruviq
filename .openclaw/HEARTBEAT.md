# Heartbeat Tasks

## Priority 1: Health Check
- curl https://api.pruviq.com/market (expect 200)
- curl https://api.pruviq.com/news (expect 200)
- curl https://pruviq.com (expect 200)

## Priority 2: Git Status
- Check for uncommitted changes
- Check if behind remote

## Priority 3: Build Check
- If code changed, run npm run build
- Report any build errors

## Current Sprint Tasks
- Monitor site uptime
- Check for broken links
- Verify Korean translations are complete
