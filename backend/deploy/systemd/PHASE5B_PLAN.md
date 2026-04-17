# Phase 5-B Plan (Redesigned): Responsibility split

> First draft monolithically ported Mac's `refresh_static.sh` to DO —
> owner pushback: **"뿌리부터 탄탄하게 원론적 해결"**. Redesign below
> separates concerns by the hardware/network constraints of each layer.

## Physical constraints discovered

| Constraint | Verified how | Implication |
|------------|--------------|-------------|
| **Binance 451 from DO** | `curl -I https://api.binance.com/api/v3/ticker/24hr` from 167.172.81.145 (Singapore) → HTTP 451 | DO cannot host `refresh_static.py` / `update_ohlcv.py` — any script touching Binance directly stays on Mac |
| **`/opt/binance-proxy.py` insufficient** | proxy runs on DO itself → outbound still DO IP → binance still 451 | Proxy only defeats OUR KR-based rate limits, not binance's geo block |
| **DO hardware (2vCPU/4GB)** | `indicator_cache.build_multi(572 × 17)` blocked event loop >10 min | Anything CPU-bound at startup must be lazy / capped (see #1082) |
| **Cloudflare deploy** | `wrangler.toml` → Workers Assets. No Pages Git integration. | Some entity must run `npm build + wrangler deploy` — can't rely on "git push auto-deploys" |

## Responsibility split (new)

| Responsibility | Owner | Why here |
|----------------|-------|----------|
| External data fetch (Binance, CoinGecko, news) | **Mac Mini cron** (unchanged) | Binance 451 on DO. Cannot move. |
| OHLCV refresh (572 coins) | **Mac Mini cron** (unchanged) | Same reason. |
| `autotrader trades → performance.json` | **DO systemd** (new) | Source is `/opt/autotrader/` on same DO host. No SSH needed. |
| git commit + push of `public/data/` | **Mac Mini** (who fetches) | Atomicity: commit next to fetch keeps writer single. |
| npm build + `wrangler deploy` | **GitHub Actions** (new, `data-deploy.yml`) | Hermetic CI, secrets stay in GitHub, no Node on DO |
| pruviq-api restart after backend/** merge | **GitHub Actions** (`backend-deploy.yml`, PR #1079 MERGED) | SSH to DO, systemctl restart |

## What changes vs pre-cutover

- **Mac**: keeps Binance-facing cron (physical necessity), **stops running `wrangler deploy`** (moves to CI).
- **DO**: gets autotrader-reading `update-performance` timer, keeps API + Phase 5-A timers.
- **GitHub Actions**: becomes the single build+deploy surface.

## Drafts delivered this session

| File | Status |
|------|--------|
| `bin/refresh-data.sh` | Written, NOT deployed (Binance 451 on DO blocks use) |
| `bin/commit-data.sh` | Written, NOT deployed (needs deploy key) |
| `pruviq-refresh-data.{service,timer}` | Written, NOT deployed |
| `pruviq-commit-data.service` | Written, NOT deployed |
| `.github/workflows/data-deploy.yml` | Written, needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets |

Not blocking on Binance access — these become useful once a CF Workers binance-proxy exists (future work). Today they serve as:
- Documentation of the correct split.
- Template for the `update-performance` unit (which doesn't need Binance).

## What's actually shippable now

**`update-performance`**: reads `/opt/autotrader/logs/trades/*.json` (same host), computes performance.json, commits + pushes. Only blocked on:
- Deploy key registration (trivial, one ssh-keygen + GitHub Settings paste).

That one timer is the only genuine Phase 5-B "Mac → DO" move available today without infra changes.

## Longer-term architectural move

**Cloudflare Workers binance-proxy**:

Deploy a Worker at `binance-proxy.pruviq.com` that forwards to `api.binance.com` / `fapi.binance.com`. CF Worker IPs are not blocked. Then DO (and Mac) can both fetch via the CF proxy, making Mac replaceable for data fetch.

- Effort: ~1 day Worker + testing.
- Benefit: Mac fully replaceable for fetch. Single infra layer.
- Prerequisite: Workers paid plan ($5/mo) to exceed free-tier 100k req/day if fetch rate increases.

## Action items

Blocked on owner:
- [ ] Create `CLOUDFLARE_API_TOKEN` (Workers:Edit scope) + `CLOUDFLARE_ACCOUNT_ID`
- [ ] Add both as GitHub repo secrets (for `data-deploy.yml`)
- [ ] `sudo -u pruviq ssh-keygen -t ed25519 -f /opt/pruviq/.ssh/id_ed25519 -N ""` on DO
- [ ] Register the pubkey in repo Settings → Deploy keys (write access)
- [ ] Decide: accept Mac-for-fetch long term, OR schedule CF Workers binance-proxy work

Shippable without owner input:
- [ ] `bin/update-performance.sh` + unit (once deploy key registered)
- [x] `data-deploy.yml` (already in repo; fires only once CLOUDFLARE_API_TOKEN secret exists)
