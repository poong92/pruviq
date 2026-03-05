---
name: deploy
description: PRUVIQ deployment status, pre-checks, and execution for frontend and backend
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["npm", "curl", "ssh", "git"] }, "emoji": "🚀", "os": ["darwin"] } }
---

# /deploy - Deployment Management

Check deployment status or execute frontend/backend deployments.

## Usage
```
/deploy status     # Check current deployment state
/deploy frontend   # Run pre-deploy checks for Cloudflare Pages
/deploy backend    # Deploy backend to Mac Mini
```

## Frontend Deploy (Cloudflare Pages)
1. `npm run build` (must be 0 errors)
2. `bash scripts/qa-redirects.sh` (CONFLICT must be 0)
3. git push → Cloudflare auto-builds in ~2 min

**CRITICAL**: _redirects file takes priority over HTML files on Cloudflare Pages. Always check for conflicts before deploying.

## Backend Deploy (Mac Mini)
1. SSH to Mac Mini
2. git pull
3. Restart uvicorn on port 8400
4. Verify via /health endpoint

## Sync Check
Compares local git hash with Mac Mini server hash to detect drift.
