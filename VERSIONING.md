# PRUVIQ Versioning Rules

## Two Independent Version Systems

PRUVIQ has TWO separate version tracks that must never be confused:

### 1. Platform Version (package.json)
- **Current**: `0.3.0`
- **Format**: `0.MAJOR.MINOR` (pre-launch SemVer)
- **Scope**: Website features, UI, simulator, API, infrastructure

#### When to bump
| Change Type | Example | Bump |
|-------------|---------|------|
| New feature set | Simulator v1.0, Market Dashboard | MAJOR (0.X.0) |
| Fix, refinement, content | TS fix, color change, i18n | MINOR (0.x.X) |
| Static data refresh (cron) | "chore: static data refresh" | NEVER |
| Dependency update | Astro 5.17→5.18 | MINOR (0.x.X) |

#### Git tag rules
- Tag **only** on MAJOR bumps: `v0.3.0`, `v0.4.0`, ...
- Never tag on MINOR bumps or cron commits
- Tag format: `vX.Y.Z` matching package.json exactly
- Command: `npm version minor` → auto-creates tag + commit

#### Pre-launch → Launch
- `0.x.x` = pre-launch (current)
- `1.0.0` = first public launch (Product Hunt, etc.)
- After 1.0: standard SemVer (MAJOR.MINOR.PATCH)

### 2. Trading Strategy Version (changelog content)
- **Current**: `v1.7.0` (BB Squeeze SHORT)
- **Managed in**: AutoTrader repo (`~/Desktop/autotrader`)
- **Displayed on**: `/changelog` and `/ko/changelog` pages
- **Scope**: Trading parameters, strategy logic, risk management

This version is **content only** — PRUVIQ just displays it.
Do NOT confuse with platform version.

## Rules

1. **Never bump platform version for strategy changes**
2. **Never bump platform version for cron commits**
3. **Always update VERSIONING.md when version changes**
4. **Never use internal component version comments** (use git blame)
5. **Changelog page must label versions as "Trading System"**
