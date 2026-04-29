# OKX Broker Support — OAuth Silent Drop Inquiry

> **Internal draft — owner sends from PRUVIQ broker email account.**
> Recipient: Jun Kim (BD contact) + cc: broker@okx.com
> Subject: `[BROKER c12571e26a02OCDE / PRUVIQ] OAuth callback never fires — /account/users silent redirect on all parameter combinations`

---

## Recommended subject line

```
[BROKER c12571e26a02OCDE / PRUVIQ] OAuth callback never fires after authorize — silent /account/users redirect across all parameter variants
```

---

## Email body (English)

Hello OKX Broker team / Jun,

We are PRUVIQ, OAuth-broker `c12571e26a02OCDE` (App ID `dda2405f72ba4581be6aa155ba55b2ffjXhTUnG4`, status: **Active**, level: **Lvl 2 verified**, mode: **OAuth broker**, registered name: PRUVIQ).

Since broker activation, we have been unable to complete a single OAuth flow end-to-end. Our `/auth/okx/callback` endpoint has **never been hit by OKX** — not even once. After several rounds of debugging on our side (detailed below), every parameter combination we have tested results in OKX silently redirecting the user to `https://www.okx.com/account/users` without firing our callback. We need broker-side guidance on what activation step we are missing.

### What we have verified is correct on our end

The OKX broker console at https://www.okx.com/broker?broker-type=2 shows for our app:

| Field | Console value | Our backend value | Match |
|---|---|---|---|
| Application name | `PRUVIQ` | `PRUVIQ` | ✅ |
| Logo | uploaded | — | ✅ |
| Redirect URLs | `https://api.pruviq.com/auth/okx/callback` | `https://api.pruviq.com/auth/okx/callback` | ✅ byte-level |
| OAuth authorized IP | `167.172.81.145` | `167.172.81.145` (DigitalOcean droplet) | ✅ |
| Broker code | `c12571e26a02OCDE` | env `OKX_BROKER_CODE=c12571e26a02OCDE` | ✅ |
| Status | Active + Lvl 2 verified | — | ✅ |

### Symptom

User flow:
1. User visits our authorize URL (built per OKX broker docs §1)
2. Browser → `https://www.okx.com/account/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...&channelId=c12571e26a02OCDE&...`
3. User logs into OKX (or is already logged in)
4. **Expected**: Either the consent page appears (Standard OAuth) OR an automatic 302 to our `redirect_uri` with `?code=...&state=...` (Fast API auto-issue)
5. **Actual**: Browser ends at `https://www.okx.com/account/users` (the user's own OKX accounts page). No callback. No error message. No record on OKX side that anything was attempted.

Our backend journal (`journalctl -u pruviq-api`) shows zero `GET /auth/okx/callback` log entries since broker activation, despite many `GET /auth/okx/start` initiations.

### Parameter variants we tested (all silent-drop identical)

We deployed an experimental endpoint that varies one parameter at a time. The owner-on-record (the same OKX account verified by KYC for this broker registration) hit each variant from a fresh browser session while logged into OKX. **All eight redirected to `/account/users` without firing our callback.**

| # | Variant | Description | Result |
|---|---|---|---|
| 1 | baseline | `scope=fast_api` + PKCE (S256) + `channelId` + `access_type=offline` | `/account/users` |
| 2 | read_only_trade | `scope=read_only,trade` (everything else identical) | `/account/users` |
| 3 | no_channel | drop `channelId` parameter | `/account/users` |
| 4 | no_access_type | drop `access_type=offline` | `/account/users` |
| 5 | add_domain | + `domain=okx.com` | `/account/users` |
| 6 | add_platform | + `platform=web` | `/account/users` |
| 7 | read_only_trade_no_channel | combine #2 and #3 | `/account/users` |
| 8 | no_pkce | strip `code_challenge` + `code_challenge_method` | `/account/users` |

### Sample authorize URL we send (baseline)

```
https://www.okx.com/account/oauth/authorize
  ?client_id=dda2405f72ba4581be6aa155ba55b2ffjXhTUnG4
  &response_type=code
  &access_type=offline
  &redirect_uri=https%3A%2F%2Fapi.pruviq.com%2Fauth%2Fokx%2Fcallback
  &scope=fast_api
  &state=<32B URL-safe random>
  &code_challenge=<base64url SHA256 of verifier>
  &code_challenge_method=S256
  &channelId=c12571e26a02OCDE
```

A reachable test URL is `https://api.pruviq.com/auth/okx/start` (we can re-enable the experimental endpoint upon request).

### Our specific questions

1. **What activation step are we missing?** The console shows our app as Active + Lvl 2 verified. Are there additional broker-side activation steps after the `client_id`/`client_secret` issuance email that are not documented in https://www.okx.com/docs-v5/broker_en/ ?
2. **Is OAuth flow (callback delivery) gated by something invisible in our broker console** — for example, a server-side review state, a permissions toggle, or a sub-account/master-API-key linkage that we cannot see or configure?
3. **Is there a way to view OKX-side request logs for our `client_id`** so we can see how OKX classifies the requests we are sending? OKX docs error code `53017` ("Fast API permissions not enabled — BD must activate") matches our symptom but we have no way to verify whether it is firing.
4. **Should we register a separate "API broker" application** (the dropdown option visible in the broker console alongside "OAuth broker" and "Affiliate") to enable the manual-API-key-paste flow as a parallel path? If so, please confirm broker-tag `c12571e26a02OCDE` will continue to receive commission attribution on orders placed through API-broker users.

### Our fix history (so you can see we have done due diligence)

| PR | What we changed | Outcome |
|---|---|---|
| #1116 | Added `channelId` parameter, corrected token URL to `/v5/users/oauth/token` (without `/api/`) | Token endpoint now reachable |
| #1119 | Switched scope `read_only,trade` → `fast_api` after seeing `/account/users` redirect | Same redirect |
| #1122 | Reverted scope back to `read_only,trade` to attempt consent-page flow | Same redirect |
| #1159 | Final scope decision `fast_api` after 6h debugging session that ruled out client_id, secret, IP, channelId, redirect URI value mismatches | Same redirect |
| #1375 | Added PKCE (S256) per docs "OAuth 2.0 supports authorization code mode and PKCE mode"; added `ip` to `/api/v5/users/oauth/apikey` body to prevent 14d expiry | Same redirect |
| #1379 | Eight-variant A/B test endpoint to isolate the silent-drop trigger | All 8 variants identical `/account/users` |

Test commission/turnover/traders: **0 / 0 / 0** (since broker activation, per console "Data display"). This confirms no end-to-end OAuth has ever completed for our broker.

We are blocked on launch and would appreciate any guidance you can share. Happy to provide additional logs, a live demo, or a video capture of the silent-drop reproduction.

Thanks,
PRUVIQ team

---

## Attachments to include when sending

1. Screenshot of the OKX broker console showing Active + Lvl 2 verified + Redirect URLs + IP whitelist (from `/broker?broker-type=2`)
2. Screenshot of the OAuth permission settings modal (the one with Application name, Logo, Redirect URLs, IP)
3. Optional: short Loom/screen recording showing one variant attempt → `/account/users` final URL

## Send checklist

- [ ] Replace owner contact line if needed
- [ ] Confirm sending from owner's broker-registered OKX email
- [ ] Cc broker@okx.com
- [ ] Cc Jun Kim (BD contact) directly if you have his email
- [ ] Attach 2-3 screenshots above
- [ ] Save sent timestamp here for follow-up tracking: `__________`
