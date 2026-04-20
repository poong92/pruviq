# Cloudflared — Tunnel ingress config

Version-controlled source-of-truth for the `cloudflared` ingress rules
running on DO (`167.172.81.145:2222`). Mirrors the pattern used for
`backend/deploy/alloy/` (Grafana Alloy) — a prod config that lived only
on the box until someone audited it.

## Files

| File | Purpose |
|------|---------|
| `config.yml` | Ingress rules. Deploy to `/etc/cloudflared/config.yml` on DO. |

## What it routes

- `api.pruviq.com` → `http://localhost:8080` (prod, `pruviq-api.service`)
- `staging-api.pruviq.com` → `http://localhost:8081` (staging, `pruviq-api-staging.service`)

## Deploy procedure

**Config file update** (on DO, as root):

```bash
sudo cp /opt/pruviq/current/backend/deploy/cloudflared/config.yml \
        /etc/cloudflared/config.yml
sudo systemctl restart pruviq-cloudflared.service
sudo journalctl -u pruviq-cloudflared -n 30 --no-pager
# Expect "Registered tunnel connection" lines for each connector.
```

**DNS setup** (one-time per new hostname):

Option A — via `cloudflared` CLI on DO (idempotent, recommended):

```bash
cloudflared tunnel route dns \
  a3a723e9-be50-49d8-899b-f8ff41df5104 \
  staging-api.pruviq.com
```

Option B — via Cloudflare dashboard:

1. https://dash.cloudflare.com → pruviq.com → DNS → Records
2. Add CNAME:
   - Name: `staging-api`
   - Target: `a3a723e9-be50-49d8-899b-f8ff41df5104.cfargotunnel.com`
   - Proxy status: **Proxied** (orange cloud) — required for CF Access to intercept

## Access control (for staging)

Staging-api.pruviq.com is protected by Cloudflare Access (Zero Trust).

- Application: `staging-api` (Self-hosted)
- Policy: `staging-allowlist` (Allow, Emails: `jaepoong92@gmail.com`)
- Identity provider: One-time PIN
- Session: 24h

Unauthenticated visitors land on the Zero Trust login page, get a PIN
emailed, then redirect to staging if their email is in the allowlist.

## Verification after deploy

From any machine (not just DO):

```bash
# 1. DNS resolves via tunnel
dig +short staging-api.pruviq.com CNAME
# → ...cfargotunnel.com

# 2. HTTPS lands on Access auth wall (HTTP 200 login page, not the API)
curl -sI https://staging-api.pruviq.com/health
# → Expect redirect/login headers, NOT 200-ok-JSON-from-app

# 3. After logging in via browser, /health should return real JSON.
```

From DO (inside the network, bypassing CF Access):

```bash
curl -sf http://127.0.0.1:8081/health
# → {"status":"ok","version":"0.3.0","coins_loaded":...}
```

## Not in repo (deliberate)

- `/etc/cloudflared/a3a723e9-*.json` — tunnel credentials (secrets). Rotated via
  `cloudflared tunnel create` on DO; not pushed to version control.
- `pruviq-cloudflared.service` — the systemd unit lives at
  `/etc/systemd/system/pruviq-cloudflared.service` on DO. If we ever move
  it to the repo (similar to how `pruviq-api.service` lives under
  `backend/deploy/systemd/`), reference it from here.
