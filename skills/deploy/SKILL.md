---
name: deploy
description: PRUVIQ deployment status, pre-checks, and execution for frontend and backend
user-invocable: true
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

## Backend Deploy (DigitalOcean)
1. Triggered automatically by `.github/workflows/deploy-backend.yml`
   on push to `main` that touches `backend/**` (or via workflow_dispatch).
2. Workflow SSHes into the DO droplet (`DO_HOST` secret, port 2222) and
   runs `git pull` + `systemctl restart pruviq-api`.
3. App listens on `:8080`; verify via `curl https://api.pruviq.com/health`.

Manual retrigger: `gh workflow run deploy-backend.yml --ref main`.

## Sync Check
Compares local git hash with DO server's deployed SHA via
`/health` response (includes `deployed_sha`) to detect drift.
