# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in PRUVIQ, please report it
**privately** — **do not open a public GitHub issue.**

**Preferred:** email `contact@pruviq.com` with:
- A description of the issue and its potential impact
- Steps to reproduce (minimum viable PoC is appreciated)
- Your suggested severity (CVSS or informal)
- Whether you want public credit after disclosure

You should receive acknowledgement within **3 business days** (usually
sooner). We will work with you on a coordinated disclosure timeline —
typically 30–90 days depending on severity and fix complexity.

## Scope

In scope:
- `pruviq.com` (Cloudflare Pages)
- `api.pruviq.com` (FastAPI backend on DigitalOcean)
- OKX OAuth and auto-trading integration
- The code in this repository

Out of scope:
- Social engineering of PRUVIQ staff
- Physical attacks against infrastructure
- Denial-of-service attacks (please use rate-limited traffic during testing)
- Issues in third-party services (OKX, Cloudflare, Backblaze, Grafana
  Cloud) — please report directly to the affected vendor
- Findings on `disabled/` or explicitly archived code paths

## Safe harbor

We will not pursue legal action against researchers who:
1. Make a good-faith effort to avoid privacy violations and service
   disruption
2. Give us reasonable time to investigate and fix before public
   disclosure
3. Do not exfiltrate data beyond what's needed to demonstrate the issue
4. Do not access, modify, or destroy other users' data

## Supported versions

We actively maintain only the `main` branch. Fixes are not backported.

## Known trade-offs (for triage)

Some behaviours are intentional and not security issues:
- **OKX broker code `c12571e26a02OCDE` is public** — it's an affiliate
  tracking identifier; public exposure credits PRUVIQ for trades made
  with it, which is the intended economic model.
- **Backend server IP appears in some configs** — the IP is also
  resolvable via `api.pruviq.com` DNS; our defence relies on `ufw` +
  `fail2ban` + key-only SSH, not IP obscurity.
- **SHA-1 in `clOrdId` hashing** — deterministic transaction IDs for
  OKX idempotency, not a cryptographic security primitive.
- **Merkle audit log publishes only the daily root**, not individual
  leaves — users keep their own pre-image to verify inclusion. This is
  by design (Moat-2).

## Our promise

- We read every report.
- We respond within 3 business days.
- We credit researchers publicly (unless they opt out) once the fix ships.
- We do not pursue reporters acting in good faith.
